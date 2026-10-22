import { ArrowUpRight, Heart, MapPin, QrCode, Search } from 'lucide-react';
import MediaImage from '../../components/shared/MediaImage';
import { CATS, LANG } from './pageData';

export default function PlaceListPage({
  places = [],
  favs = [],
  cat,
  setCat,
  q,
  setQ,
  sort,
  setSort,
  canSave = true,
  toggleFav,
  openPlace,
  eyebrow,
  title,
  showHero = false,
  savedOnly = false,
  onScan,
}) {
  const query = q.trim().toLocaleLowerCase('vi');
  const shown = places
    .filter((place) => !savedOnly || favs.includes(place.id))
    .filter((place) => cat === 'all' || place.category === cat)
    .filter((place) => !query || [place.name, place.enName, place.address]
      .some((value) => value?.toLocaleLowerCase('vi').includes(query)))
    .sort((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name, 'vi');
      if (sort === 'category') return (CATS[left.category] || '').localeCompare(CATS[right.category] || '', 'vi');
      return 0;
    });
  const featuredPlace = places.find((place) => place.slug === 'dinh-doc-lap') || places[0];
  const featuredText = featuredPlace?.texts?.vi;

  return (
    <>
      {showHero && (
        <section className="user-hero">
          <div className="user-hero-copy">
            <div className="eyebrow">SAIGON, IN YOUR LANGUAGE</div>
            <h1>Nghe thành phố<br/><em>kể chuyện.</em></h1>
            <p>Từ những mái ngói trăm năm đến nhịp sống bên sông. Chọn ngôn ngữ của bạn và để Sài Gòn dẫn lối.</p>
            <div className="user-hero-actions">
              <a className="btn primary" href="#destinations">Bắt đầu khám phá <ArrowUpRight size={16}/></a>
              {onScan && <button className="btn" type="button" onClick={onScan}><QrCode size={16}/> Quét QR</button>}
            </div>
            <div className="user-hero-note">
              <span><b>VI</b><b>EN</b><b>JA</b></span>
              <span>Đa ngôn ngữ · Một Sài Gòn, nhiều câu chuyện</span>
            </div>
          </div>
          <button
            className="user-hero-art"
            onClick={() => featuredPlace && openPlace(featuredPlace)}
            type="button"
            aria-label={featuredPlace ? `Khám phá ${featuredPlace.name}` : 'Minh họa Sài Gòn'}
          >
            {featuredPlace
              ? <MediaImage place={featuredPlace}/>
              : <div className="user-hero-placeholder"><MapPin size={44}/><span>Những câu chuyện Sài Gòn</span></div>}
            {featuredPlace && (
              <span className="user-hero-story">
                <span className="user-wave" aria-hidden="true"><i/><i/><i/><i/><i/><i/></span>
                <span><strong>{featuredPlace.name}</strong><small>{featuredText?.slice(0, 76) || 'Chạm để khám phá câu chuyện địa điểm'}</small></span>
                <span className="user-play" aria-hidden="true">▶</span>
              </span>
            )}
          </button>
        </section>
      )}

      <section id="destinations" className="user-destinations">
        <div className="user-section-head">
          <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>
          <span className="user-count">{shown.length} địa điểm</span>
        </div>
        <div className="user-toolbar">
          <div className="user-category-list" aria-label="Lọc theo danh mục">
            {Object.entries(CATS).map(([key, label]) => (
              <button key={key} type="button" className={`chip ${cat === key ? 'active' : ''}`} onClick={() => setCat(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="user-search-tools">
            <label className="user-search">
              <Search size={16}/>
              <input
                type="search"
                placeholder="Tìm địa điểm, tên đường…"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                aria-label="Tìm địa điểm"
              />
            </label>
            <select className="user-sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp địa điểm">
              <option value="featured">Nổi bật</option>
              <option value="name">Theo tên</option>
              <option value="category">Theo danh mục</option>
            </select>
          </div>
        </div>

        {shown.length ? (
          <div className="user-place-grid">
            {shown.map((place) => {
              const isFavorite = favs.includes(place.id);
              const languages = Object.keys(LANG).filter((language) => place.texts?.[language]?.trim());
              return (
                <article className="user-place-card" key={place.id}>
                  <button className="user-place-art" type="button" onClick={() => openPlace(place)} aria-label={`Mở ${place.name}`}>
                    <MediaImage place={place}/>
                    <span className="user-place-tag">{CATS[place.category] || 'Địa điểm'}</span>
                  </button>
                  {canSave && (
                    <button
                      className={`user-favorite ${isFavorite ? 'saved' : ''}`}
                      type="button"
                      aria-label={isFavorite ? `Bỏ lưu ${place.name}` : `Lưu ${place.name}`}
                      aria-pressed={isFavorite}
                      onClick={() => toggleFav(place.id)}
                    ><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'}/></button>
                  )}
                  <div className="user-place-body">
                    <button className="user-place-title" type="button" onClick={() => openPlace(place)}>{place.name}</button>
                    {place.enName && <p className="user-place-en-name">{place.enName}</p>}
                    <p className="user-place-summary">
                      {place.texts?.vi?.slice(0, 116) || 'Câu chuyện địa điểm đang được cập nhật.'}
                      {place.texts?.vi?.length > 116 ? '…' : ''}
                    </p>
                    <div className="user-place-address"><MapPin size={14}/><span>{place.address || 'Chưa cập nhật địa chỉ'}</span></div>
                    <div className="user-place-bottom">
                      <span className="user-language-list">{languages.length
                        ? languages.map((language) => LANG[language]?.short || language.toUpperCase()).join(' · ')
                        : 'Sắp có nội dung'}</span>
                      <button className="user-story-link" type="button" onClick={() => openPlace(place)}>Nghe câu chuyện <ArrowUpRight size={14}/></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="user-empty-state">
            <MapPin size={25}/>
            <strong>{savedOnly && !favs.length ? 'Bạn chưa lưu địa điểm nào' : 'Chưa có địa điểm phù hợp'}</strong>
            <p>{savedOnly ? 'Chạm biểu tượng trái tim ở địa điểm bạn yêu thích để lưu lại.' : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc danh mục.'}</p>
          </div>
        )}
      </section>
    </>
  );
}
