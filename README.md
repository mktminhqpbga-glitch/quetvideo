# LibTV Canvas Demo

Bản demo giao diện canvas tạo video kiểu LibTV (Liblib), lấy nguyên từ artifact LibTV Canvas Demo.

## Cách chạy

Mở trực tiếp file `index.html` bằng trình duyệt, hoặc chạy máy chủ tĩnh bất kỳ, ví dụ:

```sh
python3 -m http.server 5173
# mở http://localhost:5173
```

Không cần cài đặt, không cần Node hay Electron cho bản demo này.

## Tài liệu bổ sung từ app-mooz, có kiểm chứng bằng REA

- `docs/WORKFLOW.md` — luồng làm việc 8 bước từ app-mooz 0.68.0 Canvas Studio, áp cho demo này, kèm bằng chứng phân tích REA trên app-mooz.
- `docs/AI-CALLING.md` — cách gọi AI qua tab đã đăng nhập kiểu app-mooz, khung gọi API HTTP, và cách làm thủ công.
- `examples/ai-provider.example.js` — ví dụ interface provider, có mock chạy được và khung API, không được nạp bởi `index.html`.

App-mooz chỉ được đọc để tham chiếu, không sửa, không copy code vào đây. REA dùng là morluto/rea, phân tích JavaScript/Electron, chạy cục bộ.

## Giới hạn rõ ràng

- Đây là demo giao diện, không phải app thật.
- Nút tạo ảnh/video chỉ chạy mô phỏng, trừ điểm demo, không gọi API AI thật và không tạo ra ảnh/video thật.
- Không có tài khoản, API key hay dữ liệu thật nào trong repo này.
- Repo này đã được dọn sạch theo yêu cầu của chủ repo trước khi đưa demo vào, nội dung QuetVideo 0.1.0 / 0.1.1 cũ không còn trong nhánh main nữa (vẫn xem lại được trong lịch sử commit Git nếu cần).
