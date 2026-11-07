"use strict";
const { contextBridge } = require("electron");
const port = Number(process.argv.find(a => a.startsWith("--toonflow-port="))?.slice(16) || 0);
const token = process.argv.find(a => a.startsWith("--toonflow-host-token="))?.slice(22) || "";
const u = new URL(location.href);
const allowed = u.hostname === "127.0.0.1" && u.protocol === "http:" && Number(u.port) === port && /^[a-f0-9]{64}$/.test(token);
const ready = allowed ? fetch("/api/multiTenant/hostSession", {
  method: "POST", credentials: "same-origin",
  headers: { "x-toonflow-host-token": token, "x-toonflow-workspace": "1" },
}).then(response => { if (!response.ok) throw Error("Host login failed: " + response.status); })
  : Promise.reject(Error("Invalid local host origin"));
contextBridge.exposeInMainWorld("toonflowHostReady", ready);
