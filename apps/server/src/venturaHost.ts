import express from "express";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";

const root = resolve(process.env.TOONFLOW_VENTURA_ROOT || resolve(import.meta.dirname, "../.."));
const dataDirectory = resolve(process.env.TOONFLOW_DATA_DIR || resolve(root, "data"));
mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
process.env.TOONFLOW_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "production";

const { setRuntimeHost } = await import("./lib/platform");
setRuntimeHost("desktop");
const { createApp } = await import("./app");
const { registerHostClient, startMultiTenantRuntime } = await import("./utils/multiTenant");
const { initializeMcpRuntime } = await import("./utils/mcp/runtime");

const app = await createApp({
  webRoot: resolve(root, "build/web"),
  appVersion: "2.0.0",
  dataDirectory,
  toolsRoot: resolve(root, "build/tools"),
  nodesRoot: resolve(root, "build/nodes"),
  extRoot: resolve(root, "build/ext"),
  providersRoot: resolve(root, "build/providers"),
  skillsRoot: resolve(root, "build/skills"),
});
const hostSecret = randomBytes(32).toString("hex");
registerHostClient(app, hostSecret);

const gateway = express();
let expectedOrigin = "";
gateway.use((req, res, next) => {
  const remote = req.socket.remoteAddress;
  const host = req.get("host") ?? "";
  const origin = req.get("origin");
  const referer = req.get("referer");
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote ?? "")
    || !expectedOrigin || "http://" + host !== expectedOrigin
    || origin !== undefined && origin !== expectedOrigin
    || referer !== undefined && !referer.startsWith(expectedOrigin + "/")
    || req.get("x-forwarded-for") || req.get("forwarded")) {
    res.sendStatus(403);
    return;
  }
  res.set("Cache-Control", "no-store");
  next();
});
gateway.use(app);

const server = gateway.listen(0, "127.0.0.1");
await once(server, "listening");
const port = (server.address() as AddressInfo).port;
expectedOrigin = "http://127.0.0.1:" + port;
await startMultiTenantRuntime(app);
try {
  await initializeMcpRuntime(app, expectedOrigin, resolve(root, "build/mcp/stdio.js"));
} catch (cause) {
  console.warn("Ventura: optional MCP runtime did not start:", cause);
}
console.log("TOONFLOW_VENTURA_READY:" + JSON.stringify({ port, token: hostSecret }));
