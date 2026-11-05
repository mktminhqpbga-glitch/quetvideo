// tests/ai-tab.test.mjs - Test AI qua tab: protocol, sites, dispatch, chrome-host.
// Khong can Chrome that: dung host gia + extension gia (WebSocket that).
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket, WebSocketServer } from 'ws';
import { validToken, newToken, pairingCode, parseURI } from '../desktop/remote-protocol.cjs';
import { list, get, providerForURL, queryPatterns } from '../desktop/ai-sites.cjs';
import { AIDispatch } from '../desktop/ai-dispatch.cjs';
import { ChromeHost } from '../desktop/chrome-host.cjs';

test('ma ghep cap cuc bo: tao -> doc lai duoc, sai token/host thi bi tu choi', () => {
  const token = newToken();
  assert.equal(validToken(token), true);
  assert.equal(validToken('xyz'), false);
  const code = pairingCode(54321, token);
  assert.ok(code.startsWith('workflow-connect://127.0.0.1:54321/'));
  const parsed = parseURI(code);
  assert.equal(parsed.port, 54321);
  assert.equal(parsed.token, token);
  assert.throws(() => parseURI('workflow-connect://127.0.0.1:54321/short'), /không hợp lệ/);
  assert.throws(() => parseURI('workflow-connect://example.com:54321/' + token), /không hợp lệ/);
  assert.throws(() => pairingCode(0, token), /Cổng/);
});

test('ai-sites: nhan dung provider theo URL tab, tu choi URL la', () => {
  assert.equal(providerForURL('https://muse.ai/chat'), 'muse');
  assert.equal(providerForURL('https://chatgpt.com/c/abc'), 'chatgpt');
  assert.equal(providerForURL('https://gemini.google.com/app'), 'gemini');
  assert.equal(providerForURL('https://grok.com/'), 'grok');
  assert.equal(providerForURL('https://flow.google.com/'), 'flow');
  assert.equal(providerForURL('https://example.com/'), null);
  assert.equal(providerForURL('http://muse.ai/'), null);
  assert.equal(get('muse').types.includes('video'), true);
  assert.equal(get('chatgpt').types.includes('video'), false);
  assert.ok(list().length >= 5);
  assert.ok(queryPatterns().length >= 5);
});

// Host gia: tra tab gia + ket qua gia, dem so lan gui de chung minh khong tu gui lai.
function fakeHost({ failMessage = false } = {}) {
  let calls = 0;
  const host = {
    status: () => ({ connected: true }),
    request: async (operation, payload) => {
      calls++;
      if (operation === 'tabs.query') {
        return [{ id: 7, url: 'https://muse.ai/chat', title: 'Muse' }];
      }
      if (operation === 'tabs.script') return [{ result: null }];
      if (operation === 'tabs.message') {
        if (failMessage) throw Error('Tab AI ngat giua chung');
        return { ok: true, url: 'data:image/png;base64,AAA' };
      }
      throw Error('operation la: ' + operation);
    },
    calls: () => calls,
  };
  return host;
}

test('dispatch: 2 job chay tuan tu theo thu tu, dung 1 tab', async () => {
  const host = fakeHost();
  const d = new AIDispatch({ host, sites: { get, queryPatterns, providerForURL }, gapMs: 10, restMs: 10 });
  d.select('muse', 7);
  const order = [];
  const p1 = d.enqueue({ prompt: 'anh 1', mediaType: 'image' }).then(() => order.push(1));
  const p2 = d.enqueue({ prompt: 'anh 2', mediaType: 'image' }).then(() => order.push(2));
  await Promise.all([p1, p2]);
  assert.deepEqual(order, [1, 2]);
  assert.equal(host.calls(), 4); // moi job: 1 tabs.script + 1 tabs.message
});

test('dispatch: loi thi job do loi, KHONG tu gui lai', async () => {
  const host = fakeHost({ failMessage: true });
  const d = new AIDispatch({ host, sites: { get, queryPatterns, providerForURL }, gapMs: 5, restMs: 5 });
  d.select('muse', 7);
  await assert.rejects(d.enqueue({ prompt: 'anh loi', mediaType: 'image' }), /ngat/);
  // Chi 1 lan message (1 script truoc do): khong co lan gui lai.
  assert.equal(host.calls(), 2);
});

test('dispatch: chua chon tab thi tu choi ngay, chua gui gi', async () => {
  const host = fakeHost();
  const d = new AIDispatch({ host, sites: { get, queryPatterns, providerForURL }, gapMs: 5, restMs: 5 });
  await assert.rejects(d.enqueue({ prompt: 'x', mediaType: 'image' }), /Chưa chọn AI/);
  assert.equal(host.calls(), 0);
});

test('dispatch: stop huy job dang cho', async () => {
  const host = fakeHost();
  const d = new AIDispatch({ host, sites: { get, queryPatterns, providerForURL }, gapMs: 5, restMs: 5 });
  d.select('muse', 7);
  const p1 = d.enqueue({ prompt: 'chay ngay', mediaType: 'image' });
  const p2 = d.enqueue({ prompt: 'cho roi huy', mediaType: 'image' });
  d.stop();
  await p1;
  await assert.rejects(p2, /Đã dừng/);
});

// May chu that + extension gia that: auth dung -> ready; auth sai -> dong.
test('chrome-host: extension gia auth dung thi nhan ready, gui request nhan response', async () => {
  const token = newToken();
  const host = new ChromeHost({
    WebSocketServer, token, appVersion: '0.3.0-test',
    onNotification: () => {}, onGate: async () => ({ ok: true }),
  });
  const port = await host.listen(0);
  assert.equal(host.status().connected, false);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const ready = await new Promise((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    ws.send(JSON.stringify({ type: 'auth', token, protocol: 1, resultRecovery: 1, extensionVersion: '1.9.1' }));
  });
  assert.equal(ready.type, 'ready');
  assert.equal(ready.appVersion, '0.3.0-test');
  assert.equal(host.status().connected, true);
  // Extension gia tra loi request tu app.
  const replyPromise = new Promise((resolve) => {
    ws.once('message', (data) => {
      const m = JSON.parse(data.toString());
      ws.send(JSON.stringify({ type: 'response', id: m.id, result: { ok: true, url: 'data:image/png;base64,BBB' } }));
      resolve(m);
    });
  });
  const resultPromise = host.request('tabs.query', { url: ['https://muse.ai/*'] });
  const req = await replyPromise;
  assert.equal(req.type, 'request');
  assert.equal(req.operation, 'tabs.query');
  const result = await resultPromise;
  assert.equal(result.url, 'data:image/png;base64,BBB');
  ws.close();
  await host.close();
});

test('chrome-host: token sai thi ket noi bi dong, khong ready', async () => {
  const token = newToken();
  const host = new ChromeHost({ WebSocketServer, token, appVersion: '0.3.0-test' });
  const port = await host.listen(0);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
  await new Promise((resolve) => { ws.once('open', resolve); });
  const closed = new Promise((resolve) => ws.once('close', resolve));
  ws.send(JSON.stringify({ type: 'auth', token: '0'.repeat(64), protocol: 1 }));
  await closed;
  assert.equal(host.status().connected, false);
  await host.close();
});
