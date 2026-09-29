import { Router } from "express";
import { firestore, nextId, nextNIds, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";
import { callAIWithTokens, extractJsonObject } from "../lib/pipeline.js";

const router = Router();

router.get("/topics", requireAuth, async (req, res) => {
  try {
    const { chapterId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    let query: FirebaseFirestore.Query = firestore.collection("topics");
    if (chapterId) { const n = parseInt(chapterId); query = query.where("chapterId", "==", isNaN(n) ? chapterId : n); }
    let topics = snapshotToArr(await query.get()) as any[];
    topics.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    if (search) {
      const q = search.toLowerCase();
      topics = topics.filter((t) => t.name.toLowerCase().includes(q));
    }

    const total = topics.length;
    const page_topics = topics.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const withCounts = await Promise.all(
      page_topics.map(async (t) => {
        const chapterDoc = t.chapterId ? await firestore.collection("chapters").doc(String(t.chapterId)).get() : null;
        const chapterName = chapterDoc?.exists ? chapterDoc.data()?.name ?? null : null;
        const qCnt = (await firestore.collection("questions").where("topicId", "==", t.id).get()).size;
        return { ...t, chapterName, questionsCount: qCnt };
      })
    );

    res.json({ data: withCounts, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List topics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/topics", requireAuth, async (req, res) => {
  try {
    const { name, description, chapterId, isActive = true } = req.body;
    // Fetch chapterName for denormalization (used by pipeline.ts)
    const chapterDoc = chapterId ? await firestore.collection("chapters").doc(String(chapterId)).get() : null;
    const chapterName = chapterDoc?.exists ? chapterDoc.data()?.name ?? null : null;
    const id = await nextId("topics");
    const now = nowTs();
    const data = { id, name, description: description ?? null, chapterId, chapterName, isActive, createdAt: now, updatedAt: now };
    await firestore.collection("topics").doc(String(id)).set(data);
    res.status(201).json({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString(), questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create topic error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/topics/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, description, isActive } = req.body;
    const ref = firestore.collection("topics").doc(String(id));
    if (!(await ref.get()).exists) { res.status(404).json({ error: "Topic not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (name !== undefined) updates["name"] = name;
    if (description !== undefined) updates["description"] = description;
    if (isActive !== undefined) updates["isActive"] = isActive;
    await ref.update(updates);
    const t = docToObj(await ref.get())!;
    res.json({ ...t, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update topic error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/topics/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await firestore.collection("topics").doc(String(id)).delete();
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete topic error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// AI-generate topic suggestions for a chapter (preview only, does not save)
router.post("/topics/ai-generate", requireAuth, async (req, res) => {
  try {
    const { chapterId, providerId, model } = req.body as {
      chapterId: number;
      providerId: number;
      model: string;
    };

    if (!chapterId || !providerId || !model) {
      res.status(400).json({ error: "chapterId, providerId, and model are required" });
      return;
    }

    const [chapterDoc, providerDoc] = await Promise.all([
      firestore.collection("chapters").doc(String(chapterId)).get(),
      firestore.collection("aiProviders").doc(String(providerId)).get(),
    ]);

    if (!chapterDoc.exists) { res.status(404).json({ error: "Chapter not found" }); return; }
    if (!providerDoc.exists) { res.status(404).json({ error: "AI provider not found" }); return; }

    const chapter = chapterDoc.data() as any;
    const provider = providerDoc.data() as any;

    const subjectDoc = chapter.subjectId ? await firestore.collection("subjects").doc(String(chapter.subjectId)).get() : null;
    const subject = subjectDoc?.exists ? subjectDoc.data() as any : null;
    const standardDoc = subject?.standardId ? await firestore.collection("standards").doc(String(subject.standardId)).get() : null;
    const standard = standardDoc?.exists ? standardDoc.data() as any : null;
    const boardDoc = standard?.boardId ? await firestore.collection("boards").doc(String(standard.boardId)).get() : null;
    const board = boardDoc?.exists ? boardDoc.data() as any : null;

    const token = provider.encryptedToken ? simpleDecrypt(provider.encryptedToken) : (provider.apiKey || "");

    const cIdNum = Number(chapterId);
    const existingSnap = await firestore.collection("topics").where("chapterId", "==", isNaN(cIdNum) ? chapterId : cIdNum).get();
    const existingNames = existingSnap.docs.map((d) => d.data().name).join(", ") || "none";

    const systemPrompt = `You are an expert curriculum specialist for ${board?.name ?? "Indian"} board, ${standard?.name ?? ""}, ${subject?.name ?? ""}.
Generate curriculum-aligned topic names with clear learning objectives. Output must be a valid JSON object.`;

    const userPrompt = `List ALL the real topics that are covered in the chapter: "${chapter.name}" (Subject: ${subject?.name ?? ""}, Board: ${board?.name ?? ""}, ${standard?.name ?? ""}).

Already existing topics (avoid duplicating these): ${existingNames}

Requirements:
- Generate exactly as many topics as this chapter genuinely has in the real curriculum — no more, no less
- Each topic should represent one clearly bounded learning concept from the actual syllabus
- Cover the full breadth of the chapter systematically
- Order from foundational to advanced
- Include both conceptual and application topics
- Do NOT pad with extra topics — only include topics that truly belong to this chapter

Return a JSON object containing a "topics" array:
{
  "topics": [
    {
      "name": "Topic name (concise, curriculum-standard phrasing)",
      "description": "One sentence: what students will learn in this topic"
    }
  ]
}`;

    let raw = "";
    try {
      const aiResult = await callAIWithTokens(
        token,
        model,
        provider.providerType || "gemini",
        systemPrompt,
        userPrompt,
        0.5,
        3000,
        false
      );
      raw = aiResult.content;
    } catch (aiErr: any) {
      req.log.error({ err: aiErr }, "AI provider call failed in topics/ai-generate");
      res.status(502).json({ error: aiErr.message || "Failed to generate topics from AI provider." });
      return;
    }

    let topics: Array<{ name: string; description: string }> = [];
    try {
      const jsonStr = extractJsonObject(raw);
      const parsed = JSON.parse(jsonStr.trim());
      if (Array.isArray(parsed)) {
        topics = parsed;
      } else if (parsed && Array.isArray(parsed.topics)) {
        topics = parsed.topics;
      } else if (typeof parsed === "object") {
        const found = Object.values(parsed).find(Array.isArray);
        if (found) topics = found as any;
      }
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          topics = JSON.parse(match[0]);
        } catch {
          // ignore
        }
      }
    }

    // Sanitize and ensure format
    const sanitizedTopics = (Array.isArray(topics) ? topics : [])
      .filter((t) => t && (t.name || typeof t === "string"))
      .map((t: any) => ({
        name: typeof t === "string" ? t : String(t.name || "").trim(),
        description: typeof t === "string" ? "" : String(t.description || "").trim(),
      }))
      .filter((t) => t.name.length > 0);

    if (sanitizedTopics.length === 0) {
      res.status(502).json({ error: "AI returned unparseable response. Please try again or switch models." });
      return;
    }

    res.json({ topics: sanitizedTopics, chapterName: chapter.name, subjectName: subject?.name, boardName: board?.name });
  } catch (err: any) {
    req.log.error({ err }, "AI generate topics error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Bulk-save AI-generated topics
router.post("/topics/bulk", requireAuth, async (req, res) => {
  try {
    const { topics, chapterId } = req.body as {
      chapterId: number;
      topics: Array<{ name: string; description: string }>;
    };

    if (!chapterId || !Array.isArray(topics) || topics.length === 0) {
      res.status(400).json({ error: "chapterId and topics array are required" });
      return;
    }

    const chapterDoc = await firestore.collection("chapters").doc(String(chapterId)).get();
    const chapterName = chapterDoc.exists ? chapterDoc.data()?.name ?? null : null;

    const ids = await nextNIds("topics", topics.length);
    const now = nowTs();
    const batch = firestore.batch();
    const inserted: any[] = [];

    topics.forEach((t, i) => {
      const id = ids[i]!;
      const data = { id, name: t.name, description: t.description ?? null, chapterId, chapterName, isActive: true, createdAt: now, updatedAt: now };
      batch.set(firestore.collection("topics").doc(String(id)), data);
      inserted.push({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() });
    });

    await batch.commit();
    res.status(201).json({ saved: inserted.length, topics: inserted });
  } catch (err) {
    req.log.error({ err }, "Bulk save topics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
