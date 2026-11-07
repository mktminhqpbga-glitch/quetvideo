const rules = [
  { type: "input", field: "relayUrl" as const, title: "MooZ relay URL", value: "https://mooz-relay.onrender.com", props: { placeholder: "https://mooz-relay.onrender.com" } },
  { type: "input", field: "relayAdminKey" as const, title: "MooZ RELAY_ADMIN_KEY (ToonFlow backend only)", value: "", props: { type: "password", showPassword: true, autocomplete: "off" } },
  { type: "input", field: "deviceId" as const, title: "Default Chrome device ID", value: "chrome-main", props: { placeholder: "chrome-main" } },
] as const;

type JobState = {
  jobId: string;
  state: "queued" | "running" | "done" | "error";
  error?: string;
  result?: { imageData?: string; imageUrl?: string; videoData?: string; videoUrl?: string };
};
type Context = ProviderContext<ProviderConfig<typeof rules>>;
type GenerationType = "image" | "video";
const devicePattern = /^[a-zA-Z0-9_-]{1,64}$/;

function baseUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("MooZ relay must use HTTPS (except localhost)");
  }
  if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("Relay URL must be a base origin");
  return url.origin;
}

function getConnection(context: Context) {
  const url = baseUrl(context.config.relayUrl || "");
  const key = context.config.relayAdminKey?.trim();
  if (!key) throw new Error("Enter the existing RELAY_ADMIN_KEY in ToonFlow Media Model settings (not in Chrome)");
  return { url, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" } };
}

async function readResponse(response: Response) {
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "MooZ relay HTTP " + response.status);
  return body;
}

function formatResult(status: JobState, type: GenerationType): MediaAsset[] {
  const data = type === "video" ? status.result?.videoData : status.result?.imageData;
  const kind = type === "video" ? "(video\\/(?:mp4|webm|quicktime))" : "(image\\/(?:png|jpeg|webp))";
  if (typeof data === "string" && data.startsWith("data:" + type + "/")) {
    const parts = new RegExp("^data:" + kind + ";base64,([A-Za-z0-9+/=]+)$").exec(data);
    if (!parts) throw new Error("Invalid " + type + " returned by Chrome");
    return [{ mediaType: type, type: "base64", mimeType: parts[1]!, data: parts[2]! }];
  }
  const url = type === "video" ? status.result?.videoUrl : status.result?.imageUrl;
  if (typeof url === "string" && /^https:\/\//.test(url)) return [{ mediaType: type, type: "url", url }];
  throw new Error("Chrome did not return " + type + "; do not use a thumbnail as a video");
}

async function waitForResult(context: Context, jobId: string, type: GenerationType): Promise<MediaAsset[]> {
  const { url, headers } = getConnection(context);
  const signal = context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(11 * 60_000)]) : AbortSignal.timeout(11 * 60_000);
  while (true) {
    signal.throwIfAborted();
    const response = await context.tool.fetch(url + "/toonflow/jobs/" + encodeURIComponent(jobId), { headers, signal });
    const status = await readResponse(response) as JobState;
    if (status.state === "error") throw new Error(status.error || "Muse generation failed. Inspect the tab before starting another job.");
    if (status.state === "done") return formatResult(status, type);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(); }, 2500);
      const aborted = () => { clearTimeout(timer); reject(signal.reason); };
      signal.addEventListener("abort", aborted, { once: true });
    });
  }
}

async function submit(context: Context, request: ImageRequest | VideoRequest, mediaType: GenerationType): Promise<MediaAsset[]> {
  const { url, headers } = getConnection(context);
  const override = request.other?.deviceId;
  const deviceId = typeof override === "string" ? override : context.config.deviceId?.trim();
  if (!deviceId || !devicePattern.test(deviceId)) throw new Error("Invalid Chrome device ID");
  if (mediaType === "image" && (request.images?.length || (request as ImageRequest).mask)) throw new Error("Muse Chrome currently supports text-to-image only");
  if (mediaType === "video") {
    const video = request as VideoRequest;
    if (video.images?.length || video.videos?.length || video.audios?.length || video.firstFrame || video.lastFrame) {
      throw new Error("Muse Chrome batch currently supports text-to-video only, without reference media");
    }
  }
  const signal = context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  const response = await context.tool.fetch(url + "/toonflow/jobs", {
    method: "POST", headers, signal,
    body: JSON.stringify({
      deviceId, mediaType, prompt: request.prompt,
      ratio: request.ratio,
      ...("size" in request ? { size: request.size } : {}),
    }),
  });
  const { jobId } = await readResponse(response) as { jobId: string };
  if (typeof jobId !== "string" || !/^[a-f0-9-]{36}$/i.test(jobId)) throw new Error("Relay did not acknowledge the job ID; check Muse before trying again");
  // Save the exact accepted job. Recovery polls this ID without submitting the prompt twice.
  await context.saveTaskData?.({ jobId, deviceId, mediaType });
  return waitForResult(context, jobId, mediaType);
}

export default {
  id: "chromeMuse",
  label: "Muse via Chrome Extension (MooZ relay)",
  version: "0.3.0",
  rules,
  models: [
    { id: "museChrome", label: "Muse Image / Chrome", type: "image", mode: ["text"], imageSizes: ["1K", "2K"], imageRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
    { id: "museChromeVideo", label: "Muse Video / Chrome", type: "video", mode: ["text"] },
  ] satisfies ProviderModel[],
  async generateImage(request: ImageRequest): Promise<MediaAsset[]> {
    return submit(this, request, "image");
  },
  async generateVideo(request: VideoRequest): Promise<MediaAsset[]> {
    return submit(this, request, "video");
  },
  async resumeTask(data: ProviderTaskData): Promise<MediaAsset[]> {
    if (typeof data.jobId !== "string" || !/^[a-f0-9-]{36}$/i.test(data.jobId) ||
      (data.mediaType !== "video" && data.mediaType !== "image")) {
      throw new Error("Saved Muse task ID is invalid; inspect the browser before creating another job");
    }
    return waitForResult(this, data.jobId, data.mediaType);
  },
} satisfies ProviderDefinition<typeof rules>;
