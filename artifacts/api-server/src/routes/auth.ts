import { Router } from "express";
import bcrypt from "bcryptjs";
import { firestore, docToObj, nextId, nowTs } from "@workspace/db";
import { signToken, requireAuth } from "../lib/auth.js";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Check if test account matches settings
    try {
      const paymentSettingsSnap = await firestore.collection("settings").doc("payment").get();
      if (paymentSettingsSnap.exists) {
        const pData = paymentSettingsSnap.data() as any;
        if (
          pData?.testAccountEmail &&
          pData?.testAccountPassword &&
          email.toLowerCase().trim() === pData.testAccountEmail.toLowerCase().trim() &&
          password === pData.testAccountPassword
        ) {
          // Find or create test account user
          let testUserSnap = await firestore.collection("users").where("email", "==", email.trim()).limit(1).get();
          let testUser: any;
          if (testUserSnap.empty) {
            const newId = await nextId("users");
            const now = nowTs();
            testUser = {
              id: newId,
              email: email.trim(),
              name: "Test Account",
              role: "admin",
              isActive: true,
              createdAt: now,
              updatedAt: now,
            };
            await firestore.collection("users").doc(String(newId)).set(testUser);
          } else {
            testUser = docToObj(testUserSnap.docs[0]);
          }

          const token = signToken({ userId: testUser.id, email: testUser.email, role: testUser.role || "admin" });
          res.json({
            token,
            user: { id: testUser.id, email: testUser.email, name: testUser.name, role: testUser.role || "admin", createdAt: testUser.createdAt },
          });
          return;
        }
      }
    } catch (e) {
      // Continue normal login flow
    }

    const snap = await firestore.collection("users").where("email", "==", email).limit(1).get();
    if (snap.empty) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const user = docToObj(snap.docs[0]!) as any;
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    void import("../lib/audit.js").then(({ logActivity }) => {
      logActivity({
        userId: user.id,
        userName: user.name || user.email,
        userEmail: user.email,
        userRole: user.role,
        action: "LOGIN",
        resource: "auth",
        details: { email: user.email, role: user.role },
        ipAddress: req.ip,
      });
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    req.log?.error?.({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user as { userId: number };
    const doc = await firestore.collection("users").doc(String(user.userId)).get();
    const found = docToObj(doc);
    if (!found) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: found.id,
      email: found.email,
      name: found.name,
      role: found.role,
      permissions: Array.isArray(found.permissions) ? found.permissions : [],
      createdAt: found.createdAt,
    });
  } catch (err) {
    req.log?.error?.({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
