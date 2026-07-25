import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Users,
  Building,
  UploadCloud,
  FileSpreadsheet,
  Settings as SettingsIcon,
  UserCheck,
  Database,
  LogOut,
  Menu,
  X,
  User
} from 'lucide-react';
import { authAPI, settingsAPI } from '../api/client';

const BRAND_NAME = 'SKY ARIANA GROUP OF COMPANIES';
const BRAND_SUBTITLE = 'Money Transaction & Hawala Receipt Management System';
const BRAND_LOGO = '/sky-bbb-logo.png';

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sky_sidebar_collapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [settings, setSettings] = useState(null);
  const sidebarRef = useRef(null);
  const openButtonRef = useRef(null);
  const closeTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const handleLanguageToggle = () => {
    const languageCycle = ['en', 'fa', 'ps'];
    const currentIndex = languageCycle.indexOf(i18n.resolvedLanguage || i18n.language);
    const newLang = languageCycle[(currentIndex + 1) % languageCycle.length];
    i18n.changeLanguage(newLang);
    localStorage.setItem('sky_banking_lang', newLang);
  };

  const nextLanguageLabel = {
    en: 'دری',
    fa: 'پښتو',
    ps: 'English',
  }[i18n.resolvedLanguage || i18n.language] || 'English';

  const user = JSON.parse(localStorage.getItem('sky_banking_user') || '{}');

  useEffect(() => {
    // Fetch settings to display current company name
    settingsAPI.get()
      .then((res) => setSettings(res.data))
      .catch((err) => console.error('Failed to load settings', err));
  }, []);

  const handleLogout = () => {
    authAPI.logout();
    navigate('/login');
  };

  const allNavItems = [
    { name: t('nav.dashboard'), path: '/', icon: LayoutDashboard, roles: ['Admin', 'Accountant', 'Viewer'] },
    { name: t('nav.add_transaction'), path: '/add-transaction', icon: PlusCircle, roles: ['Admin', 'Accountant'] },
    { name: t('nav.transaction_history'), path: '/transactions', icon: History, roles: ['Admin', 'Accountant', 'Viewer'] },
    { name: t('nav.customer_ledger'), path: '/customer-ledger', icon: Users, roles: ['Admin', 'Accountant', 'Viewer'] },
    { name: 'Sarafi Ledger', path: '/sarafi-ledger', icon: Users, roles: ['Admin', 'Accountant', 'Viewer'] },
    { name: t('nav.bank_ledger'), path: '/bank-ledger', icon: Building, roles: ['Admin', 'Accountant', 'Viewer'] },

    { name: t('nav.reports'), path: '/reports', icon: FileSpreadsheet, roles: ['Admin', 'Accountant', 'Viewer'] },
    { name: t('nav.users'), path: '/users', icon: UserCheck, roles: ['Admin'] },
    { name: t('nav.backup'), path: '/backup', icon: Database, roles: ['Admin'] },
    { name: t('nav.settings'), path: '/settings', icon: SettingsIcon, roles: ['Admin'] },
  ];

  const userRole = user.role || 'Viewer';
  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const openSidebar = useCallback(() => {
    openButtonRef.current = document.activeElement;
    setSidebarOpen(true);
  }, []);

  const handleDrawerNavigation = useCallback((event, path) => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    event.preventDefault();
    closeSidebar();
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => navigate(path), 320);
  }, [closeSidebar, navigate]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!sidebarOpen) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // Swipe left gesture (negative X direction)
    if (Math.abs(diffX) > Math.abs(diffY) && diffX < -45) {
      closeSidebar();
    }
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    document.documentElement.classList.add('ios-scroll-lock');
    document.body.classList.add('ios-scroll-lock');

    const drawer = sidebarRef.current;
    const focusable = drawer?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeSidebar();
        return;
      }
      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.documentElement.classList.remove('ios-scroll-lock');
      document.body.classList.remove('ios-scroll-lock');
      document.removeEventListener('keydown', handleKeyDown);
      openButtonRef.current?.focus?.({ preventScroll: true });
    };
  }, [closeSidebar, sidebarOpen]);

  const companyName = BRAND_NAME;
  const isFormOrDetailView = 
    location.pathname.startsWith('/add-transaction') ||
    location.pathname.startsWith('/edit-transaction') ||

    /^\/transactions\/\d+/.test(location.pathname);

  const bottomTabs = [];
  bottomTabs.push({ name: t('nav.dashboard'), path: '/', icon: LayoutDashboard });
  bottomTabs.push({ name: t('nav.transaction_history'), path: '/transactions', icon: History });
  
  if (userRole === 'Admin' || userRole === 'Accountant') {
    bottomTabs.push({ name: t('nav.add_transaction'), path: '/add-transaction', icon: PlusCircle });
  } else {
    bottomTabs.push({ name: t('nav.reports'), path: '/reports', icon: FileSpreadsheet });
  }
  bottomTabs.push({ name: t('nav.customer_ledger'), path: '/customer-ledger', icon: Users });

  const labelSignOut = t('action.sign_out');
  const labelMore = t('nav.more');

  return (
    <div className="h-screen overflow-hidden print:h-auto print:overflow-visible bg-gradient-to-br from-[#f7fbff] via-[#eaf4ff] to-[#f8fbff] text-slate-900 flex flex-col">
      
      {/* Mobile Header Banner */}
      <header className="md:hidden w-full flex items-center justify-between px-4 bg-white/80 backdrop-blur-xl border-b border-sky-100 sticky top-0 z-40 pt-[env(safe-area-inset-top)] h-[calc(64px+env(safe-area-inset-top))] print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-100 bg-white shadow-lg shadow-sky-500/15">
            <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-full w-full object-contain p-1" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-black text-slate-900 leading-tight truncate max-w-[210px]">{companyName}</h1>
            <p className="text-[8px] text-sky-600 font-bold truncate max-w-[210px] uppercase tracking-wider">{BRAND_SUBTITLE}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
        <button 
          ref={openButtonRef}
          onClick={openSidebar}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-sky-50 text-sky-600 font-extrabold text-xs border border-sky-100 shadow-sm ios-button-tap"
          aria-label="Open navigation"
          aria-controls="mobile-navigation-drawer"
          aria-expanded={sidebarOpen}
        >
          {user.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
        </button>
      </div>
    </header>

    <div className="flex flex-1 min-h-0 overflow-hidden print:overflow-visible print:block">
      {/* Sidebar navigation */}
      <aside
        ref={sidebarRef}
        id="mobile-navigation-drawer"
        aria-label="Main navigation"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className={`mobile-drawer fixed inset-y-0 left-0 z-[60] h-[100dvh] w-[85vw] max-w-[340px] shrink-0 border-r border-sky-100 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur-2xl transition-all duration-300 ease-out will-change-transform md:relative md:z-auto md:h-full ${sidebarCollapsed ? 'md:w-[84px]' : 'md:w-[290px]'} md:max-w-none md:translate-x-0 md:bg-white/84 md:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className={`flex h-full min-h-0 flex-col overflow-hidden px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] ${sidebarCollapsed ? 'md:px-2 md:py-4' : 'md:p-4'}`}>
          {/* Header branding logo */}
          <div className="shrink-0 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div 
                className="flex flex-col items-center text-center gap-3 w-full pb-2 cursor-pointer transition-transform active:scale-95"
                onClick={() => {
                  if (window.matchMedia('(min-width: 768px)').matches) {
                    const newState = !sidebarCollapsed;
                    setSidebarCollapsed(newState);
                    localStorage.setItem('sky_sidebar_collapsed', JSON.stringify(newState));
                  }
                }}
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xl shadow-sky-500/10 transition-all duration-300 ${sidebarCollapsed ? 'h-12 w-12' : 'h-16 w-20'}`}>
                  <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-full w-full object-contain p-1" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0 px-2 transition-opacity duration-300">
                    <h2 className="text-[14px] font-black leading-tight text-slate-900 mx-auto max-w-[200px]">
                      {companyName}
                    </h2>
                    <span className="mt-1.5 block text-[8px] font-extrabold uppercase tracking-[0.15em] text-sky-600 leading-tight">
                      {BRAND_SUBTITLE}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={closeSidebar}
                className="md:hidden h-11 w-11 flex items-center justify-center text-sky-400 hover:bg-sky-50 rounded-xl absolute top-4 right-4"
                aria-label="Close navigation"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="nav-scrollbar flex-1 min-h-0 space-y-1 overflow-y-auto overflow-x-hidden border-t border-sky-100/70 py-3 pr-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  title={sidebarCollapsed ? item.name : undefined}
                  onClick={(event) => handleDrawerNavigation(event, item.path)}
                  className={`group flex h-11 items-center gap-3 rounded-xl ${sidebarCollapsed ? 'px-0 justify-center' : 'px-4'} text-[13.5px] font-black transition-all duration-300 ios-button-tap ${
                    isActive
                      ? 'bg-white text-sky-600 shadow-md shadow-sky-950/5 border border-sky-100 ring-4 ring-sky-50/50'
                      : 'text-slate-600 hover:bg-sky-50/50 hover:text-sky-950 active:bg-sky-100/50'
                  }`}
                >
                  <IconComponent
                    size={18}
                    className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                      isActive ? 'text-sky-500' : 'text-slate-400 group-hover:text-sky-500'
                    }`}
                  />
                  {!sidebarCollapsed && <span className="min-w-0 truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Footer profile & logout */}
          <div className={`shrink-0 border-t border-sky-100/80 pt-3 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
            <div className={`rounded-2xl border border-sky-100 bg-white/72 shadow-sm shadow-sky-950/[0.03] ${sidebarCollapsed ? 'p-2 w-full flex flex-col items-center gap-2' : 'p-3'}`}>
              <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600" title={user.name || t('common.admin_user')}>
                  <User size={17} />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-black text-slate-900">{user.name || t('common.admin_user')}</h4>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-600">{user.role || t('common.viewer')}</p>
                  </div>
                )}
              </div>
              <div className={`flex gap-2 ${sidebarCollapsed ? 'flex-col w-full mt-1' : 'mt-3'}`}>
                <button
                  onClick={handleLanguageToggle}
                  title={nextLanguageLabel}
                  className={`flex h-10 items-center justify-center rounded-lg border border-sky-100 bg-white/70 text-[11px] font-bold text-slate-600 transition-all duration-200 hover:bg-sky-50 hover:text-sky-600 ios-button-tap ${sidebarCollapsed ? 'w-full px-1' : 'flex-1 px-2'}`}
                >
                  {sidebarCollapsed ? (i18n.resolvedLanguage === 'en' ? 'EN' : 'FA') : nextLanguageLabel}
                </button>
                <button
                  onClick={handleLogout}
                  title={t('common.logout')}
                  className={`flex h-10 items-center justify-center rounded-lg border border-rose-100 bg-rose-50/50 text-[11px] font-bold text-rose-600 transition-all duration-200 hover:bg-rose-100 ios-button-tap ${sidebarCollapsed ? 'w-full px-1' : 'flex-1 gap-1.5 px-2'}`}
                >
                  <LogOut size={13} strokeWidth={2.5} />
                  {!sidebarCollapsed && <span>{t('common.logout')}</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
      {/* Main content body */}
      <main className={`app-scrollbar flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 xl:p-8 print:overflow-visible print:p-0 ${
        isFormOrDetailView 
          ? 'pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-8 print:pb-0' 
          : 'pb-[calc(92px+env(safe-area-inset-bottom))] md:pb-8 print:pb-0'
      }`}>
        <div key={location.pathname} className="page-enter">
          {children}
        </div>
      </main>
    </div>

    {/* iOS Bottom Tab Navigation for Mobile */}
    {!isFormOrDetailView && (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-2xl border-t border-sky-100/60 flex items-center justify-around px-2 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,32,60,0.05)] min-h-[64px]">
        {bottomTabs.map((item) => {
          const IconComponent = item.icon;
          const isActive = item.path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 text-[9px] font-black transition-all duration-200 active:scale-95 min-h-[48px] ${
                isActive ? 'text-sky-600 font-extrabold' : 'text-slate-400'
              }`}
            >
              <div className={`flex items-center justify-center rounded-2xl w-14 h-7 transition-all ${
                isActive ? 'bg-sky-500/10 text-sky-600' : 'text-slate-400 hover:text-slate-600'
              }`}>
                <IconComponent size={20} className="shrink-0" />
              </div>
              <span className="truncate max-w-[72px] tracking-tight">{item.name}</span>
            </Link>
          );
        })}
        {/* More Tab */}
        <button
          onClick={openSidebar}
          className="flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 text-[9px] font-black text-slate-400 active:scale-95 min-h-[48px]"
        >
          <div className="flex items-center justify-center rounded-2xl w-14 h-7 hover:text-slate-600">
            <Menu size={20} className="shrink-0" />
          </div>
          <span className="tracking-tight">{labelMore}</span>
        </button>
      </nav>
    )}

    {/* Backdrop overlay for mobile sidebar drawer */}
    <button
      type="button"
      onClick={closeSidebar}
      className={`fixed inset-0 z-[55] w-screen h-screen bg-slate-950/45 backdrop-blur-[3px] transition-opacity duration-300 md:hidden ${
        sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-label="Close navigation"
      tabIndex={sidebarOpen ? 0 : -1}
    />
  </div>
  );
}
