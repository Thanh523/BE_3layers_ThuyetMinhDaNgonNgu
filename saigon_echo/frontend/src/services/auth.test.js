// Runtime validation coverage for: user authentication API contracts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('./client', () => ({
    IS_AUTH_DEMO: false,
    request,
}));

import {
    getUserSession,
    loginUser,
    logoutUser,
    registerUser,
} from './auth';

describe('user authentication API', () => {
    beforeEach(() => {
        request.mockReset();
    });

    it('logs in through the user endpoint and returns only a user session', async () => {
        const user = { id: 12, username: 'listener', role: 'user' };
        request.mockResolvedValue({ user });

        await expect(loginUser('listener', 'long-test-password')).resolves.toEqual(user);
        expect(request).toHaveBeenCalledWith('/user/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'listener', password: 'long-test-password' }),
        });
    });

    it('rejects an admin session returned from the user login endpoint', async () => {
        request.mockResolvedValue({ user: { role: 'admin' } });

        await expect(loginUser('listener', 'long-test-password'))
            .rejects.toThrow('Tài khoản không có quyền người dùng.');
    });

    it('registers through the user endpoint and verifies the returned role', async () => {
        const account = {
            fullName: 'Test Listener',
            email: 'listener@example.test',
            username: 'listener',
            password: 'long-test-password',
        };
        const user = { id: 12, username: 'listener', role: 'user' };
        request.mockResolvedValue({ user });

        await expect(registerUser(account)).resolves.toEqual(user);
        expect(request).toHaveBeenCalledWith('/user/auth/register', {
            method: 'POST',
            body: JSON.stringify(account),
        });
    });

    it('returns the current user session and treats an expired session as signed out', async () => {
        const user = { id: 12, username: 'listener', role: 'user' };
        request.mockResolvedValueOnce({ user });
        await expect(getUserSession()).resolves.toEqual(user);
        expect(request).toHaveBeenLastCalledWith('/user/auth/me');

        request.mockRejectedValueOnce(new Error('Phiên đăng nhập đã hết hạn.'));
        await expect(getUserSession()).resolves.toBeNull();
    });

    it('logs out only from the user authentication endpoint', async () => {
        request.mockResolvedValue({});

        await logoutUser();

        expect(request).toHaveBeenCalledWith('/user/auth/logout', { method: 'POST' });
    });
});
