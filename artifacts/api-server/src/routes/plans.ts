import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("plans").orderBy("name").get();
    const plans = snapshotToArr(snap);
    res.json({ data: plans });
  } catch (err) {
    req.log.error({ err }, "List plans error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, price, questionLimit, boardId, standardId, subjectId, chapterId, isActive = true } = req.body;
    const id = await nextId("plans");
    const now = nowTs();
    const data = { 
      id, name, price, questionLimit, boardId: boardId ?? null, standardId: standardId ?? null, 
      subjectId: subjectId ?? null, chapterId: chapterId ?? null, isActive, 
      createdAt: now, updatedAt: now 
    };
    await firestore.collection("plans").doc(String(id)).set(data);
    res.status(201).json({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Create plan error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const doc = await firestore.collection("plans").doc(String(id)).get();
    const plan = docToObj(doc);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
    res.json(plan);
  } catch (err) {
    req.log.error({ err }, "Get plan error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, price, questionLimit, boardId, standardId, subjectId, chapterId, isActive } = req.body;
    
    const ref = firestore.collection("plans").doc(String(id));
    const existing = await ref.get();
    if (!existing.exists) { res.status(404).json({ error: "Plan not found" }); return; }
    
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (name !== undefined) updates["name"] = name;
    if (price !== undefined) updates["price"] = price;
    if (questionLimit !== undefined) updates["questionLimit"] = questionLimit;
    if (boardId !== undefined) updates["boardId"] = boardId;
    if (standardId !== undefined) updates["standardId"] = standardId;
    if (subjectId !== undefined) updates["subjectId"] = subjectId;
    if (chapterId !== undefined) updates["chapterId"] = chapterId;
    if (isActive !== undefined) updates["isActive"] = isActive;
    
    await ref.update(updates);
    const updated = docToObj(await ref.get())!;
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update plan error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await firestore.collection("plans").doc(String(id)).delete();
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete plan error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export const plansRouter = router;
