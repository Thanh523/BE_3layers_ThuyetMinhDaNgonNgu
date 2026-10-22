import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, Heart, Headphones, LogOut, Shield } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDemoData } from '../contexts/DemoDataContext';
import { CATS } from '../pages/User/pageData';
import { getUserSession, logoutUser, SESSION_EVENT, startUserSessionActivity } from '../services/api';

export default function UserLayout() {
  const { data, accountScope, setAccountScope, favorites, toggleFavorite, history, clearHistory, notify } = useDemoData();
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const requiresAccount = location.pathname === '/yeu-thich' || location.pathname === '/lich-su';

  const loadUserSession = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const sessionUser = await getUserSession();
      setUser(sessionUser);
      setAccountScope(sessionUser?.id);
      setStatus(sessionUser ? 'authenticated' : 'guest');
    } catch (sessionError) {
      setError(sessionError.message || 'Không thể kiểm tra phiên người dùng.');
      setUser(null);
      setAccountScope(null);
      setStatus('guest');
    }
  }, [setAccountScope]);

  useEffect(() => { loadUserSession(); }, [loadUserSession, retry]);

  useEffect(() => {
    if (status === 'guest' && requiresAccount) {
      navigate('/dang-nhap?role=user', {
        replace: true,
        state: { role: 'user', from: location.pathname },
      });
    }
  }, [location.pathname, navigate, requiresAccount, status]);

  useEffect(() => {
    const expireSession = () => {
      setUser(null);
      setAccountScope(null);
      setStatus('guest');
      navigate('/dang-nhap?role=user', {
        replace: true,
        state: { role: 'user', from: location.pathname, expired: true },
      });
    };
    window.addEventListener(SESSION_EVENT, expireSession);
    return () => window.removeEventListener(SESSION_EVENT, expireSession);
  }, [location.pathname, navigate, setAccountScope]);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    return startUserSessionActivity(() => {
      setUser(null);
      setAccountScope(null);
      setStatus('guest');
      navigate('/dang-nhap?role=user', {
        replace: true,
        state: { role: 'user', from: location.pathname, expired: true },
      });
    });
  }, [location.pathname, navigate, setAccountScope, status]);

  useEffect(() => {
    if (status === 'guest' && accountScope !== 'guest') setAccountScope(null);
  }, [accountScope, setAccountScope, status]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
      setUser(null);
      setAccountScope(null);
      setStatus('guest');
      navigate('/kham-pha', { replace: true });
    } catch (logoutError) {
      notify(logoutError.message || 'Không thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setLoggingOut(false);
    }
  };

  const places = useMemo(() => data.locations
    .filter((place) => place.visible)
    .map((place) => {
      const narrations = data.narrations.filter(
        (item) => item.locationId === place.id && item.visible !== false,
      );
      return {
        ...place,
        texts: Object.fromEntries(narrations.map((item) => [item.lang, item.text || ''])),
      };
    }), [data.locations, data.narrations]);

  const openPlace = (place) => {
    if (!place?.slug) {
      notify('Địa điểm này chưa có đường dẫn công khai.');
      return;
    }
    navigate(`/tham-quan/${encodeURIComponent(place.slug)}`);
  };

  const outletContext = {
    places,
    favs: status === 'authenticated' ? favorites : [],
    cat: category,
    setCat: setCategory,
    q: query,
    setQ: setQuery,
    sort,
    setSort,
    canSave: status === 'authenticated',
    toggleFav: toggleFavorite,
    openPlace,
    hist: status === 'authenticated' ? history : [],
    clearHistory,
    say: notify,
    onScan: () => notify('Tính năng quét QR trực tiếp đang được cập nhật. Bạn có thể quét mã bằng camera để mở đường dẫn địa điểm.'),
  };

  if (status === 'loading') {
    return <main className="login-loading" aria-live="polite"><p>Đang kiểm tra tài khoản...</p></main>;
  }

  if (requiresAccount && status !== 'authenticated') return null;

  return (
    <div className="user-site">
      <header className="user-header">
        <Link className="user-brand" to="/kham-pha" aria-label="Sài Gòn Echo - Khám phá">
          <span className="brand-symbol">◖</span>
          <span><strong>Sài Gòn Echo</strong><small>STORIES AROUND YOU</small></span>
        </Link>
        <nav className="user-nav" aria-label="Điều hướng chính">
          <NavLink to="/kham-pha"><Compass size={16}/>Khám phá</NavLink>
          {user && <>
            <NavLink to="/yeu-thich"><Heart size={16}/>Đã lưu</NavLink>
            <NavLink to="/lich-su"><Headphones size={16}/>Lịch sử nghe</NavLink>
          </>}
        </nav>
        {user
          ? <div className="user-account-actions"><span className="user-greeting">{user.name}</span><button className="btn small user-admin-link" type="button" disabled={loggingOut} onClick={handleLogout}><LogOut size={15}/>{loggingOut ? 'Đang thoát...' : 'Đăng xuất'}</button></div>
          : <Link className="btn small user-admin-link" to="/dang-nhap?role=user"><Shield size={15}/> Đăng nhập</Link>}
      </header>
      <main className="user-main">
        {error && <p className="auth-notice user-session-warning" role="status">{error} Bạn vẫn có thể tiếp tục với vai trò khách.</p>}
        <Outlet context={{ ...outletContext, user }}/>
      </main>
      <footer className="user-footer">
        <span><BookOpen size={15}/> Sài Gòn Echo · Nghe thành phố kể chuyện</span>
        <span>Địa điểm và nội dung được quản lý bởi Sài Gòn Echo</span>
      </footer>
    </div>
  );
}
