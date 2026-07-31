import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import bcrypt from "bcryptjs";

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
let credential;
if (saJson) {
  const parsed = JSON.parse(saJson);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  credential = cert(parsed);
} else {
  // fall back to the committed key file
  const raw = readFileSync("../../kpark-edu-firebase-adminsdk-fbsvc-465cb297c2.json", "utf-8");
  const parsed = JSON.parse(raw);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  credential = cert(parsed);
}

const app = initializeApp({ credential });
const dbId = process.env.FIRESTORE_DATABASE_ID || "kp73"; // use kp73 based on firebase.json
const db = getFirestore(app, dbId);

async function nextId(collectionName) {
  const docRef = db.collection("_counters").doc(collectionName);
  const snap = await docRef.get();
  if (snap.exists) {
    const data = snap.data();
    const newValue = (data.value || 0) + 1;
    await docRef.update({ value: newValue });
    return newValue;
  }
  await docRef.set({ value: 1 });
  return 1;
}

async function run() {
  const email = "razorpay@yunora.ai";
  const password = "Razorpay123!";
  
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) {
    console.log("Creating Razorpay test user...");
    const passwordHash = await bcrypt.hash(password, 10);
    const id = await nextId("users");
    const now = db.doc("users/dummy").firestore.FieldValue.serverTimestamp; // use firestore timestamp or just Date.now
    
    await db.collection("users").doc(String(id)).set({
      id, email, name: "Razorpay Test",
      passwordHash, role: "student", isActive: true,
      createdAt: Date.now(), updatedAt: Date.now()
    });
    console.log(`Created user ${email} with password ${password}`);
  } else {
    console.log(`User ${email} already exists.`);
  }

  // Seed plans if none exist
  const plansSnap = await db.collection("plans").limit(1).get();
  if (plansSnap.empty) {
    console.log("Seeding test plans...");
    const planId = await nextId("plans");
    await db.collection("plans").doc(String(planId)).set({
      id: planId,
      name: "Standard Plan",
      price: 499,
      questionLimit: 100,
      accessScope: "all",
      durationDays: 30,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    console.log("Seeded 'Standard Plan' for ₹499");
  } else {
    console.log("Plans already exist in DB.");
  }

  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
