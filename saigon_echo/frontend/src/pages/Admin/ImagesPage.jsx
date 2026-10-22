// USE CASE: xem ảnh theo địa điểm, tải ảnh, xem trước, sắp xếp, sửa chú thích, xóa ảnh.
import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useDemoData, newId } from '../../contexts/DemoDataContext';
import { putFile, validateFile, deleteFile } from '../../services/fileStore';
import PageHeader from '../../components/shared/PageHeader';
import PlacePicker from '../../components/shared/PlacePicker';
import Modal from '../../components/shared/Modal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import EmptyState from '../../components/shared/EmptyState';
import MediaImage from '../../components/shared/MediaImage';

function ImageForm({ original, onClose }) {
    const { data, add, update, notify, setCover } = useDemoData();
    const [locationId, setLocationId] = useState(original?.locationId || '');
    const [caption, setCaption] = useState(original?.caption || '');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    // URL tạm để người dùng nhìn được file ngay sau khi chọn, chưa cần upload server.
    const chooseFile = (chosen) => {
        if (preview) URL.revokeObjectURL(preview);
        try {
            validateFile(chosen, 'image');
            setFile(chosen);
            setPreview(URL.createObjectURL(chosen));
            setError('');
        } catch (e) {
            setFile(null);
            setPreview('');
            setError(e.message);
        }
    };
    const save = async (event) => {
        event.preventDefault();
        if (!locationId || (!file && !original)) {
            setError('Hãy chọn địa điểm và một tệp ảnh.');
            return;
        }
        setBusy(true);
        let fileId;
        try {
            if (file) {
                fileId = newId('file');
                await putFile(fileId, file);
            }
            if (original) {
                update('images', original.id, {
                    caption,
                    locationId,
                    ...(fileId ? { fileId } : {}),
                });
                // Khi thay ảnh, xóa blob cũ để không chiếm thêm bộ nhớ trình duyệt.
                if (fileId && original.fileId) await deleteFile(original.fileId).catch(() => {});
            } else {
                const existing = data.images.filter((item) => item.locationId === locationId);
                const id = newId('img');
                add('images', {
                    id,
                    locationId,
                    caption,
                    fileId,
                    order: existing.length,
                    isCover: existing.length === 0,
                    createdAt: new Date().toISOString(),
                });
            }
            notify(original ? 'Đã cập nhật hình ảnh.' : 'Đã tải và lưu hình ảnh vào trình duyệt.');
            if (preview) URL.revokeObjectURL(preview);
            onClose();
        } catch {
            setError('Không lưu được ảnh. Kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <form onSubmit={save}>
            <PlacePicker required value={locationId} onChange={setLocationId} />
            <label className="field">
                <span>Tệp hình ảnh {original ? '(có thể để trống để giữ ảnh cũ)' : '*'}</span>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => chooseFile(e.target.files?.[0])}
                />
                <small>JPEG / PNG / WebP · tối đa 8 MB</small>
            </label>
            {preview && (
                <div className="upload-preview">
                    <img src={preview} alt="Xem trước hình ảnh vừa chọn" />
                </div>
            )}
            {original && !preview && (
                <div className="upload-preview">
                    <MediaImage
                        image={original}
                        place={data.locations.find((p) => p.id === locationId)}
                    />
                </div>
            )}
            <label className="field">
                <span>Chú thích</span>
                <input
                    maxLength={180}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="VD: Mặt tiền công trình"
                />
            </label>
            {error && (
                <p className="error-text" role="alert">
                    {error}
                </p>
            )}
            <div className="form-actions">
                <button type="button" className="btn" onClick={onClose}>
                    Hủy
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                    {busy ? 'Đang lưu...' : 'Lưu hình ảnh'}
                </button>
            </div>
        </form>
    );
}

export default function ImagesPage() {
    const { data, setCover, moveImage, removeMedia, notify } = useDemoData();
    const [filter, setFilter] = useState('');
    const [editing, setEditing] = useState(undefined);
    const [deleting, setDeleting] = useState(null);
    const [preview, setPreview] = useState(null);
    const items = useMemo(
        () =>
            data.images
                .filter((item) => !filter || item.locationId === filter)
                .sort((a, b) => a.locationId.localeCompare(b.locationId) || a.order - b.order),
        [data.images, filter],
    );
    const placeOf = (item) => data.locations.find((p) => p.id === item.locationId);
    const deleteSelected = async () => {
        const old = deleting;
        await removeMedia('images', old.id);
        if (old.isCover) {
            const next = data.images
                .filter((i) => i.locationId === old.locationId && i.id !== old.id)
                .sort((a, b) => a.order - b.order)[0];
            if (next) setCover(old.locationId, next.id);
        }
        setDeleting(null);
        notify('Đã xóa hình ảnh.');
    };

    return (
        <>
            <PageHeader
                kicker="TƯ LIỆU / 03"
                title="Quản lý hình ảnh"
                description="Sắp xếp hình ảnh và lưu lại những góc nhìn về Sài Gòn."
                action={
                    <button className="btn primary" onClick={() => setEditing(null)}>
                        <Plus size={17} /> Thêm hình ảnh
                    </button>
                }
            />
            <div className="feature-note">
                <ImagePlus size={20} />
                <div>
                    <strong>Thư viện hình ảnh</strong>
                    <p>
                        Những ảnh SVG có sẵn là minh họa từ giao diện demo; bạn có thể tải ảnh của
                        mình lên để thay thế.
                    </p>
                </div>
            </div>
            <div className="image-toolbar">
                <PlacePicker all value={filter} onChange={setFilter} />
                <span className="count-text">{items.length} hình ảnh</span>
            </div>
            {items.length ? (
                <div className="media-grid">
                    {items.map((item, index) => {
                        const place = placeOf(item);
                        return (
                            <article className="media-card" key={item.id}>
                                <button
                                    className="media-card-picture"
                                    onClick={() => setPreview(item)}
                                    title="Xem trước ảnh"
                                >
                                    <MediaImage image={item} place={place} />
                                    {item.isCover && (
                                        <span className="cover-tag">★ Ảnh đại diện</span>
                                    )}
                                </button>
                                <div className="media-card-body">
                                    <span className="mini-kicker">
                                        {place?.name || 'Không rõ địa điểm'}
                                    </span>
                                    <h3>{item.caption || 'Chưa có chú thích'}</h3>
                                    <div className="media-card-actions">
                                        <button
                                            className="small-btn"
                                            onClick={() => moveImage(item.id, -1)}
                                            title="Đưa lên trước"
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                        <button
                                            className="small-btn"
                                            onClick={() => moveImage(item.id, 1)}
                                            title="Đưa xuống sau"
                                        >
                                            <ArrowDown size={16} />
                                        </button>
                                        <button
                                            className={`small-btn ${item.isCover ? 'selected-icon' : ''}`}
                                            title="Đặt ảnh đại diện"
                                            onClick={() => {
                                                setCover(item.locationId, item.id);
                                                notify('Đã đặt ảnh đại diện.');
                                            }}
                                        >
                                            <Star size={16} />
                                        </button>
                                        <button
                                            className="small-btn"
                                            title="Sửa"
                                            onClick={() => setEditing(item)}
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            className="small-btn danger-icon"
                                            title="Xóa"
                                            onClick={() => setDeleting(item)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <EmptyState text="Địa điểm này chưa có hình ảnh." />
            )}
            {editing !== undefined && (
                <Modal
                    title={editing ? 'Chỉnh sửa hình ảnh' : 'Tải hình ảnh lên'}
                    onClose={() => setEditing(undefined)}
                >
                    <ImageForm original={editing} onClose={() => setEditing(undefined)} />
                </Modal>
            )}
            {preview && (
                <Modal
                    title={preview.caption || 'Xem trước hình ảnh'}
                    onClose={() => setPreview(null)}
                    wide
                >
                    <div className="preview-big">
                        <MediaImage image={preview} place={placeOf(preview)} />
                    </div>
                    <p className="helper">{placeOf(preview)?.name}</p>
                </Modal>
            )}
            {deleting && (
                <ConfirmDialog
                    title="Xóa hình ảnh?"
                    text={`Hình ảnh “${deleting.caption || 'Không có chú thích'}” sẽ bị xóa khỏi dữ liệu demo.`}
                    onCancel={() => setDeleting(null)}
                    onConfirm={deleteSelected}
                />
            )}
        </>
    );
}
