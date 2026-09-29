import WebSocket from "ws";

async function test() {
  const tabsRes = await fetch("http://localhost:9222/json");
  const tabs = await tabsRes.json();
  console.log("Found tabs:", tabs.map(t => ({ title: t.title, url: t.url, type: t.type })));

  const chatGptTab = tabs.find(t => t.url && t.url.includes("chatgpt.com"));
  if (!chatGptTab) {
    console.log("No chatgpt.com tab found!");
    return;
  }

  console.log("Connecting to ChatGPT tab:", chatGptTab.webSocketDebuggerUrl);
  const ws = new WebSocket(chatGptTab.webSocketDebuggerUrl);

  await new Promise(r => ws.on("open", r));
  console.log("Connected to WebSocket!");

  let nextId = 1;
  function evaluate(expression) {
    const id = nextId++;
    return new Promise(resolve => {
      function onMessage(data) {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off("message", onMessage);
          resolve(msg.result?.result?.value);
        }
      }
      ws.on("message", onMessage);
      ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
    });
  }

  const domInfo = await evaluate(`
    (() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], #prompt-textarea, [data-testid]')).map(el => ({
        tag: el.tagName,
        id: el.id,
        className: el.className,
        contentEditable: el.contentEditable,
        placeholder: el.getAttribute('placeholder') || el.innerText,
        testId: el.getAttribute('data-testid')
      }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        testId: b.getAttribute('data-testid'),
        ariaLabel: b.getAttribute('aria-label'),
        text: b.innerText
      })).filter(b => b.testId || b.ariaLabel || b.text);
      return { url: location.href, title: document.title, inputs, buttons };
    })()
  `);

  console.log("DOM Info on ChatGPT tab:", JSON.stringify(domInfo, null, 2));
  ws.close();
}

test().catch(console.error);
