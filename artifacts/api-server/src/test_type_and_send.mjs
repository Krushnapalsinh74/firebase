import WebSocket from "ws";

async function testPrompt() {
  const tabsRes = await fetch("http://localhost:9222/json");
  const tabs = await tabsRes.json();
  const chatGptTab = tabs.find(t => t.url && t.url.includes("chatgpt.com"));
  if (!chatGptTab) {
    console.log("No chatgpt.com tab found!");
    return;
  }

  console.log("Connecting to WebSocket:", chatGptTab.webSocketDebuggerUrl);
  const ws = new WebSocket(chatGptTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on("open", r));

  let nextId = 1;
  function send(method, params = {}) {
    const id = nextId++;
    return new Promise(resolve => {
      function onMessage(data) {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off("message", onMessage);
          resolve(msg.result);
        }
      }
      ws.on("message", onMessage);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  function evaluate(expression) {
    return send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
      .then(res => res?.result?.value);
  }

  await send("Page.enable");
  await send("Runtime.enable");

  console.log("Focusing prompt area...");
  await evaluate(`
    (() => {
      const el = document.querySelector('#prompt-textarea');
      if (el) {
        el.focus();
        el.innerHTML = '<p>Respond with: HELLO_FROM_LOCAL_AI_TEST</p>';
        const evt = new Event('input', { bubbles: true });
        el.dispatchEvent(evt);
      }
    })()
  `);

  await new Promise(r => setTimeout(r, 600));

  console.log("Sending Enter key...");
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r"
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13
  });

  // Also click send button if exists
  await evaluate(`
    (() => {
      const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="send"]');
      if (sendBtn) sendBtn.click();
    })()
  `);

  console.log("Prompt sent! Polling for response...");
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const res = await evaluate(`
      (() => {
        const assistantMsgs = Array.from(document.querySelectorAll('div[data-message-author-role="assistant"], .markdown.prose, [class*="agent-turn"]'));
        if (assistantMsgs.length > 0) {
          return assistantMsgs[assistantMsgs.length - 1].innerText;
        }
        return null;
      })()
    `);
    if (res) {
      console.log("Received response from ChatGPT:", res);
      break;
    }
  }

  ws.close();
}

testPrompt().catch(console.error);
