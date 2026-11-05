# Luồng làm việc — bổ sung từ app-mooz

Bản này tóm tắt luồng của app-mooz, bản 0.68.0 Canvas Studio, rồi áp vào
demo trong repo này (`index.html`). Code của app-mooz không được copy vào đây;
chỉ luồng, cách làm và nguyên tắc được viết lại, đơn giản hơn.

Nguồn đối chiếu trong app-mooz: `docs/USER-REVIEW-0680.md` (Canvas Studio)
và `docs/CANVAS-STUDIO-CAPABILITIES.md` (đối chiếu với ảnh LibTV).
Phân tích REA (morluto/rea, phân tích JavaScript/Electron) trên bản sao
app-mooz được dùng để kiểm tra lại cấu trúc module, xem phần
"Bằng chứng REA" ở cuối file này.

## 1. Luồng 8 bước, áp cho cả demo và app thật

1. **Tạo dự án.** Một dự án là một canvas. Trong demo, tên dự án ở header,
   điểm demo bắt đầu 100. Trong app-mooz, dự án mới có sẵn node mẫu
   "Yêu cầu" và "Tạo ảnh 1", không phải canvas trống hoàn toàn.
2. **Thêm node.** Bấm + để thêm văn bản, ảnh, video hoặc bước xử lý.
   Cũng có thể kéo tệp vào nền canvas. Mỗi node là một công việc riêng,
   có đầu vào, prompt, thông số và kết quả riêng.
3. **Nối dây.** Nối cổng ra của node trước vào cổng vào của node sau.
   Một dây là một quan hệ dữ liệu, không phải trang trí. Ví dụ trong demo:
   Kịch bản → Hình ảnh 5, Kịch bản → Hình ảnh 4, rồi cả hai hình ảnh
   cùng vào Video 8. Video dùng ảnh trước làm khung đầu và tham chiếu,
   không cần gõ lại prompt từ đầu.
4. **Chốt prompt và tham chiếu, trước khi chạy.** Sửa nội dung, prompt và
   thông số trong phần Thiết lập của node đang chọn. Với ảnh thương mại,
   chốt 2 tham chiếu riêng: ảnh nhân vật (khuôn mặt, vóc dáng, màu da,
   kiểu tóc) và ảnh sản phẩm (màu, cổ áo, sọc, logo, form). Tham chiếu
   này phải được lặp lại ở mọi node sau, nếu không mặt và áo sẽ trôi.
   Kho prompt và kho nhân vật dùng chung các dự án, không phải kho
   nhân vật chính thức của LibTV.
5. **Chọn AI và tab cho cả nhóm.** Trong app-mooz, chọn một AI và một tab
   cho cả nhóm node, các bước AI giữ cùng tab, chạy theo dây phụ thuộc.
   Tab bận thì chờ trên tab đó, không chạy chồng lên nhau. Nút Dừng
   ngừng các bước tiếp theo. Trong demo này, bước này là mô phỏng:
   bấm Tạo thì chạy tiến trình giả và trừ điểm demo, chưa gọi AI thật.
6. **Xếp hàng và theo dõi.** Mở hàng đợi để xem tác vụ đang chạy, đang
   chờ và đã xong. Lịch sử giữ trạng thái thật sau khi mở lại app.
   Tác vụ bị gián đoạn thì phải kiểm tra tab AI trước khi chạy lại,
   không được tự gửi lại khi chưa rõ kết quả.
7. **Nhận kết quả và kiểm tra.** Kết quả có thể là ảnh, video, văn bản
   hoặc âm thanh, và được đưa vào node tiếp theo qua dây nối. Kiểm tra
   4 điểm trước khi dùng cho thương mại: mặt giống tham chiếu, màu và
   logo sản phẩm đúng, sản phẩm không bị biến dạng hay thêm chi tiết,
   không có chữ lạ, watermark hay phụ đề chạy trên sản phẩm. Hỏng ở
   node nào thì chạy lại đúng node đó, không làm lại cả luồng.
8. **Hậu kỳ và xuất.** Chọn ảnh để cắt, xoay/lật, chỉnh sáng/màu hoặc
   đổi kích thước — kết quả là node ảnh mới có dây về nguồn, ảnh gốc
   vẫn giữ. Chọn video để cắt, chỉnh màu, tách tiếng bằng FFmpeg nếu
   có. Cuối cùng ghép các đoạn, cân bằng âm lượng và xuất thành phẩm.
   Lưu mẫu luồng để dùng lại: mẫu chỉ giữ đầu vào và thiết lập, bỏ
   kết quả AI, khóa và tab phiên cũ, và khi chèn mẫu thì tạo ID node
   mới, nối lại dây nội bộ.

## 2. Cách làm, theo từng loại node

- **Kịch bản / văn bản:** viết yêu cầu chung một lần, rồi tách thành
  từng đoạn cho từng node video. Mỗi đoạn phải mang lại khóa chung
  (nhân vật, sản phẩm, bối cảnh, ánh sáng) thì các đoạn mới không trôi.
