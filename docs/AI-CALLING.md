# Cách gọi AI — bổ sung từ app-mooz

Có 3 cách gọi AI, đừng nhầm lẫn chúng với nhau. App-mooz dùng cách 1
là chính. Demo trong repo này hiện chỉ dùng cách mô phỏng, và file
`examples/ai-provider.example.js` là khung để thay mô phỏng bằng
cách 2 sau này, nếu có API thật.

## Cách 1: Qua tab AI đã đăng nhập — cách app-mooz làm thật

Đây không phải gọi API bằng API key. App kết nối tới trình duyệt Chrome
đang mở sẵn, qua tiện ích MooZ Connect, rồi gửi yêu cầu vào đúng tab
AI mà người dùng đã đăng nhập.

- **Chuẩn bị:** Chrome đang chạy, tiện ích MooZ Connect đã kết nối
  (chấm xanh, hiển thị App đã kết nối), tab AI đã đăng nhập sẵn.
  Các AI được hỗ trợ theo app-mooz gồm Muse, ChatGPT, Gemini, Grok
  và Google Flow/Veo, qua MooZ Connect hoặc cửa sổ AI trong app.
  Website khác cần connector riêng của nó, không tự có.
- **Chọn một lần cho cả nhóm:** chọn AI và tab cho cả nhóm node.
  Các bước AI giữ cùng tab qua mọi bước và qua ghép/xuất, dù danh
  sách tab có đảo thứ tự. Tab bận thì tác vụ xếp hàng chờ trên tab
  đó, không chạy song song trên cùng một tab.
- **Nhịp gửi:** trong app-mooz, nhịp mặc định là khoảng cách gửi
  5 giây, nghỉ 5 giây, chạy tuần tự 1 tác vụ tại một thời điểm trên
  một tab. Muốn hai tác vụ chạy đồng thời thì chọn hai tab khác nhau.
- **Gửi gì:** prompt đã chốt, ảnh tham chiếu (nhân vật, sản phẩm,
  cảnh) và thông số của node. Ảnh tham chiếu đi kèm ảnh sản phẩm
  hoặc cảnh khi tạo ảnh/video, và tác vụ đã xếp hàng giữ ảnh đã chốt.
- **Nhận kết quả:** app theo dõi chat của tab đó, nhận ảnh/video
  đúng loại, đối chiếu với prompt mới gửi, rồi gắn kết quả vào node
  và chuyển sang bước sau qua dây nối. Kết quả phải được xác nhận
  đã nhận, không được tạo lại AI chỉ vì chưa thấy phản hồi ngay.
- **Khi lỗi:** mất kết nối tạm thời thì giữ phản hồi tối đa 90 giây
  trong một số bản app-mooz, rồi chuyển lại đúng mã yêu cầu. Nếu
  kết quả vẫn chưa rõ thì dừng và kiểm tra tab AI thủ công, không
  tự gửi lại. Tác vụ gián đoạn yêu cầu kiểm tra tab trước khi chạy
  lại.
- **Giới hạn thật:** AI qua tab vẫn cần Chrome/app hoạt động, tài
  khoản đã đăng nhập và website đó thực sự hỗ trợ tác vụ được chọn
  (đúng model, đúng chế độ, nhận được tham chiếu). Không cam kết
  tương đương công cụ chuyên biệt của LibTV chỉ bằng một prompt.
  Các công cụ như chuyển động tham chiếu, thay trang phục, xóa/vẽ
  lại vùng ảnh, tách lớp, panorama và AI nâng độ nét chưa có bộ xử
  lý chuyên biệt trong app-mooz, nên không được hứa là có.

## Cách 2: Qua API HTTP — khung cho app mới, chưa có trong demo

Dùng khi có API thật của một nhà cung cấp model, và có API key riêng.

- **Nguyên tắc:** API key lấy từ biến môi trường hoặc kho khóa an
  toàn, không bao giờ ghi trực tiếp vào code, không commit lên repo,
  không gửi qua chat. Một job gồm prompt, tham chiếu, model, tỉ lệ,
  chất lượng và số lượng, trả về job ID, rồi hỏi trạng thái theo
  chu kỳ cho tới khi xong, tải kết quả về và lưu vào kho tài sản.
- **Hàng đợi:** giữ nguyên nguyên tắc của cách 1: một job tại một
  thời điểm cho một tài khoản hoặc một model nếu nhà cung cấp giới
  hạn, có khoảng cách giữa các lần gửi, có giới hạn thử lại và có
  trạng thái thật (đang chạy, đang chờ, xong, lỗi) cho từng job.
- **Trừ điểm và lỗi:** chỉ trừ điểm khi job được chấp nhận hoặc đã
  chạy, không trừ khi job chưa gửi được. Lỗi 429, khóa tài khoản
  hoặc hết hạn thì dừng gửi, không đổi endpoint để lách.
- **Khung code:** xem `examples/ai-provider.example.js`. File đó có
  provider mô phỏng chạy được ngay, và phần API chỉ là khung có ghi
  chú, chưa có URL hay key thật, nên không chạy ra ảnh thật cho tới
  khi người dùng tự điền nhà cung cấp và key của mình.

## Cách 3: Làm thủ công, không qua app

Dùng khi chưa có connector và chưa có API: copy prompt và tham chiếu
từ node, dán vào website AI đã đăng nhập, tải kết quả về, rồi nhập
lại vào node hoặc kho tài sản của demo. Cách này chậm nhưng chắc chắn
nhất để kiểm tra prompt và model trước khi tự động hóa, và là cách
kiểm chứng xem một model có thực sự giữ được mặt và sản phẩm hay không.

## Demo trong repo này đang ở đâu

- Nút Tạo trong `index.html` hiện chỉ chạy mô phỏng: hiện tiến trình,
  trừ điểm demo, ghi kết quả mẫu vào node. Nó không gọi tab AI như
  cách 1, cũng không gọi API như cách 2.
- Muốn nâng cấp, thay mô phỏng bằng cách 1 hoặc cách 2 ở trên, giữ
  nguyên giao diện và luồng trong `docs/WORKFLOW.md`, chỉ thay phần
  gọi AI. Đừng thay cả luồng chỉ vì đổi cách gọi.
