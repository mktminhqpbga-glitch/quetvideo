const defaults = { relayUrl: "https://mooz-relay.onrender.com", pairingCode: "", resumeToken: "", deviceId: "chrome-main", tabId: 0, promptSelector: "textarea", buttonSelector: "button[type=submit]", imageSelector: "img", videoSelector: "video" };
let ws;
let heartbeat;
let reconnect;
let executing = false;

function relayAddress(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw Error("Relay must use HTTPS");
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) throw Error("Use the base HTTPS relay URL only");
  return url.origin.replace(/^http/, "ws") + "/toonflow";
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
  if (!cfg.relayUrl || !cfg.deviceId || (!cfg.pairingCode && !cfg.resumeToken)) { notify("disconnected", "Enter one-time pairing code from ToonFlow relay; never enter RELAY_ADMIN_KEY here"); return; }
  let url;
  try { url = relayAddress(cfg.relayUrl); } catch (e) { notify("error", e.message); return; }
  const socket = new WebSocket(url);
  ws = socket;
  notify("connecting");
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "hello", role: "extension", pairingCode: cfg.pairingCode || undefined, resumeToken: cfg.resumeToken || undefined, deviceId: cfg.deviceId }));
  };
  socket.onmessage = async event => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === "ready") {
      if (typeof msg.resumeToken !== "string" || !/^[a-f0-9]{64}$/.test(msg.resumeToken)) { socket.close(1008, "Invalid relay response"); return; }
      await chrome.storage.local.set({ resumeToken: msg.resumeToken, pairingCode: "" });
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
        args: [{ promptSelector: current.promptSelector, buttonSelector: current.buttonSelector, imageSelector: current.imageSelector, videoSelector: current.videoSelector, mediaType: msg.mediaType === "video" ? "video" : "image", prompt: msg.prompt, ratio: msg.ratio, size: msg.size, quality: msg.quality }],
      });
      const mediaType = msg.mediaType === "video" ? "video" : "image";
      const property = mediaType === "video" ? "videoUrl" : "imageUrl";
      const source = response?.result?.[property];
      if (typeof source !== "string" || !source) throw Error("Muse returned no " + mediaType + " media. Check the page mode and CSS selectors.");
      let result = { [property]: source };
      const shouldCapture = /^blob:|^data:/.test(source) || mediaType === "video" && /^https:/.test(source);
      if (shouldCapture) {
        // Convert files in their owning Muse tab; protected video URLs may require session cookies.
        // The relay is in-memory and enforces a bounded 18 MiB data URI payload.
        try {
          const [blob] = await chrome.scripting.executeScript({
            target: { tabId: Number(current.tabId) },
            func: async (src, kind) => {
              const response = await fetch(src, { credentials: "include" });
              if (!response.ok) throw Error("Cannot download " + kind + " from Muse");
              const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
              const length = Number(response.headers.get("content-length") || 0);
              const limit = kind === "video" ? 12 * 1024 * 1024 : 7 * 1024 * 1024;
              if (length > limit) throw Error(kind + " exceeds in-memory bridge limit (12 MiB for video)");
              const file = await response.blob();
              const mimeType = contentType || file.type;
              if (kind === "video" && !["video/mp4", "video/webm", "video/quicktime"].includes(mimeType)) throw Error("Muse did not return a video file");
              if (kind === "image" && !["image/png", "image/jpeg", "image/webp"].includes(mimeType)) throw Error("Muse did not return an image file");
              if (file.size === 0 || file.size > limit) throw Error(kind + " exceeds in-memory bridge limit");
              return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(new Blob([file], { type: mimeType }));
              });
            },
            args: [source, mediaType],
          });
          if (!blob?.result || typeof blob.result !== "string") throw Error("Cannot serialize " + mediaType);
          result = { [mediaType === "video" ? "videoData" : "imageData"]: blob.result };
        } catch (e) {
          if (!/^https:/.test(source)) throw e;
          // Server-side fetch of a protected HTTPS link may still fail; never claim successful download.
          result = { [property]: source };
        }
      }
      socket.send(JSON.stringify({ type: "result", jobId: msg.jobId, result }));
    } catch (e) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "result", jobId: msg.jobId, error: String(e.message || e) }));
    } finally { executing = false; }
  };
  socket.onerror = () => notify("error", "WebSocket error");
  socket.onclose = event => {
    clearInterval(heartbeat);
    if (ws !== socket) return;
    ws = null;
    if (event.code === 1008) {
      void chrome.storage.local.set({ resumeToken: "", pairingCode: "" });
      notify("pairing-required", "Pairing expired or invalid. Create a new pairing code using RELAY_ADMIN_KEY on your own machine.");
      return;
    }
    notify("disconnected", "Connection interrupted. Attempting to reconnect without resending any prompt.");
    reconnect = setTimeout(connect, 5000);
  };
}

async function runMuse(config) {
  const { promptSelector, buttonSelector, imageSelector, videoSelector, prompt, mediaType } = config;
  const field = document.querySelector(promptSelector);
  const button = document.querySelector(buttonSelector);
  if (!field || !button) throw Error("Muse selectors do not match. Update the Extension popup.");
  if (mediaType !== "image" && mediaType !== "video") throw Error("Unsupported media type");
  const readImage = el => el.currentSrc || el.src || "";
  const readVideo = el => el.currentSrc || el.src || el.querySelector?.("source[src]")?.src || "";
  const selector = mediaType === "video" ? videoSelector : imageSelector;
  const read = mediaType === "video" ? readVideo : readImage;
  if (!selector || typeof selector !== "string") throw Error("Configure the " + mediaType + " selector");
  const before = new Set([...document.querySelectorAll(selector)].map(read).filter(Boolean));
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
  // Set the intended Image/Video mode manually on Muse before submitting; don't guess UI controls.
  button.click();
  const until = Date.now() + 8 * 60_000;
  while (Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    for (const el of document.querySelectorAll(selector)) {
      const src = read(el);
      if (!src || before.has(src) || !/^(?:https:|blob:|data:)/.test(src)) continue;
      if (mediaType === "image") {
        if (!el.complete || el.naturalWidth < 256 || el.naturalHeight < 256) continue;
        return { imageUrl: src };
      }
      const video = el.tagName === "VIDEO" ? el : el.closest?.("video");
      if (!video || video.readyState < 1) continue;
      return { videoUrl: src };
    }
  }
  throw Error("No new " + mediaType + " detected. Inspect Muse output and selectors; prompt was NOT resubmitted.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "connect") { connect().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ error: e.message })); return true; }
  if (message?.type === "disconnect") { disconnect(); notify("disconnected"); sendResponse({ ok: true }); return; }
});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
