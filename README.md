# QuetVideo 0.3.1

Canvas tạo video theo luồng node, kiểu LibTV. Chạy được như app-mooz:
một cửa sổ app riêng trên máy, hoặc mở bằng web trên máy của bạn.
Từ 0.3.0, AI chạy qua tab đã đăng nhập kiểu app-mooz (MooZ Connect).

**0.3.1:** sửa lỗi hộp thoại AI không bao giờ đóng được — CSS `display:flex` của `.ai-dialog-backdrop` đã thắng thuộc tính `hidden` của trình duyệt, nên nút ✕ và bấm ra ngoài đều không ẩn được hộp thoại. Đã thêm `.ai-dialog-backdrop[hidden] { display: none; }`. Lỗi này phát hiện trong lúc thử thật end-to-end trên máy ảo (ảnh thật đã về node trước khi sửa).

## Chạy như app-mooz

Cần Node 20 trở lên. Lần đầu, trong thư mục này chạy:

```sh
npm install
```

Rồi chọn một trong hai cách:

**Cách 1 — App desktop (giống app-mooz nhất, có AI qua tab):**

```sh
npm start
```

Electron mở một cửa sổ QuetVideo riêng, tải giao diện canvas LibTV
trong `renderer/index.html`. Đóng hết cửa sổ thì app thoát, trừ macOS
giữ app lại như app desktop thường làm.

**Cách 2 — Web trên máy của bạn (chỉ demo mô phỏng):**

```sh
npm run web
# mở http://localhost:5173
```

Chỉ cần Node, không cần cài Electron. Giữ Terminal mở trong lúc dùng.
AI qua tab không chạy trên web — nút Tạo vẫn chạy mô phỏng như cũ.

## Nối AI thật qua tab (kiểu app-mooz)

Chỉ chạy trong app desktop, trên cùng máy với Chrome:

1. Mở QuetVideo (`npm start`), bấm chip **“Chưa mở tab”** ở góc trên.
2. Bấm **Sao chép mã**, dán mã vào MooZ Connect trên Chrome (cùng máy),
   bấm Kết nối. Mã chỉ có hiệu lực 15 phút, mỗi lần mở app sinh mã mới.
3. Trên Chrome, mở tab AI và đăng nhập (Muse, ChatGPT, Gemini, Grok,
   Flow/Veo), rồi bấm **Liệt kê tab AI** trong QuetVideo và chọn đúng tab.
4. Bấm Tạo trên node ảnh/video: prompt của node được gửi sang tab đó,
   kết quả thật hiện vào node. Không trừ điểm demo.

Luật chạy giống app-mooz: một nhóm dùng một AI + một tab, chạy tuần tự,
cách nhau 5 giây, nghỉ 5 giây sau mỗi tác vụ. Mất kết nối hoặc lỗi thì
job đó lỗi — không tự gửi lại, kiểm tra tab rồi chạy lại thủ công.

## Kiểm tra và đóng gói

```sh
npm test          # kiểm tra cấu trúc + AI qua tab (dùng extension giả)
npm run dist:win    # Windows .exe (NSIS) — nên build trên Windows
npm run dist:mac    # macOS .dmg + .zip — nên build trên Mac
npm run dist:linux  # Linux AppImage
```

File `.exe` / `.dmg` chưa được build và chạy thử trên máy này (máy này
là Linux), chỉ có lệnh build sẵn trong `package.json`, giống như
app-mooz cũng build Windows trên Windows và Mac trên Mac.

## Cấu trúc — mỗi phần một việc

- `desktop/main.cjs` — mở cửa sổ Electron, nối preload + AI qua tab.
- `desktop/preload.cjs` — cầu nối an toàn, chỉ mở `window.quetvideo.ai*`.
- `desktop/chrome-host.cjs` — máy chủ WebSocket cục bộ cho MooZ Connect
  (ws://127.0.0.1, token 64 ký tự, handshake auth/ready, request/response).
- `desktop/ai-dispatch.cjs` — hàng đợi AI tuần tự, 5s giữa các lần gửi,
  5s nghỉ sau mỗi tác vụ, Dừng, không tự gửi lại.
- `desktop/ai-sites.cjs` — danh sách AI qua tab (Muse/ChatGPT/Gemini/
  Grok/Flow-Veo) và mẫu URL được chấp nhận.
- `desktop/remote-protocol.cjs` — mã ghép cặp cục bộ
  (`workflow-connect://127.0.0.1:PORT/token`).
- `renderer/index.html` — giao diện LibTV Canvas Demo, tự chứa CSS/JS
  và ảnh mẫu, không cần mạng để mở; đã thêm chip AI + hộp thoại nối tab,
  `runGenerate` rẽ sang AI thật khi có tab.
- `server.js` — chỉ phục vụ bản web ở localhost:5173, dùng Node chuẩn.
- `docs/WORKFLOW.md` — luồng làm việc 8 bước từ app-mooz 0.68.0
  Canvas Studio, kèm bằng chứng phân tích REA (morluto/rea).
- `docs/AI-CALLING.md` — cách gọi AI qua tab đã đăng nhập kiểu app-mooz,
  khung gọi API HTTP, và cách làm thủ công.
- `examples/ai-provider.example.js` — interface provider, mock chạy
  được, TabProvider dùng `window.quetvideo.aiRun`, khung API chưa có
  URL hay key thật, không được nạp bởi demo.
- `tests/smoke.test.mjs`, `tests/ai-tab.test.mjs` — kiểm tra cấu trúc
  và AI qua tab.

App-mooz và MooZ Connect chỉ được đọc để tham chiếu giao thức, không
sửa, không copy code vào đây. Giao thức ghép cặp và chạy tab được viết
lại cho QuetVideo theo đúng định dạng hai bên đã dùng.

## Giới hạn rõ ràng của 0.3.1

- Nối tab AI mới chỉ có chế độ **cục bộ** (cùng máy). Chế độ **relay**
  (app và Chrome ở hai máy khác nhau, qua mooz-relay.onrender.com)
  chưa có, vì nó cần RELAY_ADMIN_KEY của dịch vụ relay — khóa này không
  có trong repo, không hỏi qua chat; khi cần sẽ nhập qua kênh bảo mật.
- Chạy tab AI thật end-to-end (prompt → tab → ảnh thật vào node) chưa
  được kiểm tra trực tiếp, vì cần Chrome + MooZ Connect đã ghép cặp và
  tab AI đã đăng nhập trên cùng máy. Phần đã kiểm tra: handshake
  auth/ready, request/response, hàng đợi tuần tự, Dừng, không tự gửi lại
  — bằng extension giả trong `npm test`, và cửa sổ Electron mở lên với
  chip AI “Chưa mở tab”.
- Chưa có kho nhân vật, chưa lưu dự án ra file — đó là các bước tiếp theo,
  theo đúng `docs/WORKFLOW.md` và `docs/AI-CALLING.md`.
- Không có tài khoản, API key hay dữ liệu thật nào trong repo này.
