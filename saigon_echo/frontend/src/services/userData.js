import { request } from './client';

export function getPublicPlaces() {
    return request('/places');
}

export function getPublicPlace(slug) {
    return request(`/places/${encodeURIComponent(slug)}`);
}

export function getFavorites() {
    return request('/user/favorites');
}

export function setFavorite(placeId, saved) {
    return request(`/user/favorites/${encodeURIComponent(placeId)}`, {
        method: saved ? 'PUT' : 'DELETE',
    });
}

export function getUserHistory() {
    return request('/user/history');
}

export function recordHistory(placeId, lang) {
    return request('/user/history', {
        method: 'POST',
        body: JSON.stringify({ placeId, lang }),
    });
}

export function clearHistory() {
    return request('/user/history', { method: 'DELETE' });
}
