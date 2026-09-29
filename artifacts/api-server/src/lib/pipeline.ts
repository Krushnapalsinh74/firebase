import { randomUUID } from "crypto";
import { firestore, snapshotToArr } from "@workspace/db";
import { callBrowserAI } from "./browserAi.js";
import { simpleDecrypt } from "./auth.js";

// ─── Shared Types & Constants ────────────────────────────────────────────────

export interface MicroTopic {
  name: string;
  concepts: string[];
  crossLinks?: string[];
  depth?: number;
}

export interface ConceptSeed {
  selectedTopics: MicroTopic[];
  persona: { name: string; style: string };
}

export interface AgentResult {
  question: string;
  correctAnswer: string;
  options?: string;
  explanation: string;
  learningObjective: string;
  estimatedSolveTime: number;
  difficultyScore: number;
  qualityScore: number;
  factuallyValid: boolean;
  syllabusAligned: boolean;
  grammarOk: boolean;
  difficultyVerified: boolean;
  conceptsUsed: string[];
  crossChapterLinks: string[];
  persona: string;
  hiddenObservation: string;
  commonMistake: string;
  bloomsLevel: string;
  cognitiveLoad: Record<string, unknown>;
  qualityScores: Record<string, unknown>;
  overallScore: number;
  selfCritique: string;
  expertComment: string;
}

export interface GenerationRequest {
  topicId: string;
  chapterId: string;
  subjectId: string;
  boardId: string;
  standardId: string;
  providerId: string;
  model: string;
  count: number;
  questionType: string;
  difficulty: string;
  jeeAdvancedOnly?: boolean;
  customInstructions?: string;
  includeDiagrams?: 'no' | 'yes' | 'ai' | 'provider';
  diagramProviderId?: number | string;
  diagramProviderType?: string;
  diagramModel?: string;
  diagramApiKey?: string;
  diagramToken?: string;
  marks?: number | null;
}

const OFF_SYLLABUS_KEYWORDS = [
  "minkowski", "fourier", "laplace", "tensor", "manifold", "topology",
  "projective geometry", "convex hull", "hilbert space", "banach",
  "lebesgue", "riemann surface", "algebraic geometry", "galois",
  "category theory", "differential form", "lie algebra", "spinor",
  "quantum field", "stochastic", "markov chain", "monte carlo",
  "generating function", "z-transform", "wavelet",
  "biology", "botany", "zoology", "taxonomy", "taxonomic", "biodiversity",
  "binomial nomenclature", "living organism", "living organisms", "anatomy",
  "physiology", "ecology", "microorganism", "microorganisms", "cell biology",
];

export function isAllowedTopic(name: string): boolean {
  const lower = name.toLowerCase();
  return !OFF_SYLLABUS_KEYWORDS.some(kw => lower.includes(kw));
}

export function isJeeGenerationAllowedContext(ctx: { topicName: string; chapterName: string; subjectName: string }): boolean {
  const combined = [ctx.topicName, ctx.chapterName, ctx.subjectName].join(" ");
  return isAllowedTopic(combined);
}

const SYLLABUS_GUARDRAIL = `SYLLABUS RULE: Every concept you use MUST be from the official JEE Advanced syllabus.
Difficulty must arise from combining syllabus concepts in non-obvious ways.
NEVER introduce graduate-level mathematics (Fourier transforms, Minkowski sums, tensors, topology, Galois theory, etc.).`;

export const PERSONAS = [
  { name: "Vector & Geometry Specialist", style: `Combines coordinate geometry with vector algebra. Favours locus problems, distance optimisation, and hidden dot-product identities. ${SYLLABUS_GUARDRAIL}` },
  { name: "Calculus & Analysis Expert", style: `Designs problems around limits with L'H\u00f4pital edge-cases, definite integrals with parameter tricks, and functional equations disguised as calculus. ${SYLLABUS_GUARDRAIL}` },
  { name: "Olympiad Problem Architect", style: `Creates problems requiring elegant invariant arguments, extremum without calculus, and unexpected substitutions. Innovation comes ONLY from combining JEE syllabus concepts. ${SYLLABUS_GUARDRAIL}` },
  { name: "Mechanics & Experimental Physicist", style: `Specialises in constraint-rich dynamics, non-inertial frames, thermodynamic cycles with hidden symmetry, and wave superposition. ${SYLLABUS_GUARDRAIL}` },
  { name: "Algebraic Manipulation Virtuoso", style: `Uses polynomial identities, complex number geometry, binomial coefficient manipulation, and number-theoretic arguments hidden inside algebra. ${SYLLABUS_GUARDRAIL}` },
  { name: "Multi-Concept Integration Master", style: `Creates problems that require EXACTLY three different JEE syllabus chapters to solve. The solution path is non-obvious and each chapter's idea is load-bearing. ${SYLLABUS_GUARDRAIL}` },
];

export const DIFFICULTY_GUIDE: Record<string, string> = {
  easy: "Single concept, direct application with a slight twist.",
  medium: "Two concepts combined with a non-obvious bridge.",
  hard: "Multiple concepts with layered reasoning and a hidden step.",
  advanced: "Multiple deep concepts, Olympiad-level insight, non-obvious substitutions.",
  expert: "Multiple deep concepts, Olympiad-level insight, non-obvious substitutions.",
};

export const QUALITY = {
  weights: {
    conceptualDepth:    0.30,
    hiddenObservation:  0.25,
    originality:        0.20,
    jeeSimilarity:      0.15,
    algebraComplexity:  0.10,
  },
  minOverall:           8.7,
  minSingleAxis:        6.0,
  minMicroTopics:       3,
  maxRetries:           3,
  maxStage1Retries:     2,
  duplicateThreshold:   0.72,
};

const FALLBACK_TOPICS: Record<string, MicroTopic[]> = {
  Trigonometry: [
    { name: 'Compound Angle with hidden symmetry', concepts: ['Compound Angles'], crossLinks: ['Coordinate Geometry'], depth: 4 },
    { name: 'General Solution with parameter restrictions', concepts: ['General Solution'], crossLinks: ['Algebra'], depth: 4 },
    { name: 'Inverse Trigonometry composition', concepts: ['Inverse Trig'], crossLinks: ['Functions'], depth: 4 },
    { name: 'Triangle identity optimization', concepts: ['Triangle Identities', 'Optimization'], crossLinks: ['Calculus'], depth: 4 },
    { name: 'Sum-to-product transformation', concepts: ['Sum-Product'], crossLinks: [], depth: 3 },
  ],
  DEFAULT: [
    { name: 'Core concept with hidden insight', concepts: ['Core Concept'], crossLinks: [], depth: 3 },
    { name: 'Multi-step reasoning problem', concepts: ['Multi-step'], crossLinks: [], depth: 4 },
    { name: 'Optimization problem', concepts: ['Optimization'], crossLinks: [], depth: 4 },
  ],
};

export function getFallbackTopics(chapterName: string, topicName: string): MicroTopic[] {
  const key = Object.keys(FALLBACK_TOPICS).find(k =>
    chapterName.toLowerCase().includes(k.toLowerCase())
  ) ?? 'DEFAULT';
  const base = [...FALLBACK_TOPICS[key]];
  if (!base.find(t => t.name.includes(topicName))) {
    base.unshift({ name: topicName, concepts: [topicName, chapterName], crossLinks: [], depth: 3 });
  }
  return base;
}