- **Hình ảnh:** prompt theo thứ tự phong cách, chủ thể, quần áo hoặc
  sản phẩm, bối cảnh, ánh sáng, máy ảnh. Thêm tham chiếu canvas, đánh
  dấu vùng cần giữ và phong cách, thay vì chỉ gõ chữ.
- **Video:** khung đầu lấy từ node hình ảnh, tham chiếu mặt lấy từ
  node nhân vật. Mỗi shot kết thúc giữ yên rồi cắt cứng sang shot sau,
  không dissolve. Nhạc và hiệu ứng âm thanh phải đồng bộ, không có
  lời thoại trừ khi người dùng yêu cầu rõ.
- **Âm thanh và thành phẩm:** nhạc chỉ chạy trong video, chữ cuối chỉ
  ở thẻ cuối nếu cần, không chạy chữ trên sản phẩm.

## 3. Nguyên tắc không được phá

- Canvas chính chạy một nhóm mỗi lần; hàng đợi hàng loạt giữ bộ chạy
  riêng. Một tab AI chỉ nhận một tác vụ tại một thời điểm.
- Không tự gửi lại AI khi mất kết nối hoặc chưa rõ kết quả.
- Không tạo nút hoạt động giả: nếu một công cụ chuyên biệt của LibTV
  như chuyển động tham chiếu, thay trang phục, xóa/vẽ lại vùng ảnh,
  tách lớp, panorama hay AI nâng độ nét chưa có bộ xử lý thật thì phải
  nói rõ là chưa có, không biến một thay đổi CSS thành kết quả AI.
- Không sao chép nhân vật chính thức hay dịch vụ model của LibTV.
- Mẫu luồng tối đa 20 MB trong app-mooz, không chứa API key, token,
  session, lựa chọn tab, kết quả AI hay phản hồi đang chờ.

## 4. Bằng chứng REA

Đã chạy REA (morluto/rea, `npx rea-agents analyze-javascript-application`)
trên bản sao app-mooz 0.68.0, commit 9c21928, ngày 2026-11-05.
Kết quả: evidence `ev_28aeb573519f7d63f9a7f9c2f9c3f2c8dfcea9dd197b312655112d41a5fdec0f`,
root SHA-256 `ac208bfc9470f05d649090890985ad250ef1ae48e28906d38059b9125a71de3c`.
Phân tích tĩnh, không chạy app, nên chỉ chứng minh cấu trúc code, không
chứng minh hành vi lúc chạy.

- **Quy mô:** 341 file liên quan, 302 file JavaScript đã parse, 0 lỗi
  parse, 662.378 AST node, 2.397 finding, đồ thị 1.355 node và 1.582 cạnh.
- **Ranh giới Electron:** 1 main `desktop/main.cjs`, 8 renderer,
  1 preload, 2 API contextBridge, 13 thành viên exposed, IPC có
  3 operation, 2 kênh literal, 1 handler ở main, 1 lần gửi ở renderer
  đã ghép cặp, 0 native addon, 0 utility process.
- **Module gọi AI (18 file, kể cả test):** `ai-bridge.js`,
  `ai-providers.js`, `ai-sites.js`, `ai-activity.js`,
  `desktop/ai-dispatch.cjs`, `desktop/ai-connections.cjs`,
  `desktop/ai-windows.cjs`, `desktop/chrome-connect.js`,
  `desktop/connections.js`, `desktop/ai-dispatch-ui.js`.
  Điều này khớp với cách gọi AI qua tab ở `docs/AI-CALLING.md`:
  điều phối, kết nối và danh sách AI tách riêng, không nằm chung
  trong một file canvas.
- **Module canvas (17 file, kể cả test):** `canvas-studio.js`,
  `canvas-diagram.js`, `canvas-presets.js`, `canvas-characters.js`,
  `canvas-image-editor.js`, `canvas-layout.js`,
  `canvas-studio-bridge.js`. Điều này khớp với bước 2, 4, 7 và 8
  ở trên: canvas, mẫu luồng, kho nhân vật và chỉnh ảnh là các
  module riêng, không phải một khối duy nhất.
- **Giới hạn REA cần ghi rõ:** đồ thị chỉ phủ một phần, vì một số
  file lớn như `desktop/ai-dispatch.cjs` và
  `desktop/ai-connections.cjs` vượt ngân sách kết quả của REA, nên
  quan hệ mở rộng của chúng chỉ giữ trên node file, không mở hết
  thành cạnh. `media-studio.js` chưa được phân tích ngữ nghĩa vì
  hết tài nguyên. Thiếu một finding không chứng minh là không có
  tính năng đó, và quan hệ Electron suy ra từ cú pháp tĩnh, chưa
  chứng minh đăng ký hay ép buộc lúc chạy.
