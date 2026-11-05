// modules/canvas.js
// PHAN RIENG: Chi ve va tuong tac canvas, khong biet model AI hay diem la gi.
// - Canvas la 1 o grid rieng trong index.html, khong de len panel khac.
// - Pan: keo nen trong. Zoom: nut - / + o goc duoi canvas. Keo node: keo the node.
// - Day noi: ve bang duong cong SVG nam DUOI the node, khong che chu node.
// - Fit-view: dua tat ca node vao giua khung nhin, sua loi ban demo cu (node nam ngoai man hinh).
export function createCanvasView(canvasEl, onSelect, onDrag) {
  const view = { x: 0, y: 0, k: 1 };
  let draggingNode = null, panning = false, lastX = 0, lastY = 0;

  // Dua tat ca node vao giua, co chừa le tren/duoi cho header va thanh cong cu.
  function fitView(nodes) {
    if (!nodes.length) return;
    const rect = canvasEl.getBoundingClientRect();
    if (rect.width < 10) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + 260); maxY = Math.max(maxY, n.y + 180); }
    const scale = Math.min(1, (rect.width - 80) / Math.max(1, maxX - minX), (rect.height - 80) / Math.max(1, maxY - minY));
    view.k = scale;
    view.x = (rect.width - (maxX - minX) * scale) / 2 - minX * scale;
    view.y = (rect.height - (maxY - minY) * scale) / 2 - minY * scale + 20;
  }

  function applyTransform(layer) {
    layer.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
  }

  // Bat dau pan khi keo nen trong, khong phai keo node hay nut.
  canvasEl.addEventListener('pointerdown', (e) => {
    if (e.target === canvasEl) { panning = true; lastX = e.clientX; lastY = e.clientY; }
  });
  window.addEventListener('pointermove', (e) => {
    if (panning) { view.x += e.clientX - lastX; view.y += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; if (onDrag) onDrag(); }
    if (draggingNode) { draggingNode.node.x += (e.clientX - lastX) / view.k; draggingNode.node.y += (e.clientY - lastY) / view.k; lastX = e.clientX; lastY = e.clientY; if (onDrag) onDrag(); }
  });
  window.addEventListener('pointerup', () => { panning = false; draggingNode = null; });

  function startNodeDrag(e, node, onMove) {
    draggingNode = { node };
    lastX = e.clientX; lastY = e.clientY;
    e.stopPropagation();
    if (onMove) { const stop = () => { window.removeEventListener('pointerup', stop); onMove(); }; window.addEventListener('pointerup', stop); }
  }

  return { view, fitView, applyTransform, startNodeDrag, onSelect };
}
