// Firestore-backed data layer.
// Replaces the previous Drizzle/libsql implementation.
export {
  firestore,
  nextId,
  nextNIds,
  docToObj,
  snapshotToArr,
  normalizeTimestamps,
  nowTs,
  toTs,
  Timestamp,
  FieldValue,
} from "./firestore.js";
