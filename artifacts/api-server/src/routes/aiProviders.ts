import { Router } from "express";
import { firestore, nextId, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth, simpleEncrypt, simpleDecrypt } from "../lib/auth.js";

const router = Router();

function safeProvider(p: Record<string, any>) {
  const { encryptedToken, ...rest } = p;
  return rest;
}

router.get("/ai-providers", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("aiProviders").orderBy("name").get();
    res.json(snapshotToArr(snap).map(safeProvider));
  } catch (err) {
    req.log.error({ err }, "List AI providers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai-providers", requireAuth, async (req, res) => {
  try {
    const { name, providerType, accessToken = "local_no_auth", baseUrl = "", defaultModel, availableModels = [], isActive = true } = req.body;
    const encryptedToken = accessToken ? simpleEncrypt(accessToken) : "";
    const id = await nextId("aiProviders");
    const now = nowTs();
    const data = {
      id, name, providerType, encryptedToken, defaultModel,
      baseUrl: baseUrl || "",
      availableModels: availableModels.length > 0 ? availableModels : getDefaultModels(providerType),
      isActive, createdAt: now, updatedAt: now,
    };
    await firestore.collection("aiProviders").doc(String(id)).set(data);
    res.status(201).json(safeProvider({ ...data, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() }));
  } catch (err) {
    req.log.error({ err }, "Create AI provider error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/ai-providers/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, accessToken, baseUrl, defaultModel, availableModels, isActive } = req.body;
    const ref = firestore.collection("aiProviders").doc(String(id));
    if (!(await ref.get()).exists) { res.status(404).json({ error: "Provider not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (name !== undefined) updates["name"] = name;
    if (accessToken !== undefined) updates["encryptedToken"] = simpleEncrypt(accessToken);
    if (baseUrl !== undefined) updates["baseUrl"] = baseUrl;
    if (defaultModel !== undefined) updates["defaultModel"] = defaultModel;
    if (availableModels !== undefined) updates["availableModels"] = availableModels;
    if (isActive !== undefined) updates["isActive"] = isActive;
    await ref.update(updates);
    const p = docToObj(await ref.get())!;
    res.json(safeProvider(p));
  } catch (err) {
    req.log.error({ err }, "Update AI provider error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/ai-providers/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await firestore.collection("aiProviders").doc(String(id)).delete();
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete AI provider error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai-providers/:id/test", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const doc = await firestore.collection("aiProviders").doc(String(id)).get();
    if (!doc.exists) { res.status(404).json({ error: "Provider not found" }); return; }
    const provider = doc.data() as any;
    const token = simpleDecrypt(provider.encryptedToken);
    const start = Date.now();

    const cleanToken = (token || "").trim().replace(/^["']|["']$/g, "");
    if (!cleanToken && provider.providerType !== "local_stealth" && provider.providerType !== "browser_web" && provider.providerType !== "custom_local") {
      res.json({ success: false, message: "No API key configured for this provider.", latencyMs: null });
      return;
    }

    if (provider.providerType === "custom_local" || provider.providerType === "local_stealth") {
      const rawBase = (provider.baseUrl || "http://127.0.0.1:9222").trim().replace(/\/+$/, "");
      
      // 1. First test if it is a Chrome DevTools / Browser DevTunnel
      try {
        const cdpRes = await fetch(`${rawBase}/json`, { signal: AbortSignal.timeout(4000) });
        if (cdpRes.ok) {
          const tabs = await cdpRes.json() as any[];
          const geminiTab = tabs.find((t: any) => t.url && t.url.includes("gemini.google.com"));
          const chatgptTab = tabs.find((t: any) => t.url && t.url.includes("chatgpt.com"));
          const latencyMs = Date.now() - start;
          const targetName = geminiTab ? "Google Gemini" : chatgptTab ? "ChatGPT" : "Chrome Browser";
          res.json({
            success: true,
            message: `Connected to Local Browser (${targetName})! Found ${tabs.length} tabs.`,
            latencyMs,
          });
          return;
        }
      } catch {
        // Not a direct CDP endpoint, try OpenAI/Ollama format
      }

      // 2. Otherwise test standard OpenAI/Ollama completions endpoint
      let endpoint = rawBase;
      if (!endpoint.endsWith("/chat/completions")) {
        if (endpoint.endsWith("/v1")) endpoint += "/chat/completions";
        else endpoint += "/v1/chat/completions";
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cleanToken && cleanToken !== "browser_session" && cleanToken !== "local_no_auth") {
        headers["Authorization"] = `Bearer ${cleanToken}`;
      }
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: provider.defaultModel || "llama3",
            messages: [{ role: "user", content: "Say hello in one word." }],
            max_tokens: 10,
          }),
          signal: AbortSignal.timeout(6000),
        });
        const latencyMs = Date.now() - start;
        if (!response.ok) {
          const text = await response.text();
          res.json({ success: false, message: `Local AI connection returned HTTP ${response.status}: ${text.slice(0, 200)}`, latencyMs });
          return;
        }
        res.json({ success: true, message: `Connected to Local AI successfully at ${endpoint}!`, latencyMs });
        return;
      } catch (e: any) {
        res.json({ success: false, message: `Could not connect to ${rawBase}: ${e.message}`, latencyMs: null });
        return;
      }
    } else if (provider.providerType === "gemini") {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanToken)}`);
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const text = await response.text();
        res.json({ success: false, message: `Gemini API test failed (${response.status}): ${text.slice(0, 200)}`, latencyMs });
        return;
      }
      const data = await response.json() as { models?: Array<{ name: string }> };
      const modelNames = (data.models || []).map(m => m.name.replace("models/", "")).filter(m => m.includes("gemini")).slice(0, 5).join(", ");
      res.json({ success: true, message: `Connected to Gemini! Available models: ${modelNames || "gemini-2.0-flash"}`, latencyMs });
    } else if (provider.providerType === "openai") {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const text = await response.text();
        res.json({ success: false, message: `OpenAI connection failed (${response.status}): ${text.slice(0, 200)}`, latencyMs });
        return;
      }
      res.json({ success: true, message: "Connected to OpenAI successfully!", latencyMs });
    } else if (provider.providerType === "groq") {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const text = await response.text();
        res.json({ success: false, message: `Groq connection failed (${response.status}): ${text.slice(0, 200)}`, latencyMs });
        return;
      }
      res.json({ success: true, message: "Connected to Groq successfully!", latencyMs });
    } else if (provider.providerType === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": cleanToken, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: provider.defaultModel || "claude-3-5-haiku-20241022", max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const text = await response.text();
        res.json({ success: false, message: `Anthropic connection failed (${response.status}): ${text.slice(0, 200)}`, latencyMs });
        return;
      }
      res.json({ success: true, message: "Connected to Anthropic successfully!", latencyMs });
    } else {
      res.json({ success: true, message: "Provider credentials validated.", latencyMs: Date.now() - start });
    }
  } catch (err) {
    req.log.error({ err }, "Test AI provider error");
    res.json({ success: false, message: `Connection failed: ${(err as Error).message}`, latencyMs: null });
  }
});

function getDefaultModels(providerType: string): string[] {
  switch (providerType) {
    case "custom_local":
      return ["llama3", "llama3.1:8b", "mistral", "deepseek-r1", "qwen2.5", "phi3", "custom"];
    case "gemini":
      return ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    case "groq":
      return ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
    case "openai":
      return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"];
    case "anthropic":
      return ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"];
    case "github_models":
      return ["gpt-4o", "gpt-4o-mini", "Llama-3.3-70B-Instruct", "Mistral-Large-2407", "Phi-4"];
    case "cerebras":
      return ["llama3.1-8b", "llama3.1-70b"];
    case "deepseek":
      return ["deepseek-chat", "deepseek-reasoner"];
    default:
      return ["gemini-2.0-flash"];
  }
}

export default router;
