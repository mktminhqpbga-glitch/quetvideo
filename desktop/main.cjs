// desktop/main.cjs
// PHAN RIENG: Chi lo mo cua so Electron + noi AI qua tab. Khong chua logic canvas, node hay hang doi.
// - Web: khong dung file nay, chi can `npm run web` (server.js) roi mo trinh duyet.
// - Desktop: `npm start` -> Electron mo renderer/index.html trong cua so rieng.
// - AI qua tab: main mo may chu WS cuc bo (chrome-host), MooZ Connect ghep cap bang ma cuc bo,
//   ai-dispatch gui prompt sang tab AI da dang nhap, tuan tu, khong tu gui lai.
// - Build: `npm run dist:win` / `dist:mac` / `dist:linux` (xem package.json).
// Luu y: file nay dung CommonJS vi Electron main yeu cau vay. Renderer dung ES module rieng.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { WebSocketServer } = require('ws');
const sites = require('./ai-sites.cjs');
const { newToken, pairingCode } = require('./remote-protocol.cjs');
const { ChromeHost } = require('./chrome-host.cjs');
const { AIDispatch } = require('./ai-dispatch.cjs');

const APP_VERSION = '0.3.0';
const PAIRING_TTL_MS = 15 * 60 * 1000;

let host = null;
let dispatch = null;
let pairing = null; // {code, token, expiresAt, port}
let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    title: 'QuetVideo ' + APP_VERSION,
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      // Khong bat Node trong renderer: renderer chay giong web, an toan va de test.
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

async function startChromeHost() {
  const token = newToken();
  host = new ChromeHost({
    WebSocketServer,
    token,
    appVersion: APP_VERSION,
    onNotification: (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('quetvideo:ai-event', { type: 'tab-event', event });
      }
    },
    onGate: async (gate) => {
      // Chi cho tab dang duoc chon cho nhom hien tai gui; tab la khong duoc.
      const ok = dispatch && dispatch.tabId !== null && gate.tabId === dispatch.tabId && !!dispatch.running;
      return ok
        ? { ok: true }
        : { ok: false, error: 'Tab chưa được chọn cho nhóm này. Chọn đúng tab AI trong QuetVideo trước.' };
    },
  });
  const actualPort = await host.listen(0); // He dieu hanh chon cong trong — khong doan cong co dinh.
  pairing = {
    token,
    port: actualPort,
    expiresAt: Date.now() + PAIRING_TTL_MS,
    code: pairingCode(actualPort, token),
  };
  dispatch = new AIDispatch({ host, sites });
  dispatch.onEvent((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('quetvideo:ai-event', event);
    }
  });
}

function registerIpc() {
  ipcMain.handle('quetvideo:ai-status', () => ({
    ...(dispatch ? dispatch.status() : { provider: null, tabId: null, connected: false, running: null, queued: [] }),
    pairingExpiresAt: pairing ? pairing.expiresAt : null,
  }));
  ipcMain.handle('quetvideo:ai-providers', () => sites.list());
  ipcMain.handle('quetvideo:ai-pairing-code', () => {
    if (!pairing || Date.now() >= pairing.expiresAt) throw Error('Mã ghép cặp đã hết hạn. Khởi động lại QuetVideo để lấy mã mới.');
    return { code: pairing.code, expiresAt: pairing.expiresAt, port: pairing.port };
  });
  ipcMain.handle('quetvideo:ai-tabs', async () => dispatch.listTabs());
  ipcMain.handle('quetvideo:ai-select', (_event, provider, tabId) => dispatch.select(provider, tabId));
  ipcMain.handle('quetvideo:ai-run', (_event, job) => dispatch.enqueue(job));
  ipcMain.handle('quetvideo:ai-stop', () => { dispatch.stop(); return true; });
}

app.whenReady().then(async () => {
  await startChromeHost();
  registerIpc();
  mainWindow = createWindow();
});
app.on('window-all-closed', () => {
  // macOS: app thuong giu lai khi dong het cua so, cac he khac thi thoat.
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
});
app.on('before-quit', async () => {
  await host?.close().catch(() => {});
});
