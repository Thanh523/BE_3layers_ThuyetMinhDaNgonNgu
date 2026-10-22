// USE CASE: xem danh sách QR, chọn địa điểm, tạo mã, xem trước, tải PNG, in và xóa mục QR.
// Mỗi QR trỏ đến /tham-quan/:slug; cập nhật bài thuyết minh không làm đổi đường dẫn.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Plus, Printer, QrCode, Trash2 } from 'lucide-react';
import { useDemoData, newId } from '../../contexts/DemoDataContext';
import { createQRImage, getPublicUrl, downloadDataURL } from '../../services/qrService';
import PageHeader from '../../components/shared/PageHeader';
import PlacePicker from '../../components/shared/PlacePicker';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';

function QRPreview({ place }) {
    const [src, setSrc] = useState('');
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        if (!place) return () => {};
        setSrc('');
        createQRImage(getPublicUrl(place.slug))
            .then((image) => {
                if (active) setSrc(image);
            })
            .catch(() => {
                if (active) setError('Không tạo được mã QR.');
            });
        return () => {
            active = false;
        };
    }, [place?.slug]);
    if (!place) return null;
    return (
        <div className="qr-preview">
            <div className="qr-visual">
                {src ? (
                    <img src={src} alt={`Mã QR địa điểm ${place.name}`} />
                ) : (
                    <div className="qr-placeholder">
                        <QrCode size={40} />
                    </div>
                )}
            </div>
            <div className="qr-info">
                <small>QUÉT ĐỂ KHÁM PHÁ</small>
                <h3>{place.name}</h3>
                <p>Nghe thành phố kể chuyện · Sài Gòn Echo</p>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="qr-actions">
                <button
                    className="btn primary"
                    disabled={!src}
                    onClick={() => downloadDataURL(src, `QR-${place.slug}.png`)}
                >
                    <Download size={16} /> Tải PNG
                </button>
                <button className="btn" disabled={!src} onClick={() => window.print()}>
                    <Printer size={16} /> In mã QR
                </button>
            </div>
        </div>
    );
}

