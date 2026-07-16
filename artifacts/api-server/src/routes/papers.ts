import { Router } from "express";
import { db } from "@workspace/db";
import { papersTable, questionsTable } from "@workspace/db";
import { eq, inArray, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/papers", requireAuth, async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const [{ total }] = await db.select({ total: count() }).from(papersTable);
    const papers = await db.select().from(papersTable).limit(limitNum).offset(offset).orderBy(papersTable.createdAt);
    res.json({ data: papers, total: Number(total), page: pageNum, limit: limitNum });
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

    const questions = await db.select().from(questionsTable).where(inArray(questionsTable.id, questionIds));
    if (questions.length === 0) {
      res.status(400).json({ error: "No valid questions found" });
      return;
    }

    const firstQ = questions[0];
    const [paper] = await db.insert(papersTable).values({
      title,
      institutionName,
      totalQuestions: questions.length,
      subjectName: firstQ?.subjectId ? String(firstQ.subjectId) : null,
      boardName: firstQ?.boardId ? String(firstQ.boardId) : null,
      standardName: firstQ?.standardId ? String(firstQ.standardId) : null,
      includeAnswerKey,
      includeExplanations,
      questionIds: JSON.stringify(questionIds),
    }).returning();

    res.status(201).json(paper);
  } catch (err) {
    req.log.error({ err }, "Create paper error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/papers/:id/export", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const [paper] = await db.select().from(papersTable).where(eq(papersTable.id, id)).limit(1);
    if (!paper) { res.status(404).json({ error: "Paper not found" }); return; }

    const questionIds: number[] = JSON.parse(paper.questionIds);
    const questions = await db.select().from(questionsTable).where(inArray(questionsTable.id, questionIds));

    const pdfUrl = `/api/papers/${id}/download`;
    await db.update(papersTable).set({ pdfUrl }).where(eq(papersTable.id, id));

    res.json({ success: true, downloadUrl: pdfUrl, expiresAt: null });
  } catch (err) {
    req.log.error({ err }, "Export paper error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
