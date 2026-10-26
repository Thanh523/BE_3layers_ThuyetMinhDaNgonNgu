import { useOutletContext } from 'react-router-dom';
import { LANG } from './pageData';

export default function HistoryPage() {
  const { hist, places, openPlace, clearHistory } = useOutletContext();

  return (
    <section className="user-history-page">
      <div className="user-section-head">
        <div><div className="eyebrow">HÀNH TRÌNH CỦA BẠN</div><h1>Lịch sử nghe</h1><p>Các câu chuyện bạn đã bắt đầu nghe trên thiết bị này.</p></div>
        {hist.length > 0 && <button type="button" className="btn small" onClick={clearHistory}>Xóa lịch sử</button>}
      </div>
      <div className="user-history-list">
        {hist.length ? hist.map((entry) => {
          const place = places.find((item) => item.id === entry.place_id);
          const language = LANG[entry.lang]?.label || entry.lang?.toUpperCase() || 'Ngôn ngữ';
          const time = new Date(entry.time);
          return (
            <article className="user-history-row" key={entry.id}>
              <div className="user-history-art">{place?.artwork ? '◖' : '♫'}</div>
              <div className="user-history-details">
                <strong>{place?.name || 'Địa điểm đã ẩn hoặc xóa'}</strong>
                <span>{language} · {Number.isNaN(time.getTime()) ? 'Thời gian không xác định' : time.toLocaleString('vi-VN')}</span>
              </div>
              {place && <button type="button" className="btn small" onClick={() => openPlace(place)}>Nghe lại ↗</button>}
            </article>
          );
        }) : (
          <div className="user-empty-state">
            <span className="user-empty-icon">♫</span>
            <strong>Bạn chưa nghe bản thuyết minh nào</strong>
            <p>Khi bắt đầu phát một câu chuyện, lịch sử sẽ xuất hiện tại đây.</p>
          </div>
        )}
      </div>
    </section>
  );
}
