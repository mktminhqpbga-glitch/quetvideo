// modules/queue.js
// PHAN RIENG: Hang doi mo phong, tach rieng de sau nay thay bang API AI that
// ma khong phai sua giao dien hay canvas.
// - Hien tai: chay tien trinh gia, tru diem demo, ghi ket qua mau vao node.
// - Sau nay: chi can thay ham runJob nay bang goi API that, giu nguyen ten ham
//   va cach tra ve (progress -> done), cac module khac khong doi.
export function runJob(project, node, onProgress) {
  return new Promise((resolve) => {
    let progress = 0;
    const timer = setInterval(() => {
      progress += 20;
      if (onProgress) onProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(timer);
        // Ket qua mau, noi ro la demo, khong phai anh/video do AI that tao ra.
        node.result = '[Ket qua demo] Da chay xong node ' + node.title + '. Can noi API AI that de co anh/video that.';
        resolve(node);
      }
    }, 200);
  });
}
