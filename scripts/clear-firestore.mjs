/**
 * Clears all documents from every known collection in the named Firestore database,
 * so the seed can re-populate fresh data on the next server start.
 *
 * Usage: node scripts/clear-firestore.mjs
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON and FIRESTORE_DATABASE_ID env vars.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
let credential;
if (saJson) {
  const parsed = JSON.parse(saJson);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  credential = cert(parsed);
} else {
  // fall back to the committed key file
  const raw = readFileSync("/home/runner/workspace/kpark-edu-firebase-adminsdk-fbsvc-465cb297c2.json", "utf-8");
  const parsed = JSON.parse(raw);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  credential = cert(parsed);
}

const app = initializeApp({ credential });
const dbId = process.env.FIRESTORE_DATABASE_ID || "(default)";
const db = getFirestore(app, dbId);

const COLLECTIONS = [
  "users", "boards", "standards", "subjects", "chapters", "topics",
  "questions", "questionTypes", "aiProviders", "generationJobs",
  "papers", "analytics", "_counters",
];

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) { console.log(`  ${name}: empty, skipping`); return; }
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  ${name}: deleted ${snap.size} docs`);
}

console.log(`Clearing Firestore database "${dbId}"...`);
for (const col of COLLECTIONS) {
  await deleteCollection(col);
}
console.log("Done. Restart the API server to re-seed.");
process.exit(0);
