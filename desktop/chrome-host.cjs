// desktop/chrome-host.cjs
// PHAN RIENG: May chu WebSocket CUC BO cho MooZ Connect tren cung may.
// - Nghe ws://127.0.0.1:PORT/ , chi chap nhan ket noi tu localhost.
// - Extension gui {type:'auth', token, protocol:1, resultRecovery:1, extensionVersion}.
//   App tra {type:'ready', protocol:1, appVersion, resultRecovery:1, sessionToken, pendingRequests:[]}
//   neu token khop va protocol dung; sai thi dong ket noi.
// - Sau do app gui {type:'request', id, operation, payload}; extension tra
//   {type:'response', id, result} hoac {type:'response', id, error}.
//   App phai gui {type:'response-ack', id} sau khi nhan response.
// - Extension gui {type:'notification', event} (tab doi, tien trinh AI) va
//   {type:'gate', callId, tabId, message} (tab xin quyen gui); app tra
//   {type:'gate-result', callId, result}.
// - Ping 20s tu extension: app tra {type:'pong'}. Mat ket noi thi moi yeu cau
//   dang cho tro ve loi "chua co ket qua", KHONG tu gui lai.
'use strict';
const { randomBytes } = require('node:crypto');

const PROTOCOL = 1;

class ChromeHost {
  constructor({ WebSocketServer, token, appVersion, onRequest, onNotification, onGate }) {
    this.WebSocketServer = WebSocketServer;
    this.token = token;
    this.appVersion = appVersion;
    this.onRequest = onRequest || (async () => { throw Error('Chưa có bộ xử lý yêu cầu.'); });
    this.onNotification = onNotification || (() => {});
    this.onGate = onGate || (async () => ({ ok: false, error: 'Tab chưa được chọn cho nhóm này.' }));
    this.wss = null;
    this.socket = null;
    this.connected = false;
    this.extensionVersion = null;
    this.sessionToken = randomBytes(32).toString('hex');
    this.pending = new Map(); // id -> {resolve, reject, timer}
    this.requestSeq = 0;
    this.lastSeen = 0;
  }

  async listen(port) {
    if (this.wss) return this.wss.address().port;
    const wss = new this.WebSocketServer({ host: '127.0.0.1', port });
    this.wss = wss;
    await new Promise((resolve, reject) => {
      wss.once('listening', resolve);
      wss.once('error', reject);
    });
    wss.on('connection', (ws) => this._accept(ws));
    return wss.address().port;
  }

  async close() {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(Error('Kết nối Chrome đã đóng; chưa có kết quả. Kiểm tra tab AI rồi gửi lại thủ công.'));
    }
    this.pending.clear();
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    await new Promise((resolve) => (this.wss ? this.wss.close(resolve) : resolve()));
    this.wss = null;
  }

  status() {
    return {
      connected: this.connected,
      extensionVersion: this.extensionVersion,
      appVersion: this.appVersion,
      pendingRequests: [...this.pending.keys()],
    };
  }

  // Gui mot thao tac sang extension, cho response. Timeout mac dinh 10 phut (AI video lau).
  request(operation, payload, timeoutMs = 600000) {
    if (!this.connected || !this.socket) return Promise.reject(Error('Chưa kết nối MooZ Connect.'));
    const id = `q${++this.requestSeq}-${Date.now().toString(36)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error('Tab AI chưa trả kết quả sau ' + Math.round(timeoutMs / 1000) + 's. Kiểm tra tab rồi gửi lại thủ công.'));
      }, timeoutMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket.send(JSON.stringify({ type: 'request', id, operation, payload }));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(Error('Chưa gửi được sang Chrome: ' + (e.message || e)));
      }
    });
  }

  _accept(ws) {
    // Chi mot extension tai mot thoi diem; ket noi cu bi thay the.
    if (this.socket) { try { this.socket.close(1000, 'Superseded connection'); } catch {} }
    this.socket = ws;
    this.connected = false;
    let authed = false;
    const failAuth = (reason) => { try { ws.close(1008, reason); } catch {} };
    ws.on('message', (data) => {
      let m;
      try {
        const text = typeof data === 'string' ? data : data.toString();
        if (text.length > 128 * 1024 * 1024) throw Error('Qua lon');
        m = JSON.parse(text);
      } catch { failAuth('Invalid message'); return; }
      this.lastSeen = Date.now();
      if (!authed) {
        if (m?.type !== 'auth' || m.token !== this.token || m.protocol !== PROTOCOL) {
          failAuth('Authentication failed'); return;
        }
        authed = true;
        this.connected = true;
        this.extensionVersion = typeof m.extensionVersion === 'string' ? m.extensionVersion : null;
        try {
          ws.send(JSON.stringify({
            type: 'ready', protocol: PROTOCOL, appVersion: this.appVersion,
            resultRecovery: 1, sessionToken: this.sessionToken, pendingRequests: [],
          }));
        } catch {}
        return;
      }
      if (m?.type === 'ping') { try { ws.send(JSON.stringify({ type: 'pong' })); } catch {} return; }
      if (m?.type === 'response' && typeof m.id === 'string') {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        clearTimeout(p.timer);
        try { ws.send(JSON.stringify({ type: 'response-ack', id: m.id })); } catch {}
        if (m.error !== undefined) p.reject(Error(String(m.error)));
        else p.resolve(m.result);
        return;
      }
      if (m?.type === 'notification' && m.event) { this.onNotification(m.event); return; }
      if (m?.type === 'gate' && typeof m.callId === 'string') {
        this.onGate(m).then(
          (result) => { try { ws.send(JSON.stringify({ type: 'gate-result', callId: m.callId, result })); } catch {} },
          (error) => { try { ws.send(JSON.stringify({ type: 'gate-result', callId: m.callId, result: { ok: false, error: error.message } })); } catch {} },
        );
        return;
      }
    });
    ws.on('close', () => {
      if (this.socket !== ws) return;
      this.socket = null;
      this.connected = false;
      this.extensionVersion = null;
      for (const [id, p] of this.pending) {
        clearTimeout(p.timer);
        this.pending.delete(id);
        p.reject(Error('Mất kết nối Chrome; chưa có kết quả. Kiểm tra tab AI rồi gửi lại thủ công.'));
      }
    });
    ws.on('error', () => {});
  }
}

module.exports = { ChromeHost, PROTOCOL };
