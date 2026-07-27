import { Router } from "express";
import { firestore, snapshotToArr } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/export", requireAuth, async (req, res) => {
  try {
    const [
      boardsSnap,
      standardsSnap,
      subjectsSnap,
      chaptersSnap,
      topicsSnap,
      questionsSnap
    ] = await Promise.all([
      firestore.collection("boards").get(),
      firestore.collection("standards").get(),
      firestore.collection("subjects").get(),
      firestore.collection("chapters").get(),
      firestore.collection("topics").get(),
      firestore.collection("questions").get()
    ]);

    const data = {
      boards: snapshotToArr(boardsSnap),
      standards: snapshotToArr(standardsSnap),
      subjects: snapshotToArr(subjectsSnap),
      chapters: snapshotToArr(chaptersSnap),
      topics: snapshotToArr(topicsSnap),
      questions: snapshotToArr(questionsSnap)
    };

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Export all data error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
