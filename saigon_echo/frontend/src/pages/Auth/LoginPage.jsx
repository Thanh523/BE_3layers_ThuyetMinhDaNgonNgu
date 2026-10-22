import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Headphones, LockKeyhole, UserRound, UserRoundCog } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getSession, getUserSession, login, loginUser } from '../../services/api';
import PlaceArtwork from '../../components/shared/PlaceArtwork';

const LOGIN_MODES = [
  { id: 'admin', label: 'Quản trị viên', icon: UserRoundCog },
  { id: 'user', label: 'Tài khoản user', icon: UserRound },
];

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = location.state?.role === 'admin' || location.state?.role === 'user'
    ? location.state.role
    : searchParams.get('role') === 'admin' ? 'admin' : 'user';
  const [mode, setMode] = useState(initialMode);
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
    Promise.allSettled([getSession(), getUserSession()])
      .then(([adminResult, userResult]) => {
        if (!active) return;
        const admin = adminResult.status === 'fulfilled' ? adminResult.value : null;
        const user = userResult.status === 'fulfilled' ? userResult.value : null;
        setSessionUser(admin || user);
        const failedCheck = [adminResult, userResult].find((result) => result.status === 'rejected');
        if (!admin && !user && failedCheck) {
          setError(failedCheck.reason.message || 'Không thể kiểm tra phiên đăng nhập.');
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  if (sessionUser) {
    return <Navigate to={sessionUser.role === 'admin' ? destination : '/kham-pha'} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = mode === 'admin'
        ? await login(username.trim(), password)
        : await loginUser(username.trim(), password);
      navigate(user.role === 'admin' ? destination : '/kham-pha', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (checkingSession) {
    return <main className="login-loading" aria-live="polite"><p>Đang kiểm tra phiên đăng nhập...</p></main>;
  }

  const activeMode = LOGIN_MODES.find((item) => item.id === mode);

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Giới thiệu Sài Gòn Echo">
        <Link className="login-brand" to="/kham-pha" aria-label="Sài Gòn Echo">
          <span className="login-brand-mark" aria-hidden="true">◖</span>
          <span><strong>Sài Gòn Echo</strong><small>STORIES AROUND YOU</small></span>
        </Link>
        <div className="login-story-copy">
          <span className="login-kicker">SAIGON, IN EVERY LANGUAGE</span>
          <h1>Mỗi địa điểm,<br/>một câu chuyện<br/><em>được kể.</em></h1>
          <p>Cùng gìn giữ những câu chuyện của thành phố và đưa chúng đến với mọi người.</p>
        </div>
        <div className="login-art-card">
          <PlaceArtwork
            place={{ name: 'Dinh Độc Lập', artwork: 'palace', color: '#d5ded0' }}
            className="login-artwork"
          />
          <div className="login-art-caption">
            <span className="login-sound-bars" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></span>
            <span><strong>Dinh Độc Lập</strong><small>Một Sài Gòn · Nhiều câu chuyện</small></span>
          </div>
        </div>
        <span className="login-story-foot">THÀNH PHỐ HỒ CHÍ MINH · VIỆT NAM</span>
      </section>

      <section className="login-main">
        <header className="login-topbar">
          <span>CHỌN CÁCH TRUY CẬP</span>
          <Link className="login-brand-pill" to="/kham-pha"><i/>Sài Gòn Echo</Link>
        </header>
        <div className="login-form-wrap">
          <div className="login-lock-tile"><LockKeyhole size={23}/></div>
          <span className="login-form-kicker">CHÀO MỪNG TRỞ LẠI</span>
          <h2>Đăng nhập</h2>
          <p className="auth-description">Chọn vai trò để tiếp tục hành trình của bạn.</p>

          <div className="login-role-tabs" role="tablist" aria-label="Chọn loại tài khoản">
            {LOGIN_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={mode === id ? 'active' : ''}
                onClick={() => { setMode(id); setError(''); }}
              >
                <Icon size={17}/><span>{label}</span>
              </button>
            ))}
          </div>

          {location.state?.expired && (
            <p className="auth-notice" role="status">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</p>
          )}
          {error && <p className="error-text" role="alert">{error}</p>}

          <form className="login-form" onSubmit={submit}>
            <label className="field auth-field">
              <span>Tên đăng nhập <b>*</b></span>
              <input
                autoComplete="username"
                autoFocus
                maxLength={100}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nhập tên đăng nhập"
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
              <span>{busy ? 'Đang đăng nhập...' : `Đăng nhập ${activeMode.label.toLocaleLowerCase('vi')}`}</span>
              <ArrowRight size={18}/>
            </button>
          </form>

          {mode === 'user' ? (
            <p className="login-account-link">Chưa có tài khoản? <Link to="/dang-ky">Đăng ký ngay</Link></p>
          ) : (
            <p className="login-security-note"><LockKeyhole size={14}/> Chỉ dành cho tài khoản quản trị được cấp quyền.</p>
          )}

          <div className="login-guest-option">
            <span>Chỉ muốn khám phá?</span>
            <Link to="/kham-pha"><Headphones size={16}/> Tiếp tục với vai trò khách <ArrowRight size={14}/></Link>
            <small>Khách không hiển thị lịch sử nghe và địa điểm yêu thích.</small>
          </div>
        </div>
        <footer className="login-footer">
          <span>© 2026 Sài Gòn Echo</span><span>Nghe thành phố kể chuyện.</span>
        </footer>
      </section>
    </main>
  );
}
