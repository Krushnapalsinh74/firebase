import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../lib/auth.js";

const router = Router();

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
