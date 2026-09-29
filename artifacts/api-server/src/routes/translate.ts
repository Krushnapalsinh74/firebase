import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";
import { firestore, snapshotToArr } from "@workspace/db";
import { callAIWithTokens, parseJSON, repairJsonWithLatex } from "../lib/pipeline.js";

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
  providerType: string,
  baseUrl?: string
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

  let systemPrompt = `You are a specialized educational content translator for competitive school and college exams (JEE/NEET/CBSE/NCERT/State Boards).
Translate the given JSON array of strings from English to ${langName}.

CRITICAL RULES:
1. TRANSLATE ONLY THE NATURAL LANGUAGE PROSE.
2. DO NOT modify, translate, or transliterate ANY mathematical symbols, variables (e.g., x, y, P₁, θ, r⃗, cosθ, α, β), numbers, formulas, equations, chemical formulas, or coordinate points. Keep them EXACTLY as they appear, including all Unicode subscripts/superscripts and vector symbols.
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
  - Parallel -> સમાન્તર
  - Hypotenuse -> કર્ણ
  - Remainder -> શેષ
  - Divisor -> ભાજક
  - Quotient -> ભાગફળ`;
  }

  const userPrompt = JSON.stringify(protectedTexts);

  try {
    const result = await callAIWithTokens(
      token, model, providerType,
      systemPrompt, userPrompt,
      0.2, 4096, true,
      baseUrl
    );

    let translated: string[] = [];
    try {
      translated = parseJSON<string[]>(result.content);
    } catch {
      try {
        translated = JSON.parse(repairJsonWithLatex(result.content));
      } catch {
        const match = result.content.match(/\[[\s\S]*\]/);
        if (match) {
          translated = JSON.parse(repairJsonWithLatex(match[0]));
        } else {
          throw new Error("AI did not return a valid JSON array");
        }
      }
    }

    if (!Array.isArray(translated) || translated.length !== texts.length) {
      // If length mismatch, fill with original
      translated = texts.map((t, i) => (translated[i] != null ? String(translated[i]) : t));
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
  } catch (err: any) {
    console.warn(`[protectMathAndTranslate] Fallback to original text due to: ${err.message}`);
    return texts;
  }
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
    const rawToken = provider.encryptedToken ? simpleDecrypt(provider.encryptedToken as string) : (provider.apiKey || provider.accessToken || "");
    const token = (rawToken || "").trim().replace(/^["']|["']$/g, "");
    const model: string = provider.defaultModel ?? "gemini-2.0-flash";

    const translated = await protectMathAndTranslate(texts, langName, token, model, provider.providerType, provider.baseUrl);
    res.json({ translations: translated });
  } catch (error: any) {
    req.log?.error({ err: error }, "AI translate error");
    res.status(500).json({ error: "AI translation failed", details: error.message });
  }
});

