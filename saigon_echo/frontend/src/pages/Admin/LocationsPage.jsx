// USE CASE: xem danh sách/chi tiết, tìm kiếm-lọc, thêm, sửa, xóa và ẩn/hiện địa điểm.
import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useDemoData, makeSlug, newId } from '../../contexts/DemoDataContext';
import { CATEGORIES } from '../../data/seed';
import PageHeader from '../../components/shared/PageHeader';
import Modal from '../../components/shared/Modal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import EmptyState from '../../components/shared/EmptyState';
import MediaImage from '../../components/shared/MediaImage';

const newDraft = {
    name: '',
    enName: '',
    address: '',
    category: 'history',
    summary: '',
    visible: true,
};

function LocationForm({ original, onClose }) {
    const { data, add, update, notify } = useDemoData();
    const [form, setForm] = useState(original ? { ...original } : { ...newDraft });
    const [error, setError] = useState('');
    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    // Kiểm tra dữ liệu bắt buộc, tên/đường dẫn trùng nhau trước khi lưu.
    const submit = (event) => {
        event.preventDefault();
        if (!form.name.trim() || !form.address.trim()) {
            setError('Vui lòng nhập tên và địa chỉ địa điểm.');
            return;
        }
        const rawSlug = makeSlug(form.name.trim()) || 'dia-diem';
        const slug = original?.slug || rawSlug;
        if (!original && data.locations.some((item) => item.slug === slug)) {
            setError('Tên/đường dẫn địa điểm đã tồn tại.');
            return;
        }
        if (
            !original &&
            data.locations.some(
                (item) => item.name.toLowerCase() === form.name.trim().toLowerCase(),
            )
        ) {
            setError('Tên địa điểm đã tồn tại.');
            return;
        }
        const item = { ...form, name: form.name.trim(), address: form.address.trim(), slug };
        if (original) update('locations', original.id, item);
        else add('locations', { ...item, id: newId('loc'), artwork: 'palace', color: '#d5ded0' });
        notify(original ? 'Đã cập nhật địa điểm.' : 'Đã thêm địa điểm mới.');
        onClose();
    };

    return (
        <form onSubmit={submit}>
            <div className="form-grid">
                <label className="field">
                    <span>
                        Tên địa điểm <b>*</b>
                    </span>
                    <input
                        value={form.name}
                        maxLength={100}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="VD: Bảo tàng Thành phố"
                        required
                    />
                </label>
                <label className="field">
                    <span>Tên tiếng Anh</span>
                    <input
                        value={form.enName}
                        maxLength={120}
                        onChange={(e) => set('enName', e.target.value)}
                        placeholder="English name"
                    />
                </label>
            </div>
            <label className="field">
                <span>
                    Địa chỉ <b>*</b>
                </span>
                <input
                    required
                    maxLength={220}
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    placeholder="Địa chỉ tại TP. Hồ Chí Minh"
                />
            </label>
            <label className="field">
                <span>Danh mục</span>
                <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                    {CATEGORIES.map((item) => (
                        <option key={item.value} value={item.value}>
                            {item.label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="field">
                <span>Mô tả ngắn</span>
                <textarea
                    rows={3}
                    maxLength={400}
                    value={form.summary}
                    onChange={(e) => set('summary', e.target.value)}
                    placeholder="Thông tin giới thiệu cho thẻ địa điểm"
                />
            </label>
            <label className="checkbox-line">
                <input
                    type="checkbox"
                    checked={form.visible}
                    onChange={(e) => set('visible', e.target.checked)}
                />{' '}
                Hiển thị địa điểm cho người tham quan
            </label>
            {original && (
                <p className="helper">
                    Đường dẫn QR được giữ nguyên khi sửa tên:{' '}
                    <code>/tham-quan/{original.slug}</code>
                </p>
            )}
            {error && (
                <p className="error-text" role="alert">
                    {error}
                </p>
            )}
            <div className="form-actions">
                <button type="button" className="btn" onClick={onClose}>
                    Hủy
                </button>
                <button className="btn primary" type="submit">
                    {original ? 'Lưu thay đổi' : 'Thêm địa điểm'}
                </button>
            </div>
        </form>
    );
}

export default function LocationsPage() {
    const { data, update, removeLocation, notify } = useDemoData();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [editing, setEditing] = useState(undefined);
    const [details, setDetails] = useState(null);
    const [deleting, setDeleting] = useState(null);

    // Lọc kết quả theo tên, tên tiếng Anh, địa chỉ và trạng thái ẩn/hiện.
    const rows = useMemo(
        () =>
            data.locations.filter((item) => {
                const q = search.toLocaleLowerCase('vi');
                return (
                    [item.name, item.enName, item.address].some((text) =>
                        (text || '').toLocaleLowerCase('vi').includes(q),
                    ) &&
                    (status === 'all' || (status === 'visible') === item.visible)
                );
            }),
        [data.locations, search, status],
    );

    const toggle = (item) => {
        update('locations', item.id, { visible: !item.visible });
        notify(item.visible ? 'Đã ẩn địa điểm.' : 'Đã hiển thị địa điểm.');
    };
    const confirmDelete = async () => {
        await removeLocation(deleting.id);
        setDeleting(null);
        notify('Đã xóa địa điểm cùng nội dung liên quan.');
    };

    return (
        <>
            <PageHeader
                kicker="NỘI DUNG / 01"
                title="Quản lý địa điểm"
                description="Thêm và tổ chức các điểm tham quan nổi bật của thành phố."
                action={
                    <button className="btn primary" onClick={() => setEditing(null)}>
                        <Plus size={17} /> Thêm địa điểm
                    </button>
                }
            />
            <div className="metric-line">
                <span>
                    <strong>{data.locations.length}</strong> địa điểm
                </span>
                <span>
                    <strong>{data.locations.filter((x) => x.visible).length}</strong> đang hiển thị
                </span>
                <span>
                    <strong>{data.locations.filter((x) => !x.visible).length}</strong> đã ẩn
                </span>
            </div>
            <section className="panel">
                <div className="filter-row">
                    <label className="search-field">
                        <Search size={18} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm tên hoặc địa chỉ địa điểm..."
                        />
                    </label>
                    <select
                        className="filter-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="visible">Đang hiển thị</option>
                        <option value="hidden">Đã ẩn</option>
                    </select>
                </div>
                {rows.length ? (
                    <div className="place-list">
                        {rows.map((place) => (
                            <article className="place-row" key={place.id}>
                                <div className="place-thumb">
                                    <MediaImage place={place} />
                                </div>
                                <div className="place-info">
                                    <h3>{place.name}</h3>
                                    <p>{place.enName || 'Địa điểm tham quan'}</p>
                                    <div className="tiny-meta">
                                        <MapPin size={13} />
                                        {place.address}
                                    </div>
                                </div>
                                <div className="place-status">
                                    <span
                                        className={`status-pill ${place.visible ? 'success' : 'neutral'}`}
                                    >
                                        {place.visible ? 'Đang hiển thị' : 'Đã ẩn'}
                                    </span>
                                </div>
                                <div className="table-actions">
                                    <button
                                        className="small-btn"
                                        title="Xem chi tiết"
                                        onClick={() => setDetails(place)}
                                    >
                                        <Eye size={16} />
                                    </button>
                                    <button
                                        className="small-btn"
                                        title="Chỉnh sửa"
                                        onClick={() => setEditing(place)}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        className="small-btn"
                                        title={place.visible ? 'Ẩn' : 'Hiện'}
                                        onClick={() => toggle(place)}
                                    >
                                        {place.visible ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button
                                        className="small-btn danger-icon"
                                        title="Xóa"
                                        onClick={() => setDeleting(place)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <EmptyState text="Không tìm thấy địa điểm. Hãy thử từ khóa hoặc bộ lọc khác." />
                )}
            </section>
            {editing !== undefined && (
                <Modal
                    title={editing ? 'Chỉnh sửa địa điểm' : 'Thêm địa điểm mới'}
                    onClose={() => setEditing(undefined)}
                    wide
                >
                    <LocationForm original={editing} onClose={() => setEditing(undefined)} />
                </Modal>
            )}
            {details && (
                <Modal title="Chi tiết địa điểm" onClose={() => setDetails(null)}>
                    <div className="detail-banner">
                        <MediaImage place={details} />
                    </div>
                    <h3>{details.name}</h3>
                    <p>{details.enName}</p>
                    <p>
                        <b>Địa chỉ:</b> {details.address}
                    </p>
                    <p>
                        <b>Danh mục:</b>{' '}
                        {CATEGORIES.find((c) => c.value === details.category)?.label}
                    </p>
                    <p>
                        <b>Mô tả:</b> {details.summary || 'Chưa có'}
                    </p>
                    <p>
                        <b>Đường dẫn:</b> <code>/tham-quan/{details.slug}</code>
                    </p>
                    <p>
                        <b>Trạng thái:</b> {details.visible ? 'Đang hiển thị' : 'Đã ẩn'}
                    </p>
                </Modal>
            )}
            {deleting && (
                <ConfirmDialog
                    title={`Xóa ${deleting.name}?`}
                    text="Thao tác này xóa cả văn bản, ảnh, âm thanh và mục QR liên quan. Mã QR đã tải có thể dẫn đến trang không tồn tại."
                    onCancel={() => setDeleting(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </>
    );
}
