# BE_3layers_ThuyetMinhDaNgonNgu

## Chạy frontend demo

Frontend hiện dùng dữ liệu demo; metadata được lưu trong `localStorage`, còn ảnh và âm thanh được lưu trong IndexedDB của trình duyệt. Đăng nhập quản trị mặc định xác thực với SQL Server qua backend.

```powershell
cd saigon_echo\frontend
npm install
npm run dev
```

Tạo bản build production bằng `npm run build` trong thư mục `saigon_echo\frontend`.

Các route `/admin/*` yêu cầu đăng nhập. Mặc định, frontend gọi backend tại `http://localhost:3001` qua proxy Vite để xác thực tài khoản trong `dbo.AdminAccounts`; tài khoản phải đang hoạt động, có vai trò `ADMIN` hoặc `SUPER_ADMIN`, và mật khẩu được kiểm tra từ `PasswordHash`. Khởi động backend trước frontend:

```powershell
cd saigon_echo\backend
npm install
npm start
```

Nếu chỉ cần kiểm tra giao diện đăng nhập mà không kết nối backend, đặt `VITE_DEMO_AUTH=true` trong `saigon_echo\frontend\.env`. Chế độ này chỉ áp dụng khi chạy môi trường phát triển và đăng nhập bằng `admin` / `Admin@123`; phiên demo tự hết hạn sau 30 giây không hoạt động.

Trang tổng quan mặc định lấy thống kê từ database qua proxy Vite: lượt truy cập từ `VisitorSessions`, lượt nghe từ sự kiện `PLAY` trong `UsageEvents`, và danh mục địa điểm/ngôn ngữ/nội dung từ các bảng tương ứng. Bộ lọc hỗ trợ 7 ngày, 30 ngày và khoảng ngày tự chọn. Khi chạy production hoặc backend ở host khác, cấu hình `VITE_API_URL` trong `saigon_echo\frontend\.env` (ví dụ `http://localhost:3001`) để gọi API trực tiếp; cấu hình `FRONTEND_ORIGIN` tương ứng ở backend. Các API nội dung thuyết minh khác vẫn cần `VITE_API_URL` để bật.

Trang `/dang-nhap` cho phép chọn vai trò quản trị viên hoặc người dùng; khách có thể tiếp tục tới `/kham-pha` mà không cần tài khoản. Người dùng đăng ký tại `/dang-ky`; tài khoản được lưu trong `dbo.UserAccounts` của SQL Server và mật khẩu được băm bằng scrypt. Các route `/admin/*` vẫn chỉ dành cho tài khoản quản trị. Khách không thấy và không truy cập được `/yeu-thich` hoặc `/lich-su`.

Trang người dùng nằm tại `/kham-pha`, `/yeu-thich` và `/lich-su`. Danh sách công khai lấy các địa điểm đang hiển thị cùng nội dung đã được bật từ dữ liệu hiện có của trình duyệt; yêu thích và lịch sử nghe được lưu riêng theo `UserId` trong `localStorage` trên thiết bị hiện tại. Lịch sử ghi nhận khi người dùng bắt đầu phát file audio có sẵn. Phiên đăng nhập được lưu trong bộ nhớ backend và hết hạn sau 30 giây không hoạt động; sau khi khởi động lại backend, người dùng cần đăng nhập lại.

Trang `/admin/noi-dung` có thể chuyển bài thuyết minh demo lên backend khi địa điểm khớp ID hoặc slug. Dữ liệu không khớp sẽ được bỏ qua và báo kết quả; dữ liệu demo vẫn được giữ nguyên. Địa điểm, hình ảnh, âm thanh và QR chưa có API backend nên tiếp tục lưu trên trình duyệt.