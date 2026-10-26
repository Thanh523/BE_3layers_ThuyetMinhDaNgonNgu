// Bố cục quản trị dùng chung cho dashboard và các trang nội dung.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, AudioLines, FileText, Images, LogOut, MapPinned, Menu, QrCode, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IS_AUTH_DEMO, IS_DEMO, logout } from '../../services/api';

const MENU = [
  { to: '/admin/tong-quan', label: 'Tổng quan', icon: Activity, code: '00' },
  { to: '/admin/dia-diem', label: 'Quản lý địa điểm', icon: MapPinned, code: '01' },
  { to: '/admin/noi-dung', label: 'Nội dung thuyết minh', icon: FileText, code: '02' },
  { to: '/admin/hinh-anh', label: 'Quản lý hình ảnh', icon: Images, code: '03' },
  { to: '/admin/am-thanh', label: 'Quản lý âm thanh', icon: AudioLines, code: '04' },
  { to: '/admin/ma-qr', label: 'Quản lý mã QR', icon: QrCode, code: '05' },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(() =>
    window.matchMedia('(max-width: 960px)').matches
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 960px)');
    const updateViewport = (event) => setIsMobileNav(event.matches);
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  const toggleSidebar = () => {
    if (isMobileNav) setMobileOpen((open) => !open);
    else setSidebarCollapsed((collapsed) => !collapsed);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      navigate('/dang-nhap', { replace: true });
    } catch (error) {
      setLogoutError(error.message || 'Không thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setLoggingOut(false);
    }
  };

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    {mobileOpen && <button className="drawer-scrim" onClick={() => setMobileOpen(false)} aria-label="Đóng menu" />}
    <aside id="admin-sidebar" className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="side-brand"><div className="brand-symbol">◖</div><div><strong>Sài Gòn Echo</strong><small>CÂU CHUYỆN QUANH BẠN</small></div><button className="icon-button close-mobile" onClick={() => setMobileOpen(false)} aria-label="Đóng"><X size={18}/></button></div>
      <div className="side-caption">KHÔNG GIAN QUẢN TRỊ</div>
      <nav className="side-nav" aria-label="Chức năng quản trị">
        {MENU.map(item => <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
          <item.icon size={19}/><span>{item.label}</span><small>{item.code}</small>
        </NavLink>)}
      </nav>
    </aside>
    <div className="workspace">
      <header className="topbar"><button
        className="icon-button sidebar-toggle"
        onClick={toggleSidebar}
        aria-label={isMobileNav ? (mobileOpen ? 'Đóng menu' : 'Mở menu') : (sidebarCollapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng')}
        aria-expanded={isMobileNav ? mobileOpen : !sidebarCollapsed}
        aria-controls="admin-sidebar"
        title={isMobileNav ? 'Menu' : 'Đóng/mở thanh điều hướng'}
        type="button"
      ><Menu size={22}/></button>
        <div className="topbar-brand"><span className="eyebrow">SÀI GÒN ECHO / ADMIN</span><span className="topbar-subtitle">Hành trình kể chuyện về thành phố</span></div>
        <div className="admin-profile"><span className="avatar">A</span><span>Quản trị viên<small>{IS_AUTH_DEMO ? 'Phiên demo' : 'Phiên SQL Server'}</small></span></div>
        <button className="topbar-logout" disabled={loggingOut} onClick={handleLogout} type="button">
          <LogOut size={16}/>{loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </button>
      </header>
      {logoutError && <p className="error-text logout-error" role="alert">{logoutError}</p>}
      <main className="main-content"><Outlet /></main>
      <footer className="app-footer">© 2026 Sài Gòn Echo · {IS_DEMO
        ? IS_AUTH_DEMO ? 'Dữ liệu frontend demo · Đăng nhập demo' : 'Dữ liệu frontend demo · Đăng nhập SQL Server'
        : 'Backend: xác thực, thống kê và thuyết minh'} · 5 nhóm chức năng quản trị</footer>
    </div>
  </div>;
}
