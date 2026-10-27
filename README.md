# PITCH PULSE — Live Investment Show 🎤

Một web game trình diễn gọi vốn kiểu **Kahoot × Shark Tank** bằng HTML/CSS/JavaScript, Node.js và Server-Sent Events (SSE).

## Khởi chạy

Cài **Node.js 18+** (bản LTS), sau đó có thể chạy **start.command** trên macOS / **start.bat** trên Windows, hoặc mở terminal trong thư mục này rồi gõ:

```bash
node server.js
```

Hoặc chạy `npm start` (không cần `npm install`, vì project **không dùng package ngoài**).

Mở **http://localhost:3000** trên máy Host.

### Cho các nhóm tham gia trên điện thoại / laptop

- **Cùng Wi-Fi:** mở địa chỉ dạng `http://IP-CỦA-MÁY-HOST:3000` trên các máy còn lại (ví dụ `http://192.168.1.12:3000`). Cho phép kết nối qua tường lửa nếu cần. Nếu Host chia sẻ link, các thiết bị khác cần dùng địa chỉ IP hoặc tên miền truy cập được, **không** dùng `localhost` trên điện thoại.
- **Qua Internet:** triển khai Node app trên Render / Railway / VPS; hệ thống hỗ trợ PORT từ môi trường. Phải sử dụng dịch vụ có filesystem bền vững hoặc gắn database nếu muốn lưu phòng dài hạn.
- Không cần tạo user database thủ công. Tên nhóm và PIN 4 chữ số được tạo khi đăng nhập lần đầu vào phòng.

## Luồng sử dụng

1. **Host:** chọn TẠO PHÒNG → đặt tên dự án → nhận mã 6 ký tự, ví dụ `ABC234`.
2. **Nhóm:** chọn THAM GIA NHÓM → nhập mã phòng, tên nhóm, PIN 4 số → truy cập quỹ **$10 million**.
3. **Nhóm:** chọn amount 0–10 (cho phép hai số thập phân), kéo slider / nhập số → bấm CONFIRM INVESTMENT. Có thể cập nhật khi phòng còn mở. Chọn 0 nếu từ chối đầu tư.
4. **Host:** chỉ xem tình trạng đã gửi/chưa gửi, **không xem số tiền trước khi công bố**.
5. **Host:** chọn START THE REVEAL. 7,5 giây trống tăng tốc, spotlight, đếm ngược; sau đó hiện tổng vốn, hiệu ứng pháo giấy và bảng từng nhóm. Kết quả được đồng bộ cho mọi thiết bị.
6. **Host:** xuất CSV hoặc bắt đầu dự án mới (reset ngân sách từng nhóm về $10M, giữ nguyên tài khoản nhóm).

## Demo 1 máy

Ở Host Dashboard chọn **THÊM 5 NHÓM DEMO** để có ngay 5 nhóm đầu tư với tổng **$36M**, rồi bấm Reveal. Nhớ **XÓA NHÓM DEMO** trước khi dùng thật.

## Ghi chú vận hành

- Host nên bật loa và bấm Reveal trực tiếp trên máy trình chiếu. Âm trống được tạo bằng Web Audio API, **không cần tải MP3**, nhưng một số trình duyệt chặn âm thanh trên thiết bị chưa có tương tác.
- Mã Host được lưu ở `localStorage` của trình duyệt Host; nhóm được nhớ trong `sessionStorage` của tab (để tránh lưu PIN dài hạn). Đừng chia sẻ thiết bị/trình duyệt Host cho người chơi.
- Phòng và mức đầu tư được lưu tại `data/rooms.json` để không mất khi máy chủ khởi động lại. Khi đưa lên hosting có filesystem tạm, dữ liệu có thể bị mất sau khi redeploy; hãy gắn lưu trữ bền vững.
- Đây là **game mô phỏng**, không xử lý tiền thật. Cơ chế xác thực bằng tên nhóm + PIN 4 số phù hợp hoạt động lớp học/sự kiện nhỏ, chưa phải hệ thống bảo mật cấp production.
- Nếu dùng nhiều dự án liên tiếp, nút "DỰ ÁN MỚI" sẽ **cấp mới $10M mỗi nhóm** thay vì trừ ngân sách giữa các dự án.
