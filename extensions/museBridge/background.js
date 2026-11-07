const defaults = { relayUrl: "", token: "", deviceId: "chrome-main", tabId: 0, promptSelector: "textarea", buttonSelector: "button[type=submit]", imageSelector: "img" };
let ws;
let heartbeat;
let reconnect;
let executing = false;

function relayAddress(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw Error("Relay must use HTTPS");
  return url.href.replace(/\/$/, "").replace(/^http/, "ws") + "/ws";
}

async function settings() { return { ...defaults, ...await chrome.storage.local.get(Object.keys(defaults)) }; }

function notify(state, message = "") { chrome.storage.local.set({ bridgeState: state, bridgeMessage: message }); }

function disconnect() {
  clearInterval(heartbeat);
  clearTimeout(reconnect);
  if (ws) { const previous = ws; ws = null; previous.close(); }
}

async function connect() {
  disconnect();
  const cfg = await settings();
  if (!cfg.relayUrl || !cfg.token || !cfg.deviceId) { notify("disconnected", "Configure relay URL, token and device ID"); return; }
  let url;
  try { url = relayAddress(cfg.relayUrl); } catch (e) { notify("error", e.message); return; }
  const socket = new WebSocket(url);
  ws = socket;
  notify("connecting");
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "hello", role: "extension", token: cfg.token, deviceId: cfg.deviceId }));
  };
  socket.onmessage = async event => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === "ready") {
      notify("connected");
      heartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" })); }, 20000);
      return;
    }
    if (msg.type !== "job" || !msg.jobId) return;
    if (executing) { socket.send(JSON.stringify({ type: "result", jobId: msg.jobId, error: "Chrome is already processing another job" })); return; }
    executing = true;
    try {
      const current = await settings();
      if (!current.tabId) throw Error("Select a Muse tab in the extension popup");
      const tab = await chrome.tabs.get(Number(current.tabId));
      if (!tab.url?.startsWith("https://") && !tab.url?.startsWith("http://localhost")) throw Error("Invalid target tab");
      const origin = new URL(tab.url).origin + "/*";
      if (!(await chrome.permissions.contains({ origins: [origin] }))) throw Error("Chrome site permission is missing. Open popup and select the target tab again.");
      const [response] = await chrome.scripting.executeScript({
        target: { tabId: Number(current.tabId) }, func: runMuse,
        args: [{ promptSelector: current.promptSelector, buttonSelector: current.buttonSelector, imageSelector: current.imageSelector, prompt: msg.prompt, ratio: msg.ratio, size: msg.size, quality: msg.quality }],
      });
      if (!response?.result?.imageUrl) throw Error("No generated image found");
      let result = { imageUrl: response.result.imageUrl };
      if (/^blob:/.test(result.imageUrl) || /^data:/.test(result.imageUrl)) {
        // A blob URL belongs to the Muse tab; serialize its bytes while the tab still owns it.
        const [blob] = await chrome.scripting.executeScript({
          target: { tabId: Number(current.tabId) }, func: async src => {
            const response = await fetch(src);
            const bytes = await response.blob();
            if (!["image/png", "image/jpeg", "image/webp"].includes(bytes.type) || bytes.size > 7 * 1024 * 1024) throw Error("Image exceeds allowed size or format");
            return await new Promise((resolve, reject) => {
              const file = new FileReader(); file.onload = () => resolve(file.result); file.onerror = reject; file.readAsDataURL(bytes);
            });
          }, args: [result.imageUrl],
        });
        result = { imageData: blob.result };
      }
      socket.send(JSON.stringify({ type: "result", jobId: msg.jobId, result }));
    } catch (e) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "result", jobId: msg.jobId, error: String(e.message || e) }));
    } finally { executing = false; }
  };
  socket.onerror = () => notify("error", "WebSocket error");
  socket.onclose = () => {
    clearInterval(heartbeat);
    if (ws !== socket) return;
    ws = null;
    notify("disconnected");
    reconnect = setTimeout(connect, 5000);
  };
}

async function runMuse(config) {
  const { promptSelector, buttonSelector, imageSelector, prompt } = config;
  const field = document.querySelector(promptSelector);
  const button = document.querySelector(buttonSelector);
  if (!field || !button) throw Error("Muse selectors did not match. Update them in the extension popup.");
  const before = new Set([...document.querySelectorAll(imageSelector)].map(el => el.currentSrc || el.src).filter(Boolean));
  if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set;
    if (setter) setter.call(field, prompt); else field.value = prompt;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (field.isContentEditable) {
    field.focus();
    field.textContent = prompt;
    field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
  } else throw Error("Prompt selector must target an editable field");
  button.click();
  const until = Date.now() + 8 * 60_000;
  while (Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    for (const image of document.querySelectorAll(imageSelector)) {
      const src = image.currentSrc || image.src;
      if (!src || before.has(src) || !image.complete || image.naturalWidth < 256 || image.naturalHeight < 256) continue;
      return { imageUrl: src };
    }
  }
  throw Error("No new image detected. Check Muse and the image selector.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "connect") { connect().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ error: e.message })); return true; }
  if (message?.type === "disconnect") { disconnect(); notify("disconnected"); sendResponse({ ok: true }); return; }
});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