// ── Batch Question Translation (with chunking, LaTeX math protection, and option alignment) ──
router.post("/ai/batch-translate-questions", requireAuth, async (req: Request, res: Response) => {
  req.socket?.setTimeout(0);
  res.setTimeout(0);
  try {
    const { questions, targetLanguage, providerId, model } = req.body as {
      questions: Array<{
        id?: string;
        question: string;
        options?: Array<{ id: string; text: string }> | string[] | null;
        explanation?: string;
        correctAnswer?: string;
        translations?: Record<string, any>;
      }>;
      targetLanguage: string;
      providerId?: string | number;
      model?: string;
    };

    if (!questions?.length || !targetLanguage) {
      res.status(400).json({ error: "Missing 'questions' or 'targetLanguage'" });
      return;
    }

    const langName = LANG_NAMES[targetLanguage] ?? targetLanguage;

    let providerDoc: any = null;
    if (providerId) {
      const pDoc = await firestore.collection("aiProviders").doc(String(providerId)).get();
      if (pDoc.exists) providerDoc = pDoc;
    }
    if (!providerDoc) {
      const snap = await firestore.collection("aiProviders").where("isActive", "==", true).limit(1).get();
      if (!snap.empty) providerDoc = snap.docs[0];
    }
    if (!providerDoc) {
      const snap = await firestore.collection("aiProviders").limit(1).get();
      if (!snap.empty) providerDoc = snap.docs[0];
    }

    if (!providerDoc) {
      res.status(500).json({ error: "No active AI provider configured" });
      return;
    }

    const provider = providerDoc.data() as any;
    const rawToken = provider.encryptedToken ? simpleDecrypt(provider.encryptedToken) : (provider.apiKey || provider.accessToken || "");
    const token = (rawToken || "").trim().replace(/^["']|["']$/g, "");
    const selectedModel: string = model || provider.defaultModel || provider.availableModels?.[0] || "gemini-2.0-flash";

    // Process questions in small chunks of 3-4 items concurrently with Promise.all
    const CHUNK_SIZE = 4;
    const translatedMap = new Map<number, any>();
    const chunkPromises: Promise<void>[] = [];

    const systemPrompt = `You are an elite educational translator specializing in STEM and competitive exams (JEE/NEET/CBSE/NCERT/State Boards).
Your task is to translate questions from English into ${langName}.

CRITICAL INSTRUCTIONS:
1. Preserve all mathematical formulas, LaTeX notation ($...$, $$...$$, \\(...\\), \\[...\\]), numbers, option labels (A, B, C, D), variables, chemical equations, and code EXACTLY as they are.
2. Translate natural language text accurately and academically for school/college students in ${langName}.
3. Maintain the exact same JSON structure and number of questions.
4. Output 100% valid JSON array.`;

    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      const chunkIndex = i;

      chunkPromises.push((async () => {
        const itemsToTranslate = chunk.map((q, cIdx) => ({
          index: chunkIndex + cIdx,
          id: q.id,
          question: q.question,
          options: q.options,
          explanation: q.explanation || "",
          correctAnswer: q.correctAnswer || "",
        }));

        const userPrompt = `Translate these ${itemsToTranslate.length} questions into ${langName}:
${JSON.stringify(itemsToTranslate, null, 2)}

Return JSON array in this format:
[
  {
    "index": ${chunkIndex},
    "question": "Translated question text in ${langName}",
    "options": [
      { "id": "A", "text": "Translated Option A" },
      { "id": "B", "text": "Translated Option B" }
    ],
    "explanation": "Translated step-by-step solution in ${langName}"
  }
]`;

        try {
          const aiResult = await callAIWithTokens(
            token,
            selectedModel,
            provider.providerType || "gemini",
            systemPrompt,
            userPrompt,
            0.2,
            8192,
            true,
            provider.baseUrl
          );

          let chunkList: any[] = [];
          try {
            chunkList = parseJSON<any[]>(aiResult.content);
          } catch {
            try {
              chunkList = JSON.parse(repairJsonWithLatex(aiResult.content));
            } catch {
              const match = aiResult.content.match(/\[[\s\S]*\]/);
              if (match) {
                chunkList = JSON.parse(repairJsonWithLatex(match[0]));
              }
            }
          }

          if (Array.isArray(chunkList) && chunkList.length > 0) {
            chunkList.forEach((t, tIdx) => {
              const globalIdx = typeof t.index === "number" ? t.index : (chunkIndex + tIdx);
              translatedMap.set(globalIdx, t);
            });
            return;
          }
          throw new Error("Invalid chunk response shape");
        } catch (chunkErr: any) {
          req.log?.warn?.({ err: chunkErr, chunkIndex }, `Batch translation chunk ${chunkIndex} failed, attempting per-item fallback`);
          
          // Fallback: translate items in this chunk individually via protectMathAndTranslate
          for (let cIdx = 0; cIdx < chunk.length; cIdx++) {
            const globalIdx = chunkIndex + cIdx;
            const q = chunk[cIdx];
            try {
              const textsToTranslate: string[] = [q.question || ""];
              const optList = Array.isArray(q.options) ? q.options : [];
              optList.forEach((opt: any) => {
                textsToTranslate.push(typeof opt === "string" ? opt : (opt.text || ""));
              });
              if (q.explanation) {
                textsToTranslate.push(q.explanation);
              }

              const transTexts = await protectMathAndTranslate(
                textsToTranslate,
                langName,
                token,
                selectedModel,
                provider.providerType || "gemini",
                provider.baseUrl
              );

              const translatedQ = transTexts[0] || q.question;
              let currentTextIdx = 1;
              const translatedOpts = optList.map((opt: any, optIdx: number) => {
                const letter = typeof opt === "string" ? String.fromCharCode(65 + optIdx) : (opt.id || String.fromCharCode(65 + optIdx));
                const tText = transTexts[currentTextIdx++] || (typeof opt === "string" ? opt : (opt.text || ""));
                return { id: letter, text: tText };
              });
              const translatedExpl = q.explanation ? (transTexts[currentTextIdx] || q.explanation) : "";

              translatedMap.set(globalIdx, {
                index: globalIdx,
                question: translatedQ,
                options: translatedOpts,
                explanation: translatedExpl,
              });
            } catch {
              // Keep original if all else fails
              translatedMap.set(globalIdx, {
                index: globalIdx,
                question: q.question,
                options: q.options,
                explanation: q.explanation,
              });
            }
          }
        }
      })());
    }

    await Promise.all(chunkPromises);

    // Merge translations into each question
    const updatedQuestions = questions.map((q, idx) => {
      const trans = translatedMap.get(idx);
      if (!trans) return q;

      let options = trans.options;
      if (Array.isArray(options)) {
        options = options.map((opt: any, optIdx: number) => {
          if (typeof opt === "string") {
            const letter = String.fromCharCode(65 + optIdx);
            return { id: letter, text: opt };
          }
          return {
            id: String(opt.id || String.fromCharCode(65 + optIdx)),
            text: String(opt.text || opt.value || ""),
          };
        });
      } else if (q.options && Array.isArray(q.options)) {
        options = q.options;
      } else {
        options = null;
      }

      const existingTranslations = (q as any).translations || {};
      return {
        ...q,
        translations: {
          ...existingTranslations,
          [targetLanguage]: {
            question: String(trans.question || q.question).trim(),
            options,
            explanation: String(trans.explanation || q.explanation || "").trim(),
            correctAnswer: q.correctAnswer,
          },
        },
      };
    });

    res.json({
      success: true,
      targetLanguage,
      langName,
      questions: updatedQuestions,
    });
  } catch (error: any) {
    req.log?.error({ err: error }, "Batch question translate error");
    // Return fallback with original questions instead of failing with 500/502
    res.json({
      success: false,
      targetLanguage: req.body?.targetLanguage || "unknown",
      langName: req.body?.targetLanguage || "unknown",
      questions: req.body?.questions || [],
      error: error.message || "Translation completed with fallback",
    });
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
