// Cấu hình chế độ chạy và gửi yêu cầu chung đến backend.
export const IS_DEMO = !import.meta.env.VITE_API_URL;
export const IS_STATS_DEMO =
    import.meta.env.DEV && import.meta.env.VITE_DEMO_STATS === 'true';
export const IS_AUTH_DEMO =
    import.meta.env.DEV && import.meta.env.VITE_DEMO_AUTH === 'true';
const configuredBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = configuredBase
    ? configuredBase.endsWith('/api')
        ? configuredBase
        : `${configuredBase}/api`
    : '/api';
export const SESSION_EVENT = 'echo-session-expired';

export async function request(path, options = {}) {
    let response;
    try {
        response = await fetch(`${BASE}${path}`, {
            credentials: 'include',
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers },
        });
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(
                `Không kết nối được backend tại ${BASE}. Hãy kiểm tra backend đang chạy và cấu hình VITE_API_URL.`,
                { cause: error },
            );
        }
        throw error;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const isAuthRequest = path.startsWith('/admin/auth/') || path.startsWith('/user/auth/');
        if (response.status === 401 && !isAuthRequest)
            window.dispatchEvent(new Event(SESSION_EVENT));
        throw new Error(
            response.status === 401
                ? path === '/admin/auth/login' || path === '/user/auth/login'
                    ? 'Tên đăng nhập hoặc mật khẩu không đúng.'
                    : 'Phiên đăng nhập đã hết hạn.'
                : response.status === 403
                  ? 'Tài khoản không có quyền quản trị.'
                  : data.message || 'Không thể kết nối hệ thống. Vui lòng thử lại.',
        );
    }
    return data;
}
