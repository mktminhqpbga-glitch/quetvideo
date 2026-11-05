// app.js
// PHAN RIENG: Chi noi cac module lai voi nhau va gan nut bam.
// - Khong chua cong thuc tinh diem, khong chua logic ve canvas, khong goi API.
// - Moi thay doi giao dien chi sua o day va styles.css, khong sua state.js hay queue.js.
import { createProject, addNode, removeNode } from './modules/state.js';
import { nodeCost, canGenerate } from './modules/nodes.js';
import { createCanvasView } from './modules/canvas.js';
import { loadModels, filterModels } from './modules/library.js';
import { runJob } from './modules/queue.js';
import { saveProject, loadProject, downloadJson } from './modules/storage.js';
import { workflowSummary } from './modules/export.js';

let project = loadProject(createProject());
const canvasEl = document.getElementById('canvas');
const layer = document.getElementById('layer');
const toastEl = document.getElementById('toast');
let models = [];

// Ve lai toan bo canvas: day noi SVG o duoi, the node o tren.
function render() {
  saveProject(project);
  document.getElementById('credits').textContent = project.credits + ' diem demo';
  document.getElementById('projectName').value = project.name;
  const selected = project.nodes.find((n) => n.id === project.selectedId);
  document.getElementById('emptyHint').hidden = project.nodes.length > 0;
  // Day noi: duong cong tu phai node nguon sang trai node dich.
  let svg = '<svg width="2000" height="1200">';
  for (const w of project.wires) {
    const a = project.nodes.find((n) => n.id === w.from);
    const b = project.nodes.find((n) => n.id === w.to);
    if (a && b) svg += `<path d="M ${a.x + 260} ${a.y + 60} C ${a.x + 400} ${a.y + 60}, ${b.x - 140} ${b.y + 60}, ${b.x} ${b.y + 60}" stroke="#888" fill="none"/>`;
  }
  svg += '</svg>';
  layer.innerHTML = svg + project.nodes.map((n) => `
    <article class="node ${n.id === project.selectedId ? 'selected' : ''}" style="left:${n.x}px;top:${n.y}px" data-id="${n.id}">
      <strong>${n.title}</strong> <small>(${n.type})</small>
      <div class="result">${n.result || 'Chua co ket qua - nhap prompt roi bam nut Tao.'}</div>
      <small>${n.model || ''}</small>
    </article>`).join('');
  canvasView.applyTransform(layer);
  // Gan keo node va chon node sau moi lan ve.
  layer.querySelectorAll('.node').forEach((el) => {
    const node = project.nodes.find((n) => n.id === el.dataset.id);
    el.addEventListener('pointerdown', (e) => canvasView.startNodeDrag(e, node, render));
    el.addEventListener('click', () => { project.selectedId = node.id; renderProps(); render(); });
  });
  renderProps();
  document.getElementById('zoomLabel').textContent = Math.round(canvasView.view.k * 100) + '%';
}

function renderProps() {
  const node = project.nodes.find((n) => n.id === project.selectedId);
  if (!node) return;
  document.getElementById('propTitle').value = node.title;
  document.getElementById('propPrompt').value = node.prompt || '';
  document.getElementById('propModel').value = node.model || '';
  document.getElementById('propResult').textContent = node.result || '';
}

function showToast(text) { toastEl.textContent = text; }
function selectedNode() { return project.nodes.find((n) => n.id === project.selectedId); }

// Tao demo: dung node dang chon dung loai, neu khong thi node mau dau tien, neu khong co thi tu tao.
async function generateDemo(type) {
  let node = selectedNode();
  if (!node || node.type !== type) node = project.nodes.find((n) => n.type === type);
  if (!node) node = addNode(project, type);
  if (!canGenerate(node) && node.type !== 'final') { showToast('Node chua co prompt, hay nhap prompt truoc.'); return; }
  const cost = nodeCost(node);
  if (project.credits < cost) { showToast('Khong du diem demo.'); return; }
  project.credits -= cost;
  await runJob(project, node, (p) => { node.result = 'Dang chay demo... ' + p + '%'; render(); });
  showToast('Da chay xong ' + node.title + ', tru ' + cost + ' diem demo.');
  render();
}

