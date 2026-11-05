// desktop/main.cjs
// PHAN RIENG: Chi lo mo cua so Electron. Khong chua logic canvas, node hay hang doi.
// - Web: khong dung file nay, chi can `npm run web` (server.js) roi mo trinh duyet.
// - Desktop: `npm start` -> Electron mo renderer/index.html trong cua so rieng.
// - Build: `npm run dist:win` / `dist:mac` / `dist:linux` (xem package.json).
// Luu y: file nay dung CommonJS vi Electron main yeu cau vay. Renderer dung ES module rieng.
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    title: 'QuetVideo 0.2.0',
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      // Khong bat Node trong renderer: renderer chay giong web, an toan va de test.
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  // macOS: app thuong giu lai khi dong het cua so, cac he khac thi thoat.
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
