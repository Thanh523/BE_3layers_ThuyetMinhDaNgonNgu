// Hiện trạng thái trống khi bộ lọc không có kết quả hoặc chưa thêm dữ liệu.
import { SearchX } from 'lucide-react';
export default function EmptyState({ text = 'Chưa có dữ liệu phù hợp.' }) {
  return <div className="empty-state"><SearchX size={28}/><h3>Chưa có kết quả</h3><p>{text}</p></div>;
}
