# ToonFlow VN — giao diện ứng dụng cục bộ

Mục tiêu của bản tùy biến:
- Khởi động trực tiếp đến trang dự án mà không yêu cầu đăng ký/đăng nhập ToonFlow cloud ở chế độ cục bộ. Không thay đổi bảo mật của các chế độ nhiều người dùng hay hosted.
- Trang chủ chỉ giữ các mục có ích cho làm phim: tạo dự án, dự án cục bộ, thư viện tư liệu, thiết bị, cài đặt.
- Không hiển thị banner quảng cáo, carousel khuyến mãi, tab Khám phá, tab dự án nhóm và link quảng bá GitHub trên trang chủ. Những module quảng bá cũ được giữ trong mã nguồn để tránh phá các phần khác.
- Trong Cài đặt có mục Chrome & Muse, tải ZIP Extension trực tiếp từ các file được đóng gói theo phiên bản ứng dụng, chạy không cần Internet.
- Giữ nguyên các node và hệ thống plugin AI. Nếu canvas không có node, cần build plugin bằng `bun run dev:plugins` trong chế độ phát triển. Khi đóng gói desktop, `bun run package:desktop` thực hiện build node/plugin tự động.

Sau khi `git pull`:
```sh
bun install
bun run dev:plugins
bun run dev
```

Cách tạo bản macOS độc lập:
```sh
bun packages/startup/scripts/buildMac.ts
bun run package:desktop
```

Lưu ý: tích hợp Extension/Muse chưa được kiểm chứng đầu-cuối trên giao diện Muse thực tế. Relay sử dụng Render độc lập, Chrome cần được cài Extension thủ công.
