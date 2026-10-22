// API công khai tập trung; cài đặt request và endpoint nằm trong services riêng.
export { getSession, login, logout, startSessionActivity } from './auth';
export { getDashboard } from './dashboard';
export {
    createNarration,
    deleteNarration,
    getNarrations,
    updateNarration,
} from './narrations';
export { IS_AUTH_DEMO, IS_DEMO, IS_STATS_DEMO, request, SESSION_EVENT } from './client';
