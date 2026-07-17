import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/subjects", requireAuth, async (req, res) => {
  try {
    const { standardId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    let query: FirebaseFirestore.Query = firestore.collection("subjects");
    if (standardId) query = query.where("standardId", "==", parseInt(standardId));
    let subjects = snapshotToArr(await query.get()) as any[];
    subjects.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    if (search) {
      const q = search.toLowerCase();
      subjects = subjects.filter((s) => s.name.toLowerCase().includes(q));
    }

    const total = subjects.length;
    const page_subjects = subjects.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const withCounts = await Promise.all(
      page_subjects.map(async (s) => {
        const [standardDoc, chapCnt, qCnt] = await Promise.all([
          s.standardId ? firestore.collection("standards").doc(String(s.standardId)).get() : Promise.resolve(null),
          firestore.collection("chapters").where("subjectId", "==", s.id).get().then((r) => r.size),
          firestore.collection("questions").where("subjectId", "==", s.id).get().then((r) => r.size),
        ]);
        const standard = standardDoc?.exists ? standardDoc.data() : null;
        const board = standard?.boardId
          ? (await firestore.collection("boards").doc(String(standard.boardId)).get()).data()
          : null;
        return {
          ...s,
          standardName: standard?.name ?? null,
          boardId: standard?.boardId ?? null,
          boardName: board?.name ?? null,
          chaptersCount: chapCnt,
          questionsCount: qCnt,
        };
      })
    );

    res.json({ data: withCounts, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List subjects error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/subjects", requireAuth, async (req, res) => {
  try {
    const { name, code, standardId, isActive = true } = req.body;
    const id = await nextId("subjects");
    const now = nowTs();
    const data = { id, name, code, standardId, isActive, createdAt: now, updatedAt: now };
    await firestore.collection("subjects").doc(String(id)).set(data);
    res.status(201).json({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString(), standardName: null, boardId: null, boardName: null, chaptersCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/subjects/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, code, isActive } = req.body;
    const ref = firestore.collection("subjects").doc(String(id));
    if (!(await ref.get()).exists) { res.status(404).json({ error: "Subject not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (name !== undefined) updates["name"] = name;
    if (code !== undefined) updates["code"] = code;
    if (isActive !== undefined) updates["isActive"] = isActive;
    await ref.update(updates);
    const s = docToObj(await ref.get())!;
    res.json({ ...s, standardName: null, boardId: null, boardName: null, chaptersCount: 0, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/subjects/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await firestore.collection("subjects").doc(String(id)).delete();
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
