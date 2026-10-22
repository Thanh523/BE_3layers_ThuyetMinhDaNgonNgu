import { IS_DEMO, request } from './client';

export async function getNarrations() {
    if (IS_DEMO) return null;
    return request('/admin/narrations');
}

export async function createNarration(narration) {
    const result = await request('/admin/narrations', {
        method: 'POST',
        body: JSON.stringify(narration),
    });
    if (
        !result.narration ||
        typeof result.narration.id !== 'string' ||
        typeof result.narration.locationId !== 'string' ||
        typeof result.narration.lang !== 'string' ||
        typeof result.narration.text !== 'string' ||
        typeof result.narration.title !== 'string' ||
        typeof result.narration.visible !== 'boolean'
    ) {
        throw new Error('Phản hồi tạo bài thuyết minh từ backend không đúng cấu trúc.');
    }
    return result;
}

export async function updateNarration(id, changes) {
    const result = await request(`/admin/narrations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
    });
    if (
        !result.narration ||
        typeof result.narration.id !== 'string' ||
        typeof result.narration.locationId !== 'string' ||
        typeof result.narration.lang !== 'string' ||
        typeof result.narration.title !== 'string' ||
        typeof result.narration.summary !== 'string' ||
        typeof result.narration.text !== 'string' ||
        typeof result.narration.visible !== 'boolean'
    ) {
        throw new Error('Phản hồi cập nhật bài thuyết minh từ backend không đúng cấu trúc.');
    }
    return result.narration;
}

export async function deleteNarration(id) {
    await request(`/admin/narrations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
