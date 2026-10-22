import { IS_AUTH_DEMO, request } from './client';

const SESSION_KEY = 'saigon-echo-admin-session-v1';
const SESSION_IDLE_TIMEOUT_MS = 30_000;
const ACTIVITY_CHECK_INTERVAL_MS = 1_000;

export async function getSession() {
    if (!IS_AUTH_DEMO) {
        try {
            return await request('/admin/auth/me').then((x) => {
                if (x.user?.role !== 'admin') throw new Error('Tài khoản không có quyền quản trị.');
                return x.user;
            });
        } catch (error) {
            if (error.message === 'Phiên đăng nhập đã hết hạn.') return null;
            throw error;
        }
    }
    try {
        const item = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        if (item?.expiresAt > Date.now() && item.user?.role === 'admin') return item.user;
        sessionStorage.removeItem(SESSION_KEY);
        return null;
    } catch {
        return null;
    }
}

export async function login(username, password) {
    if (!IS_AUTH_DEMO)
        return request('/admin/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }).then((x) => {
            if (x.user?.role !== 'admin') throw new Error('Tài khoản không có quyền quản trị.');
            return x.user;
        });
    await new Promise((resolve) => setTimeout(resolve, 350));
    // Chỉ là tài khoản thử giao diện, không dùng làm cơ chế bảo mật thực tế.
    if (username !== 'admin' || password !== 'Admin@123')
        throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
    const user = { name: 'Quản trị viên', username: 'admin', role: 'admin' };
    sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ user, expiresAt: Date.now() + SESSION_IDLE_TIMEOUT_MS }),
    );
    return user;
}

export function startSessionActivity(onExpired) {
    let lastActivityAt = Date.now();
    let lastSyncedActivityAt = lastActivityAt;
    let expired = false;

    function expire() {
        if (expired) return;
        expired = true;
        if (IS_AUTH_DEMO) sessionStorage.removeItem(SESSION_KEY);
        onExpired();
    }

    function registerActivity() {
        const now = Date.now();
        if (now - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) {
            expire();
            return;
        }

        lastActivityAt = now;
        if (IS_AUTH_DEMO) {
            try {
                const item = JSON.parse(sessionStorage.getItem(SESSION_KEY));
                if (!item || item.expiresAt <= now) {
                    expire();
                    return;
                }
                item.expiresAt = now + SESSION_IDLE_TIMEOUT_MS;
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(item));
            } catch {
                expire();
            }
        }
    }

    function checkSession() {
        const now = Date.now();
        if (now - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) {
            expire();
            return;
        }
        if (!IS_AUTH_DEMO && lastActivityAt > lastSyncedActivityAt) {
            lastSyncedActivityAt = lastActivityAt;
            request('/admin/auth/activity', { method: 'POST' }).catch((error) => {
                if (error.message !== 'Phiên đăng nhập đã hết hạn.') {
                    console.error('Không thể đồng bộ hoạt động phiên đăng nhập:', error);
                }
            });
        }
    }

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'];
    activityEvents.forEach((eventName) =>
        window.addEventListener(eventName, registerActivity, { passive: true }),
    );
    window.addEventListener('focus', checkSession);
    const timer = setInterval(checkSession, ACTIVITY_CHECK_INTERVAL_MS);

    return () => {
        clearInterval(timer);
        activityEvents.forEach((eventName) =>
            window.removeEventListener(eventName, registerActivity),
        );
        window.removeEventListener('focus', checkSession);
    };
}

export async function logout() {
    if (!IS_AUTH_DEMO) await request('/admin/auth/logout', { method: 'POST' });
    sessionStorage.removeItem(SESSION_KEY);
}
