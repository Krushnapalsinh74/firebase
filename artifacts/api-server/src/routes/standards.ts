import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/standards", requireAuth, async (req, res) => {
  try {
    const { boardId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    let query: FirebaseFirestore.Query = firestore.collection("standards");
    if (boardId) {
      const boardIdNum = parseInt(boardId);
      if (isNaN(boardIdNum)) {
        res.json({ data: [], total: 0, page: pageNum, limit: limitNum });
        return;
      }
      query = query.where("boardId", "==", boardIdNum);
    }
    query = query.orderBy("level");

    let standards = snapshotToArr(await query.get()) as any[];
    if (search) {
      const q = search.toLowerCase();
      standards = standards.filter((s) => s.name.toLowerCase().includes(q));
    }

    const total = standards.length;
    const page_standards = standards.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const withCounts = await Promise.all(
      page_standards.map(async (s) => {
        const boardDoc = s.boardId ? await firestore.collection("boards").doc(String(s.boardId)).get() : null;
        const boardName = boardDoc?.exists ? boardDoc.data()?.name ?? null : null;
        const cnt = (await firestore.collection("subjects").where("standardId", "==", s.id).get()).size;
        return { ...s, boardName, subjectsCount: cnt };
      })
    );

    res.json({ data: withCounts, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List standards error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/standards", requireAuth, async (req, res) => {
  try {
    const { name, level, boardId, isActive = true } = req.body;
    const id = await nextId("standards");
    const now = nowTs();
    const data = { id, name, level, boardId, isActive, createdAt: now, updatedAt: now };
    await firestore.collection("standards").doc(String(id)).set(data);
    res.status(201).json({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString(), boardName: null, subjectsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create standard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/standards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, level, isActive } = req.body;
    const ref = firestore.collection("standards").doc(String(id));
    if (!(await ref.get()).exists) { res.status(404).json({ error: "Standard not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (name !== undefined) updates["name"] = name;
    if (level !== undefined) updates["level"] = level;
    if (isActive !== undefined) updates["isActive"] = isActive;
    await ref.update(updates);
    const s = docToObj(await ref.get())!;
    res.json({ ...s, boardName: null, subjectsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update standard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/standards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await firestore.collection("standards").doc(String(id)).delete();
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete standard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
