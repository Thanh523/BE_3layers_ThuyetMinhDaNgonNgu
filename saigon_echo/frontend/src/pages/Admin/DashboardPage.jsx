import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AudioLines,
  Check,
  Globe,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { getDashboard, IS_STATS_DEMO } from '../../services/api';
import EmptyState from '../../components/shared/EmptyState';
import PageHeader from '../../components/shared/PageHeader';

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(days) {
  const today = new Date();
  const to = localDateValue(today);
  const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
  return { from: localDateValue(fromDate), to };
}

function formatDate(value) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function isDashboardData(value) {
  return value &&
    value.totals &&
    Array.isArray(value.dailyVisits) &&
    Array.isArray(value.languageUsage) &&
    Array.isArray(value.places) &&
    Number.isFinite(value.totals.visits) &&
    Number.isFinite(value.totals.narrationUses) &&
    Number.isFinite(value.totals.places) &&
    Number.isFinite(value.totals.narrations);
}

function VisitsChart({ dailyVisits }) {
  const width = 720;
  const height = 250;
  const margin = { top: 18, right: 18, bottom: 38, left: 36 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...dailyVisits.map((day) => day.total));
  const step = maxValue <= 4 ? 1 : Math.ceil(maxValue / 4);
  const maxAxis = step * 4;
  const points = dailyVisits.map((day, index) => ({
    ...day,
    x: margin.left + (dailyVisits.length <= 1 ? chartWidth / 2 : (index / (dailyVisits.length - 1)) * chartWidth),
    y: margin.top + chartHeight - (day.total / maxAxis) * chartHeight,
  }));
  const path = points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
  ).join(' ');
  const dateLabelIndices = [...new Set([
    0,
    Math.floor((dailyVisits.length - 1) / 2),
    dailyVisits.length - 1,
  ])];

  return (
    <div className="stats-chart-wrap">
      {dailyVisits.length ? (
        <svg className="stats-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ lượt truy cập theo ngày">
          {[0, 1, 2, 3, 4].map((line) => {
            const y = margin.top + (line / 4) * chartHeight;
            const value = maxAxis - line * step;
            return (
              <g key={line}>
                <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} className="stats-grid-line" />
                <text x={margin.left - 12} y={y + 4} textAnchor="end" className="stats-axis-label">{value}</text>
              </g>
            );
          })}
          {points.length > 1 && <path d={path} className="stats-chart-line" />}
          {points.map((point) => (
            <circle key={point.date} cx={point.x} cy={point.y} r="3.5" className="stats-chart-point">
              <title>{formatDate(point.date)}: {point.total} lượt</title>
            </circle>
          ))}
          {dateLabelIndices.map((pointIndex, index) => (
            <text
              key={dailyVisits[pointIndex].date}
              x={points[pointIndex].x}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === dateLabelIndices.length - 1 ? 'end' : 'middle'}
              className="stats-axis-label"
            >
              {formatDate(dailyVisits[pointIndex].date)}
            </text>
          ))}
        </svg>
      ) : <EmptyState text="Chưa có dữ liệu lượt truy cập trong khoảng thời gian này." />}
    </div>
  );
}

