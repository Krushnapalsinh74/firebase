import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/chapters", requireAuth, async (req, res) => {
  try {
    const { subjectId, search, syllabus, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    let query: FirebaseFirestore.Query = firestore.collection("chapters");
    if (subjectId) { const n = parseInt(subjectId); query = query.where("subjectId", "==", isNaN(n) ? subjectId : n); }
    if (syllabus && syllabus !== "__none__") query = query.where("syllabus", "==", syllabus);
    let chapters = snapshotToArr(await query.get()) as any[];
    chapters.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    if (syllabus === "__none__") {
      chapters = chapters.filter((c) => !c.syllabus || c.syllabus.trim() === "");
    }
    if (search) {
      const q = search.toLowerCase();
      chapters = chapters.filter((c) => c.name.toLowerCase().includes(q));
    }

    const total = chapters.length;
    const page_chapters = chapters.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const withCounts = await Promise.all(
      page_chapters.map(async (c) => {
        const subjectDoc = c.subjectId ? await firestore.collection("subjects").doc(String(c.subjectId)).get() : null;
        const subjectName = subjectDoc?.exists ? subjectDoc.data()?.name ?? null : null;
        const [topicCnt, qCnt] = await Promise.all([
          firestore.collection("topics").where("chapterId", "==", c.id).get().then((r) => r.size),
          firestore.collection("questions").where("chapterId", "==", c.id).get().then((r) => r.size),
        ]);
        return { ...c, subjectName, topicsCount: topicCnt, questionsCount: qCnt };
      })
    );

    res.json({ data: withCounts, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List chapters error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chapters/syllabus-categories", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("chapters").get();
    const customCategories = snap.docs
      .map((d) => d.data()?.syllabus as string | undefined)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
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
    const id = await nextId("chapters");
    const now = nowTs();
    const data = { id, name, orderIndex, subjectId, isActive, syllabus, createdAt: now, updatedAt: now };
    await firestore.collection("chapters").doc(String(id)).set(data);
    res.status(201).json({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString(), subjectName: null, topicsCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/chapters/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, orderIndex, isActive, syllabus } = req.body;
    const ref = firestore.collection("chapters").doc(String(id));
    if (!(await ref.get()).exists) { res.status(404).json({ error: "Chapter not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (name !== undefined) updates["name"] = name;
    if (orderIndex !== undefined) updates["orderIndex"] = orderIndex;
    if (isActive !== undefined) updates["isActive"] = isActive;
    if (syllabus !== undefined) updates["syllabus"] = syllabus;
    await ref.update(updates);
    const c = docToObj(await ref.get())!;
    res.json({ ...c, subjectName: null, topicsCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/chapters/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await firestore.collection("chapters").doc(String(id)).delete();
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete chapter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
