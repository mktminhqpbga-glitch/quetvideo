// modules/library.js
// PHAN RIENG: Thu vien model kieu Civitai, nhung chi la danh muc mau tai cho.
// - Y tuong lay tu Civitai: moi model co ten, loai, model goc, tu khoa kich hoat,
//   mo ta va prompt mau, de nguoi dung chon roi ap vao node.
// - Khong tai model that, khong copy model hay anh cua Civitai, khong goi API Civitai.
// - Nguoi dung tu them model cua minh vao data/models.json.
export async function loadModels() {
  const res = await fetch('data/models.json');
  return res.json();
}

export function filterModels(models, type) {
  if (!type || type === 'all') return models;
  return models.filter((m) => m.type === type);
}
