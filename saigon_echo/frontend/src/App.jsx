// Khai báo router: dashboard và 5 module quản trị.
// /tham-quan/:slug là trang xem công khai tối giản để kiểm tra QR, không phải Dashboard.
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import DashboardPage from './pages/Admin/DashboardPage';
import LocationsPage from './pages/Admin/LocationsPage';
import NarrationsPage from './pages/Admin/NarrationsPage';
import ImagesPage from './pages/Admin/ImagesPage';
import AudiosPage from './pages/Admin/AudiosPage';
import QRPage from './pages/Admin/QRPage';
import PublicPlacePage from './pages/Admin/PublicPlacePage';
import LoginPage from './pages/Auth/LoginPage';
import { getSession, SESSION_EVENT, startSessionActivity } from './services/api';

function RequireAdmin({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getSession()
      .then(user => {
        if (active) setStatus(user ? 'authenticated' : 'unauthenticated');
      })
      .catch(error => {
        if (active) {
          setError(error.message || 'Không thể kiểm tra phiên đăng nhập.');
          setStatus('error');
        }
      });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/dang-nhap', {
        replace: true,
        state: { from: location.pathname },
      });
    }
  }, [location.pathname, navigate, status]);

  useEffect(() => {
    const expireSession = () => {
      navigate('/dang-nhap', {
        replace: true,
        state: { from: location.pathname, expired: true },
      });
    };
    window.addEventListener(SESSION_EVENT, expireSession);
    return () => window.removeEventListener(SESSION_EVENT, expireSession);
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    return startSessionActivity(() => {
      navigate('/dang-nhap', {
        replace: true,
        state: { from: location.pathname, expired: true },
      });
    });
  }, [location.pathname, navigate, status]);

  if (status === 'authenticated') return children;
  if (status === 'error') {
    return (
      <main className="auth-screen">
        <section className="auth-card" role="alert">
          <div className="brand-symbol auth-brand-symbol">◖</div>
          <h1>Không thể kiểm tra đăng nhập</h1>
          <p className="auth-description">{error}</p>
          <button className="btn primary auth-submit" onClick={() => {
            setError('');
            setStatus('loading');
            setRetry(value => value + 1);
          }}>Thử lại</button>
        </section>
      </main>
    );
  }
  if (status === 'loading') {
    return <main className="auth-screen" aria-live="polite"><p>Đang kiểm tra phiên đăng nhập...</p></main>;
  }
  return null;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/admin/dia-diem" replace />} />
    <Route path="/dang-nhap" element={<LoginPage />} />
    <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
      <Route index element={<Navigate to="tong-quan" replace />} />
      <Route path="tong-quan" element={<DashboardPage />} />
      <Route path="dia-diem" element={<LocationsPage />} />
      <Route path="noi-dung" element={<NarrationsPage />} />
      <Route path="hinh-anh" element={<ImagesPage />} />
      <Route path="am-thanh" element={<AudiosPage />} />
      <Route path="ma-qr" element={<QRPage />} />
    </Route>
    <Route path="/tham-quan/:slug" element={<PublicPlacePage />} />
    <Route path="*" element={<Navigate to="/admin/dia-diem" replace />} />
  </Routes>;
}
