import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserPlus } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getSession, getUserSession, registerUser } from '../../services/api';
import PlaceArtwork from '../../components/shared/PlaceArtwork';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [error, setError] = useState('');

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
    return <Navigate to={sessionUser.role === 'admin' ? '/admin/tong-quan' : '/kham-pha'} replace />;
  }
  if (checkingSession) {
    return <main className="login-loading" aria-live="polite"><p>Đang kiểm tra phiên đăng nhập...</p></main>;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 12) {
      setError('Mật khẩu cần có ít nhất 12 ký tự.');
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    try {
      await registerUser({ fullName, email, username, password });
      navigate('/kham-pha', { replace: true });
    } catch (registrationError) {
      setError(registrationError.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Giới thiệu Sài Gòn Echo">
        <Link className="login-brand" to="/kham-pha" aria-label="Sài Gòn Echo">
          <span className="login-brand-mark" aria-hidden="true">◖</span>
          <span><strong>Sài Gòn Echo</strong><small>STORIES AROUND YOU</small></span>
        </Link>
        <div className="login-story-copy">
          <span className="login-kicker">YOUR SAIGON JOURNEY</span>
          <h1>Lưu lại những<br/>câu chuyện<br/><em>bạn yêu thích.</em></h1>
          <p>Tạo tài khoản để lưu địa điểm yêu thích và tiếp tục hành trình nghe của bạn.</p>
        </div>
        <div className="login-art-card">
          <PlaceArtwork
            place={{ name: 'Sài Gòn', artwork: 'palace', color: '#d5ded0' }}
            className="login-artwork"
          />
        </div>
        <span className="login-story-foot">THÀNH PHỐ HỒ CHÍ MINH · VIỆT NAM</span>
      </section>
      <section className="login-main">
        <header className="login-topbar">
          <span>TÀI KHOẢN NGƯỜI DÙNG</span>
          <Link className="login-brand-pill" to="/dang-nhap?role=user"><i/>Đăng nhập</Link>
        </header>
        <div className="login-form-wrap register-form-wrap">
          <div className="login-lock-tile"><UserPlus size={23}/></div>
          <span className="login-form-kicker">BẮT ĐẦU HÀNH TRÌNH</span>
          <h2>Tạo tài khoản</h2>
          <p className="auth-description">Thông tin tài khoản được lưu an toàn trên hệ thống.</p>
          {error && <p className="error-text" role="alert">{error}</p>}
          <form className="login-form" onSubmit={submit}>
            <label className="field auth-field">
              <span>Họ và tên <b>*</b></span>
              <input autoComplete="name" maxLength={100} onChange={(event) => setFullName(event.target.value)} placeholder="Nhập họ và tên" required value={fullName}/>
            </label>
            <label className="field auth-field">
              <span>Email <b>*</b></span>
              <input autoComplete="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" required type="email" value={email}/>
            </label>
            <label className="field auth-field">
              <span>Tên đăng nhập <b>*</b></span>
              <input autoComplete="username" minLength={3} maxLength={50} onChange={(event) => setUsername(event.target.value)} placeholder="3–50 ký tự: chữ, số, dấu . _ -" required value={username}/>
            </label>
            <label className="field auth-field">
              <span>Mật khẩu <b>*</b></span>
              <span className="auth-input-wrap">
                <input autoComplete="new-password" minLength={12} maxLength={128} onChange={(event) => setPassword(event.target.value)} placeholder="Ít nhất 12 ký tự" required type={showPassword ? 'text' : 'password'} value={password}/>
                <button aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>
              </span>
            </label>
            <label className="field auth-field">
              <span>Xác nhận mật khẩu <b>*</b></span>
              <input autoComplete="new-password" maxLength={128} onChange={(event) => setConfirmation(event.target.value)} placeholder="Nhập lại mật khẩu" required type={showPassword ? 'text' : 'password'} value={confirmation}/>
            </label>
            <button className="btn primary auth-submit" disabled={busy} type="submit">
              <span>{busy ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}</span><ArrowRight size={18}/>
            </button>
          </form>
          <p className="login-security-note"><LockKeyhole size={14}/> Mật khẩu được mã hóa trước khi lưu.</p>
          <p className="login-account-link">Đã có tài khoản? <Link to="/dang-nhap?role=user">Đăng nhập</Link></p>
        </div>
        <footer className="login-footer">
          <span>© 2026 Sài Gòn Echo</span><Link to="/kham-pha">Tiếp tục với vai trò khách</Link>
        </footer>
      </section>
    </main>
  );
}
