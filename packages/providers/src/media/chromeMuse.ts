const rules = [
  { type: "input", field: "relayUrl" as const, title: "MooZ relay URL", value: "https://mooz-relay.onrender.com", props: { placeholder: "https://your-relay.onrender.com" } },
  { type: "input", field: "relayAdminKey" as const, title: "MooZ RELAY_ADMIN_KEY (ToonFlow backend only)", value: "", props: { type: "password", showPassword: true, autocomplete: "off" } },
  { type: "input", field: "deviceId" as const, title: "Chrome device ID", value: "chrome-main", props: { placeholder: "chrome-main" } },
] as const;

type JobStatus = {
  jobId: string;
  state: "queued" | "running" | "done" | "error";
  error?: string;
  result?: { imageData?: string; imageUrl?: string };
};

function baseUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Relay must use HTTPS (except localhost for development)");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("Relay URL is invalid");
  return url.href.replace(/\/$/, "");
}

async function readResponse(response: Response) {
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Relay HTTP " + response.status);
  return data;
}

export default {
  id: "chromeMuse",
  label: "Muse via Chrome Extension (Render)",
  version: "0.2.0",
  rules,
  models: [
    { id: "museChrome", label: "Muse / Chrome", type: "image", mode: ["text"], imageSizes: ["1K", "2K"], imageRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
  ] satisfies ProviderModel[],
  async generateImage(request: ImageRequest): Promise<MediaAsset[]> {
    if (request.images?.length || request.mask) throw new Error("This adapter currently supports text-to-image only");
    const relayUrl = baseUrl(this.config.relayUrl || "");
    const relayAdminKey = this.config.relayAdminKey?.trim();
    const deviceId = this.config.deviceId?.trim();
    if (!relayAdminKey || !deviceId) throw new Error("Configure RELAY_ADMIN_KEY and deviceId in Muse provider settings");
    const headers = { "Authorization": "Bearer " + relayAdminKey, "Content-Type": "application/json" };
    const signal = AbortSignal.any([AbortSignal.timeout(10 * 60_000), ...(this.signal ? [this.signal] : [])]);
    const submit = await this.tool.fetch(relayUrl + "/toonflow/jobs", {
      method: "POST", headers, signal,
      body: JSON.stringify({ deviceId, prompt: request.prompt, ratio: request.ratio, size: request.size, quality: request.quality }),
    });
    const { jobId } = await readResponse(submit) as { jobId: string };
    if (!jobId) throw new Error("Relay did not return a job ID");
    while (true) {
      signal.throwIfAborted();
      const statusResponse = await this.tool.fetch(relayUrl + "/toonflow/jobs/" + encodeURIComponent(jobId), { headers, signal });
      const status = await readResponse(statusResponse) as JobStatus;
      if (status.state === "error") throw new Error(status.error || "Muse task failed");
      if (status.state === "done") {
        const imageData = status.result?.imageData;
        if (imageData?.startsWith("data:image/")) {
          const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageData);
          if (!match) throw new Error("Invalid image data returned by Chrome");
          return [{ mediaType: "image", type: "base64", mimeType: match[1], data: match[2] }];
        }
        const imageUrl = status.result?.imageUrl;
        if (imageUrl && /^https:\/\//.test(imageUrl)) return [{ mediaType: "image", type: "url", url: imageUrl }];
        throw new Error("Muse did not return a supported image");
      }
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(); }, 2500);
        const aborted = () => { clearTimeout(timeout); reject(signal.reason); };
        signal.addEventListener("abort", aborted, { once: true });
      });
    }
  },
} satisfies ProviderDefinition<typeof rules>;
