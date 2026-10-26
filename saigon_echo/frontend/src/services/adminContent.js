import { request } from './client';

export const getAdminImages = () => request('/admin/images');
export const createAdminImage = (image) => request('/admin/images', {
    method: 'POST',
    body: JSON.stringify(image),
});
export const updateAdminImage = (id, image) => request(`/admin/images/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(image),
});
export const deleteAdminImage = (id) => request(`/admin/images/${encodeURIComponent(id)}`, {
    method: 'DELETE',
});

export const getAdminAudios = () => request('/admin/audios');
export const createAdminAudio = (audio) => request('/admin/audios', {
    method: 'POST',
    body: JSON.stringify(audio),
});
export const updateAdminAudio = (id, audio) => request(`/admin/audios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(audio),
});
export const deleteAdminAudio = (id) => request(`/admin/audios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
});

export const getAdminQrs = () => request('/admin/qrs');
export const createAdminQr = (qr) => request('/admin/qrs', {
    method: 'POST',
    body: JSON.stringify(qr),
});
export const deleteAdminQr = (id) => request(`/admin/qrs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
});

export function uploadAdminMedia(file, kind) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Không thể đọc tệp đã chọn.'));
        reader.onload = async () => {
            try {
                const result = await request('/admin/media-uploads', {
                    method: 'POST',
                    body: JSON.stringify({ dataUrl: reader.result, kind }),
                });
                if (typeof result.fileUrl !== 'string' || !result.fileUrl) {
                    throw new Error('Backend không trả về đường dẫn tệp hợp lệ.');
                }
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsDataURL(file);
    });
}
