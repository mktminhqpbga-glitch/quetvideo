// tests/nodes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeCost, canGenerate } from '../renderer/modules/nodes.js';

test('diem demo: anh 15, video 30', () => {
  assert.equal(nodeCost({ type: 'image' }), 15);
  assert.equal(nodeCost({ type: 'video' }), 30);
});

test('node anh khong co prompt thi khong chay duoc', () => {
  assert.equal(canGenerate({ type: 'image', prompt: '' }), false);
  assert.equal(canGenerate({ type: 'image', prompt: 'test' }), true);
});
