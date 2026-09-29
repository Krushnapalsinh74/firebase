import { Router, Request, Response } from "express";
import { firestore } from "@workspace/db";
import { simpleDecrypt } from "../lib/auth.js";
import {
  isCDPRunning,
  ensureBrowserRunning,
  getBrowserExecutable,
  getProfileDirectory,
  CDP_PORT,
} from "../lib/browserAi.js";

const router = Router();

/**
 * GET /api/browser/status
 * Returns current state of the server automation browser and persistent profile.
 */
router.get("/browser/status", async (_req: Request, res: Response) => {
  let hasExecutable = false;
  let executablePath = "";
  try {
    executablePath = getBrowserExecutable();
    hasExecutable = true;
  } catch {
    hasExecutable = false;
  }

  const isRunning = await isCDPRunning();
  let tabs: any[] = [];

  if (isRunning) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const rawTabs = (await response.json()) as any[];
        tabs = rawTabs
          .filter((t) => t.type === "page")
          .map((t) => ({
            id: t.id,
            title: t.title,
            url: t.url,
          }));
      }
    } catch {
      // Ignore tab read error if CDP is busy
    }
  }

  res.json({
    status: isRunning ? "running" : "idle",
    cdpPort: CDP_PORT,
    hasExecutable,
    executablePath: executablePath || null,
    profileDirectory: getProfileDirectory(),
    openTabs: tabs,
    geminiTab: tabs.find((t) => /gemini\.google\.com/i.test(t.url)) || null,
    chatgptTab: tabs.find((t) => /chatgpt\.com/i.test(t.url)) || null,
  });
});

/**
 * POST /api/browser/launch
 * Opens the local Chrome/Edge browser with persistent user profile so admin can log in.
 */
router.post("/browser/launch", async (req: Request, res: Response) => {
  try {
    const { target = "gemini" } = req.body ?? {};
    const url =
      target === "chatgpt" ? "https://chatgpt.com" : "https://gemini.google.com";

    await ensureBrowserRunning(url);

    res.json({
      success: true,
      message: `Browser opened with persistent profile. You can now log into your ${
        target === "chatgpt" ? "OpenAI" : "Google"
      } account in the opened window.`,
      targetUrl: url,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/generate-image
 * Generates an educational diagram or illustration on demand using chosen AI provider or free engine.
 */
router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt, width = 800, height = 600, providerId } = req.body ?? {};
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      res.status(400).json({ error: "Missing 'prompt' in request body" });
      return;
    }

    const cleanPrompt = prompt.trim();
    let imageUrl = "";
    let engineUsed = "Fast Free AI Generator";

    // If providerId is chosen, attempt provider-specific high-resolution generation
    if (providerId && providerId !== "free" && providerId !== "pollinations") {
      try {
        const snap = await firestore.collection("aiProviders").doc(String(providerId)).get();
        if (snap.exists) {
          const pData = snap.data() as any;
          const token = simpleDecrypt(pData.encryptedToken);
          const pType = String(pData.provider || "").toLowerCase();

          if (pType === "openai" && token) {
            const dRes = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt: `Academic scientific educational textbook illustration: ${cleanPrompt.slice(0, 950)}. Clean 2D flat vector diagram, pure white background, crisp black lines with colored arrows and labels, high contrast, no 3D rendering, no dark background, no watermarks.`,
                n: 1,
                size: "1024x1024",
                quality: "standard",
              }),
            });
            if (dRes.ok) {
              const dData = (await dRes.json()) as any;
              imageUrl = dData?.data?.[0]?.url || "";
              engineUsed = `${pData.name || "OpenAI"} (DALL-E 3)`;
            } else {
              const dErr = await dRes.text();
              console.warn("OpenAI DALL-E error:", dErr);
            }
          } else if (pType === "gemini" && token) {
            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${token}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instances: [
                  { prompt: `Academic textbook scientific diagram: ${cleanPrompt.slice(0, 950)}. Pure white background, 2D vector technical line drawing, clear educational labels, no dark theme, high clarity.` }
                ],
                parameters: { sampleCount: 1, aspectRatio: "1:1", outputMimeType: "image/jpeg" },
              }),
            });
            if (gRes.ok) {
              const gData = (await gRes.json()) as any;
              const b64 = gData?.predictions?.[0]?.bytesBase64Encoded;
              if (b64) {
                imageUrl = `data:image/jpeg;base64,${b64}`;
                engineUsed = `${pData.name || "Google Gemini"} (Imagen 3)`;
              }
            } else {
              const gErr = await gRes.text();
              console.warn("Gemini Imagen error:", gErr);
            }
          }
        }
      } catch (err: any) {
        console.warn("Provider image generation failed, using fallback:", err.message);
      }
    }

    // High-contrast 2D academic prompt for free engine (guarantees white background, eliminates dark circular orbs)
    if (!imageUrl) {
      const educationalPrompt = `${cleanPrompt}, 2D technical educational diagram, textbook vector line illustration, pure white background, sharp black lines and colored labels, high contrast scientific figure, no dark background, no 3D rendering`;
      const encoded = encodeURIComponent(educationalPrompt);
      imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true`;
    }

    res.json({
      success: true,
      prompt: cleanPrompt,
      url: imageUrl,
      engine: engineUsed,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
