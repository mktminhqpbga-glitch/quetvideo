// tests/smoke.test.mjs - Chi test cau truc du an, khong can trinh duyet hay Electron.
// Kiem tra: package.json co du lenh chay, main mo dung renderer, demo ton tai,
// va provider mo phong trong examples/ chay duoc mot job.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockProvider, JobQueue } from '../examples/ai-provider.example.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('package.json co lenh start/web/test va build win/mac/linux', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  assert.equal(pkg.version, '0.2.0');
  assert.equal(pkg.main, 'desktop/main.cjs');
  assert.equal(pkg.scripts.start, 'electron .');
  assert.equal(pkg.scripts.web, 'node server.js');
  assert.ok(pkg.scripts['dist:win'] && pkg.scripts['dist:mac'] && pkg.scripts['dist:linux']);
});

test('main Electron mo renderer/index.html, khong bat Node trong renderer', () => {
  const main = fs.readFileSync(path.join(ROOT, 'desktop/main.cjs'), 'utf-8');
  assert.ok(main.includes("renderer', 'index.html'") || main.includes("'renderer', 'index.html'"));
  assert.ok(main.includes('nodeIntegration: false'));
  assert.ok(main.includes('contextIsolation: true'));
});

test('renderer la LibTV Canvas Demo, co tieu de dung', () => {
  const html = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf-8');
  assert.ok(html.includes('LibTV Canvas Demo'));
  assert.ok(html.length > 1000000);
});

test('provider mo phong chay xong mot job qua hang doi tuan tu', async () => {
  const q = new JobQueue(MockProvider);
  const result = await q.enqueue({ prompt: 'test', onProgress: () => {} });
  assert.equal(result.status, 'done');
});

test('tai lieu app-mooz co du trong docs/', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/WORKFLOW.md')));
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/AI-CALLING.md')));
});
