# QuetVideo 0.2.0

Canvas tạo video theo luồng node, kiểu LibTV. Chạy được như app-mooz:
một cửa sổ app riêng trên máy, hoặc mở bằng web trên máy của bạn.

## Chạy như app-mooz

Cần Node 20 trở lên. Lần đầu, trong thư mục này chạy:

```sh
npm install
```

Rồi chọn một trong hai cách:

**Cách 1 — App desktop (giống app-mooz nhất):**

```sh
npm start
```

Electron mở một cửa sổ QuetVideo riêng, tải giao diện canvas LibTV
trong `renderer/index.html`. Đóng hết cửa sổ thì app thoát, trừ macOS
giữ app lại như app desktop thường làm.

**Cách 2 — Web trên máy của bạn:**

```sh
npm run web
# mở http://localhost:5173
```

Chỉ cần Node, không cần cài Electron. Giữ Terminal mở trong lúc dùng.

## Kiểm tra và đóng gói

```sh
npm test          # kiểm tra cấu trúc + provider mô phỏng
npm run dist:win    # Windows .exe (NSIS) — nên build trên Windows
npm run dist:mac    # macOS .dmg + .zip — nên build trên Mac
npm run dist:linux  # Linux AppImage
```

File `.exe` / `.dmg` chưa được build và chạy thử trên máy này (máy này
là Linux), chỉ có lệnh build sẵn trong `package.json`, giống như
app-mooz cũng build Windows trên Windows và Mac trên Mac.

## Cấu trúc — mỗi phần một việc

- `desktop/main.cjs` — chỉ mở cửa sổ Electron, không chứa logic canvas.
- `renderer/index.html` — giao diện LibTV Canvas Demo, tự chứa CSS/JS
  và ảnh mẫu, không cần mạng để mở.
- `server.js` — chỉ phục vụ bản web ở localhost:5173, dùng Node chuẩn.
- `docs/WORKFLOW.md` — luồng làm việc 8 bước từ app-mooz 0.68.0
  Canvas Studio, kèm bằng chứng phân tích REA (morluto/rea).
- `docs/AI-CALLING.md` — cách gọi AI qua tab đã đăng nhập kiểu app-mooz,
  khung gọi API HTTP, và cách làm thủ công.
- `examples/ai-provider.example.js` — interface provider, mock chạy
  được, khung API chưa có URL hay key thật, không được nạp bởi demo.
- `tests/smoke.test.mjs` — kiểm tra cấu trúc dự án.

App-mooz chỉ được đọc để tham chiếu, không sửa, không copy code vào đây.

## Giới hạn rõ ràng của 0.2.0

- Đây là bản bắt đầu chạy được, chưa phải app thật hoàn chỉnh.
- Nút tạo ảnh/video trong demo chỉ chạy mô phỏng, trừ điểm demo,
  không gọi API AI thật và không tạo ra ảnh/video thật.
- Chưa có preload bridge, chưa nối tab AI qua MooZ Connect, chưa có
  kho nhân vật, chưa lưu dự án ra file — đó là các bước tiếp theo,
  theo đúng `docs/WORKFLOW.md` và `docs/AI-CALLING.md`.
- Không có tài khoản, API key hay dữ liệu thật nào trong repo này.
