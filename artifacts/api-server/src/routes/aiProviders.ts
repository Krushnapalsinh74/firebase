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
    const { name, providerType, accessToken, defaultModel, availableModels = [], isActive = true } = req.body;
    const encryptedToken = simpleEncrypt(accessToken);
    const id = await nextId("aiProviders");
    const now = nowTs();
    const data = {
      id, name, providerType, encryptedToken, defaultModel,
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
    const { name, accessToken, defaultModel, availableModels, isActive } = req.body;
    const ref = firestore.collection("aiProviders").doc(String(id));
    if (!(await ref.get()).exists) { res.status(404).json({ error: "Provider not found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: nowTs() };
    if (name !== undefined) updates["name"] = name;
    if (accessToken !== undefined) updates["encryptedToken"] = simpleEncrypt(accessToken);
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

    if (provider.providerType === "github_models") {
      const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ model: provider.defaultModel, messages: [{ role: "user", content: "Say hello in one word." }], max_tokens: 10 }),
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const text = await response.text();
        res.json({ success: false, message: `Connection failed: ${response.statusText} - ${text.slice(0, 200)}`, latencyMs });
        return;
      }
      res.json({ success: true, message: "Connection successful", latencyMs });
    } else if (provider.providerType === "gemini") {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${token}`);
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const text = await response.text();
        res.json({ success: false, message: `Connection failed: ${response.statusText} - ${text.slice(0, 200)}`, latencyMs });
        return;
      }
      const data = await response.json() as { models?: Array<{ name: string }> };
      const modelNames = (data.models || []).map(m => m.name.replace("models/", "")).filter(m => m.includes("gemini")).slice(0, 20).join(", ");
      res.json({ success: true, message: `Connected! Allowed models: ${modelNames || "None found"}`, latencyMs });
    } else {
      res.json({ success: true, message: "Provider configured (connection test not implemented for this type)", latencyMs: Date.now() - start });
    }
  } catch (err) {
    req.log.error({ err }, "Test AI provider error");
    res.json({ success: false, message: `Connection failed: ${(err as Error).message}`, latencyMs: null });
  }
});

function getDefaultModels(providerType: string): string[] {
  if (providerType === "github_models") {
    return ["gpt-4o", "gpt-4o-mini", "Llama-3.3-70B-Instruct", "Mistral-Large-2407", "Phi-4"];
  }
  return [];
}

export default router;
