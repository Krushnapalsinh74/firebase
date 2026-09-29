import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface BrowserAIOptions {
  timeoutMs?: number;
  systemPrompt?: string;
  onStatus?: (status: string) => void;
}

let chromeProcess: ChildProcess | null = null;
export const CDP_PORT = 9222;

/**
 * Finds the local Chrome or Edge executable on Windows/Mac/Linux.
 */
export function getBrowserExecutable(): string {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("No Chrome or Edge browser executable found on the server.");
}

/**
 * Returns the persistent user profile path for the automation browser.
 */
export function getProfileDirectory(): string {
  const userHome = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\AE";
  const profileDir = path.join(userHome, ".yunora_browser_profile");
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  return profileDir;
}

/**
 * Checks if Chrome is already active on the remote debugging port.
 */
export async function isCDPRunning(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensures the automation browser is running with remote debugging enabled.
 */
export async function ensureBrowserRunning(targetUrl?: string): Promise<void> {
  if (await isCDPRunning()) return;

  const browserPath = getBrowserExecutable();
  const profileDir = getProfileDirectory();

  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1280,850",
  ];

  if (targetUrl) args.push(targetUrl);

  chromeProcess = spawn(browserPath, args, {
    detached: true,
    stdio: "ignore",
  });
  chromeProcess.unref();

  // Wait up to 10s for the browser CDP port to become active
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isCDPRunning()) return;
  }

  throw new Error("Timed out waiting for browser to launch with debugging port.");
}

/**
 * Creates or retrieves a tab matching the target URL domain.
 */
export async function getOrCreateTab(domainMatch: string, launchUrl: string, cdpBaseUrl?: string): Promise<{ id: string; webSocketDebuggerUrl: string }> {
  const base = (cdpBaseUrl || `http://127.0.0.1:${CDP_PORT}`).replace(/\/+$/, "");
  if (!cdpBaseUrl) {
    await ensureBrowserRunning(launchUrl);
  }

  const res = await fetch(`${base}/json`);
  if (!res.ok) throw new Error(`Could not connect to browser CDP at ${base}`);
  const tabs = (await res.json()) as any[];

  // Try finding an existing page matching the domain
  const existing = tabs.find((t: any) => t.type === "page" && t.url && t.url.includes(domainMatch));
  if (existing) {
    let wsUrl = existing.webSocketDebuggerUrl;
    if (cdpBaseUrl && wsUrl && (wsUrl.includes("localhost") || wsUrl.includes("127.0.0.1"))) {
      const wsBase = cdpBaseUrl.replace(/^http/, "ws").replace(/\/+$/, "");
      wsUrl = `${wsBase}/devtools/page/${existing.id}`;
    }
    return { id: existing.id, webSocketDebuggerUrl: wsUrl };
  }

  // Otherwise create a new tab
  const newRes = await fetch(`${base}/json/new?${encodeURIComponent(launchUrl)}`, { method: "PUT" });
  const newTab = (await newRes.json()) as any;
  let wsUrl = newTab.webSocketDebuggerUrl;
  if (cdpBaseUrl && wsUrl && (wsUrl.includes("localhost") || wsUrl.includes("127.0.0.1"))) {
    const wsBase = cdpBaseUrl.replace(/^http/, "ws").replace(/\/+$/, "");
    wsUrl = `${wsBase}/devtools/page/${newTab.id}`;
  }
  return { id: newTab.id, webSocketDebuggerUrl: wsUrl };
}

/**
 * Communicates with a browser tab using Chrome DevTools Protocol over WebSocket.
 */
