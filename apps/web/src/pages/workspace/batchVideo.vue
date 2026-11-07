<template>
  <el-dialog v-model="visible" title="Video hàng loạt · MooZ × ToonFlow" width="min(1000px, calc(100vw - 32px))" append-to-body :close-on-click-modal="false">
    <div class="batchStudio">
      <el-alert type="info" :closable="false" show-icon>
        Mỗi dòng là một video riêng. Các Chrome đã ghép cặp nhận tác vụ luân phiên, một tác vụ tại mỗi Chrome. Kết quả được lưu trong dự án ToonFlow.
        Trên Muse, hãy chọn chế độ Video trước khi chạy.
      </el-alert>
      <div class="formGrid">
        <div class="mainForm">
          <label for="batchVideoPrompts">Prompt video (mỗi dòng một video)</label>
          <el-input id="batchVideoPrompts" v-model="promptText" type="textarea" :rows="5" maxlength="100000" show-word-limit :disabled="running" placeholder="Cảnh 1: Máy quay tiến về phía con phố mưa...\nCảnh 2: Người đi bộ nhìn ra xa..." />
        </div>
        <div class="sideForm">
          <label for="batchChromeDevices">Device ID của Chrome đã kết nối</label>
          <el-input id="batchChromeDevices" v-model="deviceText" :disabled="running" placeholder="chrome-main, chrome-vm-01" />
          <label>Tỷ lệ dự kiến</label>
          <el-select v-model="ratio" :disabled="running" style="width:100%">
            <el-option label="Dọc 9:16" value="9:16" />
            <el-option label="Ngang 16:9" value="16:9" />
            <el-option label="Vuông 1:1" value="1:1" />
          </el-select>
          <p class="hint">Giữ nguyên video node thông thường. Đây là bảng điều phối hàng loạt theo mẫu của MooZ, không tự thay đổi chế độ/tỷ lệ trên website Muse.</p>
        </div>
      </div>
      <div class="toolbar">
        <el-button :disabled="running || !directory" @click="enqueue">Thêm vào hàng chờ</el-button>
        <el-button type="primary" :disabled="running || !jobs.some(job => job.status === 'queued')" @click="start">Chạy hàng đợi</el-button>
        <el-button :disabled="!running || paused" @click="paused = true">Tạm dừng sau tác vụ đang chạy</el-button>
        <el-button :disabled="running || !jobs.some(job => ['unknown', 'running', 'submitting'].includes(job.status))" @click="checkExisting(false)">Kiểm tra lại tác vụ</el-button>
        <el-button :disabled="running || !jobs.some(job => job.status === 'unknown')" @click="checkExisting(true)">Theo dõi tác vụ cũ</el-button>
        <el-button :disabled="running || !jobs.some(job => ['done', 'failed'].includes(job.status))" @click="clearFinished">Dọn tác vụ đã xong/lỗi</el-button>
      </div>
      <div class="stats">
        <span>Đang chờ: {{ jobs.filter(job => job.status === 'queued').length }}</span>
        <span>Đang xử lý: {{ jobs.filter(job => ['running', 'submitting'].includes(job.status)).length }}</span>
        <span>Hoàn thành: {{ jobs.filter(job => job.status === 'done').length }}</span>
        <span>Lỗi/cần kiểm tra: {{ jobs.filter(job => ['failed', 'unknown'].includes(job.status)).length }}</span>
      </div>
      <el-table :data="jobs" height="330" row-key="id" empty-text="Chưa có video nào trong hàng đợi">
        <el-table-column label="#" width="55">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="Prompt" min-width="230">
          <template #default="{ row }"><span class="promptCell" :title="row.prompt">{{ row.prompt }}</span></template>
        </el-table-column>
        <el-table-column label="Chrome" width="125" prop="deviceId" />
        <el-table-column label="Tình trạng" width="135">
          <template #default="{ row }">
            <el-tag :type="row.status === 'done' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'unknown' ? 'warning' : 'info'" size="small">
              {{ statusText[row.status as BatchStatus] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Kết quả" width="260">
          <template #default="{ row }">
            <template v-if="row.path">
              <el-button link type="primary" @click="copyPath(row.path)">Sao chép</el-button>
              <el-button v-if="!row.canvasNodeId" link type="primary" @click="attachToCanvas(row)">Đưa vào Canvas</el-button>
              <el-tag v-else type="success" size="small">Đã đưa vào Canvas</el-tag>
            </template>
            <span v-else class="errorCell" :title="row.error || ''">{{ row.error || '—' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <p class="notice">Tác vụ được ghi nhớ theo dự án trên máy này. Nếu mất kết nối sau khi gửi, trạng thái sẽ là “Cần kiểm tra”, không tự động phát lại. Video nằm trong thư mục <code>assets/batchVideos/</code> của dự án. Relay có giới hạn kích thước video và phải chạy bản mới.</p>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { createBatchJobs, parseBatchPrompts, parseDevices, type BatchVideoJob, type BatchStatus } from "./batchVideoModel";

const props = defineProps<{ directory: string; addToCanvas?: (result: { path: string; mimeType: string; prompt: string }) => Promise<string> }>();
const visible = defineModel<boolean>({ default: false });
const promptText = ref("");
const deviceText = ref("chrome-main");
const ratio = ref<BatchVideoJob["ratio"]>("9:16");
const jobs = ref<BatchVideoJob[]>([]);
const running = ref(false);
const paused = ref(false);
const destroyed = ref(false);
const statusText: Record<BatchStatus, string> = {
  queued: "Chờ", submitting: "Đang gửi", running: "Đang chạy", done: "Hoàn thành", failed: "Lỗi", unknown: "Cần kiểm tra",
};

function keyFor(directory: string) { return "toonflow.batchVideo.v1." + encodeURIComponent(directory); }
function persist() {
  if (!props.directory) return;
  try { localStorage.setItem(keyFor(props.directory), JSON.stringify(jobs.value.slice(-100))); }
  catch (cause) { console.warn("Không lưu được hàng đợi cục bộ", cause); }
}
watch(jobs, persist, { deep: true });
watch(() => props.directory, directory => {
  if (!directory) { jobs.value = []; return; }
  let saved: unknown;
  try { saved = JSON.parse(localStorage.getItem(keyFor(directory)) || "[]"); } catch { saved = []; }
  jobs.value = Array.isArray(saved) ? saved.filter(isJob).slice(-100).map(job => ({
    ...job,
    // A task may still be processing on the server; never automatically resubmit.
    status: ["running", "submitting"].includes(job.status) ? "unknown" : job.status,
  })) : [];
}, { immediate: true });

function isJob(value: unknown): value is BatchVideoJob {
  if (!value || typeof value !== "object") return false;
  const item = value as BatchVideoJob;
  return typeof item.id === "string" && typeof item.taskId === "string" &&
    /^[0-9a-f-]{36}$/i.test(item.taskId) && typeof item.prompt === "string" &&
    item.prompt.length > 0 && item.prompt.length <= 4000 &&
    ["9:16", "16:9", "1:1"].includes(item.ratio) &&
    ["queued", "submitting", "running", "done", "failed", "unknown"].includes(item.status);
}

function enqueue() {
  try {
    parseDevices(deviceText.value);
    const prompts = parseBatchPrompts(promptText.value);
    if (jobs.value.length + prompts.length > 100) throw new Error("Hàng đợi tối đa 100 video; dọn các mục hoàn thành trước.");
    jobs.value.push(...createBatchJobs(prompts, ratio.value));
    promptText.value = "";
    ElMessage.success("Đã chốt " + prompts.length + " prompt riêng vào hàng đợi");
  } catch (error) { ElMessage.error((error as Error).message); }
}

type ApiResponse<T> = { code: number; message?: string; data: T };
async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-toonflow-workspace": "1" },
    body: JSON.stringify(body), signal,
  });
  const json = await response.json() as ApiResponse<T>;
  if (!response.ok || json.code !== 200) throw new Error(json.message || "ToonFlow backend HTTP " + response.status);
  return json.data;
}

type ServerTask = {
  taskId: string;
  state?: "running" | "interrupted" | "succeeded" | "failed" | "cancelled";
  resumable?: boolean;
  result?: { code: number; message: string; data: { mediaType: string; path: string; mimeType: string }[] | null };
};

async function fetchStatus(directory: string, task: BatchVideoJob, resume = false): Promise<ServerTask> {
  const status = await post<ServerTask[]>("/api/ai/media/tasks/status",
    { directory, taskIds: [task.taskId], ...(resume ? { resume: true } : {}) }, AbortSignal.timeout(15000));
  if (!status[0] || status[0].taskId !== task.taskId) throw new Error("Không tìm thấy tác vụ trên ToonFlow server");
  return status[0];
}

function applyStatus(job: BatchVideoJob, status: ServerTask) {
  if (status.result) {
    if (status.result.code !== 200 || !status.result.data?.length) {
      job.status = "failed";
      job.error = status.result.message || "Video generation failed";
      return true;
    }
    const result = status.result.data.find(file => file.mediaType === "video" && file.mimeType.startsWith("video/"));
    if (!result) {
      job.status = "failed";
      job.error = "Không nhận được file video hợp lệ.";
      return true;
    }
    job.path = result.path;
    job.mimeType = result.mimeType;
    job.status = "done";
    job.error = undefined;
    return true;
  }
  if (status.state === "interrupted" || status.state === "cancelled") {
    job.status = "unknown";
    job.error = status.resumable ? "Gián đoạn; bấm Theo dõi tác vụ cũ." : "Không rõ kết quả; mở Muse để kiểm tra.";
    return true;
  }
  return false;
}

async function waitForJob(directory: string, job: BatchVideoJob) {
  while (!destroyed.value && props.directory === directory) {
    try {
      const status = await fetchStatus(directory, job);
      if (applyStatus(job, status)) return;
      job.status = "running";
    } catch (error) {
      job.status = "unknown";
      job.error = "Không thể xác nhận tác vụ: " + (error as Error).message;
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function runWorker(directory: string, deviceId: string) {
  while (!paused.value && props.directory === directory && !destroyed.value) {
    const job = jobs.value.find(item => item.status === "queued");
    if (!job) return;
    job.status = "submitting";
    job.deviceId = deviceId;
    persist();
    try {
      await post<{ taskId: string }>("/api/ai/media/generate", {
        directory,
        mediaType: "video",
        taskId: job.taskId,
        providerId: "chromeMuse",
        modelId: "museChromeVideo",
        prompt: job.prompt,
        ratio: job.ratio,
        mode: "text",
        outputDirectory: "assets/batchVideos",
        other: { deviceId },
      }, AbortSignal.timeout(18000));
      job.status = "running";
      await waitForJob(directory, job);
    } catch (error) {
      // The server may have accepted the task even if the acknowledgement was lost.
      job.status = "unknown";
      job.error = "Chưa rõ đã gửi hay chưa: " + (error as Error).message + ". Kiểm tra trước khi tạo lại.";
    }
    persist();
  }
}

async function start() {
  if (running.value) return;
  try {
    const devices = parseDevices(deviceText.value);
    if (!props.directory) throw new Error("Hãy mở một dự án ToonFlow trước khi chạy hàng đợi.");
    if (!jobs.value.some(job => job.status === "queued")) return;
    const directory = props.directory;
    running.value = true;
    paused.value = false;
    await Promise.all(devices.map(deviceId => runWorker(directory, deviceId)));
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally { running.value = false; }
}

async function checkExisting(resume: boolean) {
  const directory = props.directory;
  if (!directory) return;
  if (resume) {
    try { await ElMessageBox.confirm("Chỉ tiếp tục theo dõi ID cũ; không tạo tác vụ video mới. Bạn đã kiểm tra Muse chưa?", "Xác nhận", { type: "warning" }); }
    catch { return; }
  }
  for (const job of jobs.value.filter(job => ["unknown", "running", "submitting"].includes(job.status))) {
    try {
      const state = await fetchStatus(directory, job, resume);
      if (!applyStatus(job, state)) {
        job.status = "unknown";
        job.error = "Tác vụ vẫn đang xử lý. Bạn có thể kiểm tra lại sau.";
      }
    } catch (error) {
      job.status = "unknown";
      job.error = (error as Error).message;
    }
  }
  persist();
}

function clearFinished() {
  jobs.value = jobs.value.filter(job => !["done", "failed"].includes(job.status));
}
async function attachToCanvas(job: BatchVideoJob) {
  if (!job.path || !job.mimeType || !props.addToCanvas) return;
  try {
    const nodeId = await props.addToCanvas({ path: job.path, mimeType: job.mimeType, prompt: job.prompt });
    job.canvasNodeId = nodeId;
    persist();
    ElMessage.success("Đã đưa video vào Canvas dưới dạng node Video");
  } catch (error) { ElMessage.error((error as Error).message); }
}
async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(props.directory.replace(/[\\/]+$/, "") + "/" + path);
    ElMessage.success("Đã sao chép đường dẫn video");
  } catch { ElMessage.info("File: " + path); }
}
onUnmounted(() => { destroyed.value = true; });
</script>

<style scoped>
.batchStudio { display: flex; flex-direction: column; gap: 16px; }
.formGrid { display:grid; grid-template-columns: minmax(0,2fr) minmax(230px,1fr); gap: 16px; }
.mainForm,.sideForm { display:flex; flex-direction:column; gap: 8px; min-width: 0; }
.sideForm label { margin-top: 4px; }
.formGrid label { font-size: 13px; font-weight: 600; }
.toolbar { display:flex; flex-wrap:wrap; gap: 6px; }
.stats { display:flex; flex-wrap:wrap; gap:18px; font-size: 12px; color: var(--el-text-color-regular); }
.promptCell { display:block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.errorCell { display:block; color:var(--el-text-color-secondary); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.hint,.notice { color:var(--el-text-color-secondary); line-height:1.55; font-size:12px; margin: 4px 0; }
@media (max-width:700px) { .formGrid { grid-template-columns: 1fr; } }
</style>
