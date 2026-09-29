import { Router } from "express";
import { firestore, nextId, nextNIds, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";
import { callAIWithTokens, extractJsonObject, parseJSON, repairJsonWithLatex } from "../lib/pipeline.js";
import { logActivity } from "../lib/audit.js";

const router = Router();

// ── Cleans MathPix / MathJax-rendered HTML so the AI receives compact readable text ──
function cleanMathpixHtml(rawHtml: string): string {
  let html = rawHtml;
  const latexList: string[] = [];

  // Step 1A: Handle <math>...</math> blocks atomically
  html = html.replace(/<math[\s\S]*?<\/math>/gi, (mathBlock) => {
    const annMatch = mathBlock.match(/<annotation[^>]*encoding=["'](?:application\/x-tex|TeX)["'][^>]*>([\s\S]*?)<\/annotation>/i);
    if (annMatch && annMatch[1].trim()) {
      const idx = latexList.length;
      latexList.push(annMatch[1].trim());
      return `%%MATH${idx}%%`;
    }
    return "";
  });

  // Step 1B: Standalone <latex>...</latex> tags
  html = html.replace(/<latex[^>]*>([\s\S]*?)<\/latex>/gi, (_, content) => {
    const idx = latexList.length;
    latexList.push(content.trim());
    return `%%MATH${idx}%%`;
  });

  // Step 1C: Extract math from spans with data-latex or alt
  html = html.replace(
    /<span[^>]*class=["'][^"']*math[^"']*["'][^>]*(?:data-latex=["']([^"']*)["']|alt=["']([^"']*)["'])[^>]*>[\s\S]*?<\/span>/gi,
    (_, dl, alt) => {
      const formula = (dl || alt || "").trim();
      if (!formula) return "";
      const idx = latexList.length;
      latexList.push(formula);
      return `%%MATH${idx}%%`;
    }
  );

  // Step 2: Strip heavy/invisible tags
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");
  html = html.replace(/<mathml[^>]*>[\s\S]*?<\/mathml>/gi, "");
  html = html.replace(/<mathmlword[^>]*>[\s\S]*?<\/mathmlword>/gi, "");
  html = html.replace(/<asciimath[^>]*>[\s\S]*?<\/asciimath>/gi, "");
  html = html.replace(/<tsv[^>]*>[\s\S]*?<\/tsv>/gi, "");
  html = html.replace(/<table-markdown[^>]*>[\s\S]*?<\/table-markdown>/gi, "");
  html = html.replace(/<mjx-container[^>]*>[\s\S]*?<\/mjx-container>/gi, "");
  html = html.replace(/<mjx-assistive-mml[^>]*>[\s\S]*?<\/mjx-assistive-mml>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Step 3: Restore LaTeX as $...$ inline math
  html = html.replace(/%%MATH(\d+)%%/g, (_, idx) => `$${latexList[parseInt(idx)]}$`);

  // Step 4: Normalise whitespace
  html = html.replace(/[ \t]{3,}/g, " ");
  html = html.replace(/\n{3,}/g, "\n\n");

  return html;
}

// ── Convert cleaned HTML to compact plain text ──
function htmlToPlainText(html: string): string {
  let text = html;

  text = text.replace(/<\/(p|div|li|tr|h[1-6]|br|section|article|figure|figcaption)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n");
  text = text.replace(/<td[^>]*>/gi, "\t");
  text = text.replace(/<th[^>]*>/gi, "\t");

  text = text.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_, alt) =>
    alt && alt.startsWith("Diagram [") ? alt.replace(/^Diagram /, "") : alt ? `[${alt}]` : ""
  );
  text = text.replace(/<img[^>]*data-label=["']([^"']+)["'][^>]*>/gi, (_, lbl) => `[${lbl}]`);

  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#[0-9]+;/g, " ");

  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

export interface ExtractedChapter {
  name: string;
  description?: string;
  orderIndex?: number;
}

export interface ExtractedTopic {
  name: string;
  description?: string;
  chapterName: string;
}

export interface ExtractedQuestion {
  question: string;
  questionType?: string;
  difficulty?: "easy" | "medium" | "hard";
  difficultyScore?: number;
  correctAnswer?: string;
  options?: Array<{ id: string; text: string; imageUrl?: string }> | string[] | null;
  explanation?: string;
  marks?: number;
  chapterName?: string;
  topicName?: string;
  imageUrl?: string;
  imageRef?: string;
  translations?: Record<string, any>;
}

// ─── Asynchronous AI Extraction Jobs In-Memory Store ──────────────────────────
export interface AiExtractionJob {
  id: string;
  status: "processing" | "completed" | "failed";
  progress: number;
  statusText: string;
  createdAt: number;
  result?: {
    chapters: ExtractedChapter[];
    topics: ExtractedTopic[];
    questions: ExtractedQuestion[];
    summary?: any;
  };
  error?: string;
}

const aiExtractionJobs = new Map<string, AiExtractionJob>();

// Clean up stale jobs after 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of aiExtractionJobs.entries()) {
    if (now - job.createdAt > 7200000) {
      aiExtractionJobs.delete(id);
    }
  }
}, 600000);

