import { Router } from "express";
import { db } from "@workspace/db";
import { standardsTable, boardsTable, subjectsTable } from "@workspace/db";
import { eq, like, and, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/standards", requireAuth, async (req, res) => {
  try {
    const { boardId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (boardId) conditions.push(eq(standardsTable.boardId, parseInt(boardId)));
    if (search) conditions.push(like(standardsTable.name, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(standardsTable).where(where);
    const standards = await db
      .select({ s: standardsTable, boardName: boardsTable.name })
      .from(standardsTable)
      .leftJoin(boardsTable, eq(standardsTable.boardId, boardsTable.id))
      .where(where)
      .limit(limitNum)
      .offset(offset)
      .orderBy(standardsTable.level);

    const withCounts = await Promise.all(
      standards.map(async ({ s, boardName }) => {
        const [{ cnt }] = await db.select({ cnt: count() }).from(subjectsTable).where(eq(subjectsTable.standardId, s.id));
        return { ...s, boardName, subjectsCount: Number(cnt) };
      })
    );

    res.json({ data: withCounts, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List standards error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/standards", requireAuth, async (req, res) => {
  try {
    const { name, level, boardId, isActive = true } = req.body;
    const [standard] = await db.insert(standardsTable).values({ name, level, boardId, isActive }).returning();
    res.status(201).json({ ...standard, boardName: null, subjectsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create standard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/standards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const { name, level, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates["name"] = name;
    if (level !== undefined) updates["level"] = level;
    if (isActive !== undefined) updates["isActive"] = isActive;
    const [s] = await db.update(standardsTable).set(updates).where(eq(standardsTable.id, id)).returning();
    if (!s) { res.status(404).json({ error: "Standard not found" }); return; }
    res.json({ ...s, boardName: null, subjectsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update standard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/standards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    await db.delete(standardsTable).where(eq(standardsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete standard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