class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          if (data.id && this.pending.has(data.id)) {
            const cb = this.pending.get(data.id)!;
            this.pending.delete(data.id);
            cb(data);
          }
        } catch {
          // ignore
        }
      };
    });
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve) => {
      this.pending.set(id, (res) => resolve(res.result));
      this.ws.send(payload);
    });
  }

  async evaluate<T = any>(expression: string): Promise<T> {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Automates prompt execution in Gemini Web (gemini.google.com).
 */
async function runGeminiWeb(prompt: string, onStatus?: (msg: string) => void, cdpBaseUrl?: string): Promise<string> {
  const GEMINI_URL = "https://gemini.google.com/app";
  onStatus?.("Opening Gemini Web in browser...");

  const tab = await getOrCreateTab("gemini.google.com", GEMINI_URL, cdpBaseUrl);
  const client = new CDPClient(tab.webSocketDebuggerUrl);
  await client.connect();

  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    onStatus?.("Navigating to Gemini...");

    // Check if previous generation is stuck with Stop button, if so navigate fresh
    const isStuck = await client.evaluate<boolean>(`
      !!document.querySelector('button[aria-label*="Stop"]')
    `);
    if (isStuck) {
      await client.send("Page.navigate", { url: GEMINI_URL });
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Wait for the prompt editor to appear
    let foundInput = false;
    for (let i = 0; i < 30; i++) {
      foundInput = await client.evaluate<boolean>(`
        !!document.querySelector('.ql-editor, rich-textarea p, rich-textarea [contenteditable="true"], textarea, [contenteditable="true"]')
      `);
      if (foundInput) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!foundInput) {
      throw new Error("Could not find Gemini prompt box. Please make sure you are signed into Gemini in the opened browser window.");
    }

    // Count existing responses before sending
    const initialResponsesCount = await client.evaluate<number>(`
      document.querySelectorAll('.model-response-text, message-content, response-container, [class*="response-container"]').length
    `) || 0;

    onStatus?.("Inputting prompt into Gemini...");

    // Focus editor and clear previous text
    await client.evaluate(`
      (() => {
        const el = document.querySelector('.ql-editor, rich-textarea [contenteditable="true"], [contenteditable="true"], textarea');
        if (el) {
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
        }
      })()
    `);

    await new Promise((r) => setTimeout(r, 200));

    // Native CDP multiline text insertion
    await client.send("Input.insertText", { text: prompt });

    await new Promise((r) => setTimeout(r, 600));

    onStatus?.("Submitting prompt...");
    // Try clicking send button
    const clicked = await client.evaluate<boolean>(`
      (() => {
        const btn = document.querySelector('button[aria-label*="Send"], button.send-button, [data-test-id="send-button"], button[aria-label*="Submit"], button:has(mat-icon)');
        if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          btn.click();
          return true;
        }
        return false;
      })()
    `);

    // Also dispatch Enter keystrokes
    await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });

    onStatus?.("Waiting for Gemini response to finish generating (no timeout for up to 1 hour)...");
    let lastContent = "";
    let stableCount = 0;

    // Wait up to 1 hour (2400 iterations * 1500ms = 3600s)
    for (let i = 0; i < 2400; i++) {
      await new Promise((r) => setTimeout(r, 1500));

      const status = await client.evaluate<{ count: number; text: string; isStreaming: boolean }>(`
        (() => {
          const items = document.querySelectorAll('.model-response-text, message-content, response-container, [class*="response-container"]');
          const stopBtn = document.querySelector('button[aria-label*="Stop"]');
          
          let latestText = '';
          if (items.length > 0) {
            const lastItem = items[items.length - 1];
            latestText = (lastItem ? lastItem.innerText : '').trim();
          }

          // Fallback: search for JSON in body
          if (!latestText || latestText.length < 10) {
            const full = document.body.innerText || '';
            const match = full.match(/\\{[\\s\\S]*"chapters"[\\s\\S]*\\}/);
            if (match) latestText = match[0];
          }

          return {
            count: items.length,
            text: latestText,
            isStreaming: !!stopBtn
          };
        })()
      `);

      if (status && status.text && status.text.length > 10) {
        if (!status.isStreaming && status.text === lastContent) {
          stableCount++;
          if (stableCount >= 4) {
            onStatus?.("Gemini generation completed.");
            return status.text;
          }
        } else {
          lastContent = status.text;
          stableCount = 0;
        }
      }
    }

    if (lastContent.trim().length > 0) return lastContent;
    throw new Error("Reached 1 hour maximum limit waiting for Gemini response to finish.");
  } finally {
    client.close();
  }
}

/**
 * Automates prompt execution in ChatGPT Web (chatgpt.com).
 */
