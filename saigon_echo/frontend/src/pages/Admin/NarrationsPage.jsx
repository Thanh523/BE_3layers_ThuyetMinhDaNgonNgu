// USE CASE: xem, thêm, sửa, xóa nội dung; quản lý bản thuyết minh của từng ngôn ngữ.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useDemoData, newId } from '../../contexts/DemoDataContext';
import {
    createNarration,
    deleteNarration,
    getNarrations,
    IS_DEMO,
    updateNarration,
} from '../../services/api';
import { LANGUAGE_OPTIONS } from '../../data/seed';
import PageHeader from '../../components/shared/PageHeader';
import PlacePicker from '../../components/shared/PlacePicker';
import Modal from '../../components/shared/Modal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import EmptyState from '../../components/shared/EmptyState';

function NarrationForm({ original, onClose, places, narrations, onCreate, onUpdate }) {
    const { data, add, update, notify } = useDemoData();
    const [locationId, setLocationId] = useState(original?.locationId || '');
    const [lang, setLang] = useState(original?.lang || 'vi');
    const [title, setTitle] = useState(
        original?.title || places.find((place) => place.id === original?.locationId)?.name || '',
    );
    const [summary, setSummary] = useState(original?.summary || '');
    const [text, setText] = useState(original?.text || '');
    const [visible, setVisible] = useState(original?.visible !== false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    // Mỗi cặp (địa điểm, ngôn ngữ) được tạo đúng một bài thuyết minh.
    const save = async (event) => {
        event.preventDefault();
        if (!locationId || !title.trim() || !text.trim()) {
            setError('Chọn địa điểm, nhập tiêu đề và nội dung thuyết minh.');
            return;
        }
        const duplicate = narrations.some(
            (item) =>
                item.locationId === locationId && item.lang === lang && item.id !== original?.id,
        );
        if (duplicate) {
            setError('Địa điểm đã có nội dung bằng ngôn ngữ này. Hãy chọn chức năng Sửa.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const changes = {
                title: title.trim(),
                summary: summary.trim(),
                text: text.trim(),
                visible,
            };
            if (!IS_DEMO && !original) {
                const result = await createNarration({ locationId, lang, ...changes });
                onCreate(result.narration);
            } else if (!IS_DEMO) {
                onUpdate(await updateNarration(original.id, changes));
            } else if (original) {
                update('narrations', original.id, { locationId, lang, ...changes });
            } else {
                add('narrations', { id: newId('narr'), locationId, lang, ...changes });
            }
            notify(original ? 'Đã cập nhật bài thuyết minh.' : 'Đã thêm bản thuyết minh.');
            onClose();
        } catch (saveError) {
            setError(saveError.message || 'Không thể lưu bài thuyết minh.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <form onSubmit={save}>
            <PlacePicker
                value={locationId}
                onChange={setLocationId}
                required
                places={places}
                disabled={Boolean(original)}
            />
            <label className="field">
                <span>Ngôn ngữ</span>
                <select
                    value={lang}
                    disabled={Boolean(original)}
                    onChange={(e) => setLang(e.target.value)}
                >
                    {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="field">
                <span>
                    Tiêu đề <b>*</b>
                </span>
                <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={200}
                    required
                    placeholder="Tên bài thuyết minh"
                />
            </label>
            <label className="field">
                <span>Tóm tắt</span>
                <textarea
                    rows={2}
                    maxLength={1000}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="Mô tả ngắn nội dung"
                />
            </label>
            <label className="field">
                <span>
                    Nội dung thuyết minh <b>*</b>
                </span>
                <textarea
                    className="narration-editor"
                    required
                    maxLength={15000}
                    rows={9}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Nhập nội dung người tham quan sẽ đọc..."
                />
            </label>
            <div className="editor-foot">
                <span>{text.length.toLocaleString('vi-VN')} / 15.000 ký tự</span>
                <span>Nội dung này sẽ hiển thị tại trang khách tham quan.</span>
            </div>
            <label className="checkbox-line">
                <input
                    type="checkbox"
                    checked={visible}
                    onChange={(event) => setVisible(event.target.checked)}
                />{' '}
                Hiển thị bài thuyết minh cho khách tham quan
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
                <button className="btn" type="button" onClick={onClose}>
                    Hủy
                </button>
                <button className="btn primary" type="submit" disabled={busy}>
                    {busy ? 'Đang lưu…' : original ? 'Lưu thay đổi' : 'Thêm nội dung'}
                </button>
            </div>
        </form>
    );
}

export default function NarrationsPage() {
    const { data, remove, notify } = useDemoData();
    const [databaseData, setDatabaseData] = useState(null);
    const [loading, setLoading] = useState(!IS_DEMO);
    const [loadError, setLoadError] = useState('');
    const [placeFilter, setPlaceFilter] = useState('');
    const [langFilter, setLangFilter] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(undefined);
    const [deleting, setDeleting] = useState(null);
    const [reading, setReading] = useState(null);
    const [actionError, setActionError] = useState('');
    const [busyActionId, setBusyActionId] = useState(null);
    const [migrating, setMigrating] = useState(false);
    const [migrationResult, setMigrationResult] = useState('');
    const loadDatabaseData = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const result = await getNarrations();
            if (
                result &&
                (!Array.isArray(result.places) ||
                    !Array.isArray(result.narrations) ||
                    result.places.some(
                        (place) => typeof place.id !== 'string' || typeof place.name !== 'string',
                    ) ||
                    result.narrations.some(
                        (item) =>
                            typeof item.id !== 'string' ||
                            typeof item.locationId !== 'string' ||
                            typeof item.lang !== 'string' ||
                            typeof item.text !== 'string' ||
                            typeof item.title !== 'string' ||
                            typeof item.visible !== 'boolean',
                    ))
            )
                throw new Error('Dữ liệu thuyết minh từ backend không đúng cấu trúc.');
            setDatabaseData(result);
        } catch (error) {
            setLoadError(error.message || 'Không thể tải nội dung thuyết minh.');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        if (!IS_DEMO) loadDatabaseData();
    }, [loadDatabaseData]);
    const places = databaseData?.places || data.locations;
    const narrations = databaseData?.narrations || data.narrations;
    const rows = useMemo(
        () =>
            narrations.filter((item) => {
                const place = places.find((p) => p.id === item.locationId);
                return (
                    (!placeFilter || item.locationId === placeFilter) &&
                    (!langFilter || item.lang === langFilter) &&
                    `${place?.name || ''} ${item.text}`.toLowerCase().includes(search.toLowerCase())
                );
            }),
        [narrations, places, placeFilter, langFilter, search],
    );
    const getPlace = (id) => places.find((place) => place.id === id)?.name || '(Đã xóa địa điểm)';
    const getLang = (id) => LANGUAGE_OPTIONS.find((lang) => lang.value === id)?.label || id;
    const addToDatabase = (narration) =>
        setDatabaseData((current) => ({
            ...current,
            narrations: [...current.narrations, narration],
        }));
    const updateDatabaseNarration = (narration) =>
        setDatabaseData((current) => ({
            ...current,
            narrations: current.narrations.map((item) =>
                item.id === narration.id ? narration : item,
            ),
        }));
    const doDelete = async () => {
        setActionError('');
        try {
            if (IS_DEMO) remove('narrations', deleting.id);
            else {
                await deleteNarration(deleting.id);
                setDatabaseData((current) => ({
                    ...current,
                    narrations: current.narrations.filter((item) => item.id !== deleting.id),
                }));
            }
            setDeleting(null);
            notify('Đã xóa bài thuyết minh.');
        } catch (error) {
            setActionError(error.message || 'Không thể xóa bài thuyết minh.');
            setDeleting(null);
        }
    };
    const toggleVisibility = async (item) => {
        if (busyActionId) return;
        setActionError('');
        setBusyActionId(item.id);
        const changes = {
            title: item.title || getPlace(item.locationId),
            summary: item.summary || '',
            text: item.text,
            visible: item.visible === false,
        };
        try {
            if (IS_DEMO) update('narrations', item.id, changes);
            else updateDatabaseNarration(await updateNarration(item.id, changes));
            notify(changes.visible ? 'Đã hiển thị bài thuyết minh.' : 'Đã ẩn bài thuyết minh.');
        } catch (error) {
            setActionError(error.message || 'Không thể cập nhật trạng thái bài thuyết minh.');
        } finally {
            setBusyActionId(null);
        }
    };
    const migrateDemoNarrations = async () => {
        if (migrating || !databaseData) return;
        setMigrating(true);
        setMigrationResult('');
        setActionError('');
        const imported = [];
        const failures = [];
        let skipped = 0;
        const existingKeys = new Set(
            databaseData.narrations.map((item) => `${item.locationId}\u0000${item.lang}`),
        );
        for (const item of data.narrations) {
            const localPlace = data.locations.find((place) => place.id === item.locationId);
            const backendPlace = databaseData.places.find(
                (place) =>
                    place.id === item.locationId ||
                    (localPlace?.slug && place.id === localPlace.slug),
            );
            if (!backendPlace || typeof item.text !== 'string' || !item.text.trim()) {
                skipped += 1;
                continue;
            }
            const key = `${backendPlace.id}\u0000${item.lang}`;
            if (existingKeys.has(key)) {
                skipped += 1;
                continue;
            }
            try {
                const result = await createNarration({
                    locationId: backendPlace.id,
                    lang: item.lang,
                    title: item.title || backendPlace.name,
                    summary: item.summary || '',
                    text: item.text.trim(),
                    visible: item.visible !== false,
                });
                imported.push(result.narration);
                existingKeys.add(key);
            } catch (error) {
                failures.push(error.message || 'Lỗi không xác định khi nhập bài thuyết minh.');
            }
        }
        if (imported.length) {
            setDatabaseData((current) => ({
                ...current,
                narrations: [...current.narrations, ...imported],
            }));
        }
        setMigrationResult(
            `Đã chuyển ${imported.length} bài; bỏ qua ${skipped} bài không khớp địa điểm hoặc đã tồn tại.`,
        );
        if (failures.length) {
            setActionError(
                `${failures.length} bài không chuyển được. Lỗi đầu tiên: ${failures[0]}`,
            );
        }
        setMigrating(false);
    };

    return (
        <>
            <PageHeader
                kicker="NỘI DUNG / 02"
                title="Nội dung thuyết minh"
                description="Biên tập những câu chuyện bằng tiếng Việt và các ngôn ngữ khác."
                action={
                    <button
                        className="btn primary"
                        onClick={() => setEditing(null)}
                        disabled={loading || (!IS_DEMO && !places.length)}
                    >
                        <Plus size={17} /> Thêm nội dung
                    </button>
                }
            />
            {!IS_DEMO && (
                <div className="feature-note">
                    <FileText size={20} />
                    <div>
                        <strong>Dữ liệu từ database</strong>
                        <p>
                            Nội dung được lưu trong SQL Server; có thể thêm, sửa, xóa và ẩn/hiện bài
                            thuyết minh.
                        </p>
                        <p>
                            Có thể nhập các bài demo vào địa điểm backend trùng ID hoặc slug. Những
                            địa điểm/ảnh/âm thanh/QR chưa có API tương ứng sẽ không được chuyển.
                        </p>
                        <button
                            className="btn"
                            disabled={loading || migrating || !databaseData || !data.narrations.length}
                            onClick={migrateDemoNarrations}
                            type="button"
                        >
                            {migrating ? 'Đang chuyển dữ liệu...' : 'Chuyển bài demo lên backend'}
                        </button>
                        {migrationResult && <p role="status">{migrationResult}</p>}
                    </div>
                </div>
            )}
            {loadError && (
                <div className="error-box" role="alert">
                    {loadError}
                </div>
            )}
            {actionError && (
                <div className="error-box" role="alert">
                    {actionError}
                </div>
            )}
            <div className="feature-note">
                <FileText size={20} />
                <div>
                    <strong>Thuyết minh đa ngôn ngữ</strong>
                    <p>Mỗi địa điểm có thể có một bản nội dung cho từng ngôn ngữ (VI, EN, JA).</p>
                </div>
            </div>
            <section className="panel">
                <div className="filter-row multi">
                    <label className="search-field">
                        <Search size={17} />
                        <input
                            placeholder="Tìm bài thuyết minh..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <PlacePicker
                        value={placeFilter}
                        onChange={setPlaceFilter}
                        all
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
                </div>
                {loading ? (
                    <EmptyState text="Đang tải nội dung thuyết minh từ database…" />
                ) : loadError ? null : rows.length ? (
                    <div className="narration-list">
                        {rows.map((item) => (
                            <article className="narration-row" key={item.id}>
                                <div className="lang-marker">{item.lang.toUpperCase()}</div>
                                <div className="narration-content">
                                    <strong>{getPlace(item.locationId)}</strong>
                                    <span>{getLang(item.lang)}</span>
                                    {item.title && <p>{item.title}</p>}
                                    <p>{item.text}</p>
                                </div>
                                <span
                                    className={`status-pill ${item.visible === false ? 'neutral' : 'success'}`}
                                >
                                    {item.visible === false ? 'Đã ẩn' : 'Đang hiển thị'}
                                </span>
                                <div className="table-actions">
                                    <button
                                        className="small-btn"
                                        title="Xem"
                                        onClick={() => setReading(item)}
                                    >
                                        <FileText size={16} />
                                    </button>
                                    <button
                                        className="small-btn"
                                        title="Sửa"
                                        onClick={() => setEditing(item)}
                                        disabled={busyActionId === item.id}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        className="small-btn"
                                        title={item.visible === false ? 'Hiện' : 'Ẩn'}
                                        onClick={() => toggleVisibility(item)}
                                        disabled={busyActionId === item.id}
                                    >
                                        {item.visible === false ? (
                                            <Eye size={16} />
                                        ) : (
                                            <EyeOff size={16} />
                                        )}
                                    </button>
                                    <button
                                        className="small-btn danger-icon"
                                        title="Xóa"
                                        onClick={() => setDeleting(item)}
                                        disabled={busyActionId === item.id}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <EmptyState text="Chưa có nội dung với điều kiện đã chọn." />
                )}
            </section>
            {editing !== undefined && (
                <Modal
                    wide
                    title={editing ? 'Chỉnh sửa nội dung' : 'Thêm bài thuyết minh'}
                    onClose={() => setEditing(undefined)}
                >
                    <NarrationForm
                        original={editing}
                        onClose={() => setEditing(undefined)}
                        places={places}
                        narrations={narrations}
                        onCreate={addToDatabase}
                        onUpdate={updateDatabaseNarration}
                    />
                </Modal>
            )}
            {reading && (
                <Modal
                    title={`${getPlace(reading.locationId)} · ${getLang(reading.lang)}`}
                    onClose={() => setReading(null)}
                >
                    <h3>{reading.title}</h3>
                    {reading.summary && <p>{reading.summary}</p>}
                    <p className="reading-text">{reading.text}</p>
                </Modal>
            )}
            {deleting && (
                <ConfirmDialog
                    title="Xóa nội dung thuyết minh?"
                    text={`“${deleting.title || getPlace(deleting.locationId)}” sẽ bị xóa. Nếu bài đang được âm thanh hoặc lịch sử sử dụng tham chiếu, hệ thống sẽ từ chối xóa để bảo toàn dữ liệu.`}
                    onCancel={() => setDeleting(null)}
                    onConfirm={doDelete}
                />
            )}
        </>
    );
}
