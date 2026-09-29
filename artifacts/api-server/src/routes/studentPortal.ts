import { Router } from "express";
import { firestore, docToObj, snapshotToArr, nextId, nowTs } from "@workspace/db";
import { signToken, requireAuth } from "../lib/auth.js";
import { logActivity } from "../lib/audit.js";

const router = Router();

// ── 1. Student / Public Bootstrap (All taxonomies in 1 fast call) ────────────
router.get("/student/bootstrap", async (req, res) => {
  try {
    const [boardsSnap, standardsSnap, subjectsSnap, chaptersSnap, topicsSnap, questionsCountSnap] = await Promise.all([
      firestore.collection("boards").where("isActive", "==", true).get().catch(() => firestore.collection("boards").get()),
      firestore.collection("standards").where("isActive", "==", true).get().catch(() => firestore.collection("standards").get()),
      firestore.collection("subjects").where("isActive", "==", true).get().catch(() => firestore.collection("subjects").get()),
      firestore.collection("chapters").where("isActive", "==", true).get().catch(() => firestore.collection("chapters").get()),
      firestore.collection("topics").where("isActive", "==", true).get().catch(() => firestore.collection("topics").get()),
      firestore.collection("questions").get(),
    ]);

    const boards = snapshotToArr(boardsSnap);
    const standards = snapshotToArr(standardsSnap);
    const subjects = snapshotToArr(subjectsSnap);
    const chapters = snapshotToArr(chaptersSnap);
    const topics = snapshotToArr(topicsSnap);
    const totalQuestions = questionsCountSnap.size;

    res.json({
      boards,
      standards,
      subjects,
      chapters,
      topics,
      totalQuestions,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Student bootstrap error");
    res.status(500).json({ error: err.message || "Failed to load bootstrap data" });
  }
});

// ── 2. Google / Social Login for Student ──────────────────────────────────────
router.post("/student/auth/google", async (req, res) => {
  try {
    const { email, name, photoUrl, boardId, standardId } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required for Google login" });
    }

    const cleanEmail = email.toLowerCase().trim();
    let userSnap = await firestore.collection("users").where("email", "==", cleanEmail).limit(1).get();
    let studentUser: any;
    const now = nowTs();

    if (userSnap.empty) {
      // Create new student user
      const newUserId = await nextId("users");
      studentUser = {
        id: newUserId,
        email: cleanEmail,
        name: name || cleanEmail.split("@")[0],
        photoUrl: photoUrl || null,
        role: "student",
        boardId: boardId ? Number(boardId) : null,
        standardId: standardId ? Number(standardId) : null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await firestore.collection("users").doc(String(newUserId)).set(studentUser);
    } else {
      studentUser = docToObj(userSnap.docs[0]);
      if (boardId || standardId) {
        const updates: Record<string, any> = { updatedAt: now };
        if (boardId) updates.boardId = Number(boardId);
        if (standardId) updates.standardId = Number(standardId);
        await firestore.collection("users").doc(String(studentUser.id)).update(updates);
        studentUser = { ...studentUser, ...updates };
      }
    }

    const token = signToken({
      userId: studentUser.id,
      email: studentUser.email,
      role: studentUser.role || "student",
    });

    await logActivity({
      userId: studentUser.id,
      userName: studentUser.name || studentUser.email,
      userEmail: studentUser.email,
      userRole: "student",
      action: "STUDENT_GOOGLE_LOGIN",
      resource: "auth",
      details: { email: studentUser.email, boardId: studentUser.boardId, standardId: studentUser.standardId },
      ipAddress: req.ip,
    });

    res.json({
      token,
      user: {
        id: studentUser.id,
        email: studentUser.email,
        name: studentUser.name,
        photoUrl: studentUser.photoUrl,
        role: studentUser.role || "student",
        boardId: studentUser.boardId,
        standardId: studentUser.standardId,
      },
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Student Google login error");
    res.status(500).json({ error: err.message || "Failed to log in with Google" });
  }
});

// ── 3. Save Student Board & Standard Onboarding Selection ───────────────────
router.post("/student/preferences", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user;
    const { boardId, standardId, preferredLanguage } = req.body;

    const updates: Record<string, any> = { updatedAt: nowTs() };
    if (boardId !== undefined) updates.boardId = boardId ? Number(boardId) : null;
    if (standardId !== undefined) updates.standardId = standardId ? Number(standardId) : null;
    if (preferredLanguage) updates.preferredLanguage = preferredLanguage;

    await firestore.collection("users").doc(String(caller.userId)).update(updates);

    res.json({ success: true, message: "Preferences updated successfully", preferences: updates });
  } catch (err: any) {
    req.log?.error?.({ err }, "Update student preferences error");
    res.status(500).json({ error: err.message || "Failed to update preferences" });
  }
});

// ── 4. Student Question Feed with Filters & Language Translation ─────────────
router.get("/student/questions", async (req, res) => {
  try {
    const {
      boardId,
      standardId,
      subjectId,
      chapterId,
      topicId,
      difficulty,
      questionType,
      search,
      lang = "en",
      page = "1",
      limit = "30",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 30);

    let query: FirebaseFirestore.Query = firestore.collection("questions");

    if (topicId) {
      query = query.where("topicId", "==", Number(topicId));
    } else if (chapterId) {
      query = query.where("chapterId", "==", Number(chapterId));
    } else if (subjectId) {
      query = query.where("subjectId", "==", Number(subjectId));
    } else if (standardId) {
      query = query.where("standardId", "==", Number(standardId));
    } else if (boardId) {
      query = query.where("boardId", "==", Number(boardId));
    }

    const snap = await query.get();
    let questions = snapshotToArr(snap) as any[];

    // In-memory filters for robust matching
    if (boardId) questions = questions.filter((q) => String(q.boardId) === String(boardId));
    if (standardId) questions = questions.filter((q) => String(q.standardId) === String(standardId));
    if (subjectId) questions = questions.filter((q) => String(q.subjectId) === String(subjectId));
    if (chapterId) questions = questions.filter((q) => String(q.chapterId) === String(chapterId));
    if (topicId) questions = questions.filter((q) => String(q.topicId) === String(topicId));
    if (difficulty) questions = questions.filter((q) => q.difficulty === difficulty);
    if (questionType) questions = questions.filter((q) => q.questionType === questionType);
    if (search) {
      const s = search.toLowerCase();
      questions = questions.filter(
        (q) => q.question?.toLowerCase().includes(s) || q.explanation?.toLowerCase().includes(s)
      );
    }

    // Sort newest first
    questions.sort((a, b) => {
      const tA = a.generatedAt ? new Date(a.generatedAt).getTime() : Number(a.id) || 0;
      const tB = b.generatedAt ? new Date(b.generatedAt).getTime() : Number(b.id) || 0;
      return tB - tA;
    });

    const total = questions.length;
    let paged = questions.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Apply translation if specified
    if (lang && lang !== "en") {
      paged = paged.map((q) => {
        const tr = q.translations?.[lang];
        if (tr) {
          return {
            ...q,
            question: tr.question || q.question,
            options: tr.options || q.options,
            correctAnswer: tr.correctAnswer || q.correctAnswer,
            explanation: tr.explanation || q.explanation,
          };
        }
        return q;
      });
    }

    // Enrich with names
    const enriched = await Promise.all(
      paged.map(async (q) => {
        const [subDoc, chapDoc] = await Promise.all([
          q.subjectId ? firestore.collection("subjects").doc(String(q.subjectId)).get().catch(() => null) : null,
          q.chapterId ? firestore.collection("chapters").doc(String(q.chapterId)).get().catch(() => null) : null,
        ]);
        return {
          ...q,
          subjectName: subDoc?.exists ? subDoc.data()?.name : null,
          chapterName: chapDoc?.exists ? chapDoc.data()?.name : null,
        };
      })
    );

    res.json({
      data: enriched,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Student questions feed error");
    res.status(500).json({ error: err.message || "Failed to fetch questions" });
  }
});

// ── 5. Student Mock Tests / Papers ──────────────────────────────────────────
router.get("/student/mock-tests", async (req, res) => {
  try {
    const { boardId, standardId, subjectId } = req.query as Record<string, string>;
    let query: FirebaseFirestore.Query = firestore.collection("papers");

    if (subjectId) {
      query = query.where("subjectId", "==", Number(subjectId));
    } else if (standardId) {
      query = query.where("standardId", "==", Number(standardId));
    }

    const snap = await query.get();
    let papers = snapshotToArr(snap) as any[];

    if (boardId) papers = papers.filter((p) => String(p.boardId) === String(boardId));
    if (standardId) papers = papers.filter((p) => String(p.standardId) === String(standardId));
    if (subjectId) papers = papers.filter((p) => String(p.subjectId) === String(subjectId));

    papers.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    res.json({ data: papers });
  } catch (err: any) {
    req.log?.error?.({ err }, "Student mock tests error");
    res.status(500).json({ error: err.message || "Failed to fetch mock tests" });
  }
});

// ── 7. Real Curriculum Tree with Question Counts per Chapter ─────────────────
router.get("/student/curriculum-tree", async (req, res) => {
  try {
    const { boardId, standardId } = req.query as Record<string, string>;

    let subjectsQuery: FirebaseFirestore.Query = firestore.collection("subjects");
    if (standardId) {
      subjectsQuery = subjectsQuery.where("standardId", "==", Number(standardId));
    }

    const [subjectsSnap, chaptersSnap, topicsSnap, questionsSnap] = await Promise.all([
      subjectsQuery.get(),
      firestore.collection("chapters").get(),
      firestore.collection("topics").get(),
      firestore.collection("questions").get(),
    ]);

    const subjects = snapshotToArr(subjectsSnap) as any[];
    const allChapters = snapshotToArr(chaptersSnap) as any[];
    const allTopics = snapshotToArr(topicsSnap) as any[];
    const allQuestions = snapshotToArr(questionsSnap) as any[];

    // Build question count lookup by chapterId and subjectId
    const countByChapter: Record<string, number> = {};
    const countBySubject: Record<string, number> = {};

    allQuestions.forEach((q) => {
      if (q.chapterId) {
        countByChapter[String(q.chapterId)] = (countByChapter[String(q.chapterId)] || 0) + 1;
      }
      if (q.subjectId) {
        countBySubject[String(q.subjectId)] = (countBySubject[String(q.subjectId)] || 0) + 1;
      }
    });

    const curriculum = subjects.map((sub) => {
      const subChapters = allChapters
        .filter((c) => String(c.subjectId) === String(sub.id))
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .map((chap) => {
          const chapTopics = allTopics.filter((t) => String(t.chapterId) === String(chap.id));
          return {
            id: chap.id,
            name: chap.name,
            description: chap.description || null,
            questionCount: countByChapter[String(chap.id)] || 0,
            topics: chapTopics.map((t) => ({ id: t.id, name: t.name })),
          };
        });

      return {
        id: sub.id,
        name: sub.name,
        code: sub.code || null,
        totalQuestions: countBySubject[String(sub.id)] || 0,
        chaptersCount: subChapters.length,
        chapters: subChapters,
      };
    });

    res.json({ data: curriculum });
  } catch (err: any) {
    req.log?.error?.({ err }, "Curriculum tree error");
    res.status(500).json({ error: err.message || "Failed to fetch curriculum tree" });
  }
});

// ── 8. Real Student Stats from Database Attempts ────────────────────────────
router.get("/student/stats", async (req, res) => {
  try {
    const { userId } = req.query as Record<string, string>;
    const uid = userId ? Number(userId) : 0;

    let query: FirebaseFirestore.Query = firestore.collection("student_attempts");
    if (uid > 0) {
      query = query.where("userId", "==", uid);
    }

    const snap = await query.get();
    const attempts = snapshotToArr(snap) as any[];

    const totalAttempted = attempts.length;
    const correctCount = attempts.filter((a) => a.isCorrect).length;
    const accuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;

    // Calculate real active streak days from distinct attempt dates
    const attemptDates = new Set(
      attempts
        .map((a) => {
          const d = a.attemptedAt ? new Date(a.attemptedAt).toISOString().split("T")[0] : null;
          return d;
        })
        .filter(Boolean)
    );

    const streakDays = Math.max(attemptDates.size > 0 ? attemptDates.size : 1, 1);

    res.json({
      totalAttempted,
      correctCount,
      accuracy,
      streakDays,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Student stats error");
    res.status(500).json({ error: err.message || "Failed to compute stats" });
  }
});

// ── 9. Submit Question Attempt ──────────────────────────────────────────────
router.post("/student/submit-attempt", async (req, res) => {
  try {
    const { userId, questionId, selectedOption, isCorrect, timeSpentSec, chapterId, subjectId } = req.body;

    const attemptId = await nextId("student_attempts");
    const record = {
      id: attemptId,
      userId: userId ? Number(userId) : null,
      questionId: questionId ? Number(questionId) : null,
      selectedOption: selectedOption || "",
      isCorrect: Boolean(isCorrect),
      timeSpentSec: timeSpentSec ? Number(timeSpentSec) : 0,
      chapterId: chapterId ? Number(chapterId) : null,
      subjectId: subjectId ? Number(subjectId) : null,
      attemptedAt: nowTs(),
    };

    await firestore.collection("student_attempts").doc(String(attemptId)).set(record);

    res.json({ success: true, attemptId, record });
  } catch (err: any) {
    req.log?.error?.({ err }, "Submit attempt error");
    res.status(500).json({ error: err.message || "Failed to record attempt" });
  }
});

export default router;
