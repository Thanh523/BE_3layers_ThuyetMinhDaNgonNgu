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
import { IS_DEMO } from '../../services/api';
import { createAdminImage, deleteAdminImage, getAdminImages, updateAdminImage, uploadAdminMedia } from '../../services/adminContent';
import { getAdminPlaces } from '../../services/places';

function ImageForm({ original, onClose, places, images, database, onSaved }) {
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
            if (database) {
                if (!file) throw new Error('Hãy chọn ảnh mới để thay thế ảnh hiện tại.');
                const { fileUrl } = await uploadAdminMedia(file, 'image');
                if (original) {
                    await updateAdminImage(original.id, { fileUrl, sortOrder: original.order });
                } else {
                    const existing = images.filter((item) => item.locationId === locationId);
                    await createAdminImage({
                        locationId,
                        fileUrl,
                        sortOrder: existing.reduce((max, item) => Math.max(max, item.order), 0) + 1,
                    });
                }
                notify(original ? 'Đã thay ảnh trong database.' : 'Đã lưu ảnh vào database.');
                await onSaved();
                onClose();
                return;
            }
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
        } catch (saveError) {
            setError(saveError.message || 'Không lưu được ảnh. Kiểm tra kết nối backend và quyền lưu trữ.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <form onSubmit={save}>
            <PlacePicker required disabled={database && Boolean(original)} places={places} value={locationId} onChange={setLocationId} />
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
            {!database && <label className="field">
                <span>Chú thích</span>
                <input
                    maxLength={180}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="VD: Mặt tiền công trình"
                />
            </label>}
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
    const [databaseImages, setDatabaseImages] = useState(null);
    const [databasePlaces, setDatabasePlaces] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [loading, setLoading] = useState(!IS_DEMO);
    const [filter, setFilter] = useState('');
    const [editing, setEditing] = useState(undefined);
    const [deleting, setDeleting] = useState(null);
    const [preview, setPreview] = useState(null);
    const loadDatabaseImages = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [images, places] = await Promise.all([getAdminImages(), getAdminPlaces()]);
            const sortedImages = images.slice().sort((a, b) =>
                a.locationId.localeCompare(b.locationId) || a.order - b.order,
            );
            const coverLocations = new Set();
            for (const image of sortedImages) {
                image.isCover = !coverLocations.has(image.locationId);
                coverLocations.add(image.locationId);
            }
            setDatabaseImages(sortedImages);
            setDatabasePlaces(places);
        } catch (error) {
            setLoadError(error.message || 'Không thể tải hình ảnh từ database.');
        } finally {
            setLoading(false);
        }
    };
    React.useEffect(() => {
        if (!IS_DEMO) loadDatabaseImages();
    }, []);
    const images = IS_DEMO ? data.images : databaseImages || [];
    const places = IS_DEMO ? data.locations : databasePlaces || [];
    const items = useMemo(
        () =>
            images
                .filter((item) => !filter || item.locationId === filter)
                .sort((a, b) => a.locationId.localeCompare(b.locationId) || a.order - b.order),
        [images, filter],
    );
    const placeOf = (item) => places.find((p) => p.id === item.locationId);
    const deleteSelected = async () => {
        const old = deleting;
        if (!IS_DEMO) {
            try {
                await deleteAdminImage(old.id);
                await loadDatabaseImages();
            } catch (error) {
                notify(error.message || 'Không thể xóa hình ảnh.');
                return;
            }
        } else {
            await removeMedia('images', old.id);
        }
        if (old.isCover) {
            const next = images
                .filter((i) => i.locationId === old.locationId && i.id !== old.id)
                .sort((a, b) => a.order - b.order)[0];
            if (next && IS_DEMO) setCover(old.locationId, next.id);
        }
        setDeleting(null);
        notify('Đã xóa hình ảnh.');
    };
    const setDatabaseOrder = async (group) => {
        try {
            for (const [index, image] of group.entries()) {
                await updateAdminImage(image.id, { sortOrder: index + 1 });
            }
            await loadDatabaseImages();
            return true;
        } catch (error) {
            notify(error.message || 'Không thể sắp xếp hình ảnh.');
            return false;
        }
    };
    const moveDatabaseImage = (image, direction) => {
        const group = images
            .filter((item) => item.locationId === image.locationId)
            .sort((a, b) => a.order - b.order);
        const index = group.findIndex((item) => item.id === image.id);
        const target = index + direction;
        if (target < 0 || target >= group.length) return;
        [group[index], group[target]] = [group[target], group[index]];
        void setDatabaseOrder(group);
    };
    const makeDatabaseCover = (image) => {
        const group = images
            .filter((item) => item.locationId === image.locationId && item.id !== image.id)
            .sort((a, b) => a.order - b.order);
        return setDatabaseOrder([image, ...group]);
    };

    return (
        <>
            <PageHeader
                kicker="TƯ LIỆU / 03"
                title="Quản lý hình ảnh"
                description="Sắp xếp hình ảnh và lưu lại những góc nhìn về Sài Gòn."
                action={
                    <button className="btn primary" onClick={() => setEditing(null)} disabled={loading}>
                        <Plus size={17} /> Thêm hình ảnh
                    </button>
                }
            />
            <div className="feature-note">
                <ImagePlus size={20} />
                <div>
                    <strong>Thư viện hình ảnh</strong>
                    <p>
                        Ảnh đã tải lên sẽ được lưu trên máy chủ và liên kết với địa điểm trong database.
                    </p>
                </div>
            </div>
            <div className="image-toolbar">
                <PlacePicker all places={places} value={filter} onChange={setFilter} />
                <span className="count-text">{items.length} hình ảnh</span>
            </div>
            {loadError && <p className="error-text" role="alert">{loadError}</p>}
            {loading ? <EmptyState text="Đang tải hình ảnh từ database…" /> : null}
            {!loading && items.length ? (
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
                                    <h3>{item.caption || item.fileUrl?.split('/').pop() || 'Chưa có chú thích'}</h3>
                                    <div className="media-card-actions">
                                        <button
                                            className="small-btn"
                                            onClick={() => IS_DEMO ? moveImage(item.id, -1) : moveDatabaseImage(item, -1)}
                                            title="Đưa lên trước"
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                        <button
                                            className="small-btn"
                                            onClick={() => IS_DEMO ? moveImage(item.id, 1) : moveDatabaseImage(item, 1)}
                                            title="Đưa xuống sau"
                                        >
                                            <ArrowDown size={16} />
                                        </button>
                                        <button
                                            className={`small-btn ${item.isCover ? 'selected-icon' : ''}`}
                                            title="Đặt ảnh đại diện"
                                            onClick={async () => {
                                                if (IS_DEMO) {
                                                    setCover(item.locationId, item.id);
                                                    notify('Đã đặt ảnh đại diện.');
                                                } else if (await makeDatabaseCover(item)) {
                                                    notify('Đã đặt ảnh đại diện.');
                                                }
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
            ) : !loading && !loadError ? (
                <EmptyState text="Địa điểm này chưa có hình ảnh." />
            ) : null}
            {editing !== undefined && (
                <Modal
                    title={editing ? 'Chỉnh sửa hình ảnh' : 'Tải hình ảnh lên'}
                    onClose={() => setEditing(undefined)}
                >
                    <ImageForm
                        original={editing}
                        onClose={() => setEditing(undefined)}
                        places={places}
                        images={images}
                        database={!IS_DEMO}
                        onSaved={loadDatabaseImages}
                    />
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
                    text={`Hình ảnh “${deleting.caption || deleting.fileUrl?.split('/').pop() || 'Không có chú thích'}” sẽ bị xóa khỏi ${IS_DEMO ? 'dữ liệu demo' : 'database'}.`}
                    onCancel={() => setDeleting(null)}
                    onConfirm={deleteSelected}
                />
            )}
        </>
    );
}
