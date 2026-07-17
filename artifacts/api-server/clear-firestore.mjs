/**
 * Clears all documents from every known Firestore collection so the seed re-runs fresh.
 * Run with: node --import tsx/esm clear-firestore.mjs  (from this directory)
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!saJson) { console.error("FIREBASE_SERVICE_ACCOUNT_JSON not set"); process.exit(1); }

const parsed = JSON.parse(saJson);
if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");

const app = initializeApp({ credential: cert(parsed) });
const dbId = process.env.FIRESTORE_DATABASE_ID ?? "(default)";
const db = getFirestore(app, dbId);

const COLLECTIONS = [
  "users", "boards", "standards", "subjects", "chapters", "topics",
  "questions", "questionTypes", "aiProviders", "generationJobs",
  "papers", "analytics", "_counters",
];

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) { console.log(`  ${name}: empty`); return; }
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  ${name}: deleted ${snap.size} docs`);
}

console.log(`Clearing Firestore database "${dbId}"...`);
for (const col of COLLECTIONS) await deleteCollection(col);
console.log("Done — restart the API server to re-seed.");
process.exit(0);
