// modules/state.js
// PHAN RIENG: Chi giu du lieu du an, khong cham vao DOM.
// - Node: 1 cong viec (kich ban, anh, video, am thanh, thanh pham).
// - Wire: 1 duong noi tu node nguon sang node dich, mang ket qua di.
// - Khong co code ve keo tha, ve hinh hay goi API o day, de test duoc bang Node thuan.
export function createProject() {
  return {
    name: 'Du an chua dat ten',
    credits: 100,
    nodes: [
      // Luong mau thuong mai, giong demo LibTV da lam truoc do.
      { id: 'n1', type: 'script', title: 'Kich ban', x: 40, y: 40, prompt: 'Nhan vat hoi vien gioi thieu san pham, 3 shot, ket thuc giu yen roi cat cung.', result: 'Kich ban mau: gioi thieu - quay form - can canh logo.' },
      { id: 'n2', type: 'image', title: 'Node Hinh anh 5', x: 360, y: 40, prompt: 'Anh thoi trang thuong mai chan thuc, toan than, giu nguyen khuon mat va mau ao tu anh tham chieu.', model: 'Anh chan dung - Mau', ratio: '9:16', quality: 'Chuan', resolution: '2K', result: '' },
      { id: 'n3', type: 'image', title: 'Node Hinh anh 4', x: 360, y: 320, prompt: 'Anh san pham hero, nen sach, thay ro co ao, soc va logo.', model: 'Anh san pham - Mau', ratio: '1:1', quality: 'Chuan', resolution: '2K', result: '' },
      { id: 'n4', type: 'video', title: 'Node Video 8', x: 700, y: 180, prompt: 'Nhan vat mac san pham, mim cuoi nhin camera, quay nhe thay form ao, can canh logo.', model: 'Video chuyen dong - Mau', result: '' },
    ],
    wires: [
      { from: 'n1', to: 'n2' },
      { from: 'n1', to: 'n3' },
      { from: 'n2', to: 'n4' },
      { from: 'n3', to: 'n4' },
    ],
    selectedId: 'n2',
  };
}

// Them node moi, id tang dan theo so node hinh anh/video hien co, khong trung nhau.
export function addNode(project, type) {
  const count = project.nodes.filter((n) => n.type === type).length + 1;
  const titles = { script: 'Kich ban', image: 'Node Hinh anh', video: 'Node Video', audio: 'Node Am thanh', final: 'Thanh pham' };
  const node = { id: 'n' + Date.now(), type, title: (titles[type] || 'Node') + ' ' + count, x: 80 + project.nodes.length * 20, y: 80 + project.nodes.length * 20, prompt: '', model: '', result: '' };
  project.nodes.push(node);
  project.selectedId = node.id;
  return node;
}

// Xoa node va moi day noi lien quan, khong de day noi treo.
export function removeNode(project, id) {
  project.nodes = project.nodes.filter((n) => n.id !== id);
  project.wires = project.wires.filter((w) => w.from !== id && w.to !== id);
  if (project.selectedId === id) project.selectedId = project.nodes[0] ? project.nodes[0].id : null;
}

// Kiem tra day noi co hop le khong: khong tu noi vao chinh minh, khong trung day cu.
export function canWire(project, from, to) {
  if (from === to) return false;
  return !project.wires.some((w) => w.from === from && w.to === to);
}
