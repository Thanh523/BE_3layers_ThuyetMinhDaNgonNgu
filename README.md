# BE_3layers_ThuyetMinhDaNgonNgu

## Chạy frontend demo

Frontend hiện dùng dữ liệu demo; metadata được lưu trong `localStorage`, còn ảnh và âm thanh được lưu trong IndexedDB của trình duyệt. Đăng nhập quản trị mặc định xác thực với SQL Server qua backend.

```powershell
cd saigon_echo\frontend
npm install
npm run dev
```

Giao diện đã có bố cục responsive cho điện thoại. Để mở trên điện thoại trong cùng mạng Wi-Fi với máy chạy dự án:

1. Khởi động backend và frontend như hướng dẫn bên dưới; Vite sẽ lắng nghe trên mạng LAN tại cổng `5173`.
2. Trên máy tính, chạy `ipconfig` và tìm địa chỉ IPv4 của kết nối Wi-Fi (thường có dạng `192.168.x.x`).
3. Trên điện thoại, mở `http://<địa-chỉ-IPv4>:5173` (ví dụ `http://192.168.1.10:5173`). Không dùng `localhost` trên điện thoại.
4. Nếu Windows Firewall hỏi, cho phép Node.js truy cập mạng riêng tư. Điện thoại và máy tính cần cùng mạng Wi-Fi; mạng khách có thể chặn kết nối giữa các thiết bị.

Các yêu cầu API từ điện thoại đi qua proxy Vite tới backend trên máy tính, nên trong chế độ này không cần đặt `VITE_API_URL`.

Tạo bản build production bằng `npm run build` trong thư mục `saigon_echo\frontend`.

Các route `/admin/*` yêu cầu đăng nhập. Mặc định, frontend gọi backend tại `http://localhost:3001` qua proxy Vite để xác thực tài khoản trong `dbo.AdminAccounts`; tài khoản phải đang hoạt động, có vai trò `ADMIN` hoặc `SUPER_ADMIN`, và mật khẩu được kiểm tra từ `PasswordHash`. Khởi động backend trước frontend:

```powershell
cd saigon_echo\backend
npm install
npm start
```

Các trang quản trị địa điểm, thuyết minh, hình ảnh, âm thanh và QR đọc/ghi dữ liệu trong SQL Server (`dbo.Places`, `dbo.Narrations`, `dbo.PlaceImages`, `dbo.AudioFiles`, `dbo.QRCodes`). Khi cập nhật database cũ, chạy một lần script [`001_add_visibility_columns.sql`](saigon_echo/backend/migrations/001_add_visibility_columns.sql) trong SSMS, kết nối đúng database `SaigonEcho` bằng tài khoản quản trị database. Script thêm `IsVisible BIT NOT NULL DEFAULT 1` cho `dbo.Places` và `dbo.Narrations`, giữ trạng thái hiển thị cho dữ liệu cũ. Không cần cấp quyền `ALTER` cho tài khoản ứng dụng; backend chỉ cần quyền đọc/ghi các bảng nội dung, gồm `dbo.PlaceImages`. Địa điểm ẩn sẽ không xuất hiện ở trang người dùng.

Ảnh địa điểm mặc định trong `frontend\public\user-images` được liên kết vào `dbo.PlaceImages` nếu địa điểm chưa có ảnh; cả trang người dùng và quản trị cùng đọc ảnh đại diện từ bảng này. Ảnh/âm thanh tải lên mới được lưu trong `backend\uploads`, còn đường dẫn được lưu trong database. Khi triển khai server, cần giữ thư mục này trên ổ đĩa bền vững và chuyển tiếp đường dẫn `/uploads/*` tới backend; nếu dùng Netlify redirect/tunnel, hãy giữ rule `/uploads/*` trỏ tới backend đang hoạt động. Để tạo QR, địa điểm phải đang hiển thị và có ít nhất một bài thuyết minh.

Nếu chỉ cần kiểm tra giao diện đăng nhập mà không kết nối backend, đặt `VITE_DEMO_AUTH=true` trong `saigon_echo\frontend\.env`. Chế độ này chỉ áp dụng khi chạy môi trường phát triển và đăng nhập bằng `admin` / `Admin@123`; phiên demo tự hết hạn sau 30 giây không hoạt động.

