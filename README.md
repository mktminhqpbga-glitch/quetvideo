# Quetvideo — Facebook Page Migrator

## Quét ngay trên Chrome — không cần cài Python (v0.2.1)

1. Tải repo qua **Code → Download ZIP** và giải nén.
2. Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked**, chọn thư mục `extension`.
3. Nếu đã cài bản cũ: thay thư mục extension bằng bản mới, bấm **Reload / Tải lại** trên thẻ extension, chấp nhận quyền mới nếu Chrome hỏi. Đóng tab giao diện cũ rồi bấm lại biểu tượng extension để mở giao diện **Quét bài từ tab Facebook**.
4. Mở Page nguồn trong một tab Facebook của cùng Chrome đã đăng nhập. Chọn mục bài viết trên Page.
5. Trong extension bấm **Tìm tab Facebook**, chọn đúng tab nguồn, đặt số bài tối đa rồi **Bắt đầu tự quét**. Extension chuyển sang tab nguồn và tự cuộn. Không cuộn tay trong lúc quét. Có thể quay lại giao diện extension để bấm Dừng hoặc xem tiến độ.
6. Chọn bài đã thu thập, bấm **Tải nội dung JSON** hoặc **Tải ảnh/video trực tiếp**. Kiểm tra tải xong/lỗi trong mục Tệp đã tải xuống của Chrome; file nằm trong thư mục Downloads/Quetvideo theo cấu hình tải của Chrome.

**Chế độ này không dùng terminal, mã ghép nối, access token hoặc cookie xuất ra file.** Dùng phiên đăng nhập sẵn có của tab Facebook, chỉ đọc nội dung DOM đang hiển thị và tự cuộn để tải thêm; không gọi API nội bộ hoặc vượt kiểm soát truy cập. Có thể đóng chương trình Python cũ nếu đang chạy.

### Nếu bấm bắt đầu nhưng không có bài

Bản 0.2.1 cập nhật tiến độ cả trên đầu trang và thanh trạng thái dưới cùng. Kiểm tra mục **Tiến độ và chẩn đoán**: số vòng, số khối bài, liên kết bài, thời gian và vị trí cuộn. Nếu không nhận diện được dữ liệu, công cụ dừng với lý do cụ thể thay vì chỉ giữ dòng “Đã bắt đầu”.

Sau khi thay mã extension: bấm **Tải lại** trong `chrome://extensions`, đóng tab giao diện cũ, tải lại tab Facebook rồi mở extension từ biểu tượng. Tiêu đề phải hiển thị **0.2.1**. Chọn đúng URL Page nguồn trong danh sách tab. Với Page `profile.php?id=...`, ID được giữ nguyên khi lưu link nguồn. Bộ quét đã bổ sung khối bài lồng nhau, thẻ video/Reels và khung cuộn bên trong.

Nếu vẫn 0 bài, gửi URL Page cùng dòng chẩn đoán. Không gửi cookie/mật khẩu. Các bố cục mới đã được kiểm thử trên HTML mô phỏng; chưa xác minh trên Page Facebook thật hoặc tài khoản của bạn.

### Giới hạn của quét bằng trình duyệt

- Tối đa 200 bài mỗi đợt, 2.000 bài/8MB danh sách cục bộ. Dữ liệu được giữ trong Chrome khi đóng tab. Nếu muốn quét tiếp, giữ Page tại vị trí đang đọc rồi bắt đầu đợt mới. Xuất JSON/tải media trước khi xóa danh sách để lấy đợt khác.
- Tự dừng khi đủ số bài hoặc không thấy bài mới sau 8 lần cuộn. Điều này **không bảo đảm đã quét hết lịch sử Page**. Facebook có thể tải chậm, chặn truy cập hoặc đổi cấu trúc HTML.
- Nhận diện permalink dạng `posts`, `videos`, `reel/reels`, `share/p`, `share/v`, `share/r`, `permalink.php`, `story.php`, `watch`. Khi chưa có permalink, giữ nội dung hiển thị với mã tạm và ghi rõ chỉ có link Page nguồn. Giữ tham số `id` cho Page dạng `profile.php?id=...`. Bài không nhận diện được có thể bị bỏ qua; bài chia sẻ có thể bị nhận nhầm liên kết nguồn. Nên kiểm tra nội dung trước khi dùng dữ liệu.
- Tối đa 10 ảnh và một URL video trực tiếp mỗi bài. Ảnh/video phải có URL HTTPS CDN Facebook. Video `blob:`, Reels hoặc luồng phát không có URL file trực tiếp cần tải thủ công. URL ký có thể hết hạn; yêu cầu tải được tạo không có nghĩa tải đã thành công.
- Văn bản là nội dung nhận diện từ giao diện, tối đa 12.000 ký tự; có thể lẫn nhãn giao diện nếu Facebook đổi HTML. Thời gian chỉ lấy từ thẻ `time` khi có, không suy ra ngày đăng còn thiếu. Không lấy bình luận/phản ứng.
- Không tự đăng trong chế độ không cài thêm phần mềm. Bấm **Sao chép nội dung** ở bài đã chọn, mở Page đích, dán nội dung và chọn ảnh/video tải về rồi bấm Đăng trực tiếp trong Facebook. Luồng API nâng cao bên dưới vẫn được giữ riêng; danh sách quét Chrome không tự nhập vào bridge.
- Extension yêu cầu quyền đọc/chạy script trên tab Facebook, lưu cục bộ và tải file. Không thu thập mật khẩu hay cookie. Danh sách cục bộ và file xuất có thể chứa nội dung riêng tư; chỉ sao chép/đăng nội dung bạn có quyền sử dụng.

