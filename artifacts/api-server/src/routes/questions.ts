import { Router } from "express";
import { firestore, docToObj, snapshotToArr, nowTs, toTs, nextId } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { logActivity } from "../lib/audit.js";

const router = Router();

async function enrichQuestion(q: Record<string, any>) {
  try {
    const [topicDoc, chapterDoc, subjectDoc, boardDoc, standardDoc] = await Promise.all([
      q.topicId   ? firestore.collection("topics").doc(String(q.topicId)).get().catch(() => null)     : Promise.resolve(null),
      q.chapterId ? firestore.collection("chapters").doc(String(q.chapterId)).get().catch(() => null) : Promise.resolve(null),
      q.subjectId ? firestore.collection("subjects").doc(String(q.subjectId)).get().catch(() => null) : Promise.resolve(null),
      q.boardId   ? firestore.collection("boards").doc(String(q.boardId)).get().catch(() => null)     : Promise.resolve(null),
      q.standardId? firestore.collection("standards").doc(String(q.standardId)).get().catch(() => null): Promise.resolve(null),
    ]);
    return {
      ...q,
      topicName:    topicDoc?.exists    ? topicDoc.data()?.name    ?? null : null,
      chapterName:  chapterDoc?.exists  ? chapterDoc.data()?.name  ?? null : null,
      subjectName:  subjectDoc?.exists  ? subjectDoc.data()?.name  ?? null : null,
      boardName:    boardDoc?.exists    ? boardDoc.data()?.name    ?? null : null,
      standardName: standardDoc?.exists ? standardDoc.data()?.name ?? null : null,
    };
  } catch {
    return q;
  }
}

