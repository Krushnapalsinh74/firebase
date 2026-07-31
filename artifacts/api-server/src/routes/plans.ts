import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/plans", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("plans").orderBy("name").get();
    const plans = snapshotToArr(snap);
    res.json({ data: plans });
  } catch (err) {
    req.log.error({ err }, "List plans error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/plans", requireAuth, async (req, res) => {
  try {
    const id = await nextId("plans");
    const now = nowTs();
    const data = { 
      id, 
      name: req.body.name,
      price: req.body.price,
      questionLimit: req.body.questionLimit,
      accessScope: req.body.accessScope || "all",
      durationDays: req.body.durationDays || null,
      boardId: req.body.boardId ?? null, 
      standardId: req.body.standardId ?? null, 
      subjectId: req.body.subjectId ?? null, 
      chapterId: req.body.chapterId ?? null, 
      isActive: req.body.isActive ?? true, 
      createdAt: now, 
      updatedAt: now 
    };
    await firestore.collection("plans").doc(String(id)).set(data);
    res.status(201).json({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Create plan error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/plans/:id", requireAuth, async (req, res) => {
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

router.patch("/plans/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    
    const ref = firestore.collection("plans").doc(String(id));
    const existing = await ref.get();
    if (!existing.exists) { res.status(404).json({ error: "Plan not found" }); return; }
    
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.price !== undefined) updates.price = req.body.price;
    if (req.body.questionLimit !== undefined) updates.questionLimit = req.body.questionLimit;
    if (req.body.accessScope !== undefined) updates.accessScope = req.body.accessScope;
    if (req.body.durationDays !== undefined) updates.durationDays = req.body.durationDays;
    if (req.body.boardId !== undefined) updates.boardId = req.body.boardId;
    if (req.body.standardId !== undefined) updates.standardId = req.body.standardId;
    if (req.body.subjectId !== undefined) updates.subjectId = req.body.subjectId;
    if (req.body.chapterId !== undefined) updates.chapterId = req.body.chapterId;
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
    
    await ref.update(updates);
    const updated = docToObj(await ref.get())!;
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update plan error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/plans/:id", requireAuth, async (req, res) => {
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
