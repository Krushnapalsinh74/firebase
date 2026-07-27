import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    // Get all users who are not admins (or specifically 'viewer'/'student')
    const usersSnap = await firestore.collection("users").where("role", "==", "viewer").get();
    let students = snapshotToArr(usersSnap) as any[];

    // Fetch user_plans and plans to enrich data
    const userPlansSnap = await firestore.collection("user_plans").get();
    const userPlans = snapshotToArr(userPlansSnap) as any[];

    const plansSnap = await firestore.collection("plans").get();
    const plans = snapshotToArr(plansSnap) as any[];

    const result = students.map(student => {
      const uplan = userPlans.find(up => String(up.userId) === String(student.id));
      let planName: string | null = null;
      let planId: string | number | null = null;
      let questionsUsed = 0;
      
      if (uplan) {
        planId = uplan.planId;
        questionsUsed = uplan.questionsUsed || 0;
        const plan = plans.find(p => String(p.id) === String(planId));
        if (plan) planName = plan.name;
      }

      return {
        id: student.id,
        email: student.email,
        name: student.name,
        role: student.role,
        isActive: student.isActive,
        createdAt: student.createdAt?.toDate?.()?.toISOString() || student.createdAt,
        planId,
        planName,
        questionsUsed,
      };
    });

    res.json({ data: result });
  } catch (err) {
    req.log.error({ err }, "List students error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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
