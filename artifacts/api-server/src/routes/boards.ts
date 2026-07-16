import { Router } from "express";
import { db } from "@workspace/db";
import { boardsTable, standardsTable } from "@workspace/db";
import { eq, like, and, sql, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/boards", requireAuth, async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (search) conditions.push(like(boardsTable.name, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(boardsTable).where(where);
    const boards = await db.select().from(boardsTable).where(where).limit(limitNum).offset(offset).orderBy(boardsTable.name);

    const withCounts = await Promise.all(
      boards.map(async (b) => {
        const [{ cnt }] = await db.select({ cnt: count() }).from(standardsTable).where(eq(standardsTable.boardId, b.id));
        return { ...b, standardsCount: Number(cnt) };
      })
    );

    res.json({ data: withCounts, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List boards error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/boards", requireAuth, async (req, res) => {
  try {
    const { name, code, description, isActive = true } = req.body;
    const [board] = await db.insert(boardsTable).values({ name, code, description, isActive }).returning();
    res.status(201).json({ ...board, standardsCount: 0 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      res.status(400).json({ error: "Board code already exists" });
      return;
    }
    req.log.error({ err }, "Create board error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/boards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, id));
    if (!board) { res.status(404).json({ error: "Board not found" }); return; }
    const [{ cnt }] = await db.select({ cnt: count() }).from(standardsTable).where(eq(standardsTable.boardId, id));
    res.json({ ...board, standardsCount: Number(cnt) });
  } catch (err) {
    req.log.error({ err }, "Get board error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/boards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const { name, code, description, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates["name"] = name;
    if (code !== undefined) updates["code"] = code;
    if (description !== undefined) updates["description"] = description;
    if (isActive !== undefined) updates["isActive"] = isActive;
    const [board] = await db.update(boardsTable).set(updates).where(eq(boardsTable.id, id)).returning();
    if (!board) { res.status(404).json({ error: "Board not found" }); return; }
    const [{ cnt }] = await db.select({ cnt: count() }).from(standardsTable).where(eq(standardsTable.boardId, id));
    res.json({ ...board, standardsCount: Number(cnt) });
  } catch (err) {
    req.log.error({ err }, "Update board error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/boards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    await db.delete(boardsTable).where(eq(boardsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete board error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
