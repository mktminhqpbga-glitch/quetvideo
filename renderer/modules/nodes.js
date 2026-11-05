// modules/nodes.js
// PHAN RIENG: Chi dinh nghia cac loai node va cach tinh diem, khong ve giao dien.
// - Diem demo: anh 15, video 30, am thanh 10, kich ban va thanh pham 0.
// - Day la diem demo trong app, khong phai gia that cua bat ky dich vu AI nao.
export const NODE_TYPES = {
  script: { label: 'Kich ban', cost: 0 },
  image: { label: 'Hinh anh', cost: 15 },
  video: { label: 'Video', cost: 30 },
  audio: { label: 'Am thanh', cost: 10 },
  final: { label: 'Thanh pham', cost: 0 },
};

export function nodeCost(node) {
  return NODE_TYPES[node.type] ? NODE_TYPES[node.type].cost : 0;
}

// Node chi chay duoc khi co prompt (tru node thanh pham chi ghep ket qua).
export function canGenerate(node) {
  if (!node) return false;
  if (node.type === 'final') return true;
  return String(node.prompt || '').trim().length > 0;
}
