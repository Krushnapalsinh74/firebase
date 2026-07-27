import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, planId } = req.body;

    if (!name || !email || !password || !planId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Check if user exists
    const usersSnap = await firestore.collection("users").where("email", "==", email).limit(1).get();
    if (!usersSnap.empty) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    // Check if plan exists
    const planDoc = await firestore.collection("plans").doc(String(planId)).get();
    const plan = docToObj(planDoc);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (student role)
    const userId = await nextId("users");
    const now = nowTs();
    const userData = {
      id: userId,
      email,
      name,
      passwordHash,
      role: "viewer", // or student
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await firestore.collection("users").doc(String(userId)).set(userData);

    // Create user plan
    const userPlanId = await nextId("user_plans");
    await firestore.collection("user_plans").doc(String(userPlanId)).set({
      id: userPlanId,
      userId,
      planId,
      questionsUsed: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Generate token
    const jwtSecret = process.env.JWT_SECRET || "fallback_secret";
    const token = jwt.sign(
      { id: userId, email, role: "viewer" },
      jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      user: {
        id: userId,
        email,
        name,
        role: "viewer",
        createdAt: now.toDate().toISOString(),
      },
      token,
      order: {
        id: "mock_order_for_registration",
        amount: Number(plan.price || 0),
        currency: "INR"
      }
    });
  } catch (err) {
    req.log.error({ err }, "Error registering student");
    res.status(500).json({ error: "Failed to register student" });
  }
});

export const studentsRouter = router;
