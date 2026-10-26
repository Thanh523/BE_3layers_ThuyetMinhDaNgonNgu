// Trang công khai nhỏ để kiểm thử mã QR; dữ liệu hiện đọc từ kho demo trên trình duyệt.
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AudioLines, BookOpen, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useDemoData } from '../../contexts/DemoDataContext';
import { getPublicPlace } from '../../services/api';
import { LANGUAGE_OPTIONS } from '../../data/seed';
import MediaImage from '../../components/shared/MediaImage';
import useFileUrl from '../../hooks/useFileUrl';

function NarrationAudio({ audio, onPlay }) {
    const localUrl = useFileUrl(audio?.fileId);
    const url = audio?.url || audio?.fileUrl || localUrl;
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
    const [databasePlace, setDatabasePlace] = useState(null);
    const [loadError, setLoadError] = useState('');
    useEffect(() => {
        let active = true;
        getPublicPlace(slug)
            .then((result) => active && setDatabasePlace(result.place))
            .catch((error) => active && setLoadError(error.message || 'Không thể tải địa điểm.'));
        return () => { active = false; };
    }, [slug]);
    const place = databasePlace || data.locations.find((item) => item.slug === slug);
    const narration = useMemo(
        () =>
            databasePlace?.narrations?.find((item) => item.lang === lang)
                || data.narrations.find(
                    (item) =>
                        item.locationId === place?.id && item.lang === lang && item.visible !== false,
                ),
        [databasePlace, data.narrations, place?.id, lang],
    );
    const audio = narration?.audio || data.audios.find(
        (item) =>
            item.narrationId === narration?.id ||
            (!item.narrationId && item.locationId === place?.id && item.lang === lang),
    );
    if (loadError && !place)
        return <div className="not-found"><h1>Không thể tải địa điểm</h1><p>{loadError}</p></div>;
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
                        Sài Gòn Echo<small>CÂU CHUYỆN QUANH BẠN</small>
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
                    {place.images?.[0]?.url ? (
                        <img src={place.images[0].url} alt={place.name} />
                    ) : (
                        <MediaImage place={place} />
                    )}
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
                    Nội dung trang này được tải trực tiếp từ dữ liệu công khai trong SQL Server.
                </div>
            </main>
            <footer className="public-footer">
                © 2026 Sài Gòn Echo · Nghe thành phố kể chuyện
            </footer>
        </div>
    );
}
