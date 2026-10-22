// Dữ liệu demo cục bộ cho các chức năng chưa có API ghi tương ứng ở backend.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadData, saveData } from '../services/storage';
import { deleteFile } from '../services/fileStore';

const DemoDataContext = createContext(null);
const FAVORITES_KEY_PREFIX = 'saigonecho-user-favorites-v1';
const HISTORY_KEY_PREFIX = 'saigonecho-user-history-v1';
export const newId = prefix => `${prefix}_${crypto.randomUUID()}`;
export const makeSlug = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function loadUserList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`Không đọc được dữ liệu người dùng (${key}):`, error);
    return [];
  }
}

export function DemoDataProvider({ children }) {
  const [data, setData] = useState(loadData);
  const [accountScope, setAccountScopeState] = useState('guest');
  const accountScopeRef = useRef('guest');
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [messageId, setMessageId] = useState(0);

  const showMessage = text => {
    setMessage(text);
    setMessageId(id => id + 1);
  };

  // Metadata demo được lưu localStorage; file media nằm riêng trong IndexedDB.
  useEffect(() => {
    try { saveData(data); }
    catch { showMessage('Không lưu được dữ liệu: trình duyệt có thể đang đầy bộ nhớ hoặc tắt lưu trữ.'); }
  }, [data]);

  useEffect(() => {
    if (accountScope === 'guest') return;
    try {
      localStorage.setItem(`${FAVORITES_KEY_PREFIX}:${accountScope}`, JSON.stringify(favorites));
    } catch (error) {
      console.error('Không lưu được danh sách địa điểm yêu thích:', error);
      showMessage('Không lưu được địa điểm yêu thích vào trình duyệt.');
    }
  }, [accountScope, favorites]);

  useEffect(() => {
    if (accountScope === 'guest') return;
    try {
      localStorage.setItem(`${HISTORY_KEY_PREFIX}:${accountScope}`, JSON.stringify(history));
    } catch (error) {
      console.error('Không lưu được lịch sử nghe:', error);
      showMessage('Không lưu được lịch sử nghe vào trình duyệt.');
    }
  }, [accountScope, history]);

  const notify = useCallback(showMessage, []);
  const dismiss = () => setMessage('');
  const setAccountScope = useCallback((scope) => {
    const nextScope = scope ? String(scope) : 'guest';
    if (accountScopeRef.current === nextScope) return;
    accountScopeRef.current = nextScope;
    setFavorites(nextScope === 'guest'
      ? []
      : loadUserList(`${FAVORITES_KEY_PREFIX}:${nextScope}`));
    setHistory(nextScope === 'guest'
      ? []
      : loadUserList(`${HISTORY_KEY_PREFIX}:${nextScope}`));
    setAccountScopeState(nextScope);
  }, []);
  const toggleFavorite = useCallback((placeId) => {
    if (accountScope === 'guest') return;
    setFavorites((current) => {
      return current.includes(placeId)
        ? current.filter((id) => id !== placeId)
        : [...current, placeId];
    });
  }, [accountScope]);
  const addHistory = useCallback((placeId, lang) => {
    if (accountScope === 'guest') return;
    const entry = {
      id: newId('history'),
      place_id: placeId,
      lang,
      time: new Date().toISOString().replace(/Z$/, ''),
    };
    setHistory((current) => [entry, ...current].slice(0, 100));
  }, [accountScope]);
  const clearHistory = useCallback(() => {
    if (accountScope === 'guest') return;
    setHistory([]);
    showMessage('Đã xóa lịch sử nghe.');
  }, [accountScope]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [message, messageId]);

  // Thao tác CRUD dùng chung: page gọi cập nhật theo từng collection.
  const add = (collection, item) => setData(old => ({ ...old, [collection]: [...old[collection], item] }));
  const update = (collection, id, changes) => setData(old => ({
    ...old, [collection]: old[collection].map(item => item.id === id ? { ...item, ...changes } : item)
  }));
  const remove = (collection, id) => setData(old => ({
    ...old, [collection]: old[collection].filter(item => item.id !== id)
  }));

  // Xóa địa điểm đồng thời dọn dữ liệu liên quan. QR đã in sẽ dẫn đến trang không còn tồn tại.
  const removeLocation = async id => {
    const files = [...data.images, ...data.audios].filter(item => item.locationId === id && item.fileId);
    setData(old => ({
      ...old,
      locations: old.locations.filter(item => item.id !== id),
      narrations: old.narrations.filter(item => item.locationId !== id),
      images: old.images.filter(item => item.locationId !== id),
      audios: old.audios.filter(item => item.locationId !== id),
      qrs: old.qrs.filter(item => item.locationId !== id),
    }));
    await Promise.allSettled(files.map(item => deleteFile(item.fileId)));
  };

  const removeMedia = async (collection, id) => {
    const item = data[collection].find(item => item.id === id);
    remove(collection, id);
    if (item?.fileId) await deleteFile(item.fileId).catch(() => {});
  };

  // Chỉ một ảnh đại diện cho mỗi địa điểm; tránh trạng thái nhiều cover.
  const setCover = (locationId, imageId) => setData(old => ({
    ...old, images: old.images.map(item => item.locationId === locationId ? { ...item, isCover: item.id === imageId } : item)
  }));

  // Hoán đổi thứ tự ảnh trong cùng một địa điểm.
  const moveImage = (id, delta) => setData(old => {
    const ordered = old.images.filter(i => i.locationId === old.images.find(j => j.id === id)?.locationId)
      .sort((a, b) => a.order - b.order);
    const index = ordered.findIndex(item => item.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= ordered.length) return old;
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    const orderMap = new Map(ordered.map((item, i) => [item.id, i]));
    return { ...old, images: old.images.map(item => orderMap.has(item.id) ? { ...item, order: orderMap.get(item.id) } : item) };
  });

  const value = useMemo(() => ({
    data,
    add,
    update,
    remove,
    removeLocation,
    removeMedia,
    setCover,
    moveImage,
    notify,
    accountScope,
    setAccountScope,
    favorites,
    toggleFavorite,
    history,
    addHistory,
    clearHistory,
  }), [data, notify, accountScope, setAccountScope, favorites, toggleFavorite, history, addHistory, clearHistory]);
  return <DemoDataContext.Provider value={value}>{children}{message && <div className="toast" role="status"><span>{message}</span><button onClick={dismiss} aria-label="Đóng thông báo">×</button></div>}</DemoDataContext.Provider>;
}

export const useDemoData = () => {
  const value = useContext(DemoDataContext);
  if (!value) throw new Error('useDemoData cần nằm trong DemoDataProvider');
  return value;
};