async function runChatGPTWeb(prompt: string, onStatus?: (msg: string) => void, cdpBaseUrl?: string): Promise<string> {
  const CHATGPT_URL = "https://chatgpt.com";
  onStatus?.("Opening ChatGPT Web in browser...");

  const tab = await getOrCreateTab("chatgpt.com", CHATGPT_URL, cdpBaseUrl);
  const client = new CDPClient(tab.webSocketDebuggerUrl);
  await client.connect();

  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    onStatus?.("Navigating to ChatGPT...");
    // Wait for the prompt box to appear
    let foundInput = false;
    for (let i = 0; i < 30; i++) {
      foundInput = await client.evaluate<boolean>(`
        (() => {
          const el = document.querySelector('#prompt-textarea, [contenteditable="true"], textarea, [data-testid="textbox"]');
          return !!el;
        })()
      `);
      if (foundInput) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!foundInput) {
      throw new Error("Could not find ChatGPT prompt box. Please make sure you are signed into https://chatgpt.com in the opened browser window.");
    }

    onStatus?.("Inputting prompt into ChatGPT...");

    // Focus editor and insert text
    await client.evaluate(`
      (() => {
        const el = document.querySelector('#prompt-textarea, [contenteditable="true"], textarea, [data-testid="textbox"]');
        if (el) {
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
        }
      })()
    `);

    await new Promise((r) => setTimeout(r, 200));

    // Native CDP multiline text insertion
    await client.send("Input.insertText", { text: prompt });

    // Ensure ProseMirror state is updated
    await client.evaluate(`
      (() => {
        const el = document.querySelector('#prompt-textarea');
        if (el && (!el.innerText || el.innerText.trim().length === 0)) {
          el.innerHTML = '<p>' + ${JSON.stringify(prompt)}.replace(/\\n/g, '<br>') + '</p>';
        }
        if (el) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);

    await new Promise((r) => setTimeout(r, 600));

    onStatus?.("Submitting prompt...");
    // Trigger submit via Enter key and button click
    await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });

    await client.evaluate(`
      (() => {
        const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="send"]');
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
        }
      })()
    `);

    onStatus?.("Waiting for ChatGPT to generate response (no timeout for up to 1 hour)...");
    await new Promise((r) => setTimeout(r, 2000));

    let lastContent = "";
    let stableCount = 0;

    // Wait up to 1 hour (3000 iterations * 1200ms = 3600s)
    for (let i = 0; i < 3000; i++) {
      await new Promise((r) => setTimeout(r, 1200));

      const status = await client.evaluate<{ text: string; isStreaming: boolean }>(`
        (() => {
          const stopBtn = document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop"], button[aria-label*="stop"]');
          const responses = document.querySelectorAll('div[data-message-author-role="assistant"], .markdown.prose, [class*="agent-turn"], article');
          let text = '';
          if (responses.length > 0) {
            const latest = responses[responses.length - 1];
            text = latest ? (latest.innerText || latest.textContent || '') : '';
          }
          if (!text || text.length < 10) {
            const body = document.body.innerText || '';
            const match = body.match(/\\{[\\s\\S]*"chapters"[\\s\\S]*\\}/);
            if (match) text = match[0];
          }
          return {
            text: text.trim(),
            isStreaming: !!stopBtn,
          };
        })()
      `);

      if (status && status.text && status.text.length > 10) {
        if (!status.isStreaming && status.text === lastContent) {
          stableCount++;
          if (stableCount >= 4) {
            onStatus?.("ChatGPT generation completed.");
            return status.text;
          }
        } else {
          lastContent = status.text;
          stableCount = 0;
        }
      }
    }

    if (lastContent.trim().length > 0) return lastContent;
    throw new Error("Reached 1 hour maximum limit waiting for ChatGPT to finish generating.");
  } finally {
    client.close();
  }
}

/**
 * Main entrypoint for Browser AI.
 * Automatically chooses ChatGPT Web or Gemini Web and handles prompt execution.
 */
export async function callBrowserAI(
  model: "Gemini Web" | "ChatGPT Web" | "Gemini" | "ChatGPT" | string,
  prompt: string,
  options?: BrowserAIOptions,
  cdpBaseUrl?: string
): Promise<{ content: string; model: string }> {
  const base = (cdpBaseUrl || `http://127.0.0.1:${CDP_PORT}`).replace(/\/+$/, "");

  // Auto-detect active browser tabs
  let detectedTarget: "chatgpt" | "gemini" = "chatgpt";
  try {
    const res = await fetch(`${base}/json`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const tabs = (await res.json()) as any[];
      const hasChatGPT = tabs.some((t: any) => t.type === "page" && t.url && t.url.includes("chatgpt.com"));
      const hasGemini = tabs.some((t: any) => t.type === "page" && t.url && t.url.includes("gemini.google.com"));
      if (hasChatGPT) {
        detectedTarget = "chatgpt";
      } else if (hasGemini) {
        detectedTarget = "gemini";
      } else if (/gemini/i.test(model)) {
        detectedTarget = "gemini";
      } else {
        detectedTarget = "chatgpt";
      }
    }
  } catch {
    if (/gemini/i.test(model)) detectedTarget = "gemini";
  }

  if (/chatgpt/i.test(model)) detectedTarget = "chatgpt";
  if (/gemini/i.test(model)) detectedTarget = "gemini";

  const normalizedModel = detectedTarget === "chatgpt" ? "ChatGPT Web" : "Gemini Web";
  options?.onStatus?.(`Executing via ${normalizedModel} in browser (${cdpBaseUrl || "local"})...`);

  let content = "";
  if (detectedTarget === "chatgpt") {
    content = await runChatGPTWeb(prompt, options?.onStatus, cdpBaseUrl);
  } else {
    content = await runGeminiWeb(prompt, options?.onStatus, cdpBaseUrl);
  }

  return {
    content,
    model: normalizedModel,
  };
}
