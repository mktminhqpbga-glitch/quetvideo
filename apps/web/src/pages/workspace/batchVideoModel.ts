/** ToonFlow adaptation of MooZ Batch Composer input and queue validation.
 * Each prompt is an independent immutable job snapshot. No background automatic retries.
 */
export type BatchStatus = "queued" | "submitting" | "running" | "done" | "failed" | "unknown";

export type BatchVideoJob = {
  id: string;
  taskId: string;
  prompt: string;
  ratio: "9:16" | "16:9" | "1:1";
  createdAt: number;
  status: BatchStatus;
  deviceId?: string;
  path?: string;
  mimeType?: string;
  canvasNodeId?: string;
  error?: string;
};

export function parseBatchPrompts(input: string, eachLine = true): string[] {
  const entries = (eachLine ? input.split(/\r?\n/) : [input]).map(line => line.trim()).filter(Boolean);
  if (!entries.length) throw new Error("Nhập ít nhất một prompt tạo video.");
  if (entries.length > 100) throw new Error("Một lượt tối đa 100 prompt.");
  if (entries.some(line => line.length > 4000)) throw new Error("Mỗi prompt tối đa 4.000 ký tự.");
  return entries;
}

export function parseDevices(input: string): string[] {
  const devices = input.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean);
  if (!devices.length) throw new Error("Nhập ít nhất một Chrome Device ID.");
  if (devices.length > 8 || new Set(devices).size !== devices.length ||
    devices.some(id => !/^[a-zA-Z0-9_-]{1,64}$/.test(id))) {
    throw new Error("Tối đa 8 ID riêng biệt; chỉ dùng chữ cái, số, _ và -.");
  }
  return devices;
}

export function createBatchJobs(prompts: string[], ratio: BatchVideoJob["ratio"]): BatchVideoJob[] {
  if (!["9:16", "16:9", "1:1"].includes(ratio)) throw new Error("Tỷ lệ không hợp lệ.");
  return prompts.map(prompt => ({
    id: crypto.randomUUID(), taskId: crypto.randomUUID(), prompt, ratio, createdAt: Date.now(), status: "queued",
  }));
}
