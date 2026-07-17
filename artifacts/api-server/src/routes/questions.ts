import { Router } from "express";
import { firestore, docToObj, snapshotToArr, nowTs, toTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

async function enrichQuestion(q: Record<string, any>) {
  const [topicDoc, chapterDoc, subjectDoc, boardDoc, standardDoc] = await Promise.all([
    q.topicId   ? firestore.collection("topics").doc(String(q.topicId)).get()     : Promise.resolve(null),
    q.chapterId ? firestore.collection("chapters").doc(String(q.chapterId)).get() : Promise.resolve(null),
    q.subjectId ? firestore.collection("subjects").doc(String(q.subjectId)).get() : Promise.resolve(null),
    q.boardId   ? firestore.collection("boards").doc(String(q.boardId)).get()     : Promise.resolve(null),
    q.standardId? firestore.collection("standards").doc(String(q.standardId)).get(): Promise.resolve(null),
  ]);
  return {
    ...q,
    topicName:    topicDoc?.exists    ? topicDoc.data()?.name    ?? null : null,
    chapterName:  chapterDoc?.exists  ? chapterDoc.data()?.name  ?? null : null,
    subjectName:  subjectDoc?.exists  ? subjectDoc.data()?.name  ?? null : null,
    boardName:    boardDoc?.exists    ? boardDoc.data()?.name    ?? null : null,
    standardName: standardDoc?.exists ? standardDoc.data()?.name ?? null : null,
  };
}

router.get("/questions", requireAuth, async (req, res) => {
  try {
    const { page = "1", limit = "50", search, boardId, standardId, subjectId, chapterId, topicId, difficulty, questionType, model, dateFrom, dateTo } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));

    // Use the most selective equality filter as the Firestore query anchor,
    // then filter the rest in JS to avoid composite index requirements.
    let query: FirebaseFirestore.Query = firestore.collection("questions");
    if (topicId)      query = query.where("topicId",      "==", parseInt(topicId));
    else if (chapterId) query = query.where("chapterId",  "==", parseInt(chapterId));
    else if (subjectId) query = query.where("subjectId",  "==", parseInt(subjectId));
    else if (boardId)   query = query.where("boardId",    "==", parseInt(boardId));

    query = query.orderBy("generatedAt");
    const snap = await query.get();
    let questions = snapshotToArr(snap) as any[];

    // JS-side filters for remaining conditions
    if (boardId && !topicId && !chapterId && !subjectId) { /* already filtered */ }
    if (standardId) questions = questions.filter((q) => q.standardId === parseInt(standardId));
    if (difficulty)   questions = questions.filter((q) => q.difficulty   === difficulty);
    if (questionType) questions = questions.filter((q) => q.questionType === questionType);
    if (model)        questions = questions.filter((q) => q.modelUsed     === model);
    if (search) {
      const sq = search.toLowerCase();
      questions = questions.filter((q) => q.question?.toLowerCase().includes(sq));
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      questions = questions.filter((q) => {
        const d = q.generatedAt ? new Date(q.generatedAt).getTime() : 0;
        return d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      questions = questions.filter((q) => {
        const d = q.generatedAt ? new Date(q.generatedAt).getTime() : Infinity;
        return d <= to;
      });
    }

    const total = questions.length;
    const page_questions = questions.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    const enriched = await Promise.all(page_questions.map(enrichQuestion));

    res.json({ data: enriched, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List questions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/questions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const doc = await firestore.collection("questions").doc(String(id)).get();
    const q = docToObj(doc);
    if (!q) { res.status(404).json({ error: "Question not found" }); return; }
    res.json(await enrichQuestion(q));
  } catch (err) {
    req.log.error({ err }, "Get question error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/questions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { question, correctAnswer, options, explanation, difficulty, difficultyScore, learningObjective } = req.body;
    const ref = firestore.collection("questions").doc(String(id));
    if (!(await ref.get()).exists) { res.status(404).json({ error: "Question not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (question !== undefined)          updates["question"]          = question;
    if (correctAnswer !== undefined)     updates["correctAnswer"]     = correctAnswer;
    if (options !== undefined)           updates["options"]           = options;
    if (explanation !== undefined)       updates["explanation"]       = explanation;
    if (difficulty !== undefined)        updates["difficulty"]        = difficulty;
    if (difficultyScore !== undefined)   updates["difficultyScore"]   = difficultyScore;
    if (learningObjective !== undefined) updates["learningObjective"] = learningObjective;
    await ref.update(updates);
    const q = docToObj(await ref.get())!;
    res.json(await enrichQuestion(q));
  } catch (err) {
    req.log.error({ err }, "Update question error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/questions", requireAuth, async (req, res) => {
  try {
    // Delete all questions in batches of 500 (Firestore limit)
    const snap = await firestore.collection("questions").get();
    const batchSize = 500;
    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const batch = firestore.batch();
      snap.docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete all questions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/questions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await firestore.collection("questions").doc(String(id)).delete();
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete question error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