Trang tổng quan mặc định lấy thống kê từ database qua proxy Vite: lượt truy cập từ `VisitorSessions`, lượt nghe từ sự kiện `PLAY` trong `UsageEvents`, và danh mục địa điểm/ngôn ngữ/nội dung từ các bảng tương ứng. Bộ lọc hỗ trợ 7 ngày, 30 ngày và khoảng ngày tự chọn. Khi chạy production hoặc backend ở host khác, cấu hình `VITE_API_URL` trong `saigon_echo\frontend\.env` (ví dụ `http://localhost:3001`) để gọi API trực tiếp; cấu hình `FRONTEND_ORIGIN` tương ứng ở backend. Các API nội dung thuyết minh khác vẫn cần `VITE_API_URL` để bật.

Trang `/dang-nhap` cho phép chọn vai trò quản trị viên hoặc người dùng; khách có thể tiếp tục tới `/kham-pha` mà không cần tài khoản. Người dùng đăng ký tại `/dang-ky` bằng email; tài khoản được lưu trong `dbo.UserAccounts` của SQL Server và mật khẩu được băm bằng scrypt. Các route `/admin/*` vẫn chỉ dành cho tài khoản quản trị. Khách không thấy và không truy cập được `/yeu-thich` hoặc `/lich-su`.

Trang người dùng nằm tại `/kham-pha`, `/yeu-thich` và `/lich-su`. Khi backend chạy, danh sách công khai lấy các địa điểm và nội dung đã xuất bản trực tiếp từ SQL Server. Yêu thích và lịch sử nghe được ghi vào database theo `UserId` qua các API `/api/user/favorites` và `/api/user/history`; `localStorage` chỉ còn là bộ nhớ tạm khi backend chưa sẵn sàng. Lịch sử ghi nhận khi người dùng bắt đầu phát file audio có sẵn. Phiên đăng nhập được lưu trong bộ nhớ backend và hết hạn sau 30 giây không hoạt động; sau khi khởi động lại backend, người dùng cần đăng nhập lại.

Backend tự tạo hai bảng hỗ trợ nếu chưa tồn tại: `dbo.UserFavorites` và `dbo.UserListeningHistory`. Tài khoản SQL Server trong `.env` cần có quyền tạo và thao tác trên bảng. Nếu database đã có migration riêng, có thể tạo hai bảng trước khi khởi động backend.

Schema SQL Server hiện dùng các cột thật của database `SaigonEcho`: user đăng nhập bằng `Email` vì `dbo.UserAccounts` không có cột `Username`; địa điểm luôn hiển thị vì `dbo.Places` không có `IsVisible`/`DeletedAt`; narration dùng `Title`, `Content`, `LanguageCode` vì `dbo.Narrations` không có `Summary`/`Status`. Có thể sao chép [`.env.example`](saigon_echo/backend/.env.example) thành `.env` rồi điền mật khẩu SQL Server.

Ảnh cấu hình SQL Server của máy phát triển đang dùng Windows Authentication với server `DESKTOP-HOHF2EN` (đây là hostname thực tế của máy). Với cách này, cài dependency `msnodesqlv8` và đặt `DB_AUTH=windows`; backend sẽ dùng tài khoản Windows đang chạy Node, không cần lưu mật khẩu trong `.env`. Nếu chạy Node bằng tài khoản Windows khác, tài khoản đó cần được cấp quyền truy cập database `SaigonEcho`. Nếu `/api/health/db` báo `Login failed for user ...\Guest`, hãy chạy VS Code/terminal bằng đúng tài khoản Windows đã đăng nhập SSMS, hoặc chuyển sang SQL Server Authentication với một login database riêng.

Frontend mặc định gọi backend qua proxy Vite, không cần `VITE_API_URL`. Chỉ đặt `VITE_DEMO_DATA=true` khi muốn buộc dùng dữ liệu demo; `VITE_DEMO_AUTH=true` chỉ dùng cho giao diện đăng nhập thử nghiệm.

Trang `/admin/noi-dung` có thể chuyển bài thuyết minh demo lên backend khi địa điểm khớp ID hoặc slug. Dữ liệu không khớp sẽ được bỏ qua và báo kết quả; dữ liệu demo vẫn được giữ nguyên. Địa điểm, hình ảnh, âm thanh và QR chưa có API backend nên tiếp tục lưu trên trình duyệt.


# Lệnh tạo tài khoản admin: node create-admin-account.js
# Lệnh reset mật khẩu admin: node reset-admin-password.js