/**
 * Updates the admin user email from admin@yunora.ai to admin@kpark.com
 * and sets the password to admin123.
 * Run: node artifacts/api-server/update-admin.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import bcrypt from "bcryptjs";

// Load credentials
const raw = readFileSync("./kpark-edu-firebase-adminsdk-fbsvc-465cb297c2.json", "utf-8");
const parsed = JSON.parse(raw);
if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");

const app = initializeApp({ credential: cert(parsed) });
const db = getFirestore(app, "kp73");

const OLD_EMAIL = "admin@yunora.ai";
const NEW_EMAIL = "admin@kpark.com";
const NEW_PASSWORD = "admin123";

async function run() {
  // Find old admin user
  const snap = await db.collection("users").where("email", "==", OLD_EMAIL).limit(1).get();

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

  if (!snap.empty) {
    // Update existing
    const doc = snap.docs[0];
    await doc.ref.update({
      email: NEW_EMAIL,
      passwordHash,
      updatedAt: Date.now(),
    });
    console.log(`✅ Updated admin: ${OLD_EMAIL} → ${NEW_EMAIL}`);
  } else {
    // Check if new email already exists
    const existing = await db.collection("users").where("email", "==", NEW_EMAIL).limit(1).get();
    if (!existing.empty) {
      // Just update the password hash
      await existing.docs[0].ref.update({ passwordHash, updatedAt: Date.now() });
      console.log(`✅ admin@kpark.com already exists — password reset to admin123`);
    } else {
      // Create fresh admin
      const countDoc = await db.collection("_counters").doc("users").get();
      const id = (countDoc.exists ? (countDoc.data().value || 0) : 0) + 1;
      await db.collection("_counters").doc("users").set({ value: id });
      await db.collection("users").doc(String(id)).set({
        id, email: NEW_EMAIL, name: "Knowledge Park Admin",
        passwordHash, role: "admin", isActive: true,
        createdAt: Date.now(), updatedAt: Date.now(),
      });
      console.log(`✅ Created new admin: ${NEW_EMAIL}`);
    }
  }

  console.log("\nCredentials for Razorpay submission:");
  console.log(`  Email   : ${NEW_EMAIL}`);
  console.log(`  Password: ${NEW_PASSWORD}`);
  console.log("\nDone!");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
