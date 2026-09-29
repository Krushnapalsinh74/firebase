import { Router } from "express";
import { firestore, snapshotToArr } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/activity-logs", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user;
    if (caller.role !== "admin" && caller.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied. Only Super Admin can view activity logs." });
    }

    const { limit = "100", action, userId } = req.query as Record<string, string>;

    let query: FirebaseFirestore.Query = firestore.collection("activityLogs");

    if (action) {
      query = query.where("action", "==", action);
    }
    if (userId) {
      query = query.where("userId", "==", Number(userId));
    }

    const snap = await query.get();
    let logs = snapshotToArr(snap) as any[];

    // Sort newest first
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const limitNum = Math.min(200, parseInt(limit) || 100);
    const paged = logs.slice(0, limitNum);

    res.json({ logs: paged, total: logs.length });
  } catch (err: any) {
    req.log?.error?.({ err }, "Get activity logs error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