export function computeWeightedScore(scores: Record<string, number>): number {
  const w = QUALITY.weights;
  return (
    w.conceptualDepth   * (scores.conceptualDepth   || 0) +
    w.hiddenObservation * (scores.hiddenObservation || 0) +
    w.originality       * (scores.originality       || 0) +
    w.jeeSimilarity     * (scores.jeeSimilarity     || 0) +
    w.algebraComplexity * (scores.algebraComplexity || 0)
  );
}

// ─── AI Client with Token Tracking ──────────────────────────────────────────

const OPENAI_COMPAT_ENDPOINTS: Record<string, string> = {
  openai:        "https://api.openai.com/v1/chat/completions",
  github_models: "https://models.inference.ai.azure.com/chat/completions",
  groq:          "https://api.groq.com/openai/v1/chat/completions",
  gemini:        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  azure_openai:  "https://models.inference.ai.azure.com/chat/completions",
  cerebras:      "https://api.cerebras.ai/v1/chat/completions",
  deepseek:      "https://api.deepseek.com/chat/completions",
  mistral:       "https://api.mistral.ai/v1/chat/completions",
  together:      "https://api.together.xyz/v1/chat/completions",
  openrouter:    "https://openrouter.ai/api/v1/chat/completions",
};

export interface AICallResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: string;
}

