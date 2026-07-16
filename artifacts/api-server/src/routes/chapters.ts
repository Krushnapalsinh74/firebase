import { Router } from "express";
import { db } from "@workspace/db";
import { chaptersTable, subjectsTable, topicsTable, questionsTable } from "@workspace/db";
import { eq, like, and, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/chapters", requireAuth, async (req, res) => {
  try {
    const { subjectId, search, syllabus, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (subjectId) conditions.push(eq(chaptersTable.subjectId, parseInt(subjectId)));
    if (search) conditions.push(like(chaptersTable.name, `%${search}%`));
    if (syllabus) {
      if (syllabus === "__none__") {
        // Find chapters with no syllabus specified
        conditions.push(eq(chaptersTable.syllabus, ""));
      } else {
        conditions.push(eq(chaptersTable.syllabus, syllabus));
      }
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(chaptersTable).where(where);
    const rows = await db
      .select({ c: chaptersTable, subjectName: subjectsTable.name })
      .from(chaptersTable)
      .leftJoin(subjectsTable, eq(chaptersTable.subjectId, subjectsTable.id))
      .where(where)
      .limit(limitNum)
      .offset(offset)
      .orderBy(chaptersTable.orderIndex);

    const withCounts = await Promise.all(
      rows.map(async ({ c, subjectName }) => {
        const [{ topics }] = await db.select({ topics: count() }).from(topicsTable).where(eq(topicsTable.chapterId, c.id));
        const [{ questions }] = await db.select({ questions: count() }).from(questionsTable).where(eq(questionsTable.chapterId, c.id));
        return { ...c, subjectName, topicsCount: Number(topics), questionsCount: Number(questions) };
      })
    );

    res.json({ data: withCounts, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List chapters error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chapters/syllabus-categories", requireAuth, async (req, res) => {
  try {
    const rows = await db.selectDistinct({ syllabus: chaptersTable.syllabus }).from(chaptersTable);
    const customCategories = rows
      .map((r) => r.syllabus)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    
    // Merge with defaults "JEE" and "JEE Advanced"
    const defaults = ["JEE", "JEE Advanced"];
    const combined = Array.from(new Set([...defaults, ...customCategories]));
    res.json(combined);
  } catch (err) {
    req.log.error({ err }, "List syllabus categories error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chapters", requireAuth, async (req, res) => {
  try {
    const { name, orderIndex = 0, subjectId, isActive = true, syllabus = null } = req.body;
    const [c] = await db.insert(chaptersTable).values({ name, orderIndex, subjectId, isActive, syllabus }).returning();
    res.status(201).json({ ...c, subjectName: null, topicsCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/chapters/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const { name, orderIndex, isActive, syllabus } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates["name"] = name;
    if (orderIndex !== undefined) updates["orderIndex"] = orderIndex;
    if (isActive !== undefined) updates["isActive"] = isActive;
    if (syllabus !== undefined) updates["syllabus"] = syllabus;
    const [c] = await db.update(chaptersTable).set(updates).where(eq(chaptersTable.id, id)).returning();
    if (!c) { res.status(404).json({ error: "Chapter not found" }); return; }
    res.json({ ...c, subjectName: null, topicsCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/chapters/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    await db.delete(chaptersTable).where(eq(chaptersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
