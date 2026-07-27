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

// ── Helper to process translations with math placeholders ──
async function protectMathAndTranslate(
  texts: string[],
  langName: string,
  token: string,
  model: string,
  providerType: string
): Promise<string[]> {
  const mathBlocks: string[] = [];
  
  const protectMath = (s: string) => {
    if (!s) return s;
    return s.replace(/\$\$(.*?)\$\$|\$(.*?)\$|\\\((.*?)\\\)|\\\[(.*?)\\\]/gs, (match) => {
      mathBlocks.push(match);
      return `{{EQ${mathBlocks.length - 1}}}`;
    });
  };

  const protectedTexts = texts.map(protectMath);

  let systemPrompt = `You are a specialized educational content translator for JEE/NEET physics and mathematics.
Translate the given JSON array of strings from English to ${langName}.

CRITICAL RULES:
1. TRANSLATE ONLY THE NATURAL LANGUAGE PROSE.
2. DO NOT modify, translate, or transliterate ANY mathematical symbols, variables (e.g., x, y, P₁, θ, r⃗, cosθ), numbers, formulas, or equations. Keep them EXACTLY as they appear, including all Unicode subscripts/superscripts and vector symbols.
3. DO NOT duplicate equations. If an equation or mathematical expression appears once in the source, output it exactly once.
4. Do NOT modify or translate any placeholders like {{EQ0}}, {{EQ1}}, etc. Preserve them exactly as they are.
5. Return a valid JSON array of strings with the exact same length as the input.
6. Return ONLY the JSON array, no explanation.`;

  if (langName.toLowerCase() === "gujarati") {
    systemPrompt += `
- Terminology constraints for physics/math:
  - Position vector -> સ્થિતિ સદિશ
  - Displacement vector -> વિસ્થાપન સદિશ
  - Dot product -> ડોટ ગુણાકાર
  - Magnitude -> પરિમાણ
  - Projection -> પ્રક્ષેપ
  - Perpendicular -> લંબ
  - Parallel -> સમાન્તર`;
  }

  const userPrompt = JSON.stringify(protectedTexts);

  const result = await callAIWithTokens(
    token, model, providerType,
    systemPrompt, userPrompt,
    0.2, 4096, false
  );

  let translated: string[];
  try {
    const raw = result.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/,"");
    translated = JSON.parse(raw);
    if (!Array.isArray(translated) || translated.length !== texts.length) {
      throw new Error("Unexpected shape");
    }
  } catch {
    const match = result.content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("AI did not return a valid JSON array");
    translated = JSON.parse(match[0]);
  }

  const restoreMath = (s: string) => {
    if (!s) return s;
    let restored = s;
    for (let i = 0; i < mathBlocks.length; i++) {
      const regex = new RegExp(`\\{\\{\\s*EQ${i}\\s*\\}\\}`, 'g');
      restored = restored.replace(regex, () => mathBlocks[i]);
    }
    return restored;
  };

  return translated.map(restoreMath);
}

// ── AI-powered translation (uses the stored AI provider, no external API key needed) ──
router.post("/ai-translate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { texts, targetLanguage } = req.body as { texts: string[]; targetLanguage: string };
    if (!texts?.length || !targetLanguage) {
      res.status(400).json({ error: "Missing 'texts' or 'targetLanguage'" });
      return;
    }

    const langName = LANG_NAMES[targetLanguage] ?? targetLanguage;

    const snap = await firestore.collection("aiProviders").where("isActive", "==", true).limit(1).get();
    if (snap.empty) {
      res.status(500).json({ error: "No active AI provider configured" });
      return;
    }
    const provider = snapshotToArr(snap)[0] as any;
    const token = simpleDecrypt(provider.encryptedToken as string);
    const model: string = provider.defaultModel ?? "gemini-2.0-flash";

    const translated = await protectMathAndTranslate(texts, langName, token, model, provider.providerType);
    res.json({ translations: translated });
  } catch (error: any) {
    req.log?.error({ err: error }, "AI translate error");
    res.status(500).json({ error: "AI translation failed", details: error.message });
  }
});

router.post("/translate-question", requireAuth, async (req: Request, res: Response) => {
  try {
    const { questionId, targetLanguage } = req.body;
    if (!questionId || !targetLanguage) {
      res.status(400).json({ error: "Missing 'questionId' or 'targetLanguage'" });
      return;
    }

    const qDoc = await firestore.collection("questions").doc(String(questionId)).get();
    if (!qDoc.exists) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    const q = qDoc.data() as any;

    const texts = [
      q.question || "",
      q.explanation || "",
      q.options || "",
      q.correctAnswer || ""
    ];

    const langName = LANG_NAMES[targetLanguage] ?? targetLanguage;

    const snap = await firestore.collection("aiProviders").where("isActive", "==", true).limit(1).get();
    if (snap.empty) {
      res.status(500).json({ error: "No active AI provider configured" });
      return;
    }
    const provider = snapshotToArr(snap)[0] as any;
    const token = simpleDecrypt(provider.encryptedToken as string);
    const model: string = provider.defaultModel ?? "gemini-2.0-flash";

    const translated = await protectMathAndTranslate(texts, langName, token, model, provider.providerType);

    const translations = q.translations || {};
    translations[targetLanguage] = {
      question: translated[0],
      explanation: translated[1],
      options: translated[2],
      correctAnswer: translated[3],
    };

    await firestore.collection("questions").doc(String(questionId)).update({ translations });

    res.json({ success: true, translations });
  } catch (error: any) {
    req.log?.error({ err: error }, "AI translate question error");
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
