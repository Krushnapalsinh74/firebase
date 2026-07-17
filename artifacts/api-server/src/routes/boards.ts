import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/boards", requireAuth, async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    let snap = await firestore.collection("boards").orderBy("name").get();
    let boards = snapshotToArr(snap) as any[];

    if (search) {
      const q = search.toLowerCase();
      boards = boards.filter((b) => b.name.toLowerCase().includes(q));
    }

    const total = boards.length;
    const page_boards = boards.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const withCounts = await Promise.all(
      page_boards.map(async (b) => {
        const cnt = (await firestore.collection("standards").where("boardId", "==", b.id).get()).size;
        return { ...b, standardsCount: cnt };
      })
    );

    res.json({ data: withCounts, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List boards error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/boards", requireAuth, async (req, res) => {
  try {
    const { name, code, description, isActive = true } = req.body;
    // Check for duplicate code
    const existing = await firestore.collection("boards").where("code", "==", code).limit(1).get();
    if (!existing.empty) {
      res.status(400).json({ error: "Board code already exists" });
      return;
    }
    const id = await nextId("boards");
    const now = nowTs();
    const data = { id, name, code, description: description ?? null, isActive, createdAt: now, updatedAt: now };
    await firestore.collection("boards").doc(String(id)).set(data);
    res.status(201).json({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString(), standardsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create board error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/boards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const doc = await firestore.collection("boards").doc(String(id)).get();
    const board = docToObj(doc);
    if (!board) { res.status(404).json({ error: "Board not found" }); return; }
    const cnt = (await firestore.collection("standards").where("boardId", "==", id).get()).size;
    res.json({ ...board, standardsCount: cnt });
  } catch (err) {
    req.log.error({ err }, "Get board error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/boards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, code, description, isActive } = req.body;
    const ref = firestore.collection("boards").doc(String(id));
    const existing = await ref.get();
    if (!existing.exists) { res.status(404).json({ error: "Board not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (name !== undefined) updates["name"] = name;
    if (code !== undefined) updates["code"] = code;
    if (description !== undefined) updates["description"] = description;
    if (isActive !== undefined) updates["isActive"] = isActive;
    await ref.update(updates);
    const updated = docToObj(await ref.get())!;
    const cnt = (await firestore.collection("standards").where("boardId", "==", id).get()).size;
    res.json({ ...updated, standardsCount: cnt });
  } catch (err) {
    req.log.error({ err }, "Update board error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/boards/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await firestore.collection("boards").doc(String(id)).delete();
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete board error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
