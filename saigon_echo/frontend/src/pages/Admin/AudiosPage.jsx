// USE CASE: xem âm thanh, tải file, kiểm tra loại/dung lượng, gán bài thuyết minh,
// nghe thử, thay thế bản thu, sửa thông tin và xóa âm thanh.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Headphones, Pencil, Plus, Repeat2, Trash2, Volume2 } from 'lucide-react';
import { LANGUAGE_OPTIONS } from '../../data/seed';
import { useDemoData, newId } from '../../contexts/DemoDataContext';
import { getNarrations, IS_DEMO } from '../../services/api';
import { putFile, validateFile, deleteFile } from '../../services/fileStore';
import useFileUrl from '../../hooks/useFileUrl';
import PageHeader from '../../components/shared/PageHeader';
import PlacePicker from '../../components/shared/PlacePicker';
import Modal from '../../components/shared/Modal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import EmptyState from '../../components/shared/EmptyState';

function AudioPlayer({ fileId }) {
    // HTML5 audio điều khiển thật với tệp lấy từ IndexedDB.
    const url = useFileUrl(fileId);
    return url ? (
        <audio controls preload="metadata" src={url} className="full-audio">
            Trình duyệt không hỗ trợ audio.
        </audio>
    ) : (
        <p className="helper">
            {fileId ? 'Đang tải âm thanh hoặc không tìm thấy tệp...' : 'Chưa có tệp âm thanh.'}
        </p>
    );
}

