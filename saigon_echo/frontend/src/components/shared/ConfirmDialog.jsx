// Hỏi xác nhận trước khi xóa dữ liệu. Không xóa ngay khi bấm lần đầu.
import Modal from './Modal';
export default function ConfirmDialog({ title = 'Xác nhận xóa?', text, onCancel, onConfirm }) {
  return <Modal title={title} onClose={onCancel}>
    <p>{text}</p><div className="form-actions"><button className="btn" onClick={onCancel}>Hủy</button><button className="btn btn-danger" onClick={onConfirm}>Xác nhận xóa</button></div>
  </Modal>;
}
