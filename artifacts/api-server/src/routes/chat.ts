import { Router, Request, Response } from "express";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";
import { firestore, snapshotToArr } from "@workspace/db";
import { callAIWithTokens } from "../lib/pipeline.js";

const router = Router();

router.post("/chat", requireAuth, async (req: Request, res: Response) => {
  try {
    const { message, systemPrompt = "You are a helpful AI assistant." } = req.body;
    
    if (!message) {
      res.status(400).json({ error: "Missing 'message' in request body" });
      return;
    }

    const snap = await firestore.collection("aiProviders").where("isActive", "==", true).limit(1).get();
    if (snap.empty) {
      res.status(500).json({ error: "No active AI provider configured" });
      return;
    }
    const provider = snapshotToArr(snap)[0] as any;
    const token = simpleDecrypt(provider.encryptedToken as string);
    const model: string = provider.defaultModel ?? "gemini-2.0-flash";

    const result = await callAIWithTokens(
      token, model, provider.providerType,
      systemPrompt, message,
      0.7, 4096, false,
    );

    res.json({ reply: result.content });
  } catch (error: any) {
    req.log?.error({ err: error }, "AI chat error");
    res.status(500).json({ error: "AI chat failed", details: error.message });
  }
});

export default router;
