import { Router } from "express";
import { db } from "@workspace/db";
import { topicsTable, chaptersTable, questionsTable, subjectsTable, standardsTable, boardsTable, aiProvidersTable } from "@workspace/db";
import { eq, like, and, count } from "drizzle-orm";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";

const router = Router();

router.get("/topics", requireAuth, async (req, res) => {
  try {
    const { chapterId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (chapterId) conditions.push(eq(topicsTable.chapterId, parseInt(chapterId)));
    if (search) conditions.push(like(topicsTable.name, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(topicsTable).where(where);
    const rows = await db
      .select({ t: topicsTable, chapterName: chaptersTable.name })
      .from(topicsTable)
      .leftJoin(chaptersTable, eq(topicsTable.chapterId, chaptersTable.id))
      .where(where)
      .limit(limitNum)
      .offset(offset)
      .orderBy(topicsTable.name);

    const withCounts = await Promise.all(
      rows.map(async ({ t, chapterName }) => {
        const [{ questions }] = await db.select({ questions: count() }).from(questionsTable).where(eq(questionsTable.topicId, t.id));
        return { ...t, chapterName, questionsCount: Number(questions) };
      })
    );

    res.json({ data: withCounts, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "List topics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/topics", requireAuth, async (req, res) => {
  try {
    const { name, description, chapterId, isActive = true } = req.body;
    const [t] = await db.insert(topicsTable).values({ name, description, chapterId, isActive }).returning();
    res.status(201).json({ ...t, chapterName: null, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create topic error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/topics/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    const { name, description, isActive } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates["name"] = name;
    if (description !== undefined) updates["description"] = description;
    if (isActive !== undefined) updates["isActive"] = isActive;
    const [t] = await db.update(topicsTable).set(updates).where(eq(topicsTable.id, id)).returning();
    if (!t) { res.status(404).json({ error: "Topic not found" }); return; }
    res.json({ ...t, chapterName: null, questionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Update topic error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/topics/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params["id"] as string));
    await db.delete(topicsTable).where(eq(topicsTable.id, id));
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

    const [chapter] = await db.select().from(chaptersTable).where(eq(chaptersTable.id, chapterId)).limit(1);
    if (!chapter) { res.status(404).json({ error: "Chapter not found" }); return; }

    const [subject] = await db.select().from(subjectsTable).where(eq(subjectsTable.id, chapter.subjectId)).limit(1);
    const [standard] = subject ? await db.select().from(standardsTable).where(eq(standardsTable.id, subject.standardId)).limit(1) : [undefined];
    const [board] = standard ? await db.select().from(boardsTable).where(eq(boardsTable.id, standard.boardId)).limit(1) : [undefined];
    const [provider] = await db.select().from(aiProvidersTable).where(eq(aiProvidersTable.id, providerId)).limit(1);

    if (!provider) { res.status(404).json({ error: "AI provider not found" }); return; }

    const token = simpleDecrypt(provider.encryptedToken);

    // Fetch already-existing topics so AI avoids duplicates
    const existing = await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.chapterId, chapterId));
    const existingNames = existing.map(t => t.name).join(", ") || "none";

    const systemPrompt = `You are a curriculum expert for ${board?.name ?? "Indian"} board, ${standard?.name ?? ""}, ${subject?.name ?? ""}.
Generate curriculum-aligned topic names with clear learning objectives. Return ONLY a valid JSON array. No markdown outside JSON.`;

    const userPrompt = `List ALL the real topics that are covered in the chapter: "${chapter.name}" (Subject: ${subject?.name ?? ""}, Board: ${board?.name ?? ""}, ${standard?.name ?? ""}).

Already existing topics (avoid duplicating these): ${existingNames}

Requirements:
- Generate exactly as many topics as this chapter genuinely has in the real curriculum — no more, no less
- Each topic should represent one clearly bounded learning concept from the actual syllabus
- Cover the full breadth of the chapter systematically
- Order from foundational to advanced
- Include both conceptual and application topics
- Do NOT pad with extra topics — only include topics that truly belong to this chapter

Return a JSON array (number of items = actual topic count for this chapter):
[
  {
    "name": "Topic name (concise, curriculum-standard phrasing)",
    "description": "One sentence: what students will learn in this topic"
  }
]`;

    const OPENAI_COMPAT: Record<string, string> = {
      openai:        "https://api.openai.com/v1/chat/completions",
      github_models: "https://models.inference.ai.azure.com/chat/completions",
      groq:          "https://api.groq.com/openai/v1/chat/completions",
      gemini:        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      azure_openai:  "https://models.inference.ai.azure.com/chat/completions",
    };

    let raw: string;

    const isRateLimit = (status: number) => status === 429 || status === 529;
    const rateLimitMsg = "The AI provider is rate-limited or overloaded. Please wait a moment and try again, or switch to a different model/provider.";

    if (provider.providerType === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": token,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        req.log.warn({ status: response.status, body: text.slice(0, 300) }, "Anthropic API error");
        res.status(502).json({ error: isRateLimit(response.status) ? rateLimitMsg : `Anthropic API error ${response.status}: ${text.slice(0, 200)}` });
        return;
      }
      const data = await response.json() as { content: Array<{ type: string; text: string }> };
      raw = data.content?.find(c => c.type === "text")?.text ?? "[]";
    } else if (provider.providerType === "gemini") {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${token}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: { text: systemPrompt } },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 3000 }
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        req.log.warn({ providerType: provider.providerType, status: response.status, body: text.slice(0, 300) }, "AI provider error");
        res.status(502).json({ error: isRateLimit(response.status) ? rateLimitMsg : `AI API error (${provider.providerType}) ${response.status}: ${text.slice(0, 200)}` });
        return;
      }
      const data = await response.json() as any;
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    } else {
      const endpoint = OPENAI_COMPAT[provider.providerType] ?? OPENAI_COMPAT.github_models;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 3000,
          temperature: 0.6,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        req.log.warn({ providerType: provider.providerType, status: response.status, body: text.slice(0, 300) }, "AI provider error");
        res.status(502).json({ error: isRateLimit(response.status) ? rateLimitMsg : `AI API error (${provider.providerType}) ${response.status}: ${text.slice(0, 200)}` });
        return;
      }
      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      raw = data.choices[0]?.message?.content ?? "[]";
    }

    // Parse JSON from response
    let topics: Array<{ name: string; description: string }> = [];
    try {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\[[\s\S]*\])/);
      const jsonStr = match ? match[1] : raw;
      topics = JSON.parse(jsonStr!.trim());
    } catch {
      res.status(502).json({ error: "AI returned invalid JSON. Try again." });
      return;
    }

    res.json({ topics, chapterName: chapter.name, subjectName: subject?.name, boardName: board?.name });
  } catch (err) {
    req.log.error({ err }, "AI generate topics error");
    res.status(500).json({ error: "Internal server error" });
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

    const inserted = await db.insert(topicsTable).values(
      topics.map(t => ({ name: t.name, description: t.description, chapterId, isActive: true }))
    ).returning();

    res.status(201).json({ saved: inserted.length, topics: inserted });
  } catch (err) {
    req.log.error({ err }, "Bulk save topics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