export async function executeAiExtraction(params: {
  text: string;
  htmlContent?: string;
  mode?: "full" | "curriculum" | "questions";
  boardId?: number;
  standardId?: number;
  subjectId?: number;
  providerId?: number;
  model?: string;
  customPrompt?: string;
  questionTypes?: string[];
  onProgress?: (progress: number, statusText: string) => void;
  reqLog?: any;
}): Promise<{ chapters: ExtractedChapter[]; topics: ExtractedTopic[]; questions: ExtractedQuestion[]; summary: any }> {
  const {
    text,
    htmlContent,
    mode = "full",
    boardId,
    standardId,
    subjectId,
    providerId,
    model,
    customPrompt,
    questionTypes = [],
    onProgress,
    reqLog,
  } = params;

  onProgress?.(15, "Connecting to AI Provider & Loading Context...");

  const hasTextContent = text && typeof text === "string" && text.trim().length > 0;
  const hasHtmlContent = htmlContent && typeof htmlContent === "string" && htmlContent.trim().length > 0;
  if (!hasTextContent && !hasHtmlContent) {
    throw new Error("Text content or HTML content is required for extraction");
  }

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
    throw new Error("No AI Providers found in the system. Please configure an AI Provider in settings first.");
  }

  const provider = providerDoc.data() as any;
  const selectedModel = model || provider.defaultModel || provider.availableModels?.[0] || "gemini-2.0-flash";
  const rawToken = provider.encryptedToken ? simpleDecrypt(provider.encryptedToken) : provider.apiKey || provider.accessToken || "";
  const token = (rawToken || "").trim().replace(/^["']|["']$/g, "");

  if (!token && provider.providerType !== "local_stealth" && provider.providerType !== "browser_web" && provider.providerType !== "custom_local") {
    throw new Error(`The AI provider "${provider.name || "Selected"}" does not have a valid API key configured.`);
  }

  // Contextual hierarchy
  let boardName = "";
  let standardName = "";
  let subjectName = "";

  if (subjectId) {
    const sDoc = await firestore.collection("subjects").doc(String(subjectId)).get();
    if (sDoc.exists) subjectName = sDoc.data()?.name || "";
  }
  if (standardId) {
    const stDoc = await firestore.collection("standards").doc(String(standardId)).get();
    if (stDoc.exists) standardName = stDoc.data()?.name || "";
  }
  if (boardId) {
    const bDoc = await firestore.collection("boards").doc(String(boardId)).get();
    if (bDoc.exists) boardName = bDoc.data()?.name || "";
  }

  const contextStr = [
    boardName ? `Board: ${boardName}` : "",
    standardName ? `Grade/Standard: ${standardName}` : "",
    subjectName ? `Subject: ${subjectName}` : "",
  ].filter(Boolean).join(", ");

  const hasTypeFilter = Array.isArray(questionTypes) && questionTypes.length > 0;
  const typesFilterStr = hasTypeFilter
    ? `\n4. MANDATORY QUESTION TYPE FILTER: Extract ONLY questions of the following selected question types: [${questionTypes.join(", ")}]. Set "questionType" accurately for each question.`
    : "";

  // ── Build Image Registry from Markdown text or HTML ────────────────────
  interface ImgEntry { label: string; filename: string; dataUrl: string; isUrl: boolean; }
  const imageRegistry: ImgEntry[] = [];

  const getBasename = (str: string): string => {
    if (!str) return "";
    const clean = str.split("?")[0].split("#")[0].trim();
    const parts = clean.split(/[/\\]/);
    return parts[parts.length - 1] || clean;
  };

  if (hasTextContent) {
    const mdImgRe = /!\[(.*?)\]\((.*?)\)/g;
    let mdm: RegExpExecArray | null;
    while ((mdm = mdImgRe.exec(text)) !== null) {
      const src = mdm[2].trim();
      const fname = getBasename(src);
      if (src && !imageRegistry.some(i => i.dataUrl === src || (fname && i.filename === fname))) {
        const label = fname || `IMAGE_${imageRegistry.length + 1}`;
        imageRegistry.push({ label, filename: fname, dataUrl: src, isUrl: src.startsWith("http") });
      }
    }

    const apiFileRe = /\/api\/files\/[^\s"')\]]+/g;
    let afm: RegExpExecArray | null;
    while ((afm = apiFileRe.exec(text)) !== null) {
      const src = afm[0].trim();
      const fname = getBasename(src);
      if (src && !imageRegistry.some(i => i.dataUrl === src || (fname && i.filename === fname))) {
        const label = fname || `IMAGE_${imageRegistry.length + 1}`;
        imageRegistry.push({ label, filename: fname, dataUrl: src, isUrl: src.startsWith("http") });
      }
    }
  }

  const hasImages = imageRegistry.length > 0;
  const availableImageNames = imageRegistry.map(i => i.filename || i.label).filter(Boolean);
  const imageInstructions = hasImages
    ? `\n\nFIGURE & DIAGRAM DETECTION — STRICT RULES:
This document contains ${imageRegistry.length} figure/diagram image(s): [${availableImageNames.join(", ")}].
1. IGNORE FOOTER LOGOS & WATERMARKS: Do NOT attach publisher logos, app icons, QR codes, or header/footer watermarks (e.g. PW app logo, book icon) to any question. ONLY attach real educational diagrams: physics graphs, circuit diagrams, pulley setups, geometry figures, and coordinate axes.
2. MULTI-COLUMN & ADJACENT GRAPHS: If a question refers to a diagram or graph located in an adjacent column or top/bottom of the page, find the matching figure containing labels (such as points C, D, E, F) and attach that exact graph filename in "imageRef".
3. OPTION DIAGRAMS: If individual options have diagrams, attach "imageUrl" to that specific option in the "options" array.
4. If the question has a diagram, set "imageRef" to the EXACT image filename (e.g., "${availableImageNames[0] || 'image_0.png'}"). If it is purely text with NO diagram, omit "imageRef" (or set to null).`
    : "";

  const imageSchema = hasImages
    ? `      "imageRef": "${availableImageNames[0] || 'image_0.png'}"`
    : "";

  const safeText = (text || "").trim();
  const contentForAi = safeText.length > 80000
    ? safeText.slice(0, 80000) + "\n\n[... document truncated at 80k chars ...]"
    : safeText;

  const systemPrompt = `You are an elite educational AI parser and curriculum specialist.
Your job is to thoroughly analyze content extracted from educational documents and extract structured Chapters, Topics, and Questions.
Target Context: ${contextStr || "General Curriculum"}.

CRITICAL REQUIREMENTS:
1. MANDATORY CORRECT ANSWER & EXPLANATION: For EVERY extracted question, you MUST SOLVE the question to determine the "correctAnswer" (e.g. "A", "B", "C", "D") and write a clear, step-by-step educational "explanation" (solution). Even if the original document is an unsolved test, YOU MUST SOLVE IT YOURSELF. NEVER leave correctAnswer or explanation empty!
2. LaTeX MATH NOTATION: Preserve and format all mathematical equations, variables, and formulas using clean LaTeX ($...$ inline, $$...$$ block).
3. 100% VALID JSON: You MUST return ONLY a 100% valid JSON object matching the requested schema. Output must start with '{' and end with '}'.${typesFilterStr}${imageInstructions}`;

  let userPrompt = "";

  if (mode === "curriculum") {
    userPrompt = `Analyze the following document content and extract all Chapters and Topics.

Document Content:
"""
${contentForAi}
"""
${customPrompt ? `\nAdditional Instructions: ${customPrompt}\n` : ""}

Return a JSON object:
{
  "chapters": [
    { "name": "Chapter Name", "description": "Brief overview", "orderIndex": 1 }
  ],
  "topics": [
    { "name": "Topic Name", "description": "Topic overview", "chapterName": "Chapter Name" }
  ],
  "questions": []
}`;
  } else {
    userPrompt = `Analyze the following document content, extract all Questions matching the requested question types, and SOLVE every single question to provide the correct answer and step-by-step solution.${hasTypeFilter ? `\n\nTARGET QUESTION TYPES TO EXTRACT: ${questionTypes.join(", ")}` : ""}

Document Content:
"""
${contentForAi}
"""
${customPrompt ? `\nAdditional Instructions: ${customPrompt}\n` : ""}

Return a JSON object:
{
  "chapters": [
    { "name": "Chapter Name", "description": "Overview", "orderIndex": 1 }
  ],
  "topics": [
    { "name": "Topic Name", "description": "Overview", "chapterName": "Chapter Name" }
  ],
  "questions": [
    {
      "question": "Full question statement with LaTeX math notation",
      "questionType": "${hasTypeFilter ? questionTypes[0] : 'single_choice'}",
      "difficulty": "medium",
      "correctAnswer": "A",
      "options": [
        { "id": "A", "text": "Option A text", "imageUrl": null },
        { "id": "B", "text": "Option B text", "imageUrl": null },
        { "id": "C", "text": "Option C text", "imageUrl": null },
        { "id": "D", "text": "Option D text", "imageUrl": null }
      ],
      "explanation": "Detailed step-by-step solution and mathematical reasoning",
      "marks": 4,
      "chapterName": "Chapter Name",
      "topicName": "Topic Name"${hasImages ? `,\n${imageSchema}` : ""}
    }
  ]
}`;
  }

  onProgress?.(40, "AI Analyzing, Solving Questions & Formatting LaTeX...");

  let rawContent = "";
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
    rawContent = aiResult.content;
  } catch (aiErr: any) {
    throw new Error(`AI Provider Call Failed: ${aiErr.message || "Unknown error"}`);
  }

  onProgress?.(80, "Validating & Repairing JSON Output...");

  let parsed: any = {};
  try {
    parsed = parseJSON(rawContent);
  } catch {
    try {
      const repaired = repairJsonWithLatex(rawContent);
      parsed = JSON.parse(extractJsonObject(repaired));
    } catch {
      try {
        const match = rawContent.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch (e: any) {
        throw new Error("AI returned invalid JSON. Please re-run extraction.");
      }
    }
  }

  const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
  const rawTopics = Array.isArray(parsed.topics) ? parsed.topics : [];
  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

  const chapters: ExtractedChapter[] = rawChapters.map((c: any, i: number) => ({
    name: String(c.name || "").trim(),
    description: c.description ? String(c.description).trim() : "",
    orderIndex: typeof c.orderIndex === "number" ? c.orderIndex : i + 1,
  })).filter((c: any) => c.name.length > 0);

  const topics: ExtractedTopic[] = rawTopics.map((t: any) => ({
    name: String(t.name || "").trim(),
    description: t.description ? String(t.description).trim() : "",
    chapterName: String(t.chapterName || chapters[0]?.name || "General").trim(),
  })).filter((t: any) => t.name.length > 0);

  const questions: ExtractedQuestion[] = rawQuestions.map((q: any) => {
    let options = q.options;
    if (Array.isArray(options)) {
      options = options.map((opt: any, idx: number) => {
        if (typeof opt === "string") {
          return { id: String.fromCharCode(65 + idx), text: opt, imageUrl: null };
        }
        return {
          id: String(opt.id || String.fromCharCode(65 + idx)),
          text: String(opt.text || opt.value || ""),
          imageUrl: opt.imageUrl ? String(opt.imageUrl) : undefined,
        };
      });
    } else {
      options = null;
    }

    const rawDiff = String(q.difficulty || "medium").toLowerCase();
    const difficulty = rawDiff.includes("easy") ? "easy" : rawDiff.includes("hard") ? "hard" : "medium";
    const difficultyScore = difficulty === "easy" ? 3 : difficulty === "hard" ? 8 : 5;

    // Resolve Image URL if imageRef was provided
    let imageUrl = q.imageUrl || undefined;
    if (q.imageRef && hasImages) {
      const cleanRef = getBasename(String(q.imageRef));
      const matched = imageRegistry.find(
        (img) => img.filename === cleanRef || img.label.toLowerCase() === cleanRef.toLowerCase()
      );
      if (matched) {
        imageUrl = matched.dataUrl;
      }
    }

    return {
      question: String(q.question || q.questionText || "").trim(),
      questionType: q.questionType || (options && options.length > 0 ? "single_choice" : "subjective"),
      difficulty,
      difficultyScore,
      correctAnswer: q.correctAnswer != null ? String(q.correctAnswer).trim() : undefined,
      options,
      explanation: q.explanation ? String(q.explanation).trim() : "",
      marks: typeof q.marks === "number" ? q.marks : 4,
      chapterName: q.chapterName ? String(q.chapterName).trim() : chapters[0]?.name,
      topicName: q.topicName ? String(q.topicName).trim() : topics[0]?.name,
      imageUrl,
      imageRef: q.imageRef ? String(q.imageRef) : undefined,
    };
  }).filter((q: any) => q.question.length > 0);

  onProgress?.(100, "Extraction Complete!");

  return {
    chapters,
    topics,
    questions,
    summary: {
      chaptersCount: chapters.length,
      topicsCount: topics.length,
      questionsCount: questions.length,
    },
  };
}

// ─── 1. Asynchronous / Synchronous Extraction Endpoint ─────────────────────
router.post("/ai/extract-from-text", requireAuth, async (req, res) => {
  req.socket?.setTimeout(0);
  res.setTimeout(0);

  try {
    const {
      text,
      htmlContent,
      mode = "full",
      boardId,
      standardId,
      subjectId,
      providerId,
      model,
      customPrompt,
      questionTypes = [],
      asyncMode = false,
    } = req.body;

    if (asyncMode) {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const job: AiExtractionJob = {
        id: jobId,
        status: "processing",
        progress: 10,
        statusText: "Initializing extraction job...",
        createdAt: Date.now(),
      };
      aiExtractionJobs.set(jobId, job);

      void executeAiExtraction({
        text,
        htmlContent,
        mode,
        boardId,
        standardId,
        subjectId,
        providerId,
        model,
        customPrompt,
        questionTypes,
        onProgress: (progress, statusText) => {
          job.progress = progress;
          job.statusText = statusText;
        },
        reqLog: req.log,
      })
        .then((result) => {
          job.status = "completed";
          job.progress = 100;
          job.statusText = "Completed!";
          job.result = result;
        })
        .catch((err) => {
          job.status = "failed";
          job.error = err.message || "Extraction failed";
        });

      return res.status(202).json({
        success: true,
        jobId,
        status: "processing",
        message: "Extraction started in background.",
      });
    }

    const result = await executeAiExtraction({
      text,
      htmlContent,
      mode,
      boardId,
      standardId,
      subjectId,
      providerId,
      model,
      customPrompt,
      questionTypes,
      reqLog: req.log,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    req.log.error({ err }, "Extract from text error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 1.1 Polling Status Endpoint for Async Extraction ──────────────────────
router.get("/ai/extraction-status/:jobId", requireAuth, (req, res) => {
  const { jobId } = req.params;
  const job = aiExtractionJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Extraction job not found." });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    statusText: job.statusText,
    result: job.result,
    error: job.error,
  });
});

// ─── 2. Bulk Import Extracted Data into Database ────────────────────────────
router.post("/ai/import-extracted", requireAuth, async (req, res) => {
  try {
    const {
      boardId,
      standardId,
      subjectId,
      chapters = [],
      topics = [],
      questions = [],
      providerId,
      modelUsed,
    } = req.body;

    const caller = (req as any).user;
    const now = nowTs();

    // If caller is Sub-Admin, stage into approvalRequests collection
    if (caller && caller.role === "subadmin") {
      const requestId = await nextId("approvalRequests");
      const summary = `Bulk Import: ${questions.length} question(s), ${chapters.length} chapter(s), ${topics.length} topic(s)`;

      const approvalReq = {
        id: requestId,
        subAdminId: caller.userId,
        subAdminName: caller.name || caller.email,
        subAdminEmail: caller.email,
        actionType: "IMPORT_PDF_EXTRACT",
        entityType: "questions",
        payload: {
          boardId,
          standardId,
          subjectId,
          chapters,
          topics,
          questions,
          providerId,
          modelUsed,
        },
        summary,
        status: "pending",
        reviewedBy: null,
        reviewedByName: null,
        reviewNote: null,
        createdAt: now,
        reviewedAt: null,
      };

      await firestore.collection("approvalRequests").doc(String(requestId)).set(approvalReq);

      await logActivity({
        userId: caller.userId,
        userName: caller.name || caller.email,
        userEmail: caller.email,
        userRole: caller.role,
        action: "SUBMIT_APPROVAL_REQUEST",
        resource: "approvalRequests",
        details: { requestId, actionType: "IMPORT_PDF_EXTRACT", questionsCount: questions.length },
        ipAddress: req.ip,
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        requestId,
        message: `Submitted ${questions.length} questions for Super Admin approval. Once approved, they will be published.`,
        savedChapters: 0,
        savedTopics: 0,
        savedQuestions: 0,
      });
    }

    let savedChaptersCount = 0;
    let savedTopicsCount = 0;
    let savedQuestionsCount = 0;

    const existingChaptersSnap = subjectId
      ? await firestore.collection("chapters").where("subjectId", "==", Number(subjectId)).get()
      : await firestore.collection("chapters").get();

    const chapterMap = new Map<string, number>();
    existingChaptersSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.name) chapterMap.set(data.name.trim().toLowerCase(), data.id);
    });

    for (const chap of chapters) {
      const key = chap.name.trim().toLowerCase();
      if (!chapterMap.has(key)) {
        const id = await nextId("chapters");
        const chapData = {
          id,
          name: chap.name.trim(),
          description: chap.description || null,
          orderIndex: chap.orderIndex ?? 1,
          subjectId: subjectId ? Number(subjectId) : null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        await firestore.collection("chapters").doc(String(id)).set(chapData);
        chapterMap.set(key, id);
        savedChaptersCount++;
      }
    }

    const topicMap = new Map<string, number>();
    const existingTopicsSnap = await firestore.collection("topics").get();
    existingTopicsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.name && data.chapterId) {
        topicMap.set(`${data.chapterId}:${data.name.trim().toLowerCase()}`, data.id);
      }
    });

    for (const top of topics) {
      const chapKey = top.chapterName.trim().toLowerCase();
      const chapId = chapterMap.get(chapKey) || Array.from(chapterMap.values())[0] || null;
      if (!chapId) continue;

      const topKey = `${chapId}:${top.name.trim().toLowerCase()}`;
      if (!topicMap.has(topKey)) {
        const id = await nextId("topics");
        const topData = {
          id,
          name: top.name.trim(),
          description: top.description || null,
          chapterId: chapId,
          chapterName: top.chapterName,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        await firestore.collection("topics").doc(String(id)).set(topData);
        topicMap.set(topKey, id);
        savedTopicsCount++;
      }
    }

    if (questions.length > 0) {
      const qIds = await nextNIds("questions", questions.length);
      const batchSize = 400;

      for (let i = 0; i < questions.length; i += batchSize) {
        const batch = firestore.batch();
        const chunk = questions.slice(i, i + batchSize);

        chunk.forEach((q: any, chunkIdx: number) => {
          const globalIdx = i + chunkIdx;
          const qId = qIds[globalIdx]!;

          const chapKey = (q.chapterName || "").trim().toLowerCase();
          const chapId = chapterMap.get(chapKey) || Array.from(chapterMap.values())[0] || null;

          const topKey = chapId && q.topicName ? `${chapId}:${q.topicName.trim().toLowerCase()}` : "";
          const topId = topicMap.get(topKey) || (chapId ? Array.from(topicMap.entries()).find(([k]) => k.startsWith(`${chapId}:`))?.[1] : null) || null;

          const docData = {
            id: qId,
            question: q.question,
            questionType: q.questionType || "single_choice",
            difficulty: q.difficulty || "medium",
            difficultyScore: q.difficultyScore || 5,
            correctAnswer: q.correctAnswer ?? null,
            options: q.options ?? null,
            explanation: q.explanation || null,
            marks: q.marks ?? 4,
            imageUrl: q.imageUrl || null,
            translations: q.translations || null,
            topicId: topId,
            chapterId: chapId,
            subjectId: subjectId ? Number(subjectId) : null,
            standardId: standardId ? Number(standardId) : null,
            boardId: boardId ? Number(boardId) : null,
            providerId: providerId ? Number(providerId) : null,
            modelUsed: modelUsed || null,
            jobId: null,
            generatedAt: now,
            updatedAt: now,
          };

          batch.set(firestore.collection("questions").doc(String(qId)), docData);
        });

        await batch.commit();
        savedQuestionsCount += chunk.length;
      }
    }

    res.json({
      success: true,
      savedChapters: savedChaptersCount,
      savedTopics: savedTopicsCount,
      savedQuestions: savedQuestionsCount,
    });
  } catch (err: any) {
    req.log.error({ err }, "Import extracted data error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 3. Generate Similar Questions ──────────────────────────────────────────
router.post("/ai/generate-similar-questions", requireAuth, async (req, res) => {
  req.socket?.setTimeout(0);
  res.setTimeout(0);
  try {
    const {
      exampleQuestions,
      count = 3,
      providerId,
      model,
      boardId,
      standardId,
      subjectId,
      customInstructions,
    } = req.body;

    if (!exampleQuestions || !Array.isArray(exampleQuestions) || exampleQuestions.length === 0) {
      return res.status(400).json({ error: "At least one example question is required" });
    }

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
      return res.status(400).json({ error: "No AI Providers found." });
    }

    const provider = providerDoc.data() as any;
    const selectedModel = model || provider.defaultModel || provider.availableModels?.[0] || "gemini-2.0-flash";
    const rawToken = provider.encryptedToken ? simpleDecrypt(provider.encryptedToken) : provider.apiKey || provider.accessToken || "";
    const token = (rawToken || "").trim().replace(/^["']|["']$/g, "");

    const targetCount = Math.min(10, Math.max(1, count));
    const firstEx = exampleQuestions[0]!;
    const primaryTopic = firstEx.topicName || "";
    const primaryChapter = firstEx.chapterName || "";

    const examplesFormatted = exampleQuestions.slice(0, 5).map((ex: any, idx: number) => {
      let optsStr = "";
      if (ex.options && Array.isArray(ex.options)) {
        optsStr = ex.options.map((o: any) => `(${o.id}) ${o.text}`).join("\n");
      }
      return `Example ${idx + 1}:
Question: ${ex.question}
Type: ${ex.questionType || "single_choice"}
Difficulty: ${ex.difficulty || "medium"}
${optsStr ? `Options:\n${optsStr}` : ""}
Correct Answer: ${ex.correctAnswer || "N/A"}
Explanation: ${ex.explanation || "N/A"}
Topic: ${ex.topicName || primaryTopic || "N/A"}
Chapter: ${ex.chapterName || primaryChapter || "N/A"}`;
    }).join("\n\n---\n\n");

    const systemPrompt = `You are a master question creator and subject matter expert.
Generate NEW, ORIGINAL, high-quality exam questions following the reference style and LaTeX formatting.
Return ONLY valid JSON matching the schema.`;

    const userPrompt = `Here are reference example question(s):
${examplesFormatted}

Task:
Generate exactly ${targetCount} NEW similar questions.
${customInstructions ? `\nAdditional Instructions: ${customInstructions}\n` : ""}

Return a JSON object:
{
  "questions": [
    {
      "question": "Question with LaTeX math notation",
      "questionType": "single_choice",
      "difficulty": "medium",
      "correctAnswer": "A",
      "options": [
        { "id": "A", "text": "Option A" },
        { "id": "B", "text": "Option B" },
        { "id": "C", "text": "Option C" },
        { "id": "D", "text": "Option D" }
      ],
      "explanation": "Detailed step-by-step solution",
      "marks": 4,
      "chapterName": "${primaryChapter}",
      "topicName": "${primaryTopic}"
    }
  ]
}`;

    const aiResult = await callAIWithTokens(
      token,
      selectedModel,
      provider.providerType || "gemini",
      systemPrompt,
      userPrompt,
      0.5,
      8192,
      true,
      provider.baseUrl
    );

    const parsedResult = parseJSON<{ questions?: any[] }>(aiResult.content);
    const rawQuestions = Array.isArray(parsedResult.questions) ? parsedResult.questions : [];

    const questions: ExtractedQuestion[] = rawQuestions.map((q: any) => {
      let options = q.options;
      if (Array.isArray(options)) {
        options = options.map((opt: any, idx: number) => {
          if (typeof opt === "string") return { id: String.fromCharCode(65 + idx), text: opt };
          return { id: String(opt.id || String.fromCharCode(65 + idx)), text: String(opt.text || "") };
        });
      }
      return {
        question: String(q.question || "").trim(),
        questionType: q.questionType || firstEx.questionType || "single_choice",
        difficulty: q.difficulty || "medium",
        difficultyScore: q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 8 : 5,
        correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : undefined,
        options,
        explanation: q.explanation ? String(q.explanation).trim() : "",
        marks: q.marks || 4,
        chapterName: q.chapterName || primaryChapter,
        topicName: q.topicName || primaryTopic,
      };
    }).filter((q: any) => q.question.length > 0);

    res.json({ questions, count: questions.length });
  } catch (err: any) {
    req.log.error({ err }, "Generate similar questions error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 4. Auto-Solve and Generate Missing Answers ────────────────────────────
router.post("/ai/solve-missing-answers", requireAuth, async (req, res) => {
  req.socket?.setTimeout(0);
  res.setTimeout(0);
  try {
    const { questions, providerId, model } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Missing or invalid 'questions' array" });
    }

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
      return res.status(500).json({ error: "No active AI provider configured" });
    }

    const provider = providerDoc.data() as any;
    const rawToken = provider.encryptedToken ? simpleDecrypt(provider.encryptedToken) : provider.apiKey || provider.accessToken || "";
    const token = (rawToken || "").trim().replace(/^["']|["']$/g, "");
    const selectedModel = model || provider.defaultModel || provider.availableModels?.[0] || "gemini-2.0-flash";

    const systemPrompt = `You are a master academic solver and exam evaluator (JEE/NEET/CBSE/NCERT).
Accurately SOLVE each question, identify the exact correct option letter ("A", "B", "C", "D"), and write a detailed, step-by-step mathematical solution.
Return ONLY a valid JSON array matching the exact questions list length and order.`;

    const CHUNK_SIZE = 4;
    const solvedMap = new Map<number, any>();

    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      const questionsToSolve = chunk.map((q: any, cIdx: number) => ({
        index: i + cIdx,
        id: q.id,
        question: q.question,
        options: q.options,
        questionType: q.questionType || "single_choice",
      }));

      const userPrompt = `Solve these ${questionsToSolve.length} questions and output the correct answer and detailed explanation for each:
${JSON.stringify(questionsToSolve, null, 2)}

Return a JSON array in this exact format:
[
  {
    "index": ${i},
    "correctAnswer": "B",
    "explanation": "Step-by-step solution..."
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

        let solvedList: any[] = [];
        try {
          solvedList = parseJSON<any[]>(aiResult.content);
        } catch {
          solvedList = JSON.parse(repairJsonWithLatex(aiResult.content));
        }

        if (Array.isArray(solvedList)) {
          solvedList.forEach((s, sIdx) => {
            const globalIdx = typeof s.index === "number" ? s.index : i + sIdx;
            solvedMap.set(globalIdx, s);
          });
        }
      } catch (chunkErr: any) {
        req.log.warn({ err: chunkErr, chunkIndex: i }, "Solve questions chunk failed");
      }
    }

    const updatedQuestions = questions.map((q: any, idx: number) => {
      const s = solvedMap.get(idx);
      if (!s) return q;

      let ans = s.correctAnswer != null ? String(s.correctAnswer).trim() : q.correctAnswer;
      if (ans && q.options && Array.isArray(q.options)) {
        const matchedOpt = q.options.find(
          (opt: any) =>
            (opt.id && opt.id.toLowerCase() === ans.toLowerCase()) ||
            (opt.text && opt.text.trim().toLowerCase() === ans.toLowerCase()) ||
            (opt.id && ans.toLowerCase().startsWith(opt.id.toLowerCase() + ".")) ||
            (opt.id && ans.toLowerCase().startsWith(opt.id.toLowerCase() + ")"))
        );
        if (matchedOpt) {
          ans = matchedOpt.id;
        }
      }

      return {
        ...q,
        correctAnswer: ans || q.correctAnswer,
        explanation: String(s.explanation || q.explanation || "").trim(),
      };
    });

    res.json({ questions: updatedQuestions, count: updatedQuestions.length });
  } catch (err: any) {
    req.log.error({ err }, "Solve missing answers error");
    res.status(500).json({ error: err.message || "Failed to solve questions" });
  }
});

export default router;
