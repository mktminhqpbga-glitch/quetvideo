// desktop/ai-dispatch.cjs
// PHAN RIENG: Dieu phoi AI qua tab — tuan tu, mot tab, khong tu gui lai.
// Luat giong app-mooz, viet lai cho QuetVideo:
// - Mot nhom chay mot AI + mot tab duy nhat, cac buoc giu cung tab, chay theo day phu thuoc.
// - Dong thoi: 1. Giua hai lan gui cach nhau GAP_MS (5s). Sau moi tac vu nghi REST_MS (5s).
// - Nut Dung huy cac buoc cho, gui WORKFLOW_AI_STOP / MUSEFLOW_STOP_GENERATION sang tab.
// - Mat ket noi hoac loi: job do ve FAILED, khong tu gui lai. Nguoi dung phai kiem tra
//   tab AI roi bam chay lai thu cong — dung nhu quy tac cua app-mooz.
// - Ket qua that chi co khi tab tra ve; khong bao gio dung anh mau thay ket qua that.
'use strict';
const { randomUUID } = require('node:crypto');

const GAP_MS = 5000;
const REST_MS = 5000;

class AIDispatch {
  constructor({ host, sites, gapMs = GAP_MS, restMs = REST_MS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
    this.host = host; // ChromeHost
    this.sites = sites; // ai-sites.cjs
    this.gapMs = gapMs;
    this.restMs = restMs;
    this.sleep = sleep;
    this.provider = null; // id AI da chon
    this.tabId = null; // id tab da chon cho nhom
    this.queue = []; // job dang cho
    this.running = null; // job dang chay
    this.stopped = false;
    this.listeners = new Set();
    this.lastSendAt = 0;
  }

  onEvent(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(event) { for (const fn of this.listeners) { try { fn(event); } catch {} } }

  status() {
    return {
      provider: this.provider,
      tabId: this.tabId,
      connected: this.host.status().connected,
      running: this.running ? { id: this.running.id, type: this.running.mediaType } : null,
      queued: this.queue.map((j) => j.id),
    };
  }

  async listTabs() {
    const tabs = await this.host.request('tabs.query', { url: this.sites.queryPatterns() });
    return (Array.isArray(tabs) ? tabs : []).map((t) => ({
      id: t.id, url: t.url, title: t.title || '',
      provider: this.sites.providerForURL(t.url),
    })).filter((t) => t.provider);
  }

  select(provider, tabId) {
    if (!this.sites.get(provider)) throw Error('Chưa chọn AI được hỗ trợ.');
    if (!Number.isInteger(tabId) || tabId < 0) throw Error('Chưa chọn tab AI.');
    this.provider = provider;
    this.tabId = tabId;
    this.emit({ type: 'selected', provider, tabId });
    return this.status();
  }

  // Dua mot job vao hang doi. Tra ve promise ket qua khi job xong (hoac loi).
  enqueue(job) {
    if (!this.provider || this.tabId === null) {
      return Promise.reject(Error('Chưa chọn AI và tab. Kết nối MooZ Connect rồi chọn tab AI trước.'));
    }
    const site = this.sites.get(this.provider);
    if (!site.types.includes(job.mediaType)) {
      return Promise.reject(Error(`${site.name} không hỗ trợ tạo ${job.mediaType}.`));
    }
    const item = {
      id: job.id || randomUUID(),
      nodeId: job.nodeId || null,
      prompt: String(job.prompt || '').trim(),
      mediaType: job.mediaType || 'image',
      size: job.size || '1:1',
      timeoutSec: job.timeoutSec || 600,
      referenceImages: Array.isArray(job.referenceImages) ? job.referenceImages : [],
      referenceVideos: Array.isArray(job.referenceVideos) ? job.referenceVideos : [],
    };
    if (!item.prompt) return Promise.reject(Error('Thiếu prompt.'));
    const promise = new Promise((resolve, reject) => { item.resolve = resolve; item.reject = reject; });
    item.promise = promise;
    this.queue.push(item);
    this.emit({ type: 'queued', id: item.id });
    void this._pump();
    return promise;
  }

  stop() {
    this.stopped = true;
    const stoppedQueued = this.queue.splice(0);
    for (const j of stoppedQueued) j.reject(Error('Đã dừng.'));
    if (this.running) {
      const { id } = this.running;
      void this._sendStop(id).catch(() => {});
    }
    this.emit({ type: 'stopped' });
  }

  async _sendStop(requestId) {
    const type = this.provider === 'muse' ? 'MUSEFLOW_STOP_GENERATION' : 'WORKFLOW_AI_STOP';
    try { await this.host.request('tabs.message', { id: this.tabId, message: { type, requestId } }, 15000); } catch {}
  }

  async _pump() {
    if (this.running || !this.queue.length) return;
    this.stopped = false;
    const job = this.queue.shift();
    this.running = job;
    this.emit({ type: 'started', id: job.id, nodeId: job.nodeId });
    try {
      const now = Date.now();
      const wait = this.gapMs - (now - this.lastSendAt);
      if (wait > 0) await this.sleep(wait);
      if (this.stopped) throw Error('Đã dừng.');
      // Dam bao bridge da nap trong tab truoc khi gui.
      const bridge = this.provider === 'muse' ? 'muse-bridge.js' : 'ai-bridge.js';
      await this.host.request('tabs.script', {
        id: this.tabId, files: ['ai-activity.js', 'composer-controls.js', bridge],
      }, 30000);
      this.lastSendAt = Date.now();
      const messageType = this.provider === 'muse' ? 'MUSEFLOW_GENERATE' : 'WORKFLOW_AI_GENERATE';
      const result = await this.host.request('tabs.message', {
        id: this.tabId,
        message: {
          type: messageType, requestId: job.id, prompt: job.prompt,
          mediaType: job.mediaType, size: job.size, timeoutSec: job.timeoutSec,
          referenceImages: job.referenceImages, referenceVideos: job.referenceVideos,
        },
      }, job.timeoutSec * 1000 + 60000);
      if (!result || result.ok === false) {
        throw Error(result?.error || 'Tab AI không trả kết quả. Kiểm tra tab rồi chạy lại.');
      }
      this.emit({ type: 'done', id: job.id, nodeId: job.nodeId });
      job.resolve(result);
    } catch (error) {
      // Khong tu gui lai: job loi la loi, nguoi dung tu kiem tra tab roi chay lai.
      this.emit({ type: 'failed', id: job.id, nodeId: job.nodeId, error: error.message });
      job.reject(error);
    } finally {
      this.running = null;
      if (!this.stopped) await this.sleep(this.restMs);
      void this._pump();
    }
  }
}

module.exports = { AIDispatch, GAP_MS, REST_MS };
