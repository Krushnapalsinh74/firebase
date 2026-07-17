import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/papers", requireAuth, async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    const snap = await firestore.collection("papers").orderBy("createdAt", "desc").get();
    const papers = snapshotToArr(snap);
    const total = papers.length;
    const page_papers = papers.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({ data: page_papers, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List papers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/papers", requireAuth, async (req, res) => {
  try {
    const { title, institutionName, questionIds, includeAnswerKey = true, includeExplanations = false } = req.body as {
      title: string;
      institutionName?: string;
      questionIds: number[];
      includeAnswerKey?: boolean;
      includeExplanations?: boolean;
    };

    if (!questionIds || questionIds.length === 0) {
      res.status(400).json({ error: "At least one question ID required" });
      return;
    }

    // Fetch questions to verify they exist
    const questionDocs = await Promise.all(
      questionIds.map((qid) => firestore.collection("questions").doc(String(qid)).get())
    );
    const questions = questionDocs.filter((d) => d.exists).map((d) => d.data() as any);
    if (questions.length === 0) {
      res.status(400).json({ error: "No valid questions found" });
      return;
    }

    const firstQ = questions[0];
    const id = await nextId("papers");
    const now = nowTs();
    const data = {
      id, title,
      institutionName: institutionName ?? null,
      totalQuestions: questions.length,
      subjectName: firstQ?.subjectId ? String(firstQ.subjectId) : null,
      boardName: firstQ?.boardId ? String(firstQ.boardId) : null,
      standardName: firstQ?.standardId ? String(firstQ.standardId) : null,
      includeAnswerKey, includeExplanations,
      questionIds,   // stored as array (not JSON string)
      pdfUrl: null,
      createdAt: now,
    };
    await firestore.collection("papers").doc(String(id)).set(data);
    res.status(201).json({ ...data, createdAt: now.toDate().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Create paper error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/papers/:id/export", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const ref = firestore.collection("papers").doc(String(id));
    const doc = await ref.get();
    if (!doc.exists) { res.status(404).json({ error: "Paper not found" }); return; }

    const pdfUrl = `/api/papers/${id}/download`;
    await ref.update({ pdfUrl });

    res.json({ success: true, downloadUrl: pdfUrl, expiresAt: null });
  } catch (err) {
    req.log.error({ err }, "Export paper error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