function AudioForm({ original, onClose, narrations, places }) {
    const { data, add, update, notify } = useDemoData();
    const [narrationId, setNarrationId] = useState(
        original?.narrationId ||
            narrations.find(
                (item) => item.locationId === original?.locationId && item.lang === original?.lang,
            )?.id ||
            '',
    );
    const [title, setTitle] = useState(original?.title || '');
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const fileInput = useRef(null);
    const selectedNarration = narrations.find((item) => item.id === narrationId);
    const choose = (file) => {
        try {
            validateFile(file, 'audio');
            setFile(file);
            setError('');
        } catch (e) {
            setFile(null);
            setError(e.message);
        }
    };

    const save = async (event) => {
        event.preventDefault();
        if (!selectedNarration || (!original && !file)) {
            setError('Hãy chọn bài thuyết minh và tệp âm thanh.');
            return;
        }
        if (
            data.audios.some(
                (audio) =>
                    audio.id !== original?.id &&
                    (audio.narrationId === narrationId ||
                        (!audio.narrationId &&
                            audio.locationId === selectedNarration.locationId &&
                            audio.lang === selectedNarration.lang)),
            )
        ) {
            setError('Bài thuyết minh đã có âm thanh. Hãy dùng chức năng Thay thế.');
            return;
        }
        setBusy(true);
        let fileId;
        try {
            if (file) {
                fileId = newId('audiofile');
                await putFile(fileId, file);
            }
            if (original) {
                update('audios', original.id, {
                    locationId: selectedNarration.locationId,
                    narrationId,
                    lang: selectedNarration.lang,
                    title: title.trim() || file?.name || original.title,
                    ...(fileId ? { fileId } : {}),
                });
                if (fileId && original.fileId) await deleteFile(original.fileId).catch(() => {});
            } else
                add('audios', {
                    id: newId('audio'),
                    fileId,
                    locationId: selectedNarration.locationId,
                    narrationId,
                    lang: selectedNarration.lang,
                    title: title.trim() || file.name,
                    createdAt: new Date().toISOString(),
                });
            notify(original ? 'Đã cập nhật/thay thế âm thanh.' : 'Đã thêm bản thu âm thanh.');
            onClose();
        } catch {
            setError('Không lưu được tệp âm thanh. Hãy kiểm tra bộ nhớ trình duyệt.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={save}>
            <label className="field">
                <span>
                    Bài thuyết minh <b>*</b>
                </span>
                <select
                    value={narrationId}
                    required
                    onChange={(event) => setNarrationId(event.target.value)}
                >
                    <option value="">Chọn bài thuyết minh</option>
                    {narrations.map((item) => (
                        <option value={item.id} key={item.id}>
                            {item.placeName ||
                                places.find((place) => place.id === item.locationId)?.name ||
                                item.locationId}{' '}
                            ·{' '}
                            {LANGUAGE_OPTIONS.find((option) => option.value === item.lang)?.label ||
                                item.lang}
                        </option>
                    ))}
                </select>
            </label>
            {selectedNarration && (
                <div className="audio-panel">
                    <strong>Nội dung thuyết minh</strong>
                    <p>{selectedNarration.text}</p>
                </div>
            )}
            <label className="field">
                <span>Tên bản thu</span>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={150}
                    placeholder="VD: Lịch sử Dinh Độc Lập - VI"
                />
            </label>
            <label className="field">
                <span>
                    {original ? 'Thay thế tệp âm thanh (không bắt buộc)' : 'Tệp âm thanh *'}
                </span>
                <input
                    ref={fileInput}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,.m4a"
                    onChange={(e) => choose(e.target.files?.[0])}
                />
                <small>MP3, WAV, OGG, M4A · tối đa 20 MB</small>
            </label>
            {file && (
                <p className="file-choice">
                    <Headphones size={16} /> Đã chọn: {file.name} ·{' '}
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
            )}
            {original && (
                <div className="audio-panel">
                    <strong>Nghe thử bản hiện tại</strong>
                    <AudioPlayer fileId={original.fileId} />
                </div>
            )}
            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
                <button type="button" className="btn" onClick={onClose}>
                    Hủy
                </button>
                <button type="submit" disabled={busy} className="btn primary">
                    {busy ? 'Đang lưu...' : original ? 'Lưu / Thay thế' : 'Thêm âm thanh'}
                </button>
            </div>
        </form>
    );
}

export default function AudiosPage() {
    const { data, removeMedia, notify } = useDemoData();
    const [databaseData, setDatabaseData] = useState(null);
    const [narrationsLoading, setNarrationsLoading] = useState(!IS_DEMO);
    const [narrationsError, setNarrationsError] = useState('');
    const [placeFilter, setPlaceFilter] = useState('');
    const [langFilter, setLangFilter] = useState('');
    const [editing, setEditing] = useState(undefined);
    const [deleting, setDeleting] = useState(null);
    const loadNarrations = useCallback(async () => {
        if (IS_DEMO) return;
        setNarrationsLoading(true);
        setNarrationsError('');
        try {
            const result = await getNarrations();
            if (!result || !Array.isArray(result.places) || !Array.isArray(result.narrations)) {
                throw new Error('Dữ liệu thuyết minh từ backend không đúng cấu trúc.');
            }
            const placeNames = new Map(result.places.map((place) => [place.id, place.name]));
            setDatabaseData({
                places: result.places,
                narrations: result.narrations.map((item) => ({
                    ...item,
                    placeName: placeNames.get(item.locationId) || item.locationId,
                })),
            });
        } catch (error) {
            setNarrationsError(error.message || 'Không thể tải danh sách bài thuyết minh.');
        } finally {
            setNarrationsLoading(false);
        }
    }, []);
    useEffect(() => {
        loadNarrations();
    }, [loadNarrations]);
    const narrations = databaseData?.narrations || data.narrations;
    const places = databaseData?.places || data.locations;
    const filtered = useMemo(
        () =>
            data.audios.filter(
                (item) =>
                    (!placeFilter || item.locationId === placeFilter) &&
                    (!langFilter || item.lang === langFilter),
            ),
        [data.audios, placeFilter, langFilter],
    );
    const getPlace = (item) =>
        places.find((place) => place.id === item.locationId)?.name || '(Không có địa điểm)';
    const getLang = (value) => LANGUAGE_OPTIONS.find((x) => x.value === value)?.label || value;
    const del = async () => {
        await removeMedia('audios', deleting.id);
        setDeleting(null);
        notify('Đã xóa âm thanh.');
    };

    return (
        <>
            <PageHeader
                kicker="TƯ LIỆU / 04"
                title="Quản lý âm thanh"
                description="Thư viện bản thu đa ngôn ngữ cho từng điểm tham quan."
                action={
                    <button
                        className="btn primary"
                        onClick={() => setEditing(null)}
                        disabled={narrationsLoading || !narrations.length}
                    >
                        <Plus size={17} /> Tải âm thanh lên
                    </button>
                }
            />
            <div className="feature-note">
                <Volume2 size={20} />
                <div>
                    <strong>Âm thanh theo ngôn ngữ</strong>
                    <p>Mỗi bài thuyết minh có thể gắn với một bản thu âm thanh.</p>
                </div>
            </div>
            <section className="panel">
                <div className="filter-row multi">
                    <PlacePicker
                        all
                        value={placeFilter}
                        onChange={setPlaceFilter}
                        places={places}
                    />
                    <label className="field inline-filter">
                        <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)}>
                            <option value="">Tất cả ngôn ngữ</option>
                            {LANGUAGE_OPTIONS.map((l) => (
                                <option key={l.value} value={l.value}>
                                    {l.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <span className="count-text">{filtered.length} bản thu</span>
                </div>
                {narrationsError && (
                    <div className="error-box" role="alert">
                        {narrationsError}
                    </div>
                )}
                {!IS_DEMO && (
                    <div className="status-line">
                        <span>
                            Danh sách bài thuyết minh dùng để gán âm thanh
                            {narrationsLoading ? ' · Đang tải…' : ''}
                        </span>
                        <button
                            className="text-link"
                            onClick={loadNarrations}
                            disabled={narrationsLoading}
                        >
                            Tải lại bài thuyết minh
                        </button>
                    </div>
                )}
                {filtered.length ? (
                    <div className="audio-list">
                        {filtered.map((item) => (
                            <article className="audio-entry" key={item.id}>
                                <div className="audio-entry-top">
                                    <div className="audio-disc">
                                        <AudioLines size={22} />
                                    </div>
                                    <div className="audio-label">
                                        <strong>{item.title}</strong>
                                        <p>
                                            {getPlace(item)} <span>·</span> {getLang(item.lang)}
                                        </p>
                                    </div>
                                    <span className="lang-chip">{item.lang.toUpperCase()}</span>
                                </div>
                                <AudioPlayer fileId={item.fileId} />
                                <div className="audio-buttons">
                                    <button className="btn small" onClick={() => setEditing(item)}>
                                        <Pencil size={15} /> Chỉnh sửa
                                    </button>
                                    <button className="btn small" onClick={() => setEditing(item)}>
                                        <Repeat2 size={15} /> Thay thế tệp
                                    </button>
                                    <button
                                        className="btn small danger-text"
                                        onClick={() => setDeleting(item)}
                                    >
                                        <Trash2 size={15} /> Xóa
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <EmptyState text="Chưa có tệp âm thanh. Tải MP3 hoặc một định dạng được hỗ trợ để nghe thử." />
                )}
            </section>
            {editing !== undefined && (
                <Modal
                    title={editing ? 'Chỉnh sửa / thay thế âm thanh' : 'Tải tệp âm thanh lên'}
                    onClose={() => setEditing(undefined)}
                >
                    <AudioForm
                        original={editing}
                        onClose={() => setEditing(undefined)}
                        narrations={narrations}
                        places={places}
                    />
                </Modal>
            )}
            {deleting && (
                <ConfirmDialog
                    title="Xóa bản ghi âm thanh?"
                    text={`Bản thu “${deleting.title}” sẽ bị xóa khỏi trình duyệt demo.`}
                    onCancel={() => setDeleting(null)}
                    onConfirm={del}
                />
            )}
        </>
    );
}
