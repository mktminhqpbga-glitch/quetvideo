"use strict";
const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { createInterface } = require("node:readline");

const RUNTIME = join(process.resourcesPath, "toonflow");
const BUN = join(RUNTIME, "bun");
const ENTRY = join(RUNTIME, "build/server/venturaHost.js");
let child = null;
let quitting = false;
let window = null;

async function fatal(message) {
  if (quitting) return;
  await dialog.showMessageBox({
    type: "error", title: "ToonFlow Studio VN · macOS Ventura",
    message: "Không khởi động được ToonFlow.",
    detail: String(message).slice(0, 1800),
  });
  app.quit();
}
async function launchBackend() {
  if (!existsSync(BUN) || !existsSync(ENTRY)) throw new Error("Bộ cài thiếu Bun hoặc ToonFlow Backend.");
  child = spawn(BUN, [ENTRY], {
    cwd: RUNTIME,
    env: { ...process.env, TOONFLOW_VENTURA_ROOT: RUNTIME,
      TOONFLOW_DATA_DIR: join(app.getPath("userData"), "data"), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", data => { stderr = (stderr + String(data)).slice(-4000); console.error(String(data)); });
  return await new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("Backend khởi động quá lâu. " + stderr)), 90000);
    child.once("error", e => finish(e));
    child.once("exit", code => {
      if (!finished) finish(new Error("Backend thoát mã " + code + ". " + stderr));
      else if (!quitting) void fatal("Backend đã dừng (" + code + "). " + stderr);
    });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", line => {
      if (!line.startsWith("TOONFLOW_VENTURA_READY:")) { console.log(line); return; }
      try {
        const value = JSON.parse(line.slice("TOONFLOW_VENTURA_READY:".length));
        if (!Number.isInteger(value.port) || value.port <= 0 ||
          !/^[a-f0-9]{64}$/.test(value.token)) throw new Error("Backend handshake không hợp lệ");
        finish(null, value);
      } catch (e) { finish(e); }
    });
  });
}
async function boot() {
  const { port, token } = await launchBackend();
  if (quitting) return;
  const origin = "http://127.0.0.1:" + port;
  window = new BrowserWindow({
    width: 1320, height: 900, minWidth: 960, minHeight: 640,
    show: false, backgroundColor: "#151515", title: "ToonFlow Studio VN",
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
      preload: join(__dirname, "preload.cjs"),
      additionalArguments: ["--toonflow-port=" + port, "--toonflow-host-token=" + token],
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(origin + "/")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin + "/")) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    }
  });
  window.once("ready-to-show", () => window?.show());
  await window.loadURL(origin + "/");
  if (window && !window.isVisible()) window.show();
  window.on("closed", () => { window = null; });
}
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { quitting = true; child?.kill("SIGTERM"); });
app.whenReady().then(boot).catch(error => fatal(error.stack || error));
