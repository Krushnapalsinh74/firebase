import { Router } from "express";
import { db } from "@workspace/db";
import { questionsTable, topicsTable, chaptersTable, subjectsTable, boardsTable, standardsTable } from "@workspace/db";
import { eq, like, and, count, gte, lte } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

function buildQuestionWhere(q: Record<string, string>) {
  const conditions = [];
  if (q.search) conditions.push(like(questionsTable.question, `%${q.search}%`));
  if (q.boardId) conditions.push(eq(questionsTable.boardId, parseInt(q.boardId)));
  if (q.standardId) conditions.push(eq(questionsTable.standardId, parseInt(q.standardId)));
  if (q.subjectId) conditions.push(eq(questionsTable.subjectId, parseInt(q.subjectId)));
  if (q.chapterId) conditions.push(eq(questionsTable.chapterId, parseInt(q.chapterId)));
  if (q.topicId) conditions.push(eq(questionsTable.topicId, parseInt(q.topicId)));
  if (q.difficulty) conditions.push(eq(questionsTable.difficulty, q.difficulty));
  if (q.questionType) conditions.push(eq(questionsTable.questionType, q.questionType));
  if (q.model) conditions.push(eq(questionsTable.modelUsed, q.model));
  if (q.dateFrom) conditions.push(gte(questionsTable.generatedAt, new Date(q.dateFrom)));
  if (q.dateTo) conditions.push(lte(questionsTable.generatedAt, new Date(q.dateTo)));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function enrichQuestion(q: typeof questionsTable.$inferSelect) {
  const [topic] = q.topicId ? await db.select().from(topicsTable).where(eq(topicsTable.id, q.topicId)).limit(1) : [null];
  const [chapter] = q.chapterId ? await db.select().from(chaptersTable).where(eq(chaptersTable.id, q.chapterId)).limit(1) : [null];
  const [subject] = q.subjectId ? await db.select().from(subjectsTable).where(eq(subjectsTable.id, q.subjectId)).limit(1) : [null];
  const [board] = q.boardId ? await db.select().from(boardsTable).where(eq(boardsTable.id, q.boardId)).limit(1) : [null];
  const [standard] = q.standardId ? await db.select().from(standardsTable).where(eq(standardsTable.id, q.standardId)).limit(1) : [null];
  return {
    ...q,
    topicName: topic?.name ?? null,
    chapterName: chapter?.name ?? null,
    subjectName: subject?.name ?? null,
    boardName: board?.name ?? null,
    standardName: standard?.name ?? null,
  };
}

router.get("/questions", requireAuth, async (req, res) => {
  try {
    const { page = "1", limit = "50", ...filters } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;
    const where = buildQuestionWhere(filters);

    const [{ total }] = await db.select({ total: count() }).from(questionsTable).where(where);
    const questions = await db.select().from(questionsTable).where(where)
      .limit(limitNum).offset(offset).orderBy(questionsTable.generatedAt);

    const enriched = await Promise.all(questions.map(enrichQuestion));
    res.json({ data: enriched, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List questions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/questions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const [q] = await db.select().from(questionsTable).where(eq(questionsTable.id, id)).limit(1);
    if (!q) { res.status(404).json({ error: "Question not found" }); return; }
    res.json(await enrichQuestion(q));
  } catch (err) {
    req.log.error({ err }, "Get question error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/questions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const { question, correctAnswer, options, explanation, difficulty, difficultyScore, learningObjective } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (question !== undefined) updates["question"] = question;
    if (correctAnswer !== undefined) updates["correctAnswer"] = correctAnswer;
    if (options !== undefined) updates["options"] = options;
    if (explanation !== undefined) updates["explanation"] = explanation;
    if (difficulty !== undefined) updates["difficulty"] = difficulty;
    if (difficultyScore !== undefined) updates["difficultyScore"] = difficultyScore;
    if (learningObjective !== undefined) updates["learningObjective"] = learningObjective;
    const [q] = await db.update(questionsTable).set(updates).where(eq(questionsTable.id, id)).returning();
    if (!q) { res.status(404).json({ error: "Question not found" }); return; }
    res.json(await enrichQuestion(q));
  } catch (err) {
    req.log.error({ err }, "Update question error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/questions", requireAuth, async (req, res) => {
  try {
    await db.delete(questionsTable);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete all questions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/questions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    await db.delete(questionsTable).where(eq(questionsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete question error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
