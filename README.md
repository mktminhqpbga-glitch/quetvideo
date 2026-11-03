# Quetvideo — Facebook Page Migrator

Extension Chrome Manifest V3 + bridge Python chạy trên máy của bạn. Kết hợp ba dự án qua thư viện upstream, không sao chép mã nguồn của chúng:

| Thành phần | Nhiệm vụ |
| --- | --- |
| [facebook-scraper](https://github.com/kevinzg/facebook-scraper) | Lấy nội dung và danh sách media từ feed Facebook có thể truy cập |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Tải video từ URL bài Facebook |
| [Meta Business SDK](https://github.com/facebook/facebook-python-business-sdk) | Gửi yêu cầu Graph API và upload file ảnh/video lên Page đích |

**Đây là bản tích hợp ban đầu. Không bảo đảm lấy toàn bộ lịch sử Facebook.** Chức năng đăng thật cần Page access token có quyền phù hợp; kiểm thử tự động dùng Facebook giả lập. Facebook có thể thay đổi giao diện khiến facebook-scraper ngừng hoạt động. Việc cài được thư viện không chứng minh quét hoặc đăng thật thành công trên tài khoản của bạn.

## Cài trên máy bạn

Cần Python 3.12 và Chrome/Chromium. Bridge phải chạy cùng máy với Chrome: extension chỉ kết nối `127.0.0.1:8765`. Mở terminal trong thư mục dự án.

macOS/Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python run.py
```

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.lock
.venv\Scripts\python.exe run.py
```

Launcher hỏi ID Page đích, phiên bản Graph API của Meta App và Page access token (ẩn khi nhập). Enter để bỏ qua phần đăng và chỉ dùng quét/tải. Token chỉ ở bộ nhớ tiến trình; không ghi vào extension, file dự án hay JSON xuất. Không gửi token hoặc cookie trong chat.

Trong Chrome:

1. Mở `chrome://extensions`, bật **Developer mode**.
2. Chọn **Load unpacked**, chọn thư mục `extension` của dự án.
3. Bấm biểu tượng **Facebook Page Migrator**; giao diện mở thành tab riêng.
4. Nhập mã ghép nối in trong terminal bridge, bấm **Kết nối**. Mã đổi khi bridge khởi động lại và chỉ lưu trong phiên Chrome.
5. Nhập tên Page nguồn hoặc URL chuẩn `https://www.facebook.com/tenpage`. Chọn số trang feed rồi **Quét bài**.
6. Chọn bài, **Tải nội dung đã chọn**, xem trạng thái từng bài. Nội dung gốc lưu tại `data/media/<mã-băm>/post.json`, ảnh/video lưu cùng thư mục. Có thể xuất danh sách JSON từ extension.
7. Chỉ chọn các bài **Đã tải**, kiểm tra Page đích, xác nhận quyền sử dụng nội dung và bấm **Đăng các bài đã chọn**. Hộp thoại cuối xác nhận đăng thật. Bài được gửi theo thứ tự cũ đến mới, với thời điểm đăng mới.

Giữ terminal và tab extension mở trong khi chạy. Khi bridge báo bận, chờ tác vụ hoàn tất rồi tải lại danh sách. Sau khi đóng tab giữa tác vụ, kết nối lại và kiểm tra trạng thái trước khi thao tác tiếp.

## Quyền Facebook và cookie

Page đích phải thuộc quyền quản lý của bạn. Meta App và Page access token phải có quyền đăng Page phù hợp, thường gồm `pages_manage_posts` và các quyền đọc/liệt kê Page cần cho quy trình cấp token, chẳng hạn `pages_read_engagement`, `pages_show_list`. Quyền thực tế còn phụ thuộc phiên bản API, loại nội dung, chế độ App và xét duyệt của Meta. Công cụ không có OAuth tự động hoặc chức năng lấy token thay bạn. Chọn phiên bản API được App hỗ trợ, không mặc định suy ra từ phiên bản SDK.

Nếu nguồn yêu cầu đăng nhập, bạn có thể cung cấp **đường dẫn** đến file cookie Netscape từ phiên Facebook của chính bạn bằng biến `FB_COOKIES_FILE` trước khi chạy bridge. Cả scraper và yt-dlp dùng đường dẫn này. Không để file cookie trong thư mục dự án, không commit hay chia sẻ nó. Cookie hết hạn, checkpoint và giới hạn truy cập phải được giải quyết bằng quy trình đăng nhập thông thường; công cụ không vượt kiểm soát truy cập.

Biến môi trường được hỗ trợ: `FB_TARGET_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `FB_GRAPH_VERSION`, `FB_COOKIES_FILE`, `FB_DATA_DIR`. Với credential đã có trong biến môi trường, chạy `python -m bridge.server` để không hỏi tương tác. Không có dịch vụ cloud trung gian của dự án.

## Hỗ trợ và giới hạn

- Bài văn bản, bài ảnh (tối đa 10 ảnh) và bài một video; tải xong media mới cho đăng.
- Bài có cả ảnh/video, nhiều video, bài chia sẻ chưa trích được nội dung hoặc hơn 10 ảnh cần xử lý thủ công. Không âm thầm đăng thiếu phần media đã nhận diện.
- Quét 1–100 trang feed mỗi lần, mỗi đợt chọn tối đa 100 bài. Có thể quét sâu hơn lần trước; ID bài đã thấy được chống trùng trong SQLite, kể cả nhập nguồn bằng tên khác. Đây không phải cam kết quét đủ mọi bài.
- Không chuyển bình luận, phản ứng, ngày đăng gốc, định dạng album đặc biệt hay ngữ nghĩa bài chia sẻ. Video được upload thành bài video thông thường; chưa có API đăng Reels, lên lịch hoặc giữ nguyên metadata.
- Giới hạn tải mỗi ảnh 25MB và video 500MB; giới hạn upload thực tế do Meta quyết định.
- Tải về thư mục của bridge; nút tải không mở hộp thoại lưu từng file của Chrome. Media không được gửi qua extension.
- Không tự đăng sau khi quét/tải. Không tự thử lại việc đăng khi mạng/API gặp lỗi.
- `published`: API đã trả kết quả thành công. `uncertain`: request có thể đã tới Facebook hoặc bridge dừng giữa lúc gửi. Kiểm tra Page và kết quả trong SQLite; không xóa hàng đợi để thử lại mù quáng. Công cụ chưa có giao diện đối chiếu/phục hồi thủ công cho trạng thái này.
- Khi upload nhiều ảnh, lỗi giữa chừng có thể để lại ảnh đã upload ở trạng thái unpublished. Kiểm tra trên Page trước khi xử lý tiếp.
- Dùng một thư mục dữ liệu cho một luồng chuyển sang một Page đích. Không đổi Page đích rồi dùng lại hàng đợi cũ để đăng lần nữa.

SQLite `data/queue.sqlite3` lưu nội dung, đường dẫn file, trạng thái và ID kết quả; không lưu access token. Dữ liệu tải có thể chứa nội dung riêng tư và URL media có chữ ký; bảo vệ thư mục dữ liệu và file JSON xuất. Chỉ dùng nội dung bạn có quyền sao chép/đăng lại.

## Kiểm thử

```sh
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m pip check
node --check extension/app.js
```

11 kiểm thử backend bao phủ chống trùng, yêu cầu xác nhận, kiểm tra media, trạng thái sau timeout/crash và upload multipart qua SDK thật với HTTP call giả lập. Kiểm thử không đăng lên Facebook.

Kiểm thử extension thật trên Chromium, với upstream Facebook giả lập:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

Có thể dùng Chromium đã cài bằng biến `CHROMIUM=/duong/dan/chromium`; Windows chỉ định `PYTHON` tới `.venv\Scripts\python.exe`. Cổng 8765 phải trống. Test khởi động bridge giả lập riêng, kiểm tra auth, chọn/tải bài, xác nhận/hủy đăng, chống đăng lại và lỗi JavaScript. Không dùng `tests/fixture_server.py` làm launcher phát triển hoặc kết nối tài khoản thật.

Nếu Chromium được quản trị chặn cài extension, có thể chạy bộ kiểm thử giao diện bằng `UI_ONLY=1 npm run test:browser`. Chế độ này phục vụ HTML qua HTTP localhost, giả lập Chrome storage và origin của extension, nhưng vẫn gọi bridge HTTP thật với upstream Facebook giả lập. Nó không xác minh việc Chrome cài và thực thi extension.

## Trạng thái bản bàn giao

Đã cài và kiểm tra import chung ba thư viện trên Python 3.12; dependency đã khóa tại `requirements.lock`. `lxml_html_clean` được thêm để sửa tương thích import của scraper với lxml mới. Chưa kiểm thử quét/tải/đăng trên Facebook thật vì chưa có Page nguồn và cấu hình tài khoản của bạn. Mã nguồn dự án được quản lý tại [mktminhqpbga-glitch/quetvideo](https://github.com/mktminhqpbga-glitch/quetvideo).

Kết quả tại môi trường bàn giao: 11/11 kiểm thử backend đạt, `pip check` đạt và bộ kiểm thử giao diện `UI_ONLY=1` đạt (không lỗi JavaScript). Kiểm thử extension cài thật bị chính sách quản trị Chromium chặn; cần chạy lại trên Chrome/Chromium cá nhân cho phép **Load unpacked**. Chưa xác minh upload/đăng thật, quyền Meta App, hoặc độ đầy đủ của dữ liệu một Page cụ thể.