export default function DashboardPage() {
  const initialRange = useMemo(() => getDateRange(7), []);
  const [range, setRange] = useState(initialRange);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadDashboard = useCallback(async (selectedRange) => {
    if (!selectedRange.from || !selectedRange.to || selectedRange.from > selectedRange.to) {
      setError('Vui lòng chọn khoảng ngày hợp lệ.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getDashboard(selectedRange);
      if (!isDashboardData(result)) throw new Error('Dữ liệu thống kê từ backend không đúng cấu trúc.');
      setData(result);
      setAppliedRange(selectedRange);
      setRange(selectedRange);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải thống kê.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(initialRange); }, [initialRange, loadDashboard]);

  const filteredPlaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    if (!query) return data?.places || [];
    return (data?.places || []).filter((place) =>
      `${place.name} ${place.address || ''}`.toLocaleLowerCase('vi').includes(query),
    );
  }, [data, search]);

  const applyPreset = (days) => {
    const nextRange = getDateRange(days);
    setRange(nextRange);
    loadDashboard(nextRange);
  };

  const handleApply = () => loadDashboard(range);

  return (
    <>
      <PageHeader
        kicker="TỔNG QUAN / 00"
        title="Thống kê hệ thống"
        description="Theo dõi lượt truy cập, lượt nghe thuyết minh và hiệu quả từng địa điểm."
        action={<button className="btn" onClick={() => loadDashboard(appliedRange)} disabled={loading}><RefreshCw size={16}/> Làm mới</button>}
      />
      {IS_STATS_DEMO && <p className="helper">Thống kê đang ở chế độ demo; chưa truy vấn dữ liệu từ SQL Server.</p>}
      {error && <div className="error-text" role="alert">{error}</div>}

      <section className="stats-filter" aria-label="Bộ lọc thời gian thống kê">
        <div className="stats-presets" role="group" aria-label="Chọn khoảng thời gian">
          <button type="button" className={appliedRange.from === getDateRange(7).from ? 'selected' : ''} onClick={() => applyPreset(7)}>7 ngày</button>
          <button type="button" className={appliedRange.from === getDateRange(30).from ? 'selected' : ''} onClick={() => applyPreset(30)}>30 ngày</button>
        </div>
        <label className="stats-date-field">
          <span>Từ ngày</span>
          <input type="date" value={range.from} max={range.to || undefined} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
        </label>
        <label className="stats-date-field">
          <span>Đến ngày</span>
          <input type="date" value={range.to} min={range.from || undefined} max={localDateValue(new Date())} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
        </label>
        <button type="button" className="btn primary stats-apply" onClick={handleApply} disabled={loading}>Áp dụng</button>
      </section>

      <div className="stats-date-caption">
        <span>Thống kê hệ thống · {formatDate(appliedRange.from)} – {formatDate(appliedRange.to)}</span>
        {data && <span>{loading ? 'Đang cập nhật…' : 'Dữ liệu mới nhất'}</span>}
      </div>

      {loading && !data ? <EmptyState text="Đang tải thống kê..." /> : data && (
        <>
          <section className="stats-kpis" aria-label="Chỉ số tổng quan">
            <article className="stats-kpi">
              <div className="stats-kpi-heading"><span>Lượt truy cập</span><i><Users size={20}/></i></div>
              <strong>{data.totals.visits.toLocaleString('vi-VN')}</strong>
              <small>Trong khoảng thời gian đã chọn</small>
            </article>
            <article className="stats-kpi">
              <div className="stats-kpi-heading"><span>Lượt sử dụng thuyết minh</span><i className="orange"><AudioLines size={20}/></i></div>
              <strong>{data.totals.narrationUses.toLocaleString('vi-VN')}</strong>
              <small>Số lần bắt đầu nghe được ghi nhận</small>
            </article>
            <article className="stats-kpi">
              <div className="stats-kpi-heading"><span>Địa điểm du lịch</span><i><MapPin size={20}/></i></div>
              <strong>{data.totals.places.toLocaleString('vi-VN')}</strong>
              <small>{data.totals.visiblePlaces} đang hiển thị · {data.totals.hiddenPlaces} đã ẩn</small>
            </article>
            <article className="stats-kpi">
              <div className="stats-kpi-heading"><span>Nội dung thuyết minh</span><i><Globe size={20}/></i></div>
              <strong>{data.totals.narrations.toLocaleString('vi-VN')}</strong>
              <small>Mỗi bản ngôn ngữ tính là một nội dung</small>
            </article>
          </section>

          {data.totals.visits === 0 && data.totals.narrationUses === 0 && (
            <div className="stats-empty-banner" role="status">
              <Activity size={17}/>
              <span>Chưa có dữ liệu sử dụng trong khoảng thời gian này. Số lượng địa điểm và nội dung vẫn được hiển thị theo danh mục hiện tại.</span>
            </div>
          )}

          <div className="stats-panels">
            <section className="panel stats-chart-panel">
              <div className="stats-section-heading">
                <div><span className="eyebrow">NHỊP KHÁM PHÁ</span><h2>Thống kê lượt truy cập</h2></div>
                <div className="stats-chart-total"><strong>{data.totals.visits.toLocaleString('vi-VN')}</strong><span>lượt trong khoảng đã chọn</span></div>
              </div>
              <VisitsChart dailyVisits={data.dailyVisits}/>
            </section>

            <section className="panel stats-language-panel">
              <div className="stats-section-heading">
                <div><span className="eyebrow">KẾT NỐI ĐA NGÔN NGỮ</span><h2>Ngôn ngữ được sử dụng</h2><p>Dựa trên lượt bắt đầu nghe</p></div>
              </div>
              <div className="stats-language-total"><Globe size={28}/><strong>{data.totals.narrationUses.toLocaleString('vi-VN')}</strong><span>tổng lượt sử dụng</span></div>
              <div className="stats-language-list">
                {data.languageUsage.map((language) => {
                  const share = data.totals.narrationUses
                    ? (language.uses / data.totals.narrationUses) * 100
                    : 0;
                  return (
                    <div className="stats-language" key={language.code}>
                      <div className="stats-language-line">
                        <span><i/> {language.name}</span>
                        <small>{language.uses.toLocaleString('vi-VN')} · {share.toFixed(share % 1 ? 1 : 0)}%</small>
                      </div>
                      <div className="stats-progress"><span style={{ width: `${share}%` }}/></div>
                    </div>
                  );
                })}
                {!data.languageUsage.length && <p className="helper">Chưa có danh sách ngôn ngữ trong database.</p>}
              </div>
            </section>
          </div>

          <section className="panel stats-places-panel">
            <div className="stats-table-heading">
              <div><span className="eyebrow">NHỮNG CÂU CHUYỆN ĐƯỢC LẮNG NGHE</span><h2>Lượt sử dụng theo địa điểm</h2></div>
              <label className="stats-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm địa điểm..." aria-label="Tìm địa điểm"/></label>
            </div>
            <div className="stats-table-scroll">
              <table className="stats-table">
                <thead><tr><th>STT</th><th>Địa điểm</th><th>Ngôn ngữ có nội dung</th><th>Trạng thái</th><th>Lượt sử dụng</th><th>Tỷ lệ</th></tr></thead>
                <tbody>
                  {filteredPlaces.map((place, index) => (
                    <tr key={place.id}>
                      <td>{String(index + 1).padStart(2, '0')}</td>
                      <td><strong>{place.name}</strong><small>{place.address || 'Chưa có địa chỉ'}</small></td>
                      <td>{place.languages.length
                        ? place.languages.map((code) => data.languageUsage.find((language) => language.code === code)?.name || code).join(', ')
                        : '—'}</td>
                      <td><span className={`stats-status ${place.published ? 'visible' : ''}`}><i/>{place.published ? 'Đang hiển thị' : 'Không hiển thị'}</span></td>
                      <td>{place.uses.toLocaleString('vi-VN')}</td>
                      <td>{place.share.toFixed(place.share % 1 ? 1 : 0)}%</td>
                    </tr>
                  ))}
                  {!filteredPlaces.length && <tr><td colSpan="6" className="stats-table-empty">Không tìm thấy địa điểm phù hợp.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="stats-table-foot"><span>{filteredPlaces.length} địa điểm · Sắp xếp theo lượt sử dụng giảm dần</span><span><Check size={15}/> Lượt truy cập và lượt bắt đầu nghe có thể bao gồm nhiều lần của cùng một người.</span></div>
          </section>
        </>
      )}
    </>
  );
}
