# Video hàng loạt (tích hợp từ MooZ Batch Composer)

Module **Video hàng loạt · MooZ × ToonFlow** lấy các quy tắc an toàn của MooZ Batch Composer và đặt trong **workspace Canvas** của ToonFlow.

## Khả năng trong phiên bản này

- Mỗi dòng là một prompt video độc lập (1–100 dòng, tối đa 4.000 ký tự/prompt).
- Tỷ lệ 9:16 / 16:9 / 1:1 được gửi tới relay; website Muse phải được chọn đúng tỷ lệ thủ công nếu Extension chưa hỗ trợ điều khiển lựa chọn.
- Nhiều Chrome dùng Device ID riêng. Tối đa 8 Chrome; mỗi Chrome chỉ có một tác vụ được bộ điều phối giao tại một thời điểm.
- Mỗi tác vụ lưu snapshot prompt, tỷ lệ và ID. Pause chặn gửi tác vụ mới nhưng **không dừng** tác vụ đang tạo.
- ToonFlow dùng media task backend có checkpoint; server lưu video hoàn thành vào \`assets/batchVideos\` trong thư mục dự án.
- Bảng hàng đợi lưu trên trình duyệt của máy này theo từng dự án. Sau reload, tác vụ chưa xác định là \`Cần kiểm tra\` và không tự gửi lại prompt.
- Kết quả có nút sao chép đường dẫn / **Đưa vào Canvas**, tạo Video node mới từ tệp đã lưu.

## Thiết lập

1. Cập nhật repo \`quetvideo\`: \`git pull && bun install\`.
2. Trong chế độ phát triển, chạy \`bun run dev:plugins\` để build Node/Tool/Ext. Lệnh này được thay bằng bộ build tuần tự để tránh lỗi filter wildcard ở Bun; điều này quan trọng nếu Canvas hiện “Không có nút nào để hiển thị”.
3. Chạy server và web như bình thường; đóng gói desktop bằng \`bun packages/startup/scripts/buildMac.ts\` rồi \`bun run package:desktop\`.
4. Cập nhật \`app-mooz\` và **triển khai thủ công** dịch vụ Render \`mooz-relay\`; phiên bản mới cần hỗ trợ \`mediaType: video\` trên \`/toonflow\`. Deploy sẽ làm mất các session MooZ/ToonFlow đang mở.
5. Trong ToonFlow Cài đặt → Chrome & Muse, tải ZIP Extension và cài bản mới qua \`chrome://extensions\` → Load unpacked / Reload.
6. Mở Muse và đăng nhập bằng tài khoản của bạn, **chọn Video mode trong tab** và cấu hình \`videoSelector\` trong popup Extension theo giao diện Muse thật.
7. Cài đặt → Media Model → **Muse via Chrome Extension (MooZ relay)**, nhập \`https://mooz-relay.onrender.com\` và \`RELAY_ADMIN_KEY\` trong ToonFlow backend, không nhập khóa admin vào Extension. Extension dùng mã ghép một lần.
8. Mở một dự án và Canvas, nhấn nút **Video hàng loạt** (biểu tượng cuộn phim) trên thanh công cụ; nhập prompt, các Device ID, sau đó **Thêm vào hàng chờ → Chạy hàng đợi**.

## Lưu ý

- Hệ thống hiện hỗ trợ **text-to-video**. Chưa chuyển toàn bộ tính năng MooZ như nhập nhiều ảnh sản phẩm, chỉnh đồ thị workflow, viết JSON kịch bản từng cảnh, ghép nhiều clip, nhạc nền và hậu kỳ FFmpeg; các bước này cần triển khai và kiểm thử riêng.
- Đây không phải API Muse chính thức và không vượt qua CAPTCHA, quyền truy cập hay giới hạn nền tảng.
- Chrome Extension kiểm tra có video HTML mới từ selector, không lấy ảnh thumbnail làm video.
- Relay tạm lưu data URI video trong RAM (tối đa khoảng 12 MiB file nhị phân để tránh tràn bộ nhớ Render); video lớn hơn hoặc URL được bảo vệ vẫn cần cải tiến truyền tải/tải xuống theo luồng.
- Nếu mất kết nối, kiểm tra tab Muse trước khi thử lại. Không tự động gửi lặp các job đã hoặc có thể đã nhận.
