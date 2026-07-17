import { Router } from "express";
import bcrypt from "bcryptjs";
import { firestore, docToObj, snapshotToArr } from "@workspace/db";
import { signToken, requireAuth } from "../lib/auth.js";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
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
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
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
    res.json({ id: found.id, email: found.email, name: found.name, role: found.role, createdAt: found.createdAt });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