Kiểm thử đã chạy: đọc DOM mô phỏng, tự cuộn làm xuất hiện bài tiếp theo, dừng đúng giới hạn, chống trùng, chọn bài, tạo yêu cầu tải file, cảnh báo video blob và phục hồi phiên quét đã dừng. Chrome API được giả lập vì Chromium môi trường bàn giao chặn cài extension; **chưa kiểm thử cài thật hoặc quét Page Facebook thật**.

```sh
npm ci
npx playwright install chromium
npm run test:core
npm run test:native
npm run test:content
```

Các lệnh này chỉ dành cho phát triển/kiểm thử, không cần chạy để dùng extension. Bộ test dùng trang HTML mô phỏng và Chrome API giả lập, không gửi request Facebook thật.

## Luồng nâng cao tùy chọn: bridge Python và Meta API

Extension Chrome Manifest V3 + bridge Python chạy trên máy của bạn. Kết hợp ba dự án qua thư viện upstream, không sao chép mã nguồn của chúng:

| Thành phần | Nhiệm vụ |
| --- | --- |
| [facebook-scraper](https://github.com/kevinzg/facebook-scraper) | Lấy nội dung và danh sách media từ feed Facebook có thể truy cập |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Tải video từ URL bài Facebook |
| [Meta Business SDK](https://github.com/facebook/facebook-python-business-sdk) | Gửi yêu cầu Graph API và upload file ảnh/video lên Page đích |

**Đây là bản tích hợp ban đầu. Không bảo đảm lấy toàn bộ lịch sử Facebook.** Chức năng đăng thật cần Page access token có quyền phù hợp; kiểm thử tự động dùng Facebook giả lập. Facebook có thể thay đổi giao diện khiến facebook-scraper ngừng hoạt động. Việc cài được thư viện không chứng minh quét hoặc đăng thật thành công trên tài khoản của bạn.

## Cài trên máy bạn

Cần Python 3.10 trở lên (khuyên dùng 3.12) và Chrome/Chromium. Bridge phải chạy cùng máy với Chrome: extension chỉ kết nối `127.0.0.1:8765`. Mở terminal trong thư mục dự án.

macOS/Linux:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run.py
```

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe run.py
```

Nếu macOS báo không có `python3.12`, cài Python 3.12 từ [python.org](https://www.python.org/downloads/macos/) trước. Nếu môi trường `.venv` cũ dùng Python thấp hơn 3.10, tạo môi trường mới tên `.venv312` bằng `python3.12 -m venv .venv312`, rồi thay `.venv` bằng `.venv312` trong các lệnh tiếp theo. Không cần xóa môi trường cũ.

Nếu gặp `No matching distribution found` cho dependency trong file khóa cũ, nhấn Control+C để dừng bridge, cập nhật mã nguồn hoặc cài trực tiếp bằng `requirements.txt`. Bridge nay kiểm tra phiên bản Python và thư viện trước khi hỏi cấu hình.

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

Đã cài và kiểm tra import chung ba thư viện trên Python 3.12; Cài bằng `requirements.txt` để pip chọn dependency phù hợp với Python, hệ điều hành và nguồn gói của máy bạn. `requirements.lock` chỉ còn là file tương thích trỏ tới `requirements.txt`, không phải khóa phiên bản tuyệt đối. `lxml_html_clean` được thêm để sửa tương thích import của scraper với lxml mới. Chưa kiểm thử quét/tải/đăng trên Facebook thật vì chưa có Page nguồn và cấu hình tài khoản của bạn. Mã nguồn dự án được quản lý tại [mktminhqpbga-glitch/quetvideo](https://github.com/mktminhqpbga-glitch/quetvideo).

Kết quả tại môi trường bàn giao: 11/11 kiểm thử backend đạt, `pip check` đạt và bộ kiểm thử giao diện `UI_ONLY=1` đạt (không lỗi JavaScript). Kiểm thử extension cài thật bị chính sách quản trị Chromium chặn; cần chạy lại trên Chrome/Chromium cá nhân cho phép **Load unpacked**. Chưa xác minh upload/đăng thật, quyền Meta App, hoặc độ đầy đủ của dữ liệu một Page cụ thể.
