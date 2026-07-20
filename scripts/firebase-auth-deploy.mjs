#!/usr/bin/env node
/**
 * Firebase deploy helper for Replit.
 * The Replit system clock runs ~9 min fast, causing invalid_grant JWT errors.
 * This script:
 *  1. Fetches real UTC time from an HTTP API
 *  2. Generates a service-account JWT with corrected iat/exp
 *  3. Exchanges it for a Google OAuth access token
 *  4. Writes the token into Firebase CLI's config store
 *  5. Exec's `firebase deploy` so it finds a valid cached token
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = resolve(__dirname, "../kpark-edu-firebase-adminsdk-fbsvc-465cb297c2.json");
const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));

// ── 1. Get real UTC epoch (seconds) ──────────────────────────────────────────
async function getRealTime() {
  const res = await fetch("https://timeapi.io/api/time/current/zone?timeZone=UTC");
  const data = await res.json();
  // data.dateTime: "2026-07-20T08:47:44.225..."
  return Math.floor(new Date(data.dateTime).getTime() / 1000);
}

// ── 2. Build + sign a JWT for the Google token endpoint ──────────────────────
function makeJwt(nowSec) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  })).toString("base64url");

  const unsigned = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(sa.private_key, "base64url");
  return `${unsigned}.${signature}`;
}

// ── 3. Exchange JWT for access token ─────────────────────────────────────────
async function getAccessToken(jwt) {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error("Token exchange failed:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data.access_token;
}

// ── 4. Write token into Firebase CLI configstore ─────────────────────────────
function writeFirebaseConfig(accessToken) {
  const configDir = resolve(os.homedir(), ".config", "configstore");
  mkdirSync(configDir, { recursive: true });
  const configPath = resolve(configDir, "firebase-tools.json");

  // Firebase CLI checks tokens.access_token and uses it if present + non-expired.
  // We set a far-future expiry so it never tries to refresh during the deploy.
  const config = {
    tokens: {
      access_token: accessToken,
      expires_at: Date.now() + 3600 * 1000,
    },
    activeProjects: { default: "kpark-edu" },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✓ Firebase CLI credentials written");
}

// ── 5. Run firebase deploy ────────────────────────────────────────────────────
async function main() {
  console.log("Fetching real UTC time...");
  const nowSec = await getRealTime();
  console.log("Real time (epoch):", nowSec, "→", new Date(nowSec * 1000).toISOString());

  console.log("Generating JWT...");
  const jwt = makeJwt(nowSec);

  console.log("Exchanging JWT for access token...");
  const accessToken = await getAccessToken(jwt);
  console.log("✓ Got access token");

  writeFirebaseConfig(accessToken);

  console.log("\nRunning firebase deploy...\n");
  execSync("firebase deploy --project kpark-edu", {
    stdio: "inherit",
    cwd: resolve(__dirname, ".."),
    env: { ...process.env, FIREBASE_CLI_EXPERIMENTS: "webframeworks" },
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
