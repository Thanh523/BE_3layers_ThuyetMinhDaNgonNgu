# Sài Gòn Echo

## Chạy backend trên Windows

Backend đã có virtual environment tại `backend\.venv`. Mở Terminal thứ nhất:

```powershell
cd D:\homework\CNPM\BE-DEV-tudongdangonngu-cd-ci\user\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Giữ Terminal này đang chạy. Kiểm tra backend bằng cách mở:

```text
http://127.0.0.1:8000/docs
```

Nếu chạy bằng `python -m uvicorn` với Python hệ thống, có thể gặp lỗi `No module named fastapi` hoặc `No module named uvicorn`. Hãy dùng đúng file `backend\.venv\Scripts\python.exe` như lệnh trên.

## Chạy frontend

Mở Terminal thứ hai:

```powershell
cd D:\homework\CNPM\BE-DEV-tudongdangonngu-cd-ci\user\frontend
npm install
npm run dev
```

Mở URL Vite hiển thị trong Terminal, thường là `http://localhost:5173`.

Frontend proxy các request `/api` tới backend ở `http://localhost:8000`. Nếu giao diện hiển thị “Không thể tải danh sách địa điểm”, hãy kiểm tra backend đang chạy và cổng `8000` không bị ứng dụng khác chiếm.

Tài khoản đăng nhập/đăng ký sử dụng một trong hai loại định danh: số điện thoại hoặc email. Người dùng cũng có thể chọn chế độ khách để xem nội dung mà không lưu tài khoản, yêu thích hoặc lịch sử nghe.

## Quét mã QR bằng camera

Mở nút **Quét QR** trên giao diện, chọn **Bật camera** và cấp quyền camera khi trình duyệt hỏi. Camera hoạt động trên `localhost` hoặc HTTPS và sử dụng bộ giải mã tương thích với Chrome, Edge và các trình duyệt hiện đại. Nếu không thể cấp quyền camera, có thể chọn ảnh QR hoặc nhập mã dạng `SGECHO:dinh-doc-lap`.

## Build production

```powershell
cd D:\homework\CNPM\BE-DEV-tudongdangonngu-cd-ci\user\frontend
npm run build
```

Không mở trực tiếp `index.html` bằng double-click; đây là ứng dụng React cần chạy qua Vite hoặc FastAPI sau khi build.