router.get("/questions", requireAuth, async (req, res) => {
  try {
    const { page = "1", limit = "50", search, boardId, standardId, subjectId, chapterId, topicId, difficulty, questionType, model, dateFrom, dateTo, lang } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, parseInt(limit) || 50);

    // Query Firestore collection without composite index orderBy to prevent 500 errors
    let query: FirebaseFirestore.Query = firestore.collection("questions");
    if (topicId) {
      const tid = isNaN(Number(topicId)) ? topicId : Number(topicId);
      query = query.where("topicId", "==", tid);
    } else if (chapterId) {
      const cid = isNaN(Number(chapterId)) ? chapterId : Number(chapterId);
      query = query.where("chapterId", "==", cid);
    } else if (subjectId) {
      const sid = isNaN(Number(subjectId)) ? subjectId : Number(subjectId);
      query = query.where("subjectId", "==", sid);
    } else if (boardId) {
      const bid = isNaN(Number(boardId)) ? boardId : Number(boardId);
      query = query.where("boardId", "==", bid);
    }

    const snap = await query.get();
    let questions = snapshotToArr(snap) as any[];

    // JS-side filters for robust matching (supports both string & number IDs)
    if (boardId)      questions = questions.filter((q) => String(q.boardId) === String(boardId));
    if (standardId)   questions = questions.filter((q) => String(q.standardId) === String(standardId));
    if (subjectId)    questions = questions.filter((q) => String(q.subjectId) === String(subjectId));
    if (chapterId)    questions = questions.filter((q) => String(q.chapterId) === String(chapterId));
    if (topicId)      questions = questions.filter((q) => String(q.topicId) === String(topicId));
    if (difficulty)   questions = questions.filter((q) => q.difficulty === difficulty);
    if (questionType) questions = questions.filter((q) => q.questionType === questionType);
    if (model)        questions = questions.filter((q) => q.modelUsed === model);
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

    // Sort in memory by generatedAt descending (newest questions first)
    questions.sort((a, b) => {
      const timeA = a.generatedAt ? new Date(a.generatedAt).getTime() : (Number(a.id) || 0);
      const timeB = b.generatedAt ? new Date(b.generatedAt).getTime() : (Number(b.id) || 0);
      return timeB - timeA;
    });

    const total = questions.length;
    let page_questions = questions.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Swap translations if requested
    if (lang && lang !== "en") {
      page_questions = page_questions.map(q => {
        const translations = q.translations as Record<string, any> | undefined;
        const translated = translations?.[lang];
        if (translated) {
          if (translated.question) q.question = translated.question;
          if (translated.options) q.options = translated.options;
          if (translated.correctAnswer) q.correctAnswer = translated.correctAnswer;
          if (translated.explanation) q.explanation = translated.explanation;
        }
        return q;
      });
    }

    const enriched = await Promise.all(page_questions.map(enrichQuestion));

    res.json({ data: enriched, total, page: pageNum, limit: limitNum });
  } catch (err: any) {
    req.log.error({ err, message: err?.message }, "List questions error");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

// ── Create Question (Manual Entry with LaTeX, Diagram & Options) ─────────────
router.post("/questions", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user;
    const {
      question,
      questionType = "mcq",
      difficulty = "medium",
      difficultyScore = 5,
      marks = 1,
      options,
      correctAnswer,
      explanation,
      imageUrl,
      boardId,
      standardId,
      subjectId,
      chapterId,
      topicId,
      submitForApproval = false,
    } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question statement is required." });
    }

    const now = nowTs();
    const qId = await nextId("questions");

    const newQuestion = {
      id: qId,
      question: question.trim(),
      questionType: questionType || "mcq",
      difficulty: difficulty || "medium",
      difficultyScore: Number(difficultyScore) || 5,
      marks: marks !== undefined && marks !== null ? Number(marks) : 1,
      options: options || null,
      correctAnswer: correctAnswer ?? null,
      explanation: explanation || null,
      imageUrl: imageUrl || null,
      boardId: boardId ? Number(boardId) : null,
      standardId: standardId ? Number(standardId) : null,
      subjectId: subjectId ? Number(subjectId) : null,
      chapterId: chapterId ? Number(chapterId) : null,
      topicId: topicId ? Number(topicId) : null,
      createdBy: caller.userId,
      createdByName: caller.email,
      approvedBy: caller.role === "admin" || caller.role === "superadmin" ? caller.userId : null,
      modelUsed: "manual_entry",
      qualityScore: 10,
      generatedAt: now,
      updatedAt: now,
    };

    // If sub-admin wants or requires approval:
    if (caller.role === "subadmin" && submitForApproval) {
      const reqId = await nextId("approvalRequests");
      await firestore.collection("approvalRequests").doc(String(reqId)).set({
        id: reqId,
        subAdminId: Number(caller.userId),
        subAdminName: caller.email?.split("@")[0] || "Sub-Admin",
        subAdminEmail: caller.email || "",
        actionType: "CREATE_QUESTIONS",
        entityType: "questions",
        payload: {
          questions: [newQuestion],
          questionIds: [qId],
        },
        summary: `${caller.email} created new question manually (Pending Approval)`,
        status: "pending",
        createdAt: now,
      });
    }

    // Save question to collection
    await firestore.collection("questions").doc(String(qId)).set(newQuestion);

    await logActivity({
      userId: caller.userId,
      userName: caller.email,
      userEmail: caller.email,
      userRole: caller.role,
      action: "CREATE_QUESTION_MANUAL",
      resource: "questions",
      details: { questionId: qId, question: question.slice(0, 80), submitForApproval },
      ipAddress: req.ip,
    });

    const enriched = await enrichQuestion(newQuestion);
    res.status(201).json(enriched);
  } catch (err: any) {
    req.log?.error?.({ err }, "Create question error");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

router.get("/questions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const lang = req.query.lang as string;
    const doc = await firestore.collection("questions").doc(String(id)).get();
    const q = docToObj(doc);
    if (!q) { res.status(404).json({ error: "Question not found" }); return; }

    // Swap translations if requested
    if (lang && lang !== "en") {
      const translations = q.translations as Record<string, any> | undefined;
      const translated = translations?.[lang];
      if (translated) {
        if (translated.question) q.question = translated.question;
        if (translated.options) q.options = translated.options;
        if (translated.correctAnswer) q.correctAnswer = translated.correctAnswer;
        if (translated.explanation) q.explanation = translated.explanation;
      }
    }

    res.json(await enrichQuestion(q));
  } catch (err) {
    req.log.error({ err }, "Get question error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/questions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { question, correctAnswer, options, explanation, difficulty, difficultyScore, learningObjective, marks } = req.body;
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
    if (marks !== undefined)             updates["marks"]             = marks === null ? null : Number(marks);
    await ref.update(updates);
    const q = docToObj(await ref.get())!;
    res.json(await enrichQuestion(q));
  } catch (err) {
    req.log.error({ err }, "Update question error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bulk Marks ──────────────────────────────────────────────────────────────
router.patch("/questions/bulk-marks", requireAuth, async (req, res) => {
  try {
    const { ids, marks } = req.body as { ids: number[]; marks: number | null };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }
    const marksValue = marks === null || marks === undefined ? null : Number(marks);
    const updatedAt = nowTs();
    // Firestore batch limit is 500 per commit
    const BATCH_SIZE = 500;
    let updated = 0;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = firestore.batch();
      const chunk = ids.slice(i, i + BATCH_SIZE);
      for (const id of chunk) {
        const ref = firestore.collection("questions").doc(String(id));
        batch.update(ref, { marks: marksValue, updatedAt });
        updated++;
      }
      await batch.commit();
    }
    res.json({ updated });
  } catch (err) {
    req.log.error({ err }, "Bulk marks update error");
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

import { FieldValue } from "@google-cloud/firestore";

router.delete("/questions/:id/translations/:lang", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const lang = req.params["lang"] as string;
    
    if (!id || !lang) {
      res.status(400).json({ error: "Missing id or language" });
      return;
    }
    
    const ref = firestore.collection("questions").doc(String(id));
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    
    await ref.update({
      [`translations.${lang}`]: FieldValue.delete()
    });
    
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete translation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
