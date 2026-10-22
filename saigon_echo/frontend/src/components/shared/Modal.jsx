// Modal dùng chung cho thêm/sửa/xác nhận; đóng khi bấm nút hoặc bấm vùng nền.
import { X } from 'lucide-react';
import { useEffect } from 'react';
export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handleEscape = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-heading"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={19}/></button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}
