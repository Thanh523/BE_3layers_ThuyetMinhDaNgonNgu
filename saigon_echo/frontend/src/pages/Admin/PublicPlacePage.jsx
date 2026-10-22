// Trang công khai nhỏ để kiểm thử mã QR; dữ liệu hiện đọc từ kho demo trên trình duyệt.
import React, { useMemo, useState } from 'react';
import { ArrowLeft, AudioLines, BookOpen, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useDemoData } from '../../contexts/DemoDataContext';
import { LANGUAGE_OPTIONS } from '../../data/seed';
import MediaImage from '../../components/shared/MediaImage';
import useFileUrl from '../../hooks/useFileUrl';

function NarrationAudio({ audio, onPlay }) {
    const url = useFileUrl(audio?.fileId);
    return url ? (
        <audio className="full-audio" controls src={url} preload="metadata" onPlay={onPlay} />
    ) : (
        <p className="helper">Hiện chưa có bản thu âm thanh cho ngôn ngữ này.</p>
    );
}

export default function PublicPlacePage() {
    const { slug } = useParams();
    const { data, addHistory } = useDemoData();
    const [lang, setLang] = useState('vi');
    const place = data.locations.find((item) => item.slug === slug);
    const narration = useMemo(
        () =>
            data.narrations.find(
                (item) =>
                    item.locationId === place?.id && item.lang === lang && item.visible !== false,
            ),
        [data.narrations, place?.id, lang],
    );
    const audio = data.audios.find(
        (item) =>
            item.narrationId === narration?.id ||
            (!item.narrationId && item.locationId === place?.id && item.lang === lang),
    );
    if (!place || !place.visible)
        return (
            <div className="not-found">
                <h1>Địa điểm chưa sẵn sàng</h1>
                <p>Địa điểm không tồn tại hoặc đang được ẩn bởi quản trị viên.</p>
                <Link className="btn" to="/kham-pha">
                    Về trang khám phá
                </Link>
            </div>
        );
    return (
        <div className="public-site">
            <header className="public-header">
                <div className="public-brand">
                    <span className="brand-symbol">◖</span>
                    <strong>
                        Sài Gòn Echo<small>STORIES AROUND YOU</small>
                    </strong>
                </div>
                <Link to="/kham-pha" className="btn small">
                    <ArrowLeft size={15} /> Khám phá
                </Link>
            </header>
            <main className="public-container">
                <div className="eyebrow">KHÁM PHÁ SÀI GÒN / AUDIO GUIDE</div>
                <h1>{place.name}</h1>
                <p className="public-subheading">{place.enName}</p>
                <div className="public-banner">
                    <MediaImage place={place} />
                </div>
                <p className="public-address">
                    <MapPin size={17} />
                    {place.address}
                </p>
                <div className="public-tabs">
                    <span>Chọn ngôn ngữ / Language</span>
                    <div>
                        {LANGUAGE_OPTIONS.map((l) => (
                            <button
                                key={l.value}
                                className={`chip ${lang === l.value ? 'active' : ''}`}
                                onClick={() => setLang(l.value)}
                            >
                                {l.short}
                            </button>
                        ))}
                    </div>
                </div>
                <section className="public-content">
                    <h2>
                        <BookOpen size={24} /> Câu chuyện về địa điểm
                    </h2>
                    <p className="reading-text">
                        {narration?.text || 'Nội dung ngôn ngữ này đang được cập nhật.'}
                    </p>
                </section>
                <section className="public-content">
                    <h2>
                        <AudioLines size={24} /> Nghe thuyết minh
                    </h2>
                    <NarrationAudio
                        audio={audio}
                        onPlay={() => addHistory(place.id, lang)}
                    />
                </section>
                <div className="demo-disclaimer">
                    Trang tham quan hiện sử dụng dữ liệu demo lưu trên trình duyệt; nội dung chưa
                    được đồng bộ với SQL Server.
                </div>
            </main>
            <footer className="public-footer">
                © 2026 Sài Gòn Echo · Nghe thành phố kể chuyện
            </footer>
        </div>
    );
}
