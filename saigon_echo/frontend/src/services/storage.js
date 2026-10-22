// localStorage chỉ chứa thông tin dạng JSON: địa điểm, bản dịch và metadata file.
// Không lưu file hình/âm thanh bằng base64 để tránh nhanh hết dung lượng.
import { initialData } from '../data/seed';
const KEY = 'saigonecho-admin-demo-v2';

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.locations) && Array.isArray(saved.narrations)) {
        return { ...structuredClone(initialData), ...saved };
      }
    }
  } catch (error) { console.warn('Không đọc được dữ liệu demo:', error); }
  return structuredClone(initialData);
}

export function saveData(data) {
  // Ném lỗi lên Context để có thể báo cho người dùng khi bộ nhớ bị đầy.
  localStorage.setItem(KEY, JSON.stringify(data));
}