export default function QRPage() {
    const { data, add, remove, notify } = useDemoData();
    const [selection, setSelection] = useState('');
    const [filter, setFilter] = useState('');
    const [preview, setPreview] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [copied, setCopied] = useState('');
    const list = useMemo(
        () => data.qrs.filter((item) => !filter || item.locationId === filter),
        [data.qrs, filter],
    );
    const getPlace = (locationId) => data.locations.find((p) => p.id === locationId);

    // Không tạo QR trùng địa điểm. Nếu đã có thì chuyển thẳng đến xem trước.
    const create = () => {
        if (!selection) return notify('Hãy chọn địa điểm cần tạo mã QR.');
        const place = getPlace(selection);
        if (!place?.visible)
            return notify('Địa điểm đang ẩn. Hãy hiển thị địa điểm trước khi tạo QR.');
        const exists = data.qrs.some((q) => q.locationId === selection);
        if (!exists)
            add('qrs', {
                id: newId('qr'),
                locationId: selection,
                createdAt: new Date().toISOString(),
            });
        notify(exists ? 'Địa điểm đã có mã QR; đang mở xem trước.' : 'Đã tạo mã QR mới.');
        setPreview(place);
        setSelection('');
    };
    const copy = async (place) => {
        try {
            await navigator.clipboard.writeText(getPublicUrl(place.slug));
            setCopied(place.id);
            notify('Đã sao chép liên kết.');
        } catch {
            notify('Không thể sao chép tự động. Hãy sao chép liên kết ở ô URL.');
        }
    };
    const doDelete = () => {
        remove('qrs', deleting.id);
        setDeleting(null);
        notify('Đã xóa mục quản lý QR. Liên kết cũ vẫn có thể mở nếu địa điểm còn hiển thị.');
    };

    return (
        <>
            <PageHeader
                kicker="TRẢI NGHIỆM / 05"
                title="Quản lý mã QR"
                description="Kết nối mỗi địa điểm với một câu chuyện chỉ bằng một lần quét."
            />
            <div className="qr-layout">
                <section className="panel qr-create">
                    <div className="feature-icon">
                        <QrCode size={23} />
                    </div>
                    <h2>Tạo mã QR cho địa điểm</h2>
                    <p>
                        Mã QR sẽ mở trang thuyết minh công khai của địa điểm. Dùng mã thật để demo
                        trên điện thoại khi máy chủ có thể truy cập được.
                    </p>
                    <PlacePicker label="Chọn địa điểm" value={selection} onChange={setSelection} />
                    <button className="btn primary full-width" onClick={create}>
                        <Plus size={17} /> Tạo mã QR
                    </button>
                    <p className="helper">
                        Địa điểm phải ở trạng thái hiển thị để khách mở nội dung.
                    </p>
                </section>
                <section className="panel qr-explain">
                    <span className="eyebrow">CÁCH HOẠT ĐỘNG</span>
                    <h2>Từ mã QR đến câu chuyện</h2>
                    <div className="step">
                        <b>01</b>
                        <span>Admin chọn địa điểm và tạo mã QR</span>
                    </div>
                    <div className="step">
                        <b>02</b>
                        <span>Tải PNG hoặc in mã để trưng bày</span>
                    </div>
                    <div className="step">
                        <b>03</b>
                        <span>Khách quét mã → chọn ngôn ngữ → đọc/nghe thuyết minh</span>
                    </div>
                    <div className="qr-caption">
                        Trang tham quan demo được tạo từ dữ liệu đang lưu trên cùng trình duyệt.
                        Truy cập từ điện thoại khác chỉ có dữ liệu mẫu, chưa đồng bộ nội dung đã
                        sửa.
                    </div>
                </section>
            </div>
            <section className="panel">
                <div className="section-title-inline">
                    <div>
                        <h2>Danh sách mã QR</h2>
                        <p>Quản lý các địa điểm đã tạo mã.</p>
                    </div>
                    <PlacePicker value={filter} onChange={setFilter} all />
                </div>
                {list.length ? (
                    <div className="qr-table">
                        {list.map((item) => {
                            const place = getPlace(item.locationId);
                            if (!place) return null;
                            return (
                                <article className="qr-table-row" key={item.id}>
                                    <div className="qr-list-icon">
                                        <QrCode size={24} />
                                    </div>
                                    <div className="qr-list-title">
                                        <strong>{place.name}</strong>
                                        <small>{getPublicUrl(place.slug)}</small>
                                    </div>
                                    <span
                                        className={`status-pill ${place.visible ? 'success' : 'neutral'}`}
                                    >
                                        {place.visible ? 'Hoạt động' : 'Địa điểm đang ẩn'}
                                    </span>
                                    <div className="table-actions">
                                        <button
                                            className="small-btn"
                                            title="Xem trước"
                                            onClick={() => setPreview(place)}
                                        >
                                            <QrCode size={17} />
                                        </button>
                                        <button
                                            className="small-btn"
                                            title="Sao chép liên kết"
                                            onClick={() => copy(place)}
                                        >
                                            {copied === place.id ? (
                                                <Check size={17} />
                                            ) : (
                                                <Copy size={17} />
                                            )}
                                        </button>
                                        <a
                                            className="small-btn"
                                            href={getPublicUrl(place.slug)}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Mở trang đích"
                                        >
                                            <ExternalLink size={17} />
                                        </a>
                                        <button
                                            className="small-btn danger-icon"
                                            title="Xóa mục QR"
                                            onClick={() => setDeleting(item)}
                                        >
                                            <Trash2 size={17} />
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState text="Chưa có mã QR nào. Hãy tạo mã cho một địa điểm đang hiển thị." />
                )}
            </section>
            {preview && (
                <Modal title="Xem trước mã QR" onClose={() => setPreview(null)}>
                    <div className="qr-printable">
                        <QRPreview place={preview} />
                        <label className="field">
                            <span>Đường dẫn trang thuyết minh</span>
                            <input
                                readOnly
                                value={getPublicUrl(preview.slug)}
                                onFocus={(e) => e.target.select()}
                            />
                        </label>
                    </div>
                </Modal>
            )}
            {deleting && (
                <ConfirmDialog
                    title="Xóa mục mã QR?"
                    text="Chỉ xóa QR khỏi danh sách quản lý. Ảnh QR từng tải/in vẫn chứa liên kết cũ; muốn ngừng truy cập, hãy ẩn địa điểm."
                    onCancel={() => setDeleting(null)}
                    onConfirm={doDelete}
                />
            )}
        </>
    );
}
