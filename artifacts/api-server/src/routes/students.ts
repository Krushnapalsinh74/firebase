import { Router } from "express";
import { firestore, nextId, docToObj, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { getAuth } from "firebase-admin/auth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

// ── GET /students — list all users from Firebase Auth + enrich with Firestore ─
router.get("/students", requireAuth, async (req, res) => {
  try {
    // 1. Pull ALL users from Firebase Auth (the real source of truth)
    const authUsers: any[] = [];
    let pageToken: string | undefined;
    do {
      const result = await getAuth().listUsers(1000, pageToken);
      authUsers.push(...result.users);
      pageToken = result.pageToken;
    } while (pageToken);

    // 2. Pull Firestore profiles for extra fields (name, board, etc.)
    const usersSnap = await firestore.collection("users").get();
    const firestoreByEmail: Record<string, any> = {};
    const firestoreByPhone: Record<string, any> = {};
    usersSnap.docs.forEach(d => {
      const data = { id: d.id, ...d.data() } as any;
      if (data.email) firestoreByEmail[data.email] = data;
      const phone = data.phone || data.phoneNumber;
      if (phone) firestoreByPhone[phone] = data;
    });

    // 3. Pull user_plans + plans for subscription info
    const userPlansSnap = await firestore.collection("user_plans").get();
    const userPlans = userPlansSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const plansSnap = await firestore.collection("plans").get();
    const plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    // Admin emails to exclude from student list
    const ADMIN_EMAILS = new Set(["admin@yunora.ai", "admin@kpark.com", "admin@yunora.edu"]);

    // 4. Merge Firebase Auth + Firestore + plan data
    const result = authUsers
      .filter(u => !ADMIN_EMAILS.has(u.email || ""))
      .map(authUser => {
        const profile =
          firestoreByEmail[authUser.email || ""] ||
          firestoreByPhone[authUser.phoneNumber || ""] ||
          null;

        const uid = authUser.uid;
        const uplan = userPlans.find(up =>
          String(up.userId) === String(profile?.id) || String(up.uid) === uid
        );

        let planName: string | null = null;
        let questionsUsed = 0;
        if (uplan) {
          questionsUsed = uplan.questionsUsed || 0;
          const plan = plans.find(p => String(p.id) === String(uplan.planId));
          if (plan) planName = (plan as any).name;
        }

        const name =
          profile?.name ||
          authUser.displayName ||
          authUser.email ||
          authUser.phoneNumber ||
          "Unknown";

        return {
          id: profile?.id || uid,
          uid,
          email: authUser.email || profile?.email || null,
          phone: authUser.phoneNumber || profile?.phone || null,
          name,
          role: profile?.role || "student",
          isActive: !authUser.disabled,
          provider: authUser.providerData?.[0]?.providerId || "unknown",
          createdAt: authUser.metadata?.creationTime || new Date().toISOString(),
          lastSignIn: authUser.metadata?.lastSignInTime || null,
          planName,
          questionsUsed,
        };
      })
      // Sort newest first
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ data: result });
  } catch (err) {
    req.log.error({ err }, "List students error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /students/register — register a new student with a plan ──────────────
router.post("/students/register", async (req, res) => {
  try {
    const { name, email, password, planId } = req.body;

    if (!name || !email || !password || !planId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const usersSnap = await firestore.collection("users").where("email", "==", email).limit(1).get();
    if (!usersSnap.empty) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    const planDoc = await firestore.collection("plans").doc(String(planId)).get();
    const plan = docToObj(planDoc);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await nextId("users");
    const now = nowTs();
    await firestore.collection("users").doc(String(userId)).set({
      id: userId, email, name, passwordHash,
      role: "student", isActive: true,
      createdAt: now, updatedAt: now,
    });

    const userPlanId = await nextId("user_plans");
    await firestore.collection("user_plans").doc(String(userPlanId)).set({
      id: userPlanId, userId, planId,
      questionsUsed: 0, isActive: true,
      createdAt: now, updatedAt: now,
    });

    const jwtSecret = process.env.JWT_SECRET || "fallback_secret";
    const token = jwt.sign({ id: userId, email, role: "student" }, jwtSecret, { expiresIn: "7d" });

    res.status(201).json({
      user: { id: userId, email, name, role: "student", createdAt: now.toDate().toISOString() },
      token,
      order: { id: "mock_order_for_registration", amount: Number(plan.price || 0), currency: "INR" }
    });
  } catch (err) {
    req.log.error({ err }, "Error registering student");
    res.status(500).json({ error: "Failed to register student" });
  }
});

export const studentsRouter = router;
