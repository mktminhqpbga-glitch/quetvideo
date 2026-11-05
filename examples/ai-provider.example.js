// examples/ai-provider.example.js
// PHAN VI DU, KHONG DUOC NAP BOI index.html.
// Muc dich: cho thay interface goi AI ma demo co the thay vao cho mo phong,
// theo dung nguyen tac cua app-mooz: hang doi, trang thai that, khong gui lai
// khi chua ro ket qua, khong ghi API key vao code.
// Chay thu phan mo phong bang Node (khong can cai goi nao):
//   node --input-type=module -e "import('./examples/ai-provider.example.js')"
// Phan API ben duoi chi la khung co ghi chu, chua co URL hay key that,
// nen no se bao loi chu khong tao ra anh that cho toi khi ban tu dien vao.

// 1. Interface chung: moi provider phai co cung 2 ham nay.
//    - createJob(job): tra ve { jobId }
//    - waitForResult(jobId, onProgress): tra ve ket qua khi xong.
export const MockProvider = {
  async createJob(job) {
    // Mo phong: khong goi mang, chi tra jobId gia.
    return { jobId: 'mock-' + Date.now(), job };
  },
  async waitForResult(jobId, onProgress) {
    // Mo phong: tien trinh 20, 40, 60, 80, 100, moi buoc 200ms.
    for (let p = 20; p <= 100; p += 20) {
      if (onProgress) onProgress(p);
      await new Promise((r) => setTimeout(r, 200));
    }
    return { jobId, status: 'done', result: '[Ket qua demo] Can noi API that de co anh/video that.' };
  },
};

// 2. Hang doi don gian: chay tuan tu, 1 job tai 1 thoi diem.
//    Giong nguyen tac cua app-mooz: 1 tab chi nhan 1 tac vu, tab ban thi cho.
export class JobQueue {
  constructor(provider) {
    this.provider = provider;
    this.queue = [];
    this.running = false;
  }
  enqueue(job) {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.runNext();
    });
  }
  async runNext() {
    if (this.running || !this.queue.length) return;
    this.running = true;
    const { job, resolve, reject } = this.queue.shift();
    try {
      const { jobId } = await this.provider.createJob(job);
      const result = await this.provider.waitForResult(jobId, job.onProgress);
      resolve(result);
    } catch (e) {
      // Loi thi bao loi, khong tu gui lai job khi chua ro ket qua.
      reject(e);
    } finally {
      this.running = false;
      this.runNext();
    }
  }
}

// 3. Khung API HTTP, CHUA CHAY DUOC, chi de dien vao sau.
//    - API_KEY lay tu bien moi truong, KHONG ghi truc tiep vao day.
//    - URL, cach gui tham chieu va cach hoi trang thai tuy tung nha cung cap.
//    - Chi bat dau viet phan nay khi ban da co nha cung cap va key that.
/*
export const HttpApiProvider = {
  async createJob(job) {
    const res = await fetch('https://API-CUA-BAN/v1/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.AI_API_KEY,
      },
      body: JSON.stringify(job),
    });
    if (!res.ok) throw new Error('Tao job that bai: ' + res.status);
    return res.json();
  },
  async waitForResult(jobId, onProgress) {
    // Hoi trang thai theo chu ky, cho toi khi status la done hoac failed.
    // Khong gui lai job moi trong luc cho.
    throw new Error('Chua cai dat phan hoi trang thai cho nha cung cap nay.');
  },
};
*/

// 4. Goi qua tab AI — DA CO THAT tu QuetVideo 0.3.0 (desktop/ai-dispatch.cjs).
//    TabProvider nay chi la lop boc de dung trong renderer: no goi
//    window.quetvideo.aiRun (preload -> main -> ai-dispatch -> chrome-host ->
//    MooZ Connect -> tab AI). Chi chay trong app Electron; tren web,
//    window.quetvideo khong ton tai nen no bao loi ro rang thay vi gia vo chay.
export const TabProvider = {
  _jobs: new Map(),
  async createJob(job) {
    if (typeof window === 'undefined' || !window.quetvideo?.aiRun) {
      throw new Error('AI qua tab chỉ chạy trên app QuetVideo (npm start). Trên web, demo vẫn chạy mô phỏng.');
    }
    const id = 'tab-' + Date.now();
    this._jobs.set(id, job);
    return { jobId: id };
  },
  async waitForResult(jobId, onProgress) {
    const job = this._jobs.get(jobId);
    if (!job) throw new Error('Không còn mã tác vụ tab AI; không tự gửi lại prompt.');
    this._jobs.delete(jobId);
    if (onProgress) onProgress(10);
    const result = await window.quetvideo.aiRun({
      nodeId: job.nodeId || null,
      prompt: job.prompt,
      mediaType: job.mediaType || 'image',
      size: job.size || '16:9',
      timeoutSec: job.timeoutSec || 600,
    });
    if (onProgress) onProgress(100);
    return { jobId, status: 'done', result };
  },
};

// 5. Cac buoc goi qua tab AI, theo cach app-mooz lam (ghi lai de doi chieu
//    voi desktop/ai-dispatch.cjs):
//    - Chon AI va tab cho ca nhom, giu cung tab qua moi buoc.
//    - Gui prompt + anh tham chieu vao tab, cach nhau 5 giay, tuan tu.
//    - Theo doi chat, doi ket qua dung loai va doi chieu prompt.
//    - Xac nhan da nhan roi moi chuyen buoc sau; chua ro thi dung va
//      kiem tra tab thu cong, khong tu gui lai.
