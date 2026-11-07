import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const relayToken = process.env.RELAY_TOKEN || "";
if (relayToken.length < 32) throw new Error("RELAY_TOKEN must contain at least 32 characters");
const port = Number(process.env.PORT || 10000);
const devices = new Map();
const jobs = new Map();
const active = new Map();
const maxJobMs = 10 * 60 * 1000;

function authorized(value) {
  const supplied = typeof value === "string" ? value : "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(relayToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "null" });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const parts = [];
    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > 65536) { reject(new Error("Request too large")); req.destroy(); return; }
      parts.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(parts).toString("utf8"))); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function fail(job, reason) {
  if (!job || job.state === "done" || job.state === "error") return;
  job.state = "error";
  job.error = reason;
  job.updatedAt = Date.now();
  if (active.get(job.deviceId) === job.id) active.delete(job.deviceId);
}

function pump(deviceId) {
  if (active.has(deviceId)) return;
  const ws = devices.get(deviceId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const job = [...jobs.values()].find(value => value.deviceId === deviceId && value.state === "queued");
  if (!job) return;
  job.state = "running";
  job.updatedAt = Date.now();
  active.set(deviceId, job.id);
  ws.send(JSON.stringify({ type: "job", jobId: job.id, prompt: job.prompt, ratio: job.ratio, size: job.size, quality: job.quality }), err => {
    if (err) { fail(job, "Could not deliver job; check Chrome before retrying"); pump(deviceId); }
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });
  const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!authorized(bearer)) return json(res, 401, { error: "Unauthorized" });

  if (req.method === "GET" && url.pathname === "/api/devices") {
    return json(res, 200, { devices: [...devices.keys()].map(deviceId => ({ deviceId, connected: true, busy: active.has(deviceId) })) });
  }
  if (req.method === "POST" && url.pathname === "/api/jobs") {
    try {
      const body = await readJson(req);
      if (!body || typeof body !== "object" || typeof body.deviceId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.deviceId)
        || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 10000) {
        return json(res, 400, { error: "Invalid deviceId or prompt" });
      }
      if (!devices.has(body.deviceId)) return json(res, 409, { error: "Chrome device is offline" });
      for (const key of ["ratio", "size", "quality"]) {
        if (body[key] !== undefined && (typeof body[key] !== "string" || body[key].length > 32)) {
          return json(res, 400, { error: "Invalid option: " + key });
        }
      }
      const id = randomUUID();
      jobs.set(id, {
        id, deviceId: body.deviceId, prompt: body.prompt.trim(), ratio: body.ratio || "", size: body.size || "",
        quality: body.quality || "", state: "queued", createdAt: Date.now(), updatedAt: Date.now()
      });
      pump(body.deviceId);
      return json(res, 202, { jobId: id });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
    const id = url.pathname.slice("/api/jobs/".length);
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: "Job not found or expired" });
    const output = { jobId: job.id, deviceId: job.deviceId, state: job.state, updatedAt: job.updatedAt };
    if (job.state === "done") output.result = job.result;
    if (job.state === "error") output.error = job.error;
    return json(res, 200, output);
  }
  return json(res, 404, { error: "Not found" });
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: 12 * 1024 * 1024 });
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url || "/", "http://localhost").pathname !== "/ws") { socket.destroy(); return; }
  sockets.handleUpgrade(req, socket, head, ws => {
    let deviceId = "";
    let authenticated = false;
    const authTimer = setTimeout(() => ws.close(1008, "Authentication timeout"), 8000);
    ws.on("message", raw => {
      let msg;
      try { msg = JSON.parse(raw.toString("utf8")); }
      catch { ws.close(1003, "Invalid JSON"); return; }
      if (!authenticated) {
        if (msg?.type !== "hello" || msg.role !== "extension" || !authorized(msg.token)
          || typeof msg.deviceId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(msg.deviceId)) {
          ws.close(1008, "Unauthorized"); return;
        }
        authenticated = true;
        clearTimeout(authTimer);
        deviceId = msg.deviceId;
        const old = devices.get(deviceId);
        if (old && old !== ws) old.close(1000, "Replaced by new connection");
        devices.set(deviceId, ws);
        ws.send(JSON.stringify({ type: "ready", deviceId }));
        pump(deviceId);
        return;
      }
      if (msg?.type === "ping") { ws.send(JSON.stringify({ type: "pong" })); return; }
      if (msg?.type !== "result" || typeof msg.jobId !== "string") return;
      const job = jobs.get(msg.jobId);
      if (!job || job.deviceId !== deviceId || active.get(deviceId) !== job.id || job.state !== "running") return;
      if (typeof msg.error === "string" && msg.error) fail(job, msg.error.slice(0, 1000));
      else {
        const result = msg.result;
        const imageData = result?.imageData;
        const imageUrl = result?.imageUrl;
        const isImage = typeof imageData === "string" && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData);
        const isUrl = typeof imageUrl === "string" && imageUrl.length <= 4096 && /^https:\/\//.test(imageUrl);
        if (!isImage && !isUrl) fail(job, "Extension did not return a supported image");
        else {
          job.state = "done";
          job.result = isImage ? { imageData } : { imageUrl };
          job.updatedAt = Date.now();
          active.delete(deviceId);
        }
      }
      pump(deviceId);
    });
    ws.on("close", () => {
      clearTimeout(authTimer);
      if (!deviceId || devices.get(deviceId) !== ws) return;
      devices.delete(deviceId);
      for (const job of jobs.values()) {
        if (job.deviceId === deviceId && (job.state === "running" || job.state === "queued")) {
          fail(job, "Chrome disconnected. The result is uncertain; inspect Muse before submitting again.");
        }
      }
    });
    ws.on("error", () => {});
  });
});

setInterval(() => {
  const now = Date.now();
  for (const job of jobs.values()) {
    if ((job.state === "running" || job.state === "queued") && now - job.createdAt > maxJobMs) {
      fail(job, "Job timed out. Check Muse before retrying.");
      pump(job.deviceId);
    }
    if (now - job.createdAt > 30 * 60 * 1000) jobs.delete(job.id);
  }
}, 15000).unref();

server.listen(port, "0.0.0.0", () => {
  console.log("ToonFlow Chrome relay listening on port " + port);
});