const canvasView = createCanvasView(canvasEl, null, render);
document.getElementById('dbSample').onclick = () => { canvasView.fitView(project.nodes); render(); showToast('Da ve giua luong mau.'); };
document.getElementById('ehSample').onclick = () => { canvasView.fitView(project.nodes); render(); };
document.getElementById('dbCenter').onclick = () => { canvasView.fitView(project.nodes); render(); };
document.getElementById('dbAddImage').onclick = () => { addNode(project, 'image'); render(); };
document.getElementById('dbAddVideo').onclick = () => { addNode(project, 'video'); render(); };
document.getElementById('dbGenImage').onclick = () => generateDemo('image');
document.getElementById('dbGenVideo').onclick = () => generateDemo('video');
document.getElementById('dbReset').onclick = () => { project = createProject(); render(); canvasView.fitView(project.nodes); render(); };
document.getElementById('dbExport').onclick = () => { downloadJson(project); showToast('Da xuat file JSON luong.'); };
document.getElementById('btnGenerate').onclick = () => { const n = selectedNode(); if (n) generateDemo(n.type); };
document.getElementById('btnDelete').onclick = () => { const n = selectedNode(); if (n) { removeNode(project, n.id); render(); } };
document.getElementById('propTitle').onchange = (e) => { const n = selectedNode(); if (n) { n.title = e.target.value; render(); } };
document.getElementById('propPrompt').onchange = (e) => { const n = selectedNode(); if (n) { n.prompt = e.target.value; render(); } };
document.getElementById('propModel').onchange = (e) => { const n = selectedNode(); if (n) { n.model = e.target.value; render(); } };
document.getElementById('projectName').onchange = (e) => { project.name = e.target.value; render(); };
document.getElementById('zoomIn').onclick = () => { canvasView.view.k = Math.min(2, canvasView.view.k + 0.1); render(); };
document.getElementById('zoomOut').onclick = () => { canvasView.view.k = Math.max(0.3, canvasView.view.k - 0.1); render(); };
document.getElementById('btnShare').onclick = () => showToast('Ban demo: chua co chia se that.');
document.getElementById('btnMember').onclick = () => showToast('Ban demo: nut hoi vien chi la mo phong giao dien, khong thanh toan that.');

// Thu vien model: chon model thi ap ten va prompt mau vao node dang chon.
loadModels().then((data) => {
  models = data;
  const list = document.getElementById('modelList');
  const draw = () => {
    list.innerHTML = filterModels(models, document.getElementById('modelFilter').value).map((m) => `
      <div class="model-card"><strong>${m.name}</strong><br><small>${m.type} - Goc: ${m.base}</small><p>${m.description}</p><button data-id="${m.id}">Dung model nay</button></div>`).join('');
    list.querySelectorAll('button').forEach((b) => b.onclick = () => {
      const m = models.find((x) => x.id === b.dataset.id);
      const n = selectedNode();
      if (m && n) { n.model = m.name; if (!n.prompt) n.prompt = m.samplePrompt; showToast('Da ap model ' + m.name + ' vao ' + n.title); render(); }
    });
  };
  document.getElementById('modelFilter').onchange = draw;
  draw();
});
fetch('data/prompts.json').then((r) => r.json()).then((prompts) => {
  document.getElementById('promptList').innerHTML = prompts.map((p) => `<div class="model-card"><strong>${p.name}</strong><p>${p.text}</p><button data-id="${p.id}">Dung prompt nay</button></div>`).join('');
  document.querySelectorAll('#promptList button').forEach((b) => b.onclick = () => {
    const p = prompts.find((x) => x.id === b.dataset.id);
    const n = selectedNode();
    if (p && n) { n.prompt = p.text; showToast('Da ap prompt vao ' + n.title); render(); }
  });
});

// Khoi dong: ve truoc roi fit-view, de khong bao gio mo len chi thay nen trong.
render();
requestAnimationFrame(() => { canvasView.fitView(project.nodes); render(); });
