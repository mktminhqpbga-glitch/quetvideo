// desktop/preload.cjs
// PHAN RIENG: Cau noi an toan giua cua so Electron va main process.
// - Renderer KHONG co Node. Moi thu renderer can deu qua window.quetvideo o day.
// - Chi mo cac ham da liet ke, khong mo require, khong mo socket truc tiep.
// - Ket noi tab AI chi chay trong main (chrome-host + ai-dispatch), renderer chi goi lenh.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  // Trang thai AI: provider, tab, ket noi Chrome, job dang chay/cho.
  aiStatus: () => ipcRenderer.invoke('quetvideo:ai-status'),
  aiProviders: () => ipcRenderer.invoke('quetvideo:ai-providers'),
  // Ma ghep cap cuc bo hien tai (de dan vao MooZ Connect). Het han sau 15 phut.
  aiPairingCode: () => ipcRenderer.invoke('quetvideo:ai-pairing-code'),
  aiTabs: () => ipcRenderer.invoke('quetvideo:ai-tabs'),
  aiSelect: (provider, tabId) => ipcRenderer.invoke('quetvideo:ai-select', provider, tabId),
  aiRun: (job) => ipcRenderer.invoke('quetvideo:ai-run', job),
  aiStop: () => ipcRenderer.invoke('quetvideo:ai-stop'),
  // Su kien tu main: selected/queued/started/done/failed/stopped + notification tu tab.
  onAiEvent: (fn) => {
    const listener = (_event, payload) => fn(payload);
    ipcRenderer.on('quetvideo:ai-event', listener);
    return () => ipcRenderer.removeListener('quetvideo:ai-event', listener);
  },
};

contextBridge.exposeInMainWorld('quetvideo', api);
