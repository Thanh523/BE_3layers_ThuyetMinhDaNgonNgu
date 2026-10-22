import { getSession } from './auth';
import { IS_STATS_DEMO, request, SESSION_EVENT } from './client';

// Lấy dữ liệu dashboard từ backend. Chế độ cục bộ bắt đầu với nhật ký trống.
export async function getDashboard(range) {
    if (!(await getSession())) {
        window.dispatchEvent(new Event(SESSION_EVENT));
        throw new Error('Vui lòng đăng nhập lại.');
    }
    if (!IS_STATS_DEMO) {
        const query = new URLSearchParams({ from: range.from, to: range.to });
        return request(`/admin/dashboard?${query.toString()}`);
    }
    return {
        range: null,
        totals: {
            visits: 0,
            narrationUses: 0,
            places: 0,
            visiblePlaces: 0,
            hiddenPlaces: 0,
            narrations: 0,
        },
        dailyVisits: [],
        languageUsage: [],
        places: [],
    };
}
