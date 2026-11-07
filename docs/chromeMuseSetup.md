# Kết nối ToonFlow với Muse qua Chrome Extension + Render

Tài liệu này dành cho bản `main` của [quetvideo](https://github.com/mktminhqpbga-glitch/quetvideo) đã tích hợp ToonFlow. Bản tích hợp là **MVP thử nghiệm**; chưa được xác nhận tạo ảnh thực tế trên tài khoản Muse.

## A. Triển khai Render (làm trên giao diện Render)

1. Vào https://dashboard.render.com/ và đăng nhập.
2. Chọn **New > Blueprint**.
3. Kết nối repository `mktminhqpbga-glitch/quetvideo`, chọn nhánh `main`.
4. Render sẽ đọc `render.yaml` ở thư mục gốc và tạo dịch vụ `toonflow-chrome-relay`, runtime Node, gói Free (nếu tài khoản và khu vực hỗ trợ), vùng Singapore.
5. Xem lại các dịch vụ và chi phí trên trang xác nhận rồi chọn **Deploy Blueprint**.
6. Chờ service báo **Live**. Sao chép **URL HTTPS thực tế** của service, không phỏng đoán URL.
7. Mở Environment của service, xem và sao chép giá trị bí mật `RELAY_TOKEN` (cấu hình Blueprint yêu cầu Render tự sinh). Không đăng token lên GitHub hoặc gửi qua chat công khai.
8. Truy cập `https://<domain-thực-tế>/health`; nếu chạy tốt, kết quả là `{"ok":true}`.

Lưu ý: máy chủ relay không lưu bền vững. Nếu Render khởi động lại, tác vụ đang thực hiện và trạng thái trong RAM sẽ mất. Khi mất kết nối hãy kiểm tra trang Muse trước khi chạy lại; không tự gửi lặp.

## B. Cài Chrome Extension trên máy chính

1. Trên trang GitHub repository, chọn **Code > Download ZIP**, sau đó giải nén.
2. Trên Chrome mở `chrome://extensions`, bật **Developer mode**.
3. Chọn **Load unpacked**, trỏ vào thư mục `extensions/museBridge` (thư mục chứa `manifest.json`).
4. Mở Muse trong một tab Chrome, đăng nhập bằng tài khoản của chính bạn.
5. Bấm biểu tượng **ToonFlow Muse Bridge**:
   - Render relay URL: URL HTTPS ở bước A (không thêm `/ws`).
   - Relay token: chính xác `RELAY_TOKEN`.
   - Device ID: `chrome-main`.
   - Muse tab: chọn đúng tab Muse đang đăng nhập.
6. CSS selectors mặc định chỉ là **giá trị ví dụ**. Bạn phải kiểm tra giao diện Muse thật và điền đúng selector cho ô prompt, nút Generate, và ảnh đầu ra mới tạo.
7. Bấm **Save & connect**. Cấp quyền Chrome truy cập **chỉ trang đã chọn** khi được hỏi, rồi mở lại popup để kiểm tra kết nối.

## C. Chạy ToonFlow trên máy cục bộ

Trong terminal trên máy đã cài Git và Bun (xem yêu cầu theo README của upstream):

```bash
git clone https://github.com/mktminhqpbga-glitch/quetvideo.git
cd quetvideo
bun install
bun run dev
```

Có thể dùng `bun run dev:desktop` cho chế độ phát triển desktop, tùy nền tảng và các phụ thuộc đã cài.

Trong giao diện ToonFlow, vào phần media provider, tìm **Muse via Chrome Extension (Render)**, nhập:
- `relayUrl`: URL HTTPS của Render;
- `relayToken`: cùng token với Chrome Extension;
- `deviceId`: `chrome-main`.

Chọn **Muse / Chrome** trong node tạo ảnh, nhập prompt, chạy thử một lần. Nếu không có ảnh, kiểm tra popup Extension, logs Render và các CSS selector. Với ảnh ở URL yêu cầu cookie trên trình duyệt, ToonFlow server có thể không tải được URL đó; trường hợp này cần phát triển thêm bước chuyển binary qua Extension.

## D. Chrome trên máy khác hoặc máy ảo

Cài Chrome và Extension từ cùng thư mục, đăng nhập Muse thủ công, dùng **cùng URL relay + token** nhưng đặt **Device ID khác nhau** (`chrome-vm-01`, `chrome-remote-01`...). Trong ToonFlow thay `deviceId` sang đúng máy cần chạy. Chrome trên VM phải hoạt động trong phiên desktop có hỗ trợ chạy Extension, không phải Chromium headless đơn thuần.

Chỉ cần kết nối **đi ra** từ Chrome tới HTTPS/WSS Render; không cần mở cổng nhận kết nối vào máy ảo.

## E. Giới hạn và bảo mật

- Đây là kết nối qua **giao diện trang web**, không dùng API chính thức. Không hỗ trợ vượt CAPTCHA, đăng nhập tự động hoặc vượt giới hạn dịch vụ.
- Không gửi Render token vào issue, ảnh chụp công khai hoặc commit.
- Relay hiện dùng token chia sẻ cho một nhóm thiết bị đáng tin cậy. Chưa có phân quyền nhiều người dùng.
- Extension hiện hỗ trợ tạo ảnh từ prompt (text-to-image), không hỗ trợ tham chiếu ảnh hoặc bảo đảm mọi tham số tỷ lệ/chất lượng được áp dụng trên Muse.
- CSS selectors và kết quả ảnh cần kiểm thử, tinh chỉnh theo phiên bản giao diện Muse.
- Chrome Extension cần Chrome 116 trở lên để duy trì WebSocket trong service worker; những tác vụ dài vẫn cần kiểm thử độ ổn định.
