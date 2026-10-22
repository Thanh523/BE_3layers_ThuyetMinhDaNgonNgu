import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

const LANG = {
  vi: { label: "Vietnamese", voice: "vi-VN" },
  en: { label: "English", voice: "en-US" },
  ja: { label: "Japanese", voice: "ja-JP" },
  zh: { label: "Chinese", voice: "zh-CN" },
  ko: { label: "Korean", voice: "ko-KR" }
};
const CATS = { all: "Tất cả", historyCat: "Lịch sử", architecture: "Kiến trúc", culture: "Văn hóa", river: "Sông nước" };
const HERO_BACKGROUND = "/images/anh_nen.jpg";
const PLACE_IMAGES = {
  "dinh-doc-lap": "/images/ddl.jpg",
  "buu-dien": "/images/buu_dien.jpg",
  "cho-ben-thanh": "/images/ben_thanh_2.jpg",
  "nha-hat": "/images/nha-hat.jpg",
  "nguyen-hue": "/images/nguyen-hue.jpg",
  "bach-dang": "/images/bach_dang.jpg",
  "bao-tang-chung-tich-chien-tranh": "/images/bao-tang-chung-tich-chien-tranh.jpg",
  "landmark-81": "/images/landmark-81.jpg",
  "chua-ngoc-hoang": "/images/chua-ngoc-hoang.jpg"
};

export default function App() {
  const [page, setPage] = useState("home");
  const [places, setPlaces] = useState([]);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("featured");
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem("auth") || "null"));
  const [guest, setGuest] = useState(false);
  const [favs, setFavs] = useState([]);
  const [hist, setHist] = useState([]);
  const [modal, setModal] = useState(null); // {type:'place'|'auth'|'scan', place}
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const api = async (url, opt = {}) => {
    const r = await fetch("/api" + url, { ...opt, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer " + auth.token } : {}) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || "Có lỗi xảy ra");
    return d;
  };

  // (a, b) xem danh sách + tìm kiếm
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setLoadError("");
      api(`/places?q=${encodeURIComponent(q)}&category=${cat}`)
        .then(setPlaces)
        .catch((e) => setLoadError(e.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, cat, refreshKey]);
  useEffect(() => { if (auth) { api("/favorites").then(setFavs).catch(() => logout()); loadHist(); } else { setFavs([]); setHist([]); } }, [auth]);
  const loadHist = () => api("/history").then(setHist).catch(() => {});
  const logout = () => { localStorage.removeItem("auth"); setAuth(null); setGuest(false); setPage("home"); };
  const needLogin = () => { say("Vui lòng đăng nhập để dùng chức năng này"); setModal({ type: "auth" }); };

  // (h) lưu yêu thích
  const toggleFav = async (id) => {
    if (!auth) return needLogin();
    const on = favs.includes(id);
    await api("/favorites/" + id, { method: on ? "DELETE" : "PUT" });
    setFavs(on ? favs.filter((x) => x !== id) : [...favs, id]);
    say(on ? "Đã bỏ lưu địa điểm" : "Đã lưu địa điểm");
  };
  const openPlace = (p) => setModal({ type: "place", place: p });
  const shown = [...(page === "saved" ? places.filter((p) => favs.includes(p.id)) : places)].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "vi");
    if (sort === "category") return (CATS[a.category] || "").localeCompare(CATS[b.category] || "", "vi");
    return 0;
  });

  return (
    <>
      <header>
        <button className="brand" onClick={() => setPage("home")}><span className="logo">◖</span><span>Sài Gòn Echo<small>Stories around you</small></span></button>
        <nav style={{ display: "flex" }}>
          {[["home", "Khám phá"], ["saved", "Đã lưu"], ["history", "Lịch sử nghe"]].map(([k, v]) => (
            <button key={k} className={page === k ? "active" : ""} onClick={() => (k !== "home" && !auth ? needLogin() : setPage(k))}>{v}</button>
          ))}
        </nav>
        <div className="header-right">
          <button className="btn small" onClick={() => setModal({ type: "scan" })}>▣ Quét QR</button>
          {auth ? <button className="btn small" onClick={logout}>{auth.username} · Đăng xuất</button> : guest ? <button className="btn small guest-badge" onClick={() => setModal({ type: "auth" })}>Khách · Đăng nhập</button> : <button className="btn small primary" onClick={() => setModal({ type: "auth" })}>Đăng nhập</button>}
        </div>
      </header>

      <main>
        <div className="container">
          {page === "history" ? <History hist={hist} places={places} api={api} reload={loadHist} openPlace={openPlace} say={say} /> : (
            <>
              {page === "home" && (
                <section className="hero hero-text-only hero-with-background" style={{ backgroundImage: `url(${HERO_BACKGROUND})` }}>
                  <div>
                    <div className="eyebrow">SAIGON, IN YOUR LANGUAGE</div>
                    <h1>Nghe thành phố<br /><em>kể chuyện.</em></h1>
                    <p>Từ những mái ngói trăm năm đến nhịp sống bên sông. Chọn ngôn ngữ của bạn và để Sài Gòn dẫn lối.</p>
                    <div className="hero-actions">
                      <a className="btn primary" href="#destinations">Bắt đầu khám phá ↗</a>
                      <button className="btn" onClick={() => setModal({ type: "scan" })}>▣ Quét QR</button>
                    </div>
                    <div className="hero-note"><div className="avatars"><span>VI</span><span>EN</span><span>JP</span><span>中</span><span>한</span></div><span>Vietnamese · English · Japanese · Chinese · Korean</span></div>
                      <div className="hero-stats" aria-label="Thông tin nhanh">
                        <div><strong>{places.length || "—"}</strong><span>điểm đến</span></div>
                        <div><strong>5</strong><span>ngôn ngữ</span></div>
                        <div><strong>24/7</strong><span>tự khám phá</span></div>
                      </div>
                    </div>
                </section>
              )}
              <section id="destinations">
                <div className="section-head"><div><div className="eyebrow">{page === "home" ? "HÀNH TRÌNH CỦA RIÊNG BẠN" : "ĐÃ LƯU"}</div><h2>{page === "home" ? "Những điểm đến, những câu chuyện" : "Địa điểm yêu thích"}</h2><p className="section-subtitle">{page === "home" ? "Mỗi góc phố là một lát cắt của thành phố." : "Những câu chuyện bạn muốn nghe lại."}</p></div><span className="result-count">{shown.length}<small> địa điểm</small></span></div>
                <div className="toolbar">
                  <div className="chips">{Object.entries(CATS).map(([k, v]) => <button key={k} className={"chip " + (cat === k ? "active" : "")} onClick={() => setCat(k)}>{v}</button>)}</div>
                  <div className="search-tools">
                    <div className="search-wrap">
                      <span aria-hidden="true">⌕</span>
                      <input className="search" aria-label="Tìm địa điểm, tên đường" placeholder="Tìm địa điểm, tên đường…" value={q} onChange={(e) => setQ(e.target.value)} />
                      {q && <button className="clear-search" aria-label="Xóa tìm kiếm" onClick={() => setQ("")}>×</button>}
                    </div>
                    <select className="sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp địa điểm">
                      <option value="featured">Nổi bật</option>
                      <option value="name">Theo tên</option>
                      <option value="category">Theo danh mục</option>
                    </select>
                  </div>
                </div>
                {loadError && <div className="error-state" role="alert"><strong>Không thể tải danh sách địa điểm</strong><span>{loadError}. Hãy kiểm tra backend rồi thử lại.</span><button className="btn small" onClick={() => setRefreshKey((value) => value + 1)}>Thử lại</button></div>}
                <div className="grid">
                  {loading ? [...Array(6)].map((_, i) => <div className="card skeleton-card" key={i}><div className="skeleton-art" /><div className="card-body"><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /></div></div>) : shown.length ? shown.map((p) => (
                    <article className="card" key={p.id}>
                      <div className={"card-art " + (PLACE_IMAGES[p.id] ? "has-place-image" : "")} style={{ background: p.color }}>
                        {PLACE_IMAGES[p.id] ? <img src={PLACE_IMAGES[p.id]} alt={p.name} /> : <span className="card-art-icon" aria-hidden="true">{{ palace: "🏛️", post: "📮", market: "🏪", opera: "🎭", street: "🚶", river: "⛴️", museum: "🏛️", tower: "🏙️", pagoda: "🛕" }[p.art]}</span>}
                        <span className="tag">{CATS[p.category]}</span>
                        <button className={"favorite " + (favs.includes(p.id) ? "saved" : "")} aria-label={favs.includes(p.id) ? `Bỏ lưu ${p.name}` : `Lưu ${p.name}`} onClick={() => toggleFav(p.id)}>{favs.includes(p.id) ? "♥" : "♡"}</button>
                      </div>
                      <div className="card-body">
                        <button className="card-title" onClick={() => openPlace(p)}>{p.name}</button>
                        <p>{p.texts.vi.slice(0, 100)}…</p>
                        <div className="card-meta"><span>⌖ {p.address.split(",")[0]}</span></div>
                        <div className="card-bottom"><span className="languages">{Object.keys(LANG).filter((l) => p.texts[l]?.trim()).map((l) => l.toUpperCase()).join(" · ")}</span>
                          <button className="text-link" onClick={() => openPlace(p)}>Nghe câu chuyện ↗</button></div>
                      </div>
                    </article>
                  )) : <div className="empty"><span className="empty-icon">⌕</span><strong>Chưa có địa điểm phù hợp</strong><span>Thử từ khóa khác hoặc chọn một danh mục khác.</span>{(q || cat !== "all") && <button className="btn small" onClick={() => { setQ(""); setCat("all"); }}>Xóa bộ lọc</button>}</div>}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      <footer className="footer"><span>© 2026 Sài Gòn Echo · Đồ án thuyết minh đa ngôn ngữ</span></footer>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <dialog open>
            <div className="modal-head"><strong>{{ place: modal.place?.name, auth: "Tài khoản", scan: "Quét QR · Mở câu chuyện" }[modal.type]}</strong><button className="close" onClick={() => setModal(null)}>×</button></div>
            <div className="modal-content">
              {modal.type === "place" && <PlaceDetail p={modal.place} fav={favs.includes(modal.place.id)} toggleFav={toggleFav} auth={auth} api={api} reload={loadHist} say={say} />}
              {modal.type === "auth" && <Auth setAuth={(a) => { localStorage.setItem("auth", JSON.stringify(a)); setAuth(a); setGuest(false); setModal(null); say("Xin chào " + a.username); }} onGuest={() => { setGuest(true); setModal(null); say("Bạn đang sử dụng chế độ khách"); }} />}
              {modal.type === "scan" && <Scanner api={api} onFound={(p) => { say("Đã nhận diện địa điểm"); openPlace(p); }} say={say} />}
            </div>
          </dialog>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

// (c, d, e) chi tiết + chọn ngôn ngữ + nghe thuyết minh
function PlaceDetail({ p, fav, toggleFav, auth, api, reload, say }) {
  const [lang, setLang] = useState("vi");
  const [rate, setRate] = useState(1);
  const [state, setState] = useState("stopped");
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis?.getVoices() || []);
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);
  useEffect(() => () => speechSynthesis.cancel(), []);
  const stop = () => { speechSynthesis.cancel(); setState("stopped"); };
  const changeLang = (l) => { stop(); setLang(l); };
  const toggle = () => {
    if (state === "speaking") { speechSynthesis.pause(); return setState("paused"); }
    if (state === "paused") { speechSynthesis.resume(); return setState("speaking"); }
    if (!window.speechSynthesis) return say("Trình duyệt không hỗ trợ đọc văn bản");
    const narration = p.texts[lang]?.trim() || "";
    if (!narration) return say("Chưa có nội dung cho ngôn ngữ này");
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(LANG[lang].voice.toLowerCase().split("-")[0]));
    if (!v && voices.length) return say("Thiết bị chưa có giọng đọc " + LANG[lang].label);
    const u = new SpeechSynthesisUtterance(narration);
    if (v) u.voice = v;
    u.lang = LANG[lang].voice; u.rate = rate; u.onend = () => setState("stopped");
    speechSynthesis.speak(u); setState("speaking");
    if (auth) api("/history", { method: "POST", body: JSON.stringify({ place_id: p.id, lang, kind: "tts" }) }).then(reload).catch(() => {});
  };
  return (
    <>
      <div className="detail-top">
        <div className="detail-art" style={{ background: p.color }}>
          {PLACE_IMAGES[p.id] ? <img src={PLACE_IMAGES[p.id]} alt={p.name} /> : <span aria-hidden="true">{{ palace: "🏛️", post: "📮", market: "🏪", opera: "🎭", street: "🚶", river: "⛴️", museum: "🏛️", tower: "🏙️", pagoda: "🛕" }[p.art]}</span>}
        </div>
        <div>
          <span className="eyebrow">{CATS[p.category]}</span>
          <h2 style={{ fontSize: 30 }}>{p.name}</h2>
          <div className="info-list">⌖ {p.address}<br />♫ {Object.keys(LANG).filter((l) => p.texts[l]?.trim()).length} ngôn ngữ thuyết minh<br />▣ Mã QR: <code>SGECHO:{p.id}</code></div>
          <div className="detail-actions">
            <a className="btn small" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + " " + p.address)}`}>⌖ Chỉ đường ↗</a>
            <button className="btn small" onClick={() => toggleFav(p.id)}>{fav ? "♥ Đã lưu" : "♡ Lưu yêu thích"}</button>
          </div>
        </div>
      </div>
      <div className="map-card">
        <div><strong>Vị trí trên bản đồ</strong><span>{p.address}</span></div>
        <iframe
          title={"Bản đồ " + p.name}
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${p.lon - 0.006}%2C${p.lat - 0.004}%2C${p.lon + 0.006}%2C${p.lat + 0.004}&layer=mapnik&marker=${p.lat}%2C${p.lon}`}
        />
      </div>
      <div className="player">
        <button className="play" onClick={toggle} disabled={!p.texts[lang]?.trim()}>{state === "speaking" ? "Ⅱ" : "▶"}</button>
        <div className="controls"><strong>Nghe câu chuyện</strong><p>Giọng đọc tổng hợp của thiết bị · không phải bản thu âm</p></div>
        <select value={lang} onChange={(e) => changeLang(e.target.value)}>{Object.entries(LANG).map(([l, v]) => <option key={l} value={l}>{v.label}</option>)}</select>
        <select value={rate} onChange={(e) => { stop(); setRate(+e.target.value); }}>{[0.8, 1, 1.2, 1.5].map((r) => <option key={r} value={r}>{r}×</option>)}</select>
        <button className="btn light small" onClick={stop}>■</button>
      </div>
      <div className="narration">{p.texts[lang]?.trim() || "Chưa có nội dung cho ngôn ngữ này."}</div>
      {!auth && <div className="notice" style={{ display: "block" }}>Đăng nhập để lưu lịch sử nghe và địa điểm yêu thích.</div>}
    </>
  );
}

// (g) lịch sử nghe
function History({ hist, places, api, reload, openPlace, say }) {
  return (
    <>
      <div className="admin-head"><div><div className="eyebrow">YOUR JOURNEY</div><h2>Lịch sử nghe</h2></div>
        <button className="btn small" onClick={async () => { await api("/history", { method: "DELETE" }); reload(); say("Đã xóa lịch sử"); }}>Xóa lịch sử</button></div>
      <div className="panel">{hist.length ? hist.map((h) => { const p = places.find((x) => x.id === h.place_id); return (
        <div className="history-row" key={h.id}><div><strong>{p?.name || "Địa điểm đã xóa"}</strong><div className="subtitle">{LANG[h.lang]?.label} · {new Date(h.time + "Z").toLocaleString("vi-VN")}</div></div>
          {p && <button className="btn small" onClick={() => openPlace(p)}>Nghe lại ↗</button>}</div>); }) : <div className="empty">Bạn chưa nghe bản thuyết minh nào.</div>}</div>
    </>
  );
}

function Auth({ setAuth, onGuest }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ username: "", password: "", confirmPassword: "" });
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (mode === "register" && f.password !== f.confirmPassword) return setErr("Mật khẩu xác nhận không khớp");
    try {
      const r = await fetch("/api/" + mode, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: f.username.trim(), password: f.password }) });
      const d = await r.json().catch(() => ({}));
      r.ok ? setAuth(d) : setErr(d.detail || "Không thể xử lý yêu cầu");
    } catch { setErr("Không thể kết nối đến máy chủ. Hãy kiểm tra backend."); }
  };
  return (
    <div className="auth-panel">
      <div className="auth-intro"><strong>{mode === "login" ? "Chào mừng bạn trở lại" : "Tạo tài khoản mới"}</strong><span>{mode === "login" ? "Đăng nhập để lưu địa điểm và lịch sử nghe." : "Lưu lại những câu chuyện bạn yêu thích trên mọi lần ghé thăm."}</span></div>
      <div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setErr(""); }}>Đăng nhập</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setErr(""); }}>Đăng ký</button></div>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="auth-username">Số điện thoại hoặc Email</label><input id="auth-username" type="text" inputMode="email" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></div>
        <div className="field"><label htmlFor="auth-password">Mật khẩu</label><input id="auth-password" autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" minLength="6" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
        {mode === "register" && <div className="field"><label htmlFor="auth-confirm-password">Xác nhận mật khẩu</label><input id="auth-confirm-password" autoComplete="new-password" type="password" minLength="6" value={f.confirmPassword} onChange={(e) => setF({ ...f, confirmPassword: e.target.value })} required /></div>}
      {err && <p className="delete-warning">{err}</p>}
        <button className="btn primary auth-submit">{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
      </form>
      <div className="guest-divider"><span>hoặc</span></div>
      <button type="button" className="btn guest-btn" onClick={onGuest}>Tiếp tục với tư cách khách</button>
      <p className="guest-note">Chế độ khách chỉ dùng để xem, tìm kiếm và quét QR. Dữ liệu yêu thích và lịch sử sẽ không được lưu.</p>
    </div>
  );
}

// (f) quét QR: nhập mã, ảnh QR hoặc camera (BarcodeDetector)
function Scanner({ api, onFound, say }) {
  const [code, setCode] = useState("");
  const [cameraState, setCameraState] = useState("idle");
  const video = useRef(); const controls = useRef(); const stream = useRef(); const reader = useRef(new BrowserQRCodeReader());
  const resolving = useRef(false);
  const stopCam = () => {
    controls.current?.stop();
    controls.current = null;
    const tracks = stream.current?.getTracks() || video.current?.srcObject?.getTracks() || [];
    tracks.forEach((track) => track.stop());
    stream.current = null;
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
    }
    setCameraState("idle");
  };
  const resolve = async (c) => {
    if (!c.trim() || resolving.current) return false;
    resolving.current = true;
    try { stopCam(); onFound(await api("/qr/resolve?code=" + encodeURIComponent(c))); return true; }
    catch { resolving.current = false; say("Mã QR không thuộc địa điểm nào trong hệ thống"); return false; }
  };
  useEffect(() => stopCam, []);
  const startCam = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState("insecure"); return; }
    stopCam(); setCameraState("starting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.current.srcObject = stream.current;
      await video.current.play();
      controls.current = await reader.current.decodeFromVideoElement(video.current, (result) => {
        if (result && !resolving.current) resolve(result.getText());
      });
      setCameraState("scanning");
    } catch (e) {
      stopCam();
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") setCameraState("denied");
      else if (e.name === "NotReadableError" || e.name === "TrackStartError") setCameraState("busy");
      else setCameraState("error");
    }
  };
  const fromFile = async (f) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      const result = await reader.current.decodeFromImageUrl(url);
      resolve(result.getText());
    } catch {
      say("Không tìm thấy QR trong ảnh");
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const cameraMessage = { starting: "Đang xin quyền truy cập camera…", scanning: "Đưa mã QR vào khung để quét", denied: "Bạn đã chặn camera. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.", insecure: "Camera chỉ hoạt động trên HTTPS hoặc localhost.", busy: "Camera đang được ứng dụng khác sử dụng. Hãy đóng tab hoặc ứng dụng đang dùng camera rồi bấm thử lại.", error: "Không thể bật camera. Hãy kiểm tra quyền truy cập và thiết bị camera." }[cameraState];
  return (
    <>
      {cameraState !== "idle" && <div className={"scanner-box " + (cameraState === "scanning" ? "active" : "")}>
        <video ref={video} className="scanner-video" autoPlay playsInline muted hidden={cameraState !== "scanning"} />
        {cameraState === "scanning" && <span className="scan-corners" aria-hidden="true" />}
        {cameraMessage && <p className="scanner-status" role={["denied", "error", "insecure"].includes(cameraState) ? "alert" : "status"}>{cameraMessage}</p>}
      </div>}
      <div className="row"><button className="btn primary" onClick={startCam} disabled={cameraState === "starting" || cameraState === "scanning"}>◉ {cameraState === "starting" ? "Đang bật camera…" : "Bật camera"}</button>
        {cameraState === "scanning" && <button className="btn" onClick={stopCam}>■ Dừng camera</button>}
        <label className="btn">↑ Chọn ảnh QR<input type="file" accept="image/*" hidden onChange={(e) => fromFile(e.target.files[0])} /></label></div>
      <div className="field" style={{ marginTop: 16 }}><label>Hoặc nhập mã QR</label>
        <div className="row"><input style={{ flex: 1 }} placeholder="SGECHO:dinh-doc-lap" value={code} onChange={(e) => setCode(e.target.value)} /><button className="btn" disabled={!code.trim()} onClick={() => resolve(code)}>Mở địa điểm</button></div></div>
      <button className="text-link" onClick={() => resolve("SGECHO:dinh-doc-lap")}>Thử ngay: Dinh Độc Lập ↗</button>
    </>
  );
}
