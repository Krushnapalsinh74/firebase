import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";
import { firestore, snapshotToArr } from "@workspace/db";
import { callAIWithTokens } from "../lib/pipeline.js";

const router = Router();

const LANG_NAMES: Record<string, string> = {
  hi: "Hindi", gu: "Gujarati", mr: "Marathi", ta: "Tamil",
  te: "Telugu", bn: "Bengali", fr: "French", de: "German",
  es: "Spanish", ar: "Arabic", zh: "Chinese (Simplified)",
  ja: "Japanese", ko: "Korean", ur: "Urdu", pa: "Punjabi",
};

// ── AI-powered translation (uses the stored AI provider, no external API key needed) ──
router.post("/ai-translate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { texts, targetLanguage } = req.body as { texts: string[]; targetLanguage: string };
    if (!texts?.length || !targetLanguage) {
      res.status(400).json({ error: "Missing 'texts' or 'targetLanguage'" });
      return;
    }

    const langName = LANG_NAMES[targetLanguage] ?? targetLanguage;

    // Pick first active AI provider
    const snap = await firestore.collection("aiProviders").where("isActive", "==", true).limit(1).get();
    if (snap.empty) {
      res.status(500).json({ error: "No active AI provider configured" });
      return;
    }
    const provider = snapshotToArr(snap)[0] as any;
    const token = simpleDecrypt(provider.encryptedToken as string);
    const model: string = provider.defaultModel ?? "gemini-2.0-flash";

    const systemPrompt = `You are an expert educational content translator. Translate the given JSON array of strings to ${langName}.
Rules:
- Preserve ALL LaTeX math expressions exactly (anything inside $...$, $...$, \\(...\\), \\[...\\]) — do NOT translate or modify them.
- Preserve newlines and formatting.
- Translate only the natural-language text around the math.
- Return a valid JSON array with the same number of elements as the input.
- Return ONLY the JSON array, no explanation.`;

    const userPrompt = JSON.stringify(texts);

    const result = await callAIWithTokens(
      token, model, provider.providerType,
      systemPrompt, userPrompt,
      0.2, 4096, false,
    );

    // Parse the returned JSON array
    let translated: string[];
    try {
      const raw = result.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/,"");
      translated = JSON.parse(raw);
      if (!Array.isArray(translated) || translated.length !== texts.length) {
        throw new Error("Unexpected shape");
      }
    } catch {
      // Fallback: try to extract array from anywhere in the response
      const match = result.content.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("AI did not return a valid JSON array");
      translated = JSON.parse(match[0]);
    }

    res.json({ translations: translated });
  } catch (error: any) {
    req.log?.error({ err: error }, "AI translate error");
    res.status(500).json({ error: "AI translation failed", details: error.message });
  }
});

router.post("/translate", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = process.env.GOOGLE_TRANSLATION_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "GOOGLE_TRANSLATION_API_KEY is not set" });
      return;
    }

    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      res.status(400).json({ error: "Missing 'text' or 'targetLanguage' in request body" });
      return;
    }

    // Protect LaTeX math blocks from translation
    const mathBlocks: string[] = [];
    const protectMath = (s: string) => {
      // Replace $$...$$ and $...$
      // Also catch \( ... \) and \[ ... \] if they exist
      return s.replace(/\$\$(.*?)\$\$|\$(.*?)\$|\\\((.*?)\\\)|\\\[(.*?)\\\]/gs, (match) => {
        mathBlocks.push(match);
        return `___MATH_${mathBlocks.length - 1}___`;
      });
    };

    let protectedText;
    if (Array.isArray(text)) {
      protectedText = text.map(protectMath);
    } else {
      protectedText = protectMath(text);
    }

    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: protectedText,
        target: targetLanguage,
        format: 'text', // use text format to preserve placeholders securely
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google API returned ${response.status}: ${err}`);
    }

    const data = (await response.json()) as any;
    
    // Restore math blocks
    const restoreMath = (s: string) => {
      let restored = s;
      for (let i = 0; i < mathBlocks.length; i++) {
        // Google Translate sometimes adds spaces around numbers in placeholders like ___ MATH_0 ___
        const regex = new RegExp(`___\\s*MATH_${i}\\s*___`, 'g');
        // Replace using a function so the literal string is used without regex special char issues
        restored = restored.replace(regex, () => mathBlocks[i]);
      }
      return restored;
    };

    if (Array.isArray(protectedText)) {
        const translatedTexts = data.data.translations.map((t: any) => restoreMath(t.translatedText));
        res.json({ translations: translatedTexts });
    } else {
        res.json({ translation: restoreMath(data.data.translations[0].translatedText) });
    }

  } catch (error: any) {
    console.error("Translation error:", error);
    res.status(500).json({ error: "Translation failed", details: error.message });
  }
});

export default router;
