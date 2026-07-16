import { Router } from "express";
import { db } from "@workspace/db";
import { subjectsTable, standardsTable, boardsTable, chaptersTable, questionsTable } from "@workspace/db";
import { eq, like, and, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/subjects", requireAuth, async (req, res) => {
  try {
    const { standardId, boardId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (standardId) conditions.push(eq(subjectsTable.standardId, parseInt(standardId)));
    if (search) conditions.push(like(subjectsTable.name, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(subjectsTable).where(where);
    const rows = await db
      .select({ s: subjectsTable, standardName: standardsTable.name, boardId: boardsTable.id, boardName: boardsTable.name })
      .from(subjectsTable)
      .leftJoin(standardsTable, eq(subjectsTable.standardId, standardsTable.id))
      .leftJoin(boardsTable, eq(standardsTable.boardId, boardsTable.id))
      .where(where)
      .limit(limitNum)
      .offset(offset)
      .orderBy(subjectsTable.name);

    const withCounts = await Promise.all(
      rows.map(async ({ s, standardName, boardId: bId, boardName }) => {
        const [{ chapters }] = await db.select({ chapters: count() }).from(chaptersTable).where(eq(chaptersTable.subjectId, s.id));
        const [{ questions }] = await db.select({ questions: count() }).from(questionsTable).where(eq(questionsTable.subjectId, s.id));
        return { ...s, standardName, boardId: bId, boardName, chaptersCount: Number(chapters), questionsCount: Number(questions) };
      })
    );

    res.json({ data: withCounts, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List subjects error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/subjects", requireAuth, async (req, res) => {
  try {
    const { name, code, standardId, isActive = true } = req.body;
    const [s] = await db.insert(subjectsTable).values({ name, code, standardId, isActive }).returning();
    res.status(201).json({ ...s, standardName: null, boardId: null, boardName: null, chaptersCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/subjects/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const { name, code, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates["name"] = name;
    if (code !== undefined) updates["code"] = code;
    if (isActive !== undefined) updates["isActive"] = isActive;
    const [s] = await db.update(subjectsTable).set(updates).where(eq(subjectsTable.id, id)).returning();
    if (!s) { res.status(404).json({ error: "Subject not found" }); return; }
    res.json({ ...s, standardName: null, boardId: null, boardName: null, chaptersCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/subjects/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    await db.delete(subjectsTable).where(eq(subjectsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
