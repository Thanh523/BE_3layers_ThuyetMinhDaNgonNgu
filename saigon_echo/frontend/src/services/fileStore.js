// IndexedDB dùng để lưu tệp (Blob) của hình ảnh/âm thanh ngay trong trình duyệt.
// Tệp chỉ tồn tại trên thiết bị dùng demo; Backend thật sẽ thay thế lớp này.
const DB_NAME = 'saigonecho-demo-files';
const STORE = 'files';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function operate(mode, operation) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export const putFile = (id, blob) => operate('readwrite', store => store.put(blob, id));
export const getFile = id => operate('readonly', store => store.get(id));
export const deleteFile = id => operate('readwrite', store => store.delete(id));

// Kiểm tra file trước khi lưu: giới hạn dung lượng/loại tệp để demo ổn định.
export function validateFile(file, kind) {
  if (!file) throw new Error('Vui lòng chọn tệp.');
  const allowed = kind === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
  const limit = kind === 'image' ? 8 : 20;
  if (!allowed.includes(file.type)) throw new Error(`Định dạng ${kind === 'image' ? 'ảnh' : 'âm thanh'} không được hỗ trợ.`);
  if (file.size > limit * 1024 * 1024) throw new Error(`Tệp vượt quá ${limit} MB.`);
}
