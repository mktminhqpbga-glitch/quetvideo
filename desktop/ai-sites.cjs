// desktop/ai-sites.cjs
// PHAN RIENG: Danh sach AI chay qua tab, giong app-mooz.
// - Chi dinh nghia TEN, TRANG BAT DAU, MAU URL va LOAI HO TRO (text/image/video).
// - Khong chua key, khong tu mo tab, khong gui prompt. Viec gui nam o ai-dispatch.cjs.
// - Them host moi khong cap quyen duyet web tu do: chi cac URL trong patterns moi duoc chap nhan.
'use strict';

const SITES = {
  muse: {
    id: 'muse', name: 'Muse.ai', types: ['text', 'image', 'video'],
    start: 'https://muse.ai/',
    patterns: ['https://muse.ai/*', 'https://*.muse.ai/*'],
  },
  chatgpt: {
    id: 'chatgpt', name: 'ChatGPT', types: ['text', 'image'],
    start: 'https://chatgpt.com/',
    patterns: ['https://chatgpt.com/*', 'https://www.chatgpt.com/*', 'https://chat.openai.com/*'],
  },
  gemini: {
    id: 'gemini', name: 'Gemini', types: ['text', 'image'],
    start: 'https://gemini.google.com/app',
    patterns: ['https://gemini.google.com/*'],
  },
  grok: {
    id: 'grok', name: 'Grok', types: ['text', 'image', 'video'],
    start: 'https://grok.com/',
    patterns: ['https://grok.com/*', 'https://www.grok.com/*'],
  },
  flow: {
    id: 'flow', name: 'Google Flow / Veo', types: ['image', 'video'],
    start: 'https://flow.google.com/',
    patterns: ['https://flow.google.com/*', 'https://labs.google/fx/tools/flow*'],
  },
};

function list() {
  return Object.values(SITES).map((s) => ({ ...s, patterns: [...s.patterns] }));
}

function get(id) {
  return SITES[id] || null;
}

// Tra ve id AI cho mot URL tab, hoac null neu tab khong thuoc AI duoc ho tro.
// Chi chap nhan https, khong port, khong tai khoan trong URL.
function providerForURL(value) {
  try {
    if (typeof value !== 'string' || /[\x00-\x20\x7f]/.test(value)) return null;
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
    if (['chatgpt.com', 'www.chatgpt.com', 'chat.openai.com'].includes(u.hostname)) return 'chatgpt';
    if (u.hostname === 'gemini.google.com') return 'gemini';
    if (u.hostname === 'muse.ai' || u.hostname.endsWith('.muse.ai')) return 'muse';
    if (['grok.com', 'www.grok.com'].includes(u.hostname)) return 'grok';
    if (u.hostname === 'flow.google.com') return 'flow';
    if (u.hostname === 'labs.google' && /^\/fx\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?tools\/flow(?:\/|$)/.test(u.pathname)) return 'flow';
    return null;
  } catch { return null; }
}

// Mau URL dung cho tabs.query phia extension: chi cac tab AI moi duoc liet ke.
function queryPatterns() {
  return Object.values(SITES).flatMap((s) => s.patterns);
}

module.exports = { SITES, list, get, providerForURL, queryPatterns };
