// modules/storage.js
// PHAN RIENG: Chi luu/tai du an duoi dang JSON, khong chua logic node hay canvas.
// - Web va desktop dung chung cach nay: localStorage, nen cung 1 ma chay duoc ca 2 noi.
// - Khong luu API key, token hay mat khau vao du an.
const KEY = 'quetvideo-project-v1';

export function saveProject(project) {
  try { localStorage.setItem(KEY, JSON.stringify(project)); } catch (e) { /* Bo qua khi trinh duyet chan luu tru */ }
}

export function loadProject(fallback) {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* Dung du an mac dinh neu du lieu cu hong */ }
  return fallback;
}

export function downloadJson(project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'quetvideo-project.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
