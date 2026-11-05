// desktop/remote-protocol.cjs
// PHAN RIENG: Ma ghep cap CUC BO giua QuetVideo va MooZ Connect tren cung may.
// - Dinh dang: workflow-connect://127.0.0.1:PORT/<token 64 ky tu hex>
// - Token sinh moi moi lan mo app, chi co hieu luc trong phien, khong luu ra file.
// - Chi chap nhan wss/ws CUC BO. Khong co che do relay o day: relay can RELAY_ADMIN_KEY
//   cua dich vu Render, khong co trong ban nay (xem README muc "Relay — chua co").
// - Het han do app cap, khong dua vao dong ho may nhan.
'use strict';
const { randomBytes } = require('node:crypto');

const TOKEN_RE = /^[a-f0-9]{64}$/;

function validToken(value) {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

function newToken() {
  return randomBytes(32).toString('hex');
}

// Tao ma ghep cap de hien cho nguoi dung dan vao MooZ Connect.
// Dinh dang cuc bo cua MooZ Connect KHONG co tham so query (?expires=...),
// chi co port + token. Het han do app tu giu (expiresAt luu trong bo nho app).
function pairingCode(port, token) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Cổng kết nối không hợp lệ.');
  if (!validToken(token)) throw Error('Thiếu khóa ghép cặp.');
  const u = new URL('workflow-connect://127.0.0.1');
  u.port = String(port);
  u.pathname = '/' + token;
  return u.href;
}

// Doc ma do nguoi dung dan vao (khi app dong vai tro nhan). Tra ve {port, token, expiresAt}.
function parseURI(value) {
  if (typeof value !== 'string' || value.length > 4096) throw Error('Mã kết nối không hợp lệ.');
  let u;
  try { u = new URL(value); } catch { throw Error('Mã kết nối không hợp lệ. Sao chép lại từ MooZ.'); }
  if (u.protocol !== 'workflow-connect:' || u.hostname !== '127.0.0.1' || !/^\d+$/.test(u.port)
    || Number(u.port) < 1 || Number(u.port) > 65535 || u.username || u.password || u.hash
    || !TOKEN_RE.test(u.pathname.slice(1))) throw Error('Mã kết nối không hợp lệ. Sao chép lại từ MooZ.');
  const expiresAt = u.searchParams.get('expires') ? Number(u.searchParams.get('expires')) : null;
  if (expiresAt !== null && (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())) {
    throw Error('Mã đã hết hạn. Tạo mã mới trong QuetVideo.');
  }
  return { port: Number(u.port), token: u.pathname.slice(1), expiresAt };
}

module.exports = { validToken, newToken, pairingCode, parseURI };
