import { onRequest } from "firebase-functions/v2/https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Smart Self-Contained Database Setup for Firebase Cloud Functions
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "./yunora.db" || process.env.DATABASE_URL.endsWith("yunora.db")) {
  const srcDbPath = path.resolve(__dirname, "../yunora.db");
  const tmpDbPath = "/tmp/yunora.db";

  try {
    // Copy the seed/base database from the deployment bundle to writeable /tmp storage
    if (fs.existsSync(srcDbPath)) {
      if (!fs.existsSync(tmpDbPath)) {
        fs.copyFileSync(srcDbPath, tmpDbPath);
        console.log("Successfully copied SQLite database to writeable /tmp/yunora.db");
      }
    } else {
      console.warn("Base database not found in deployment bundle at:", srcDbPath);
    }
  } catch (err) {
    console.error("Failed to copy SQLite database to /tmp:", err);
  }

  // Force the database connection to use the writeable temp path
  process.env.DATABASE_URL = tmpDbPath;
}

// Now we can safely import our app, database, and start seeding
import app from "./app.js";
import { runSeed } from "./lib/seed.js";

let seeded = false;
const seedPromise = runSeed()
  .then(() => {
    seeded = true;
  })
  .catch((err) => {
    console.error("Firebase startup seed failed:", err);
  });

export const api = onRequest(
  {
    cors: true,
    timeoutSeconds: 300, // 5 minutes (important for long-running AI pipelines)
    memory: "1GiB",      // 1GB RAM (ensures fast generation and plenty of headroom)
    region: "asia-south1", // Cloud Build in asia-south1 works; us-central1 has a broken npm
  },
  async (req, res) => {
    if (!seeded) {
      await seedPromise;
    }
    return app(req, res);
  }
);
