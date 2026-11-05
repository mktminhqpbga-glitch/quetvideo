// tests/state.test.mjs - Chi test logic du lieu, khong can trinh duyet hay Electron.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, addNode, removeNode, canWire } from '../renderer/modules/state.js';

test('du an mau co 4 node va 4 day noi', () => {
  const p = createProject();
  assert.equal(p.nodes.length, 4);
  assert.equal(p.wires.length, 4);
});

test('them va xoa node thi day noi lien quan cung bien mat', () => {
  const p = createProject();
  const n = addNode(p, 'audio');
  assert.ok(p.nodes.find((x) => x.id === n.id));
  removeNode(p, n.id);
  assert.equal(p.nodes.find((x) => x.id === n.id), undefined);
});

test('khong cho tu noi vao chinh minh', () => {
  const p = createProject();
  assert.equal(canWire(p, 'n1', 'n1'), false);
});
