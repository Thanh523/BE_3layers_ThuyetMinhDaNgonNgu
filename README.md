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

Trang `/admin/noi-dung` có thể chuyển bài thuyết minh demo lên backend khi địa điểm khớp ID hoặc slug. Dữ liệu không khớp sẽ được bỏ qua và báo kết quả; dữ liệu demo vẫn được giữ nguyên. Địa điểm, hình ảnh, âm thanh và QR chưa có API backend nên tiếp tục lưu trên trình duyệt.