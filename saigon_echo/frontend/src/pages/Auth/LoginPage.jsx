import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getSession, login } from '../../services/api';

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [error, setError] = useState('');
  const destination = location.state?.from?.startsWith('/admin')
    ? location.state.from
    : '/admin/tong-quan';

  useEffect(() => {
    let active = true;
    getSession()
      .then((admin) => {
        if (!active) return;
        setSessionUser(admin);
      })
      .catch((sessionError) => {
        if (active) setError(sessionError.message || 'Không thể kiểm tra phiên đăng nhập.');
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  if (sessionUser) {
    return <Navigate to={destination} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (checkingSession) {
    return <main className="login-loading" aria-live="polite"><p>Đang kiểm tra phiên đăng nhập...</p></main>;
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Giới thiệu Sài Gòn Echo">
        <Link className="login-brand" to="/kham-pha" aria-label="Sài Gòn Echo">
          <span className="login-brand-mark" aria-hidden="true">◖</span>
          <span><strong>Sài Gòn Echo</strong><small>CÂU CHUYỆN QUANH BẠN</small></span>
        </Link>
        <div className="login-story-copy">
          <span className="login-kicker">SÀI GÒN, THEO NGÔN NGỮ CỦA BẠN</span>
          <h1>Nghe thành phố<br/><em>kể chuyện.</em></h1>
          <p>Từ những mái ngói trăm năm đến nhịp sống bên sông. Chọn ngôn ngữ của bạn và để Sài Gòn dẫn lối.</p>
        </div>
        <div className="login-art-card">
          <img
            src="/user-images/anh_nen.jpg"
            alt="Toàn cảnh thành phố Hồ Chí Minh"
            className="login-artwork"
          />
          <div className="login-art-caption">
            <span className="login-sound-bars" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></span>
            <span><strong>Sài Gòn</strong><small>Nghe thành phố kể chuyện</small></span>
          </div>
        </div>
        <span className="login-story-foot">THÀNH PHỐ HỒ CHÍ MINH · VIỆT NAM</span>
      </section>

      <section className="login-main">
        <header className="login-topbar">
          <span>ĐĂNG NHẬP QUẢN TRỊ</span>
          <Link className="login-brand-pill" to="/kham-pha"><i/>Sài Gòn Echo</Link>
        </header>
        <div className="login-form-wrap">
          <div className="login-lock-tile"><LockKeyhole size={23}/></div>
          <span className="login-form-kicker">CHÀO MỪNG TRỞ LẠI</span>
          <h2>Đăng nhập</h2>
          <p className="auth-description">Đăng nhập bằng tài khoản admin để tiếp tục.</p>

          {location.state?.expired && (
            <p className="auth-notice" role="status">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</p>
          )}
          {error && <p className="error-text" role="alert">{error}</p>}

          <form className="login-form" onSubmit={submit}>
            <label className="field auth-field">
              <span>Email hoặc tên đăng nhập <b>*</b></span>
              <input
                autoComplete="username"
                autoFocus
                maxLength={100}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nhập email hoặc tên đăng nhập"
                required
                value={username}
              />
            </label>
            <label className="field auth-field">
              <span>Mật khẩu <b>*</b></span>
              <span className="auth-input-wrap">
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu của bạn"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>
              </span>
            </label>
            <button className="btn primary auth-submit" disabled={busy} type="submit">
              <span>{busy ? 'Đang đăng nhập...' : 'Đăng nhập tài khoản admin'}</span>
              <ArrowRight size={18}/>
            </button>
          </form>

          <p className="login-security-note"><LockKeyhole size={14}/> Chỉ dành cho tài khoản admin được cấp quyền.</p>
        </div>
        <footer className="login-footer">
          <span>© 2026 Sài Gòn Echo</span><span>Nghe thành phố kể chuyện.</span>
        </footer>
      </section>
    </main>
  );
}
