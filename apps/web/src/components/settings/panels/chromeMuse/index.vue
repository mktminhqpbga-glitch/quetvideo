<template>
  <div class="chromeMuse">
    <el-alert title="Kết nối Muse bằng Chrome Extension" type="info" :closable="false" show-icon>
      Tạo ảnh từ Chrome trên Mac, máy tính khác hoặc máy ảo qua mooz-relay. Chrome cần đăng nhập Muse thủ công.
    </el-alert>
    <section class="extensionCard">
      <h3>1. Tải Extension</h3>
      <p>Tải gói ZIP có sẵn trong ứng dụng, giải nén trước khi cài. Không cần tải toàn bộ repo.</p>
      <el-button type="primary" :icon="IconDownload" @click="downloadExtension">Tải Chrome Extension (.zip)</el-button>
    </section>
    <section class="extensionCard">
      <h3>2. Cài vào Google Chrome</h3>
      <p>Mở <code>chrome://extensions</code>, bật Developer mode, chọn Load unpacked rồi chọn thư mục vừa giải nén.</p>
      <el-button @click="openChromeExtensions">Mở trang quản lý Extension</el-button>
    </section>
    <section class="extensionCard">
      <h3>3. Kết nối với Render</h3>
      <p>Relay: <code>https://mooz-relay.onrender.com</code></p>
      <p>Tạo mã ghép một lần bằng RELAY_ADMIN_KEY trên máy của bạn. Chỉ nhập mã ghép vào Chrome; <strong>không nhập khóa quản trị vào Extension</strong>.</p>
      <p>Sử dụng một Device ID riêng cho mỗi Chrome, ví dụ <code>chrome-main</code> và <code>chrome-vm-01</code>.</p>
      <el-button @click="openGuide">Xem hướng dẫn thiết lập</el-button>
    </section>
    <section class="extensionCard">
      <h3>4. Sử dụng trong Canvas</h3>
      <p>Vào Cài đặt → Media Model, cấu hình Muse via Chrome Extension (Render) với relay, RELAY_ADMIN_KEY và Device ID. Sau đó chọn model Muse / Chrome ở node tạo ảnh.</p>
      <p class="note">Bản kết nối hiện là thử nghiệm. CSS selector của Muse cần được cấu hình theo giao diện Muse thực tế. Extension không thể tự động cài vào Chrome mà không có sự cho phép của bạn.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { zipSync, strToU8 } from "fflate";
import { IconDownload } from "@tabler/icons-vue";
import extension0 from "../../../../../../../extensions/museBridge/manifest.json?raw";
import extension1 from "../../../../../../../extensions/museBridge/background.js?raw";
import extension2 from "../../../../../../../extensions/museBridge/popup.html?raw";
import extension3 from "../../../../../../../extensions/museBridge/popup.js?raw";
import extension4 from "../../../../../../../extensions/museBridge/readme.md?raw";

function downloadExtension() {
  const files = {
    "manifest.json": strToU8(extension0),
    "background.js": strToU8(extension1),
    "popup.html": strToU8(extension2),
    "popup.js": strToU8(extension3),
    "readme.md": strToU8(extension4),
  };
  const archive = zipSync(files, { level: 6 });
  const blob = new Blob([new Uint8Array(archive)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ToonFlow-Muse-Chrome-Extension.zip";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function openChromeExtensions() {
  // chrome:// is not navigable from ordinary web pages; a direct attempt
  // may be blocked. The user can paste the address into Chrome manually.
  window.open("chrome://extensions", "_blank");
}
function openGuide() {
  window.open("https://github.com/mktminhqpbga-glitch/quetvideo/blob/main/docs/chromeMuseSetup.md", "_blank", "noopener,noreferrer");
}
</script>

<style scoped>
.chromeMuse { display: flex; flex-direction: column; gap: 14px; }
.extensionCard { padding: 16px; border: 1px solid var(--el-border-color-light); border-radius: 12px; }
.extensionCard h3 { margin: 0 0 8px; font-size: 15px; }
.extensionCard p { font-size: 13px; line-height: 1.6; color: var(--el-text-color-secondary); }
.extensionCard code { word-break: break-all; }
.extensionCard .note { font-size: 12px; }
</style>
