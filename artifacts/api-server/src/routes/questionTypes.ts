import { Router } from "express";
import { firestore, snapshotToArr } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/question-types", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("questionTypes").orderBy("name").get();
    res.json(snapshotToArr(snap));
  } catch (err) {
    req.log.error({ err }, "List question types error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