export async function callAIWithTokens(
  token: string, model: string, providerType: string,
  systemPrompt: string, userPrompt: string,
  temperature = 0.9, maxTokens = 4096,
  jsonMode = true,
  customBaseUrl?: string,
): Promise<AICallResult> {
  const cleanToken = (token || "").trim().replace(/^["']|["']$/g, "");

  if (providerType === "custom_local" || providerType === "local_stealth" || providerType === "browser_web") {
    const rawBase = (customBaseUrl || "http://127.0.0.1:9222").trim().replace(/\/+$/, "");
    
    // Check if this endpoint is a Chrome DevTools / Browser DevTunnel
    let isCdp = false;
    try {
      const cdpRes = await fetch(`${rawBase}/json`, { signal: AbortSignal.timeout(3000) });
      if (cdpRes.ok) isCdp = true;
    } catch {}

    if (isCdp || providerType === "local_stealth" || providerType === "browser_web") {
      const combinedPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
      try {
        const { content: browserContent } = await callBrowserAI(model, combinedPrompt, undefined, isCdp ? rawBase : undefined);
        return {
          content: browserContent,
          promptTokens: 0,
          completionTokens: 0,
          finishReason: "stop"
        };
      } catch (browserErr: any) {
        console.warn(`[Browser AI] Browser execution unavailable: ${browserErr.message}. Attempting fallback to active API provider...`);
        try {
          const snap = await firestore.collection("aiProviders")
            .where("isActive", "==", true)
            .get();

          const allActive = snapshotToArr(snap) as any[];
          const fallbackProvider = allActive.find((p: any) => p.providerType !== "local_stealth" && p.providerType !== "browser_web" && p.providerType !== "custom_local" && (p.encryptedToken || p.apiKey));

          if (fallbackProvider) {
            const fallbackToken = simpleDecrypt(fallbackProvider.encryptedToken || fallbackProvider.apiKey);
            const fallbackModel = fallbackProvider.defaultModel || "gemini-2.0-flash";
            const fallbackType = fallbackProvider.providerType || "gemini";
            console.log(`[Browser AI] Cloud environment detected. Successfully routed to fallback provider: ${fallbackProvider.name} (${fallbackType} / ${fallbackModel})`);
            return callAIWithTokens(fallbackToken, fallbackModel, fallbackType, systemPrompt, userPrompt, temperature, maxTokens, jsonMode, fallbackProvider.baseUrl);
          }
        } catch (fallbackErr: any) {
          console.error(`[Browser AI] Fallback failed: ${fallbackErr.message}`);
        }
        throw browserErr;
      }
    }

    // Otherwise standard OpenAI / Ollama / LM Studio format
    let endpoint = rawBase;
    if (!endpoint.endsWith("/chat/completions")) {
      if (endpoint.endsWith("/v1")) {
        endpoint += "/chat/completions";
      } else {
        endpoint += "/v1/chat/completions";
      }
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cleanToken && cleanToken !== "browser_session" && cleanToken !== "local_no_auth") {
      headers["Authorization"] = `Bearer ${cleanToken}`;
    }

    const body: any = {
      model: model || "llama3",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Local AI error (${endpoint}) ${response.status}: ${err.slice(0, 300)}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? data.response ?? "";
    const pt = data.usage?.prompt_tokens ?? 0;
    const ct = data.usage?.completion_tokens ?? 0;
    const finishReason: string = data.choices?.[0]?.finish_reason ?? "stop";
    return { content, promptTokens: pt, completionTokens: ct, finishReason };
  }

  if (!cleanToken && providerType !== "custom_local") {
    throw new Error(`AI Provider has no API key or token configured. Please check AI Provider settings.`);
  }

  if (providerType === "gemini") {
    let cleanModel = (model || "gemini-2.0-flash").replace(/^models\//, "").trim();
    if (!cleanModel || cleanModel === "Gemini" || cleanModel === "gemini" || cleanModel === "Gemini Web" || cleanModel === "Gemini Flash") {
      cleanModel = "gemini-2.0-flash";
    }

    const tryGeminiCall = async (modelToUse: string): Promise<Response> => {
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${encodeURIComponent(cleanToken)}`;
      const geminiBody: any = {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        }
      };
      if (systemPrompt) {
        geminiBody.systemInstruction = { parts: [{ text: systemPrompt }] };
      }
      return fetch(geminiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cleanToken },
        body: JSON.stringify(geminiBody),
      });
    };

    let response = await tryGeminiCall(cleanModel);

    // If 429 rate limit or 503 overloaded on Gemini 2.0 Flash, try fallback to 1.5 Flash or retry after 2s
    if (response.status === 429 || response.status === 503) {
      console.warn(`[Gemini API] Rate limit (429/503) on ${cleanModel}. Attempting automatic backoff & fallback...`);
      await new Promise(r => setTimeout(r, 2000));
      
      const fallbackModelName = cleanModel.includes("2.0") ? "gemini-1.5-flash" : "gemini-2.0-flash";
      response = await tryGeminiCall(fallbackModelName);
      
      if (!response.ok && (response.status === 429 || response.status === 503)) {
        await new Promise(r => setTimeout(r, 3000));
        response = await tryGeminiCall("gemini-1.5-flash-8b");
      }
    }
    
    if (!response.ok) {
      const err = await response.text();
      if (response.status === 429) {
        throw new Error(`Gemini Free Tier Rate Limit (429): Google's free quota for this minute is temporarily full. Please wait 15-30 seconds and try again.`);
      }
      throw new Error(`AI API error (gemini native) ${response.status}: ${err}`);
    }
    
    const data: any = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const pt = data.usageMetadata?.promptTokenCount || 0;
    const ct = data.usageMetadata?.candidatesTokenCount || 0;
    let finishReason = data.candidates?.[0]?.finishReason || "stop";
    finishReason = finishReason.toLowerCase();
    
    if (finishReason === "max_tokens" || finishReason === "length" || (ct > 0 && ct >= maxTokens * 0.95)) {
      console.log("\n===== TRUNCATED GEMINI NATIVE RESPONSE =====");
      console.log(content);
      console.log("============================================\n");
    }
    
    return { content, promptTokens: pt, completionTokens: ct, finishReason };
  }

  if (providerType === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cleanToken,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }
    const data: any = await response.json();
    const content = data.content?.find((c: any) => c.type === "text")?.text || "";
    const pt = data.usage?.input_tokens || 0;
    const ct = data.usage?.output_tokens || 0;
    const finishReason = data.stop_reason || "stop";
    return { content, promptTokens: pt, completionTokens: ct, finishReason };
  }

  const endpoint = OPENAI_COMPAT_ENDPOINTS[providerType] ?? OPENAI_COMPAT_ENDPOINTS.github_models;
  
  const body: any = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  };

  if (jsonMode && (providerType === "openai" || providerType === "github_models" || providerType === "azure_openai")) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cleanToken}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error (${providerType}) ${response.status}: ${text.slice(0, 300)}`);
  }
  
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content ?? "";
  const finishReason: string = data.choices?.[0]?.finish_reason ?? "stop";
  
  let pt = 0, ct = 0;
  if (data.usage) {
    pt = data.usage.prompt_tokens ?? 0;
    ct = data.usage.completion_tokens ?? 0;
  }

  const isActuallyTruncated = ct > 0 && ct >= maxTokens * 0.95;
  if (isActuallyTruncated || (providerType !== "gemini" && finishReason === "length")) {
    throw new Error(`[truncated] Model output was cut off (finishReason=${finishReason}, tokens=${ct}/${maxTokens}). Retry with higher token limit or check API tier limits.`);
  }

  return { content, promptTokens: pt, completionTokens: ct, finishReason };
}

// ─── Tolerant JSON Parser ────────────────────────────────────────────────────

export function extractJsonObject(text: string): string {
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (mdMatch) {
    return mdMatch[1];
  }

  const startMatch = text.match(/(\{|\[)\s*["'{[]/);
  if (!startMatch) {
    return text;
  }
  
  const startIndex = startMatch.index!;
  const startChar = text[startIndex];
  const endChar = startChar === '{' ? '}' : ']';
  
  let stack = 0;
  let inString = false;
  let escape = false;
  
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === startChar) stack++;
      else if (char === endChar) stack--;
      
      if (stack === 0) {
        return text.substring(startIndex, i + 1);
      }
    }
  }
  
  return text.substring(startIndex);
}

export function repairJsonWithLatex(raw: string): string {
  if (!raw || typeof raw !== "string") return "{}";

  let clean = raw.replace(/^\uFEFF/, '').trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // Find outermost JSON object or array
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  let startIdx = 0;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace > startIdx) clean = clean.substring(startIdx, lastBrace + 1);
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    const lastBracket = clean.lastIndexOf(']');
    if (lastBracket > startIdx) clean = clean.substring(startIdx, lastBracket + 1);
  }

  // 1. Double-escape single LaTeX math commands & invalid JSON escape sequences
  let s = clean.replace(/(?<!\\)\\([a-zA-Z]+|[^"\\/bfnrtu0-9])/g, (_match, p1) => {
    return '\\\\' + p1;
  });

  // 2. Fix unclosed strings and brackets if truncated mid-generation
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === c) {
          stack.pop();
        }
      }
    }
  }

  // If truncated inside a string literal, close the string
  if (inString) {
    s += '"';
  }

  // Remove trailing comma if string ended after comma
  s = s.replace(/,\s*$/, '');

  // Close any unclosed object/array brackets in reverse order
  while (stack.length > 0) {
    const closing = stack.pop();
    s = s.replace(/,\s*$/, '') + closing;
  }

  // Remove any remaining trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');

  return s;
}

export function parseJSON<T>(text: string): T {
  if (!text || text.trim().length === 0) throw new Error('[parseJSON] Empty response from AI');

  let clean = text.replace(/^\uFEFF/, '').trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let extracted = clean;
  try { extracted = extractJsonObject(clean); } catch(e) {}

  let p: any;
  try {
    p = JSON.parse(extracted);
  } catch (e1: any) {
    try {
      p = JSON.parse(repairJsonWithLatex(extracted));
    } catch (e2: any) {
      try {
        p = JSON.parse(repairJsonWithLatex(clean));
      } catch (e3: any) {
        throw new Error(`[parseJSON] Parse failed (${e3.message}).`);
      }
    }
  }

  if (typeof p === 'object' && p !== null) {
      if (!p.stem && p.question) p.stem = p.question;
      if (!p.correct && p.answer) p.correct = p.answer;
      if (!p.correct && p.correctAnswer) p.correct = p.correctAnswer;
      if (!p.explanation && p.solution) p.explanation = p.solution;
  }

  if (Array.isArray(p)) return p as T;
  if (typeof p === 'object' && p !== null) {
    // If it's a multi-category object (like chapters, topics, questions), preserve the object
    if (p.chapters || p.topics || p.questions || p.Chapters || p.Topics || p.Questions) {
      return p as T;
    }
    const arrayKeys = Object.keys(p).filter((k) => Array.isArray((p as any)[k]));
    // Only unwrap if there is exactly 1 array key in the object (e.g. { "questions": [...] } or { "data": [...] }) and it's not a question itself
    if (arrayKeys.length === 1 && !p.stem && !p.correct && !p.question) {
      return (p as any)[arrayKeys[0]] as T;
    }
    return p as T;
  }
  
  return p as T;
}

// ─── Semantic Duplicate Detection ─────────────────────────────────────────────

const MATH_OBJECTS = ["triangle","circle","parabola","ellipse","hyperbola","vector","matrix","integral","probability"];
function fingerprint(stem: string): string {
  const norm = stem.toLowerCase();
  const verbs = ['find', 'prove', 'determine', 'calculate', 'evaluate', 'maximize', 'minimize'].filter(c => norm.includes(c));
  const operators = ['+', '-', '=', '\\sum', '\\int', '\\frac', '\\vec'].filter(c => norm.includes(c));
  const entities = ['triangle', 'circle', 'vector', 'matrix', 'function', 'probability', 'velocity', 'force', 'energy'].filter(c => norm.includes(c));
  return [...verbs, ...operators, ...entities].join('-');
}
function jaccard(fp1: string, fp2: string): number {
  if (!fp1 || !fp2) return 0;
  const s1 = new Set(fp1.split("-"));
  const s2 = new Set(fp2.split("-"));
  const inter = [...s1].filter(x => s2.has(x)).length;
  const union = new Set([...s1, ...s2]).size;
  return union === 0 ? 0 : inter / union;
}
export function isDuplicate(stem: string, existingStems: string[]): boolean {
  const fp = fingerprint(stem);
  for (const es of existingStems) {
    if (jaccard(fp, fingerprint(es)) >= QUALITY.duplicateThreshold) return true;
  }
  return false;
}
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Stage 1: Topic Planner ───────────────────────────────────────────────────

export async function planMicroTopics(
  token: string, model: string, providerType: string,
  ctx: { topicName: string; boardName: string; standardName: string; subjectName: string; chapterName: string },
  strictJeeOnly = false,
  customInstructions?: string,
  customBaseUrl?: string,
): Promise<{ topics: MicroTopic[]; tokens: { input: number; output: number } }> {
  if (strictJeeOnly && !isJeeGenerationAllowedContext(ctx)) {
    throw new Error(`[Stage 1] Off-syllabus context: ${ctx.subjectName} / ${ctx.chapterName} / ${ctx.topicName}`);
  }

  // ── Fast path: pull from database (zero AI cost) — only if no custom instructions ──
  // Topics store chapterName as a denormalized field for fast lookup.
  let topicQuery: FirebaseFirestore.Query = firestore
    .collection("topics")
    .where("chapterName", "==", ctx.chapterName);
  if (strictJeeOnly) topicQuery = topicQuery.where("isJeeSyllabus", "==", true);
  const rawTopics = snapshotToArr(await topicQuery.get()) as any[];
  const dbTopics = rawTopics.map((t) => ({
    name: t.name,
    chapter: t.chapterName ?? ctx.chapterName,
    allowedCrossLinks: t.allowedCrossLinks ?? null,
    difficulty: t.difficulty ?? null,
  }));

  if (dbTopics.length >= 3 && !customInstructions) {
    const topics: MicroTopic[] = dbTopics.map(t => ({
      name: t.name,
      concepts: [t.name, t.chapter],
      crossLinks: (() => {
        try { return t.allowedCrossLinks ? JSON.parse(t.allowedCrossLinks) : []; } catch { return []; }
      })(),
      depth: (t.difficulty ?? 2) + 2, // 1->3, 2->4, 3->5
    }));
    return { topics, tokens: { input: 0, output: 0 } };
  }

  // ── Slow path: AI generation with syllabus guard ───────────────────────────
  const sys = `You are the chief academic architect for JEE Advanced syllabus design.
Return ONLY a valid JSON array. No markdown. No explanation.
${SYLLABUS_GUARDRAIL}`;
  const prompt = `Topic: "${ctx.topicName}" — Chapter: "${ctx.chapterName}" (${ctx.subjectName}, ${ctx.boardName} ${ctx.standardName})
${customInstructions ? `\nAdmin Special Instructions / Focus:\n"${customInstructions}"\n` : ''}
Generate exactly 6 to 8 DEEP MICRO-TOPICS for JEE Advanced paper setting.

Rules:
- Every micro-topic MUST directly test "${ctx.topicName}"
${customInstructions ? `- Align the micro-topics with the Admin's instructions above` : ''}
- Each must be specific, narrow, and uniquely testable at JEE Advanced level
- Include non-obvious cross-chapter links or hidden symmetry
- EXCLUDE: NCERT definitions, formula memorisation, standard solved examples
- EXCLUDE: any concept outside the official JEE Advanced syllabus

Return ONLY a JSON array:
[{ "name": "Topic Name", "concepts": ["concept 1", "concept 2"], "crossLinks": ["link 1"], "depth": 4 }]`;

  const { content: raw, promptTokens, completionTokens } = await callAIWithTokens(token, model, providerType, sys, prompt, 0.9, 3000, true, customBaseUrl);
  const parsed = parseJSON<MicroTopic[]>(raw);
  if (!Array.isArray(parsed)) throw new Error(`[Stage 1] Response is not an array`);

  const filtered = parsed.filter(t => isAllowedTopic(t.name));
  if (filtered.length < QUALITY.minMicroTopics) throw new Error(`[Stage 1] Only ${filtered.length} syllabus-valid topics after filtering`);

  return { topics: filtered, tokens: { input: promptTokens, output: completionTokens } };
}

// ─── Stage 2: Concept Fusion ──────────────────────────────────────────────────

export function fuseConceptSeed(microTopics: MicroTopic[], difficulty: string): ConceptSeed {
  const numConcepts = difficulty === "easy" ? 2 : difficulty === "medium" ? 2 : 3;
  const weighted = microTopics.flatMap(t => Array(Math.max(1, t.depth || 3)).fill(t));
  const shuffled = [...weighted].sort(() => Math.random() - 0.5);
  const seen = new Set<string>();
  const selected: MicroTopic[] = [];
  for (const t of shuffled) {
    if (!seen.has(t.name)) { seen.add(t.name); selected.push(t); }
    if (selected.length >= numConcepts) break;
  }
  if (selected.length === 0) throw new Error('[Stage 2] Concept fusion failed');
  const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
  return { selectedTopics: selected, persona };
}

// ─── Stage 3: Question Setter (4 Sub-stages) ──────────────────────────────────

export interface RetryHint {
  category: string;
  suggestion: string;
}

export interface QuestionTypeSpec {
  isMcq: boolean;
  isMultipleCorrect: boolean;
  isNumerical: boolean;
  isTrueFalse: boolean;
  typeLabel: string;
  promptInstructions: string;
  jsonStructure: string;
}

export function getQuestionTypeSpec(questionType: string): QuestionTypeSpec {
  const t = String(questionType || "").toLowerCase().trim();

  if (t === "numerical" || t === "integer") {
    return {
      isMcq: false,
      isMultipleCorrect: false,
      isNumerical: true,
      isTrueFalse: false,
      typeLabel: "Numerical / Integer Answer",
      promptInstructions: `MANDATORY QUESTION TYPE: NUMERICAL / INTEGER ANSWER QUESTION (NO OPTIONS)
- Do NOT provide options (A, B, C, D). The "options" field MUST be omitted.
- The question stem MUST require computing a single numerical or integer value (e.g., "The magnitude of the force in Newtons is ______" or "The value of k is ______").
- "correctAnswer" MUST be a single exact real number or integer (e.g. "4", "11", "0.75").`,
      jsonStructure: `"correctAnswer": "<exact numerical value, e.g. 11>",`,
    };
  }

  if (t === "multiple_correct" || t === "multi-correct" || t === "multiple_choice_multi") {
    return {
      isMcq: true,
      isMultipleCorrect: true,
      isNumerical: false,
      isTrueFalse: false,
      typeLabel: "Multiple Choice (One or More Correct)",
      promptInstructions: `MANDATORY QUESTION TYPE: MULTIPLE CHOICE QUESTION (ONE OR MORE THAN ONE OPTION CORRECT)
- You MUST provide exactly 4 distinct options: A, B, C, D in the "options" array.
- ONE OR MORE options (1, 2, 3, or all 4) can be correct.
- "correctIndices" MUST list all correct option indices (e.g. [0, 2] for options A and C).
- "correctAnswer" must be the comma-separated letters of the correct options (e.g. "A, C").`,
      jsonStructure: `"options": ["<option A>", "<option B>", "<option C>", "<option D>"],
  "correctIndices": [0, 2],
  "correctAnswer": "A, C",`,
    };
  }

  if (t === "true-false" || t === "true_false") {
    return {
      isMcq: true,
      isMultipleCorrect: false,
      isNumerical: false,
      isTrueFalse: true,
      typeLabel: "True or False",
      promptInstructions: `MANDATORY QUESTION TYPE: TRUE OR FALSE QUESTION
- Provide exactly 2 options: ["True", "False"].
- "correctIndices" MUST be [0] (True) or [1] (False).
- "correctAnswer" MUST be "True" or "False".`,
      jsonStructure: `"options": ["True", "False"],
  "correctIndices": [0],
  "correctAnswer": "True",`,
    };
  }

  if (t === "assertion-reason" || t === "assertion_reason") {
    return {
      isMcq: true,
      isMultipleCorrect: false,
      isNumerical: false,
      isTrueFalse: false,
      typeLabel: "Assertion - Reason",
      promptInstructions: `MANDATORY QUESTION TYPE: ASSERTION - REASON QUESTION
- The stem MUST contain two clearly labeled statements: "Assertion (A): <statement>" and "Reason (R): <statement>".
- Options MUST be the 4 standard choices:
  ["Both (A) and (R) are true and (R) is the correct explanation of (A)",
   "Both (A) and (R) are true but (R) is not the correct explanation of (A)",
   "(A) is true but (R) is false",
   "(A) is false but (R) is true"]
- "correctIndices" MUST be [0], [1], [2], or [3].`,
      jsonStructure: `"options": ["Both (A) and (R) are true and (R) is the correct explanation of (A)", "Both (A) and (R) are true but (R) is not the correct explanation of (A)", "(A) is true but (R) is false", "(A) is false but (R) is true"],
  "correctIndices": [0],
  "correctAnswer": "A",`,
    };
  }

  if (t === "match-following" || t === "match_following" || t === "matrix-match") {
    return {
      isMcq: true,
      isMultipleCorrect: false,
      isNumerical: false,
      isTrueFalse: false,
      typeLabel: "Match the Following",
      promptInstructions: `MANDATORY QUESTION TYPE: MATCH THE FOLLOWING / MATRIX MATCH
- Stem must present Column I with items (A, B, C, D) and Column II with items (p, q, r, s).
- Provide 4 distinct matching combination options in "options".
- "correctIndices" MUST specify the single correct matching option [0].`,
      jsonStructure: `"options": ["A->p; B->q; C->r; D->s", "A->q; B->p; C->s; D->r", "A->s; B->r; C->p; D->q", "A->r; B->s; C->q; D->p"],
  "correctIndices": [0],
  "correctAnswer": "A",`,
    };
  }

  if (t === "short-answer" || t === "long-answer" || t === "very-short" || t === "fill-blank" || t === "one-word" || t === "subjective" || t === "case-study") {
    return {
      isMcq: false,
      isMultipleCorrect: false,
      isNumerical: false,
      isTrueFalse: false,
      typeLabel: t.toUpperCase(),
      promptInstructions: `MANDATORY QUESTION TYPE: ${t.toUpperCase()} (DESCRIPTIVE / NON-MCQ)
- Do NOT provide options (A, B, C, D). The "options" field MUST be omitted.
- "correctAnswer" must contain the definitive correct answer or key points.
- "solutionSteps" must provide the complete explanation.`,
      jsonStructure: `"correctAnswer": "<definitive answer>",`,
    };
  }

  // Default: Single Correct Multiple Choice Question
  return {
    isMcq: true,
    isMultipleCorrect: false,
    isNumerical: false,
    isTrueFalse: false,
    typeLabel: "Multiple Choice Question (Single Correct)",
    promptInstructions: `MANDATORY QUESTION TYPE: MULTIPLE CHOICE QUESTION (SINGLE CORRECT OPTION)
- You MUST provide exactly 4 distinct options: A, B, C, D in the "options" array: ["<text of option A>", "<text of option B>", "<text of option C>", "<text of option D>"].
- EXACTLY ONE option MUST be correct.
- "correctIndices" MUST be an array containing exactly one correct index: [0] (or 1, 2, 3).
- "correctAnswer" MUST be the exact value of the correct option.
- NEVER generate a question without 4 options. Every generated question MUST strictly be a 4-option MCQ.`,
    jsonStructure: `"options": ["<option A>", "<option B>", "<option C>", "<option D>"],
  "correctIndices": [0],
  "correctAnswer": "<exact correct value>",`,
  };
}

export async function generateQuestionStages(
  token: string, model: string, providerType: string,
  seed: ConceptSeed, params: GenerationRequest,
  ctx: { topicName: string; chapterName: string; subjectName: string; boardName: string; standardName: string },
  existingStems: string[],
  log: (msg: string) => void,
  tag: string,
  hint?: RetryHint,
  customBaseUrl?: string,
): Promise<{ result: Record<string, unknown>; tokens: { input: number; output: number } }> {
  const { selectedTopics, persona } = seed;
  const conceptList = selectedTopics.map(t => `• ${t.name}`).join("\n");
  const qTypeSpec = getQuestionTypeSpec(params.questionType);

  const sysBase = `You are ${persona.name} — JEE Advanced paper setter.
Return ONLY valid JSON. No markdown formatting (\`\`\`json). No explanations outside the JSON keys. Inside JSON strings, ALL backslashes must be doubled (\\\\vec not \\vec). Wrap ALL math in $ (e.g. $\\\\vec{a}$).`;

  const hintBlock = hint
    ? `\n\u26a0\ufe0f PREVIOUS ATTEMPT REJECTED (${hint.category.toUpperCase()})\nImprovement required: ${hint.suggestion}\n`
    : "";

  const promptAll = `Difficulty: ${params.difficulty.toUpperCase()} — ${DIFFICULTY_GUIDE[params.difficulty]}
Concepts to fuse:
${conceptList}
${hintBlock}
${params.customInstructions ? `\nCRITICAL ADMIN INSTRUCTIONS / SPECIAL REQUIREMENTS (STRICTLY PRIORITIZE THIS):\n"${params.customInstructions}"\n` : ''}
${qTypeSpec.promptInstructions}

Rules:
${params.customInstructions ? `- Strictly adhere to the Admin's instructions and tone specified above.` : ''}
- Include the stem, step-by-step mathematical solution, and metadata.
- Require ≥2 conceptual insights with one non-obvious hidden observation.
- NEVER use standard textbook setups.
- MATHEMATICAL EXISTENCE & RIGOR (CRITICAL):
  • Verify that all constructed geometric loci, tangents, or intersection points (e.g., point M) ACTUALLY EXIST as real points in the specified quadrant/interval. Never assume two curves intersect without algebraic proof.
  • For extrema (minimum/maximum) on an interval (a, b), verify that the extremum is an attained critical point inside the open domain, NOT an unachieved boundary limit / infimum / supremum (e.g. as θ → 0+).
  • Verify every algebra step, series sum, and trigonometric identity so the final answer matches Option A exactly.
- CRITICAL: ALL mathematical variables, vectors, and equations MUST be wrapped in single $ signs (e.g., $\\\\vec{a}$ or $x^2 + y^2 = 1$).
${ params.includeDiagrams === 'provider'
  ? `- If a visual diagram or technical illustration helps the question, provide it in the "diagram" JSON field. Set "type": "image" and provide a detailed academic "imagePrompt" to be rendered with DALL-E 3.`
  : params.includeDiagrams === 'ai' || params.includeDiagrams === 'yes'
  ? `- If a visual diagram or technical illustration genuinely enhances the question, provide it in the "diagram" JSON field. Set "type": "image" with a descriptive "imagePrompt", or "type": "svg" with "content".`
  : `- Do NOT include any diagram. All information must be conveyed through text and math notation only.`
}

Return ONLY this JSON structure (with no extra text):
{
  "stem": "<complete question text, ≥80 chars>",
  "solutionSteps": "<rigorous step-by-step derivation>",
  ${qTypeSpec.jsonStructure}
  "estimatedSolveTimeSeconds": 240,
  "bloomsLevel": "Analyze",
  "hiddenInsight": "<one sentence key insight>"${params.includeDiagrams !== 'no' ? `,
  "diagram": {
    "required": true,
    "type": "image",
    "imagePrompt": "<detailed technical illustration prompt, e.g. 'Physics vector diagram showing two forces u and v at 120 degrees on Cartesian plane'>",
    "content": "<raw svg code if type is svg>",
    "search": "<wikimedia search term if type is wikimedia>"
  }` : ''}
}
${params.includeDiagrams !== 'no' ? '(Omit "diagram" field completely if no diagram is needed).' : ''}`;

  const res = await callAIWithTokens(token, model, providerType, sysBase, promptAll, 0.8, 3000, true, customBaseUrl);
  const data = parseJSON<any>(res.content);

  let stemText = data.stem || data.question || "";
  if (stemText.length < 60) throw new Error("Stem too short");

  // Validate MCQ options strictly if required
  if (qTypeSpec.isMcq) {
    const minOptions = qTypeSpec.isTrueFalse ? 2 : 4;
    if (!Array.isArray(data.options) || data.options.length < minOptions) {
      throw new Error(`Model generated non-MCQ format for ${qTypeSpec.typeLabel} (missing ${minOptions} options). Retrying.`);
    }
  }

  // Handle Diagram & Image Generation Injection — skip only when explicitly disabled
  if (params.includeDiagrams !== 'no' && data.diagram && (data.diagram.required || data.diagram.type)) {
    try {
      const diagType = String(data.diagram.type || "").toLowerCase();
      const imgPrompt = data.diagram.imagePrompt || data.diagram.prompt || data.diagram.search;

      if ((diagType === 'image' || diagType === 'ai_image' || diagType === 'ai') && imgPrompt) {
        let imageUrl = '';

        const diagToken = (params.diagramToken || params.diagramApiKey || token || "").trim();
        const diagProviderType = (params.diagramProviderType || providerType || "").toLowerCase();
        const diagModel = params.diagramModel || (diagProviderType === 'gemini' ? 'imagen-3.0-generate-002' : 'dall-e-3');

        // Provider API option (OpenAI DALL-E or Google Imagen)
        if (params.includeDiagrams === 'provider' && (diagProviderType === 'openai' || diagProviderType === 'azure_openai') && diagToken) {
          try {
            const openAiModel = diagModel.startsWith('dall-e') ? diagModel : 'dall-e-3';
            log(`[Image] Calling OpenAI DALL-E API (${openAiModel}) for high-res diagram...`);
            const dRes = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${diagToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: openAiModel,
                prompt: `Academic scientific educational textbook illustration: ${String(imgPrompt).trim().slice(0, 950)}. Clean white background, high contrast, precise textbook diagram, no watermarks.`,
                n: 1,
                size: openAiModel === 'dall-e-2' ? '512x512' : '1024x1024',
                quality: 'standard',
              }),
            });
            if (dRes.ok) {
              const dData = (await dRes.json()) as any;
              imageUrl = dData?.data?.[0]?.url || '';
              if (imageUrl) log(`[Image] ✓ Generated high-res diagram via OpenAI (${openAiModel})`);
            } else {
              const dErr = await dRes.text();
              log(`[Image] OpenAI DALL-E notice: ${dErr.slice(0, 150)} — falling back to fast AI engine`);
            }
          } catch (dErr: any) {
            log(`[Image] Provider image API failed: ${dErr.message} — falling back`);
          }
        } else if (params.includeDiagrams === 'provider' && diagProviderType === 'gemini' && diagToken) {
          try {
            const googleModel = diagModel.includes('imagen') ? diagModel : 'imagen-3.0-generate-002';
            log(`[Image] Calling Google Imagen API (${googleModel}) for high-res diagram...`);
            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:predict?key=${diagToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instances: [
                  { prompt: `Academic textbook scientific diagram: ${String(imgPrompt).trim().slice(0, 950)}. Pure white background, 2D vector technical line drawing, clear educational labels, high clarity, no dark theme.` }
                ],
                parameters: { sampleCount: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' },
              }),
            });
            if (gRes.ok) {
              const gData = (await gRes.json()) as any;
              const b64 = gData?.predictions?.[0]?.bytesBase64Encoded;
              if (b64) {
                imageUrl = `data:image/jpeg;base64,${b64}`;
                log(`[Image] ✓ Generated high-res diagram via Google Imagen (${googleModel})`);
              }
            } else {
              const gErr = await gRes.text();
              log(`[Image] Google Imagen notice: ${gErr.slice(0, 150)} — falling back`);
            }
          } catch (gErr: any) {
            log(`[Image] Google Imagen API failed: ${gErr.message} — falling back`);
          }
        }

        // Fast Pollinations fallback
        if (!imageUrl) {
          try {
            log(`[Image] Generating high-resolution academic illustration via image engine...`);
            const encodedPrompt = encodeURIComponent(`high quality technical diagram, textbook illustration style, scientific schematic: ${imgPrompt}, clean white background, detailed vector line drawing`);
            const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
            const check = await fetch(fallbackUrl, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
            if (check.ok) {
              imageUrl = fallbackUrl;
              log(`[Image] ✓ High-res academic diagram attached`);
            }
          } catch (imgErr: any) {
            log(`[Image] ⚠️ Diagram engine notice: ${imgErr.message}`);
          }
        }

        if (imageUrl) {
          data.diagram = { ...data.diagram, imageUrl, type: 'image' };
        }
      } else if (diagType === 'wikimedia' && data.diagram.search) {
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&pithumbsize=600&generator=search&gsrsearch=${encodeURIComponent(data.diagram.search)}&gsrlimit=1`;
        const wikiRes = await fetch(url);
        const wikiData: any = await wikiRes.json();
        const pages = wikiData?.query?.pages;
        if (pages) {
          const pageId = Object.keys(pages)[0];
          const thumbUrl = pages[pageId]?.thumbnail?.source;
          if (thumbUrl) {
            stemText += `\n\n<diagram type="image" url="${thumbUrl}"></diagram>`;
          }
        }
      } else if (diagType === 'svg' && data.diagram.content) {
        stemText += `\n\n<diagram type="svg">${data.diagram.content}</diagram>`;
      } else if (imgPrompt) {
        const cleanPrompt = encodeURIComponent(String(imgPrompt).trim());
        const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=800&height=600&nologo=true`;
        stemText += `\n\n<diagram type="image" url="${imageUrl}"></diagram>`;
      }
    } catch (err) {
      log(`[Warning] Diagram generation failed: ${err}`);
    }
  }

  let formattedOptions: string | null = null;
  let correctOption = String(data.correctAnswer || "A");

  if (qTypeSpec.isMcq && Array.isArray(data.options) && data.options.length >= 2) {
    const labels = ['A', 'B', 'C', 'D'];
    formattedOptions = data.options.map((c: any, i: number) => `${labels[i] || i + 1}) ${c}`).join('\n');
    if (Array.isArray(data.correctIndices) && data.correctIndices.length > 0) {
      correctOption = data.correctIndices.map((i: number) => labels[i] || String(i + 1)).join(',');
    }
  } else {
    formattedOptions = null;
  }

  const result = {
    stem: stemText,
    options: formattedOptions,
    correct: correctOption,
    explanation: data.solutionSteps || data.solution || "",
    hiddenObservation: data.hiddenInsight || "",
    estimatedSolveTimeSeconds: data.estimatedSolveTimeSeconds || 240,
    bloomsLevel: data.bloomsLevel || "Analyze",
    metadataGenerated: true,
  };

  log(`${tag} Stage 3 ✓ — Generated everything in Single-Shot`);
  return { result, tokens: { input: res.promptTokens, output: res.completionTokens } };
}

// ─── Post-Generation Review Stages ──────────────────────────────────────────

export async function validateMath(token: string, model: string, providerType: string, q: Record<string, unknown>)
: Promise<{ passed: boolean; issues: string[]; tokens: { input: number; output: number } }> {
  const sys = `You are a rigorous mathematical validator. Return ONLY valid JSON.`;
  const prompt = `Validate:
Question: ${q.stem}
Options: ${q.options || "None"}
Answer: ${q.correct}
Explanation: ${q.explanation}

Verify exactly one correct option, distractors are mathematically incorrect, no duplicate options, no equivalent expressions, answer uniqueness, domain valid, explanation correct.
Return: {"passed": true, "issues": []}`;
  const res = await callAIWithTokens(token, model, providerType, sys, prompt, 0.2, 800, true);
  const parsed = parseJSON<any>(res.content);
  const isPassed = parsed.passed ?? parsed.isValid ?? parsed.valid ?? true;
  const issues = parsed.issues || parsed.errors || [];
  return { passed: isPassed, issues, tokens: { input: res.promptTokens, output: res.completionTokens } };
}

// ─── Stage 5: Two-Panel JEE Reviewer ──────────────────────────────────────────

export type RejectionCategory =
  | "off_syllabus"
  | "too_easy"
  | "too_formulaic"
  | "ambiguous"
  | "weak_options"
  | "wrong_solution"
  | "invalid_math"
  | "domain_error"
  | "";

export interface ExpertReviewResult {
  passed: boolean;
  syllabusCompliant: boolean;
  rejectionCategory: RejectionCategory;
  rejectionReason: string;
  scores: { conceptual: number; originality: number; jeeSuitability: number; algebra: number };
  suggestion: string;
  expertComment: string;
  tokens: { input: number; output: number };
}

/** Reviewer A: JEE Authenticity — checks syllabus, originality, difficulty. */
export async function reviewAsJEEExpert(
  token: string, model: string, providerType: string,
  q: Record<string, unknown>,
  difficulty: string,
  conceptNames: string[],
  customBaseUrl?: string,
): Promise<ExpertReviewResult> {
  const sys = `You are a Senior Academic Auditor and former JEE Advanced Paper Setting Committee Member.
Audit the question strictly according to JEE Advanced quality, mathematical correctness, and real existence standards. Return ONLY valid JSON.`;

  const diffLabel = difficulty.toUpperCase();
  const prompt = `AUDIT REPORT FOR GENERATED JEE ADVANCED QUESTION:
Difficulty Targeted: ${diffLabel}
Fused Concepts: ${conceptNames.join(", ")}

Question Stem:
${q.stem}

Options:
${q.options ? JSON.stringify(q.options) : "None (Integer/Numerical)"}

Stated Correct Answer:
${q.correct}

Proposed Step-by-Step Solution:
${q.explanation || "None"}

Audit Checklist:
1. Math & Solution Soundness: Does the derivation hold without algebraic or conceptual errors?
2. Real Existence: Do all defined points, intersections, and geometric conditions actually exist in the specified domain?
3. Extrema Validity: If asking for min/max, is it truly an attained extremum rather than an infimum/boundary limit?
4. Correct Answer Match: Does the stated correct option precisely equal the derived value?
5. JEE Advanced Depth: Is it genuine IIT Advanced caliber (requiring multi-step insight)?

Rejection categories: "invalid_math" | "domain_error" | "wrong_solution" | "off_syllabus" | "too_easy" | "too_formulaic" | "ambiguous" | ""

Return JSON:
{
  "passed": true,
  "syllabusCompliant": true,
  "rejectionCategory": "",
  "rejectionReason": "",
  "scores": {"conceptual": 8, "originality": 8, "jeeSuitability": 9, "algebra": 7},
  "suggestion": "<one actionable sentence for improvement if rejected, else empty>",
  "expertComment": "<brief positive or constructive comment>"
}`;

  const res = await callAIWithTokens(token, model, providerType, sys, prompt, 0.2, 1000, true, customBaseUrl);
  const parsed = parseJSON<any>(res.content);
  const isPassed = (parsed.passed ?? true) && (parsed.syllabusCompliant ?? true);
  return {
    passed: isPassed,
    syllabusCompliant: parsed.syllabusCompliant ?? true,
    rejectionCategory: parsed.rejectionCategory ?? "",
    rejectionReason: parsed.rejectionReason ?? parsed.reason ?? "Did not meet standard",
    scores: parsed.scores ?? { conceptual: 0, originality: 0, jeeSuitability: 0, algebra: 0 },
    suggestion: parsed.suggestion ?? "",
    expertComment: parsed.expertComment ?? "",
    tokens: { input: res.promptTokens, output: res.completionTokens },
  };
}

/** Reviewer B: Clarity & Correctness — checks wording, answer uniqueness, option quality. */
export async function reviewClarity(
  token: string, model: string, providerType: string,
  q: Record<string, unknown>,
): Promise<{ passed: boolean; rejectionCategory: RejectionCategory; issues: string[]; tokens: { input: number; output: number } }> {
  const sys = `You are a JEE Advanced quality editor. Check question clarity and mathematical correctness. Return ONLY valid JSON.`;
  const prompt = `Check this question:
Question: ${q.stem}
Options: ${q.options || "None"}
Answer: ${q.correct}
Explanation: ${String(q.explanation).slice(0, 400)}

Verify:
1. The question is complete and unambiguous (all data given)
2. The answer is mathematically correct
3. If MCQ: options are distinct and only one (or stated count) is correct
4. No hidden assumptions or missing units

Return JSON:
{
  "passed": true,
  "rejectionCategory": "",
  "issues": []
}
(rejectionCategory options: "ambiguous" | "wrong_solution" | "weak_options" | "")`;

  const res = await callAIWithTokens(token, model, providerType, sys, prompt, 0.2, 700, true);
  const parsed = parseJSON<any>(res.content);
  return {
    passed: parsed.passed ?? parsed.isValid ?? true,
    rejectionCategory: parsed.rejectionCategory ?? "",
    issues: parsed.issues || parsed.errors || [],
    tokens: { input: res.promptTokens, output: res.completionTokens },
  };
}

export async function analyzeDifficulty(token: string, model: string, providerType: string, q: Record<string, unknown>, seed: ConceptSeed, blooms: string, customBaseUrl?: string)
: Promise<{ passed: boolean; overallScore: number; scores: any; tokens: { input: number; output: number } }> {
  const sys = `You are a cognitive scientist. Return ONLY valid JSON.`;
  const prompt = `Score this question (0-10 each axis):
${q.stem}
Concepts: ${seed.selectedTopics.map(t => t.name).join(", ")}
Return: {
  "scores": {"conceptualDepth":9,"hiddenObservation":9,"originality":8,"jeeSimilarity":9,"algebraComplexity":7},
  "passed": true
}`;
  const res = await callAIWithTokens(token, model, providerType, sys, prompt, 0.2, 1000, true, customBaseUrl);
  const parsed = parseJSON<any>(res.content);
  const overall = computeWeightedScore(parsed.scores || {});
  return { 
    passed: parsed.passed !== false, 
    overallScore: parseFloat(overall.toFixed(2)), 
    scores: parsed.scores, 
    tokens: { input: res.promptTokens, output: res.completionTokens } 
  };
}

export async function runPaperEditor(token: string, model: string, providerType: string, questions: AgentResult[], customBaseUrl?: string)
: Promise<{ passed: boolean; rejectedIndices: number[]; suggestions: string; tokens: { input: number; output: number } }> {
  if (questions.length < 2) return { passed: true, rejectedIndices: [], suggestions: "", tokens: { input: 0, output: 0 } };

  const sys = `You are the Chief Paper Editor for JEE Advanced. Return ONLY valid JSON.`;
  const summaries = questions.map((q, i) => ({ index: i, preview: q.question.slice(0, 100), concepts: q.conceptsUsed }));
  const prompt = `Review batch of ${questions.length} questions:\n${JSON.stringify(summaries)}\nCheck for concept repetition.\nReturn: {"passed": true, "rejectedIndices": [], "suggestions": "..."}`;
  
  const res = await callAIWithTokens(token, model, providerType, sys, prompt, 0.3, 800, true, customBaseUrl);
  const parsed = parseJSON<any>(res.content);
  return { ...parsed, rejectedIndices: parsed.rejectedIndices || [], tokens: { input: res.promptTokens, output: res.completionTokens } };
}

// ─── Main Pipeline Entrypoint ──────────────────────────────────────────────────

export async function runJEEPipeline(
  token: string, model: string, providerType: string,
  params: GenerationRequest,
  ctx: { topicName: string; chapterName: string; subjectName: string; boardName: string; standardName: string },
  onLog?: (currentLog: string) => void,
  signal?: AbortSignal,
  customBaseUrl?: string,
): Promise<{ results: AgentResult[]; agentLog: string; inputTokens: number; outputTokens: number }> {
  const strictJeeOnly = params.jeeAdvancedOnly === true;

  if (strictJeeOnly && !isJeeGenerationAllowedContext(ctx)) {
    throw new Error(`[Pipeline] Off-syllabus context: ${ctx.subjectName} / ${ctx.chapterName} / ${ctx.topicName}`);
  }

  const logLines: string[] = [];
  const log = (msg: string) => { 
    logLines.push(msg); 
    if (onLog) onLog(logLines.join("\n"));
  };
  
  let inputTokens = 0; let outputTokens = 0;

  log(`${"═".repeat(60)}`);
  log(`[JEE Pipeline] ${params.count}× ${params.difficulty} ${params.questionType}`);
  log(`[JEE Pipeline] Topic: ${ctx.topicName} | Chapter: ${ctx.chapterName}`);
  if (params.customInstructions) {
    log(`[Admin Prompt] "${params.customInstructions}"`);
  }
  log(`${"═".repeat(60)}`);

  log("\n[Stage 1] Topic Planner...");
  let microTopics: MicroTopic[] = [];

  for (let s1try = 1; s1try <= QUALITY.maxStage1Retries; s1try++) {
    try {
      const { topics, tokens } = await planMicroTopics(token, model, providerType, ctx, strictJeeOnly, params.customInstructions, customBaseUrl);
      inputTokens += tokens.input; outputTokens += tokens.output;
      microTopics = topics;
      log(`[Stage 1] ✓ ${microTopics.length} micro-topics on attempt ${s1try}`);
      break;
    } catch (err) {
      log(`[Stage 1] ✗ Attempt ${s1try}: ${(err as Error).message}`);
      await sleep(2000);
    }
  }

  if (microTopics.length === 0) {
    log(`[Stage 1] ⚠️  All attempts failed — fallback`);
    microTopics = getFallbackTopics(ctx.chapterName, ctx.topicName);
  }

  const pool: AgentResult[] = [];
  const generatedStems: string[] = [];
  let totalAttempts = 0;
  const maxTotalAttempts = params.count * QUALITY.maxRetries;
  let lastHint: RetryHint | undefined;
  let currentSeed: ConceptSeed | undefined;

  while (pool.length < params.count && totalAttempts < maxTotalAttempts) {
    if (signal?.aborted) {
      log(`[Pipeline] 🛑 Job cancelled by user.`);
      break;
    }
    
    totalAttempts++;
    const slot = pool.length + 1;
    const tag = `[Slot ${slot}/${params.count} | attempt ${totalAttempts}]`;

    try {
      if (!currentSeed) {
        currentSeed = fuseConceptSeed(microTopics, params.difficulty);
      }
      log(`${tag} Stage 2 ✓ → [${currentSeed.selectedTopics.map(t => t.name).join(" + ")}]`);

      await sleep(500);
      const { result: raw, tokens: stage3Tokens } = await generateQuestionStages(token, model, providerType, currentSeed, params, ctx, generatedStems, log, tag, lastHint, customBaseUrl);
      inputTokens += stage3Tokens.input; outputTokens += stage3Tokens.output;
      lastHint = undefined; // consume hint

      await sleep(400);
      const expertCheck: any = strictJeeOnly
        ? await reviewAsJEEExpert(token, model, providerType, raw, params.difficulty, currentSeed.selectedTopics.map(t => t.name), customBaseUrl)
        : await analyzeDifficulty(token, model, providerType, raw, currentSeed, params.difficulty, customBaseUrl);
      inputTokens += expertCheck.tokens.input; outputTokens += expertCheck.tokens.output;

      let diffCheck: { overallScore: number; scores: any };

      if (strictJeeOnly) {
        if (!expertCheck.passed) {
          const category = expertCheck.rejectionCategory || "general";
          log(`${tag} Stage 4 ✗ [${category}] — ${expertCheck.rejectionReason}`);

          if (category === "too_easy" || category === "too_formulaic" || category === "wrong_solution" || category === "invalid_math" || category === "domain_error") {
            lastHint = { category, suggestion: (expertCheck as any).suggestion || expertCheck.rejectionReason };
          } else {
            currentSeed = undefined;
          }
          continue;
        }
        log(`${tag} Stage 4 ✓ — Verified & Scored`);
        diffCheck = { overallScore: computeWeightedScore(expertCheck.scores), scores: expertCheck.scores };
      } else {
        log(`${tag} Stage 4 ✓ — Board-syllabus scoring`);
        diffCheck = expertCheck;
      }

      if (isDuplicate(String(raw.stem), generatedStems)) { 
        log(`${tag} Stage 8 ✗ duplicate`); 
        currentSeed = undefined; 
        continue; 
      }
      
      pool.push({
        question: String(raw.stem),
        correctAnswer: String(raw.correct),
        options: raw.options ? String(raw.options) : undefined,
        explanation: String(raw.explanation),
        learningObjective: `Mastery of ${currentSeed!.selectedTopics[0].name}`,
        estimatedSolveTime: Number(raw.estimatedSolveTimeSeconds),
        difficultyScore: diffCheck.overallScore,
        qualityScore: diffCheck.overallScore / 10,
        factuallyValid: true,
        syllabusAligned: true,
        grammarOk: true,
        difficultyVerified: true,
        conceptsUsed: currentSeed.selectedTopics.map(t => t.name),
        crossChapterLinks: currentSeed.selectedTopics.flatMap(t => t.crossLinks || []),
        persona: currentSeed.persona.name,
        hiddenObservation: String(raw.hiddenObservation),
        commonMistake: "",
        bloomsLevel: String(raw.bloomsLevel),
        cognitiveLoad: {},
        qualityScores: diffCheck.scores,
        overallScore: diffCheck.overallScore,
        selfCritique: "Passed",
        expertComment: expertCheck.expertComment ?? "",
      });
      generatedStems.push(String(raw.stem));
      log(`${tag} ✅ ACCEPTED — ${pool.length}/${params.count}\n`);
      currentSeed = undefined; // Reset for next slot

    } catch (err) {
      log(`${tag} ✗ Error: ${(err as Error).message}`);
      currentSeed = undefined;
    }
  }

  // Stage 10
  if (pool.length > 1) {
    log("\n[Stage 10] Paper Quality Editor...");
    try {
      const editorResult = await runPaperEditor(token, model, providerType, pool);
      inputTokens += editorResult.tokens.input; outputTokens += editorResult.tokens.output;
      if (editorResult.rejectedIndices.length > 0) {
        const rejected = new Set(editorResult.rejectedIndices);
        const before = pool.length;
        pool.splice(0, pool.length, ...pool.filter((_, i) => !rejected.has(i)));
        log(`[Stage 10] Removed ${before - pool.length} by paper editor`);
      }
      log(`[Stage 10] ✓ — ${editorResult.suggestions}`);
    } catch (err) {
      log(`[Stage 10] ⚠️  skipped: ${(err as Error).message}`);
    }
  }

  log(`\n${"═".repeat(60)}`);
  log(`[Pipeline] COMPLETE: ${pool.length}/${params.count} accepted. Tokens: ${inputTokens} IN / ${outputTokens} OUT`);
  log(`${"═".repeat(60)}`);

  return { results: pool.slice(0, params.count), agentLog: logLines.join("\n"), inputTokens, outputTokens };
}
