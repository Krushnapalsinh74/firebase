import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK.
// Cloud Functions: auto-authenticates via the runtime service account (no config needed).
// Local dev / Replit: set FIREBASE_SERVICE_ACCOUNT_JSON secret to the full contents of a
//                     Firebase service account key JSON file.
//                     Alternatively, GOOGLE_APPLICATION_CREDENTIALS may point to such a file.
if (!getApps().length) {
  const saJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (saJson) {
    const parsed = JSON.parse(saJson);
    // The private_key may arrive with literal \n instead of real newlines when
    // copy-pasted into a secrets form. Fix it so the RSA key is valid.
    if (parsed.private_key && typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    initializeApp({ credential: cert(parsed) });
  } else {
    // Fall back to ADC (covers GOOGLE_APPLICATION_CREDENTIALS and Cloud Functions runtime).
    initializeApp();
  }
}

export const firestore = getFirestore();
export { Timestamp, FieldValue };

// ─── Auto-increment helpers ───────────────────────────────────────────────────

/** Atomically reserves the next integer ID for a collection. */
export async function nextId(collection: string): Promise<number> {
  const ref = firestore.collection("_counters").doc(collection);
  return firestore.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const next = ((doc.data()?.value ?? 0) as number) + 1;
    t.set(ref, { value: next });
    return next;
  });
}

/**
 * Atomically reserves a block of consecutive integer IDs.
 * Returns an array of `count` consecutive integers starting from the next available ID.
 */
export async function nextNIds(collection: string, count: number): Promise<number[]> {
  if (count === 0) return [];
  const ref = firestore.collection("_counters").doc(collection);
  const start = await firestore.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const current = (doc.data()?.value ?? 0) as number;
    t.set(ref, { value: current + count });
    return current + 1;
  });
  return Array.from({ length: count }, (_, i) => start + i);
}

// ─── Document conversion helpers ─────────────────────────────────────────────

/** Converts a Firestore Timestamp (or any toDate-able) to ISO string. */
function normalizeValue(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v && typeof v === "object" && typeof (v as any).toDate === "function") {
    return (v as any).toDate().toISOString();
  }
  return v;
}

/** Recursively normalize timestamps in a plain object. */
export function normalizeTimestamps(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = normalizeValue(v);
  }
  return out;
}

/**
 * Converts a Firestore DocumentSnapshot to a plain JS object.
 * The document ID is parsed as an integer if numeric, otherwise kept as a string.
 */
export function docToObj(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> | null {
  if (!doc.exists) return null;
  const rawId = doc.id;
  const id = /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId;
  return normalizeTimestamps({ id, ...(doc.data() as Record<string, unknown>) });
}

/** Converts a QuerySnapshot to an array of plain objects. */
export function snapshotToArr(snap: FirebaseFirestore.QuerySnapshot): Record<string, unknown>[] {
  return snap.docs.map((d) => docToObj(d)!);
}

/** Returns a Firestore Timestamp for right now. */
export function nowTs(): Timestamp {
  return Timestamp.now();
}

/** Converts a JS Date or ISO string to a Firestore Timestamp. */
export function toTs(d: Date | string): Timestamp {
  const date = d instanceof Date ? d : new Date(d);
  return Timestamp.fromDate(date);
}
