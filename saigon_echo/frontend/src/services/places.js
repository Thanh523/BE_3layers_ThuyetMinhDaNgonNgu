import { request } from './client';

export function createPlace(place) {
    return request('/admin/places', {
        method: 'POST',
        body: JSON.stringify(place),
    });
}

export function getAdminPlaces() {
    return request('/admin/places');
}

export function updatePlace(id, place) {
    return request(`/admin/places/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(place),
    });
}

export function deletePlace(id) {
    return request(`/admin/places/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}
