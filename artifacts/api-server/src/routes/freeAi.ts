import { Router, Request, Response } from "express";
import { firestore, snapshotToArr } from "@workspace/db";
import { simpleDecrypt } from "../lib/auth.js";
import { callAIWithTokens } from "../lib/pipeline.js";

const router = Router();

function cleanJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

/**
 * GET /api/free-ai
 * Health and discovery endpoint for the Free AI service.
 */
router.get("/free-ai", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Free AI API",
    modes: [
      {
        type: "chat",
        description: "General educational AI Q&A and tutoring",
        sampleBody: {
          type: "chat",
          message: "Explain the difference between speed and velocity.",
          systemPrompt: "Optional custom persona or instructions"
        }
      },
      {
        type: "generate-question",
        description: "Generate educational questions on any topic",
        sampleBody: {
          type: "generate-question",
          topic: "Newton's Laws of Motion",
          subject: "Physics",
          difficulty: "medium", // easy | medium | hard | advanced
          questionType: "mcq"   // mcq | short-answer | true-false
        }
      }
    ]
  });
});

/**
 * POST /api/free-ai
 * Public / Unauthenticated AI endpoint for chat and question generation.
 */
router.post("/free-ai", async (req: Request, res: Response) => {
  try {
    const {
      type = "chat",
      message,
      prompt,
      systemPrompt,
      topic,
      subject,
      difficulty = "medium",
      questionType = "mcq",
      standard,
      model: requestedModel,
    } = req.body ?? {};

    // 1. Fetch active AI provider from Firestore
    const snap = await firestore
      .collection("aiProviders")
      .where("isActive", "==", true)
      .limit(1)
      .get();

    let provider: any = null;
    let token = "";
    let model = requestedModel || "Gemini Web";

    if (!snap.empty) {
      provider = snapshotToArr(snap)[0] as any;
      token = provider.encryptedToken ? simpleDecrypt(provider.encryptedToken as string) : "";
      if (!requestedModel) {
        model = provider.defaultModel ?? "gemini-2.0-flash";
      }
    } else if (!/web|gemini|chatgpt/i.test(model)) {
      res.status(503).json({
        error: "No active AI provider is configured in the system. Please configure an AI provider in admin settings."
      });
      return;
    }

    const providerType = provider?.providerType || (/chatgpt/i.test(model) ? "local_stealth" : "local_stealth");

    // ── Mode A: Free Question Generation ──────────────────────────────────────
    if (type === "generate-question") {
      const targetTopic = (topic || prompt || message || "").trim();
      if (!targetTopic) {
        res.status(400).json({ error: "Missing 'topic' for question generation" });
        return;
      }

      const sysPrompt = [
        "You are an expert educational exam assessment designer.",
        "Generate a high-quality, syllabus-accurate question.",
        "Return ONLY a valid JSON object without markdown formatting or code fences.",
        "The JSON MUST follow this exact schema:",
        `{
  "question": "Clear problem statement using LaTeX $...$ for inline math if needed",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "The exact correct answer or option text",
  "explanation": "Detailed step-by-step educational solution",
  "difficulty": "${difficulty}",
  "questionType": "${questionType}"
}`
      ].join("\n");

      const userPrompt = [
        `Subject: ${subject || "General"}`,
        standard ? `Standard / Class: ${standard}` : "",
        `Topic: ${targetTopic}`,
        `Difficulty: ${difficulty}`,
        `Question Type: ${questionType}`,
        "Ensure the question is factually accurate, pedagogically sound, and engaging."
      ].filter(Boolean).join("\n");

      const aiRes = await callAIWithTokens(
        token,
        model,
        providerType,
        sysPrompt,
        userPrompt,
        0.7,
        2048,
        true
      );

      let parsed: any;
      try {
        parsed = JSON.parse(cleanJson(aiRes.content));
      } catch {
        parsed = { rawContent: aiRes.content };
      }

      res.json({
        success: true,
        type: "generate-question",
        data: parsed,
        provider: provider?.name || providerType,
        model
      });
      return;
    }

    // ── Mode B: Free AI Chat / Q&A ─────────────────────────────────────────────
    const userMessage = (message || prompt || "").trim();
    if (!userMessage) {
      res.status(400).json({ error: "Missing 'message' or 'prompt' in request body" });
      return;
    }

    const defaultSys = "You are an intelligent educational AI assistant for students and teachers. Provide clear, accurate, and structured answers with LaTeX math formatting when appropriate.";
    const activeSys = systemPrompt || defaultSys;

    const aiRes = await callAIWithTokens(
      token,
      model,
      providerType,
      activeSys,
      userMessage,
      0.7,
      4096,
      false
    );

    res.json({
      success: true,
      type: "chat",
      reply: aiRes.content,
      provider: provider?.name || providerType,
      model
    });
  } catch (error: any) {
    req.log?.error({ err: error }, "Free AI endpoint error");
    res.status(500).json({
      error: "Free AI processing failed",
      details: error.message
    });
  }
});

export default router;
