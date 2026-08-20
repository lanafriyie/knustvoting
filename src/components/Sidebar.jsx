import React, { useState, useEffect } from 'react';
import StepUpAuthModal from './StepUpAuthModal';
import AppBarRoleSwitcher from './AppBarRoleSwitcher';
import SidebarSearch from './SidebarSearch';
import '../styles/SecureVote.css';

export default function Sidebar({
  navigate,
  hasECAccess,
  ecRole,
  ecJurisdictionName,
  currentView,
  onViewChange,
  onNavigate  // auto-close mobile drawer after clicking a link
}) {
  const [isStepUpOpen, setStepUpOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState(() => window.location.pathname || '/');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setActiveRoute(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  function handleSecureVoteClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    setActiveRoute('/secure-vote');
    setStepUpOpen(true);
    closeDrawer();
  }

  function go(e, path) {
    e.preventDefault();
    setActiveRoute(path);
    if (typeof navigate === 'function') navigate(path);
    if (typeof onNavigate === 'function') onNavigate();
  }

  function closeDrawer() {
    if (typeof onNavigate === 'function') onNavigate();
  }

  const getItemClass = (path) => {
    const isCurrent =
      path === '/'
        ? activeRoute === '/' || activeRoute === ''
        : activeRoute === path || activeRoute.startsWith(path);

    if (isCurrent) {
      return "bg-[#EAF6F0] dark:bg-slate-800 text-[#075C42] dark:text-emerald-400 font-bold border-l-4 border-[#007A4D] rounded-r-xl px-3 py-2 flex items-center gap-2.5 transition-colors shadow-2xs";
    }
    return "text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-2 flex items-center gap-2.5 transition-colors";
  };

  const getSecureVoteClass = () => {
    const isCurrent = activeRoute === '/secure-vote' || activeRoute.startsWith('/secure-vote');
    if (isCurrent) {
      return "bg-[#EAF6F0] dark:bg-slate-800 text-[#075C42] dark:text-emerald-400 font-bold border-l-4 border-[#007A4D] rounded-r-xl px-3 py-2 flex items-center gap-2.5 transition-colors shadow-2xs";
    }
    return "bg-[#EAF6F0]/60 hover:bg-[#EAF6F0] dark:bg-slate-800/40 dark:hover:bg-slate-800 text-[#075C42] dark:text-emerald-400 font-semibold border-l-4 border-transparent hover:border-[#007A4D] rounded-r-xl px-3 py-2 flex items-center gap-2.5 transition-colors";
  };

  return (
    <nav className="app-sidebar bg-white dark:bg-slate-900 border-r border-[#DDE5E1] dark:border-slate-800 p-4 w-64 h-screen flex flex-col justify-between overflow-y-auto shrink-0 text-[#202522] dark:text-slate-100" aria-label="Main navigation">
      <div>
        {/* Brand / Portal Title */}
        <div className="sidebar-brand flex items-center gap-2 pb-3 mb-3 border-b border-[#DDE5E1] dark:border-slate-800">
          <span className="text-xl">🎓</span>
          <span className="sidebar-brand-title font-extrabold text-[#007A4D] dark:text-slate-100 text-base tracking-tight">KNUST AIM Portal</span>
        </div>

        {/* Role Switcher - only visible if user has EC access */}
        <AppBarRoleSwitcher
          hasECAccess={hasECAccess}
          ecRole={ecRole}
          ecJurisdictionName={ecJurisdictionName}
          currentView={currentView}
          onViewChange={onViewChange}
        />

        {/* Real-time Search Autocomplete */}
        <SidebarSearch
          navigate={navigate}
          onNavigate={onNavigate}
          onSecureVoteClick={handleSecureVoteClick}
        />

        <ul className="sidebar-list mt-2 space-y-1">
          {/* ── Overview Section ── */}
          <li className="text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2">
            OVERVIEW
          </li>
          <li className="sidebar-item">
            <a
              href="#dashboard"
              onClick={e => go(e, '/')}
              className={getItemClass('/')}
            >
              <span>📊</span>
              <span>Dashboard</span>
            </a>
          </li>

          {/* ── Academics Section ── */}
          <li className="text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2">
            ACADEMICS
          </li>
          <li className="sidebar-subitem">
            <a href="#course-reg" onClick={e => e.preventDefault()} className="text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">Course Registration</a>
          </li>
          <li className="sidebar-subitem">
            <a href="#reg-slip" onClick={e => e.preventDefault()} className="text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">Registration Slip</a>
          </li>
          <li className="sidebar-subitem">
            <a href="#results" onClick={e => go(e, '/results')} className={getItemClass('/results')}>Check Results 📊</a>
          </li>

          {/* ── Finance Section ── */}
          <li className="text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2">
            FINANCE
          </li>
          <li className="sidebar-subitem">
            <a href="#bills" onClick={e => e.preventDefault()} className="text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">Bill &amp; Payment</a>
          </li>
          <li className="sidebar-subitem">
            <a href="#fees" onClick={e => e.preventDefault()} className="text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">Fees Status</a>
          </li>

          {/* ── Governance Section ── */}
          <li className="text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2">
            GOVERNANCE
          </li>

          {/* Secure Vote Item */}
          <li className="secure-vote-item my-1">
            <a
              href="#secure-vote"
              id="sidebar-secure-vote-btn"
              onClick={handleSecureVoteClick}
              aria-haspopup="dialog"
              className={getSecureVoteClass()}
            >
              <span className="text-[#007A4D] dark:text-emerald-400">🗳️</span>
              <span className="text-[#075C42] dark:text-emerald-400">Secure Vote</span>
              <span className="ml-auto bg-[#FFF7DF] text-[#B88618] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#D6A72C]/40 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60 shadow-2xs">
                NEW
              </span>
            </a>
          </li>

          {/* EC Admin & Observer Room */}
          <li className="sidebar-subitem">
            <a href="#ec-admin" onClick={e => go(e, '/ec-admin')} className={getItemClass('/ec-admin')}>EC Admin</a>
          </li>
          <li className="sidebar-subitem">
            <a href="#candidate-agent" onClick={e => go(e, '/candidate-agent')} className={getItemClass('/candidate-agent')}>Observer Room</a>
          </li>

          {/* ── Utilities Section ── */}
          <li className="text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2">
            UTILITIES
          </li>
          <li className="sidebar-subitem">
            <a href="#status" onClick={e => e.preventDefault()} className="text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">Status Checker</a>
          </li>
          <li className="sidebar-subitem">
            <a href="#lecturers" onClick={e => e.preventDefault()} className="text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">Select Lecturers</a>
          </li>
          <li className="sidebar-subitem">
            <a href="#admission" onClick={e => e.preventDefault()} className="text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center gap-2 transition-colors">Admission Letter</a>
          </li>
        </ul>
      </div>

      {/* Logout zone with subtle divider */}
      <div className="sidebar-logout pt-3 border-t border-[#DDE5E1] dark:border-slate-800 mt-4">
        <button
          type="button"
          className="logout-btn w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[#66716C] dark:text-slate-300 hover:text-[#075C42] dark:hover:text-emerald-400 hover:bg-[#F3FAF6] dark:hover:bg-slate-800 border border-transparent hover:border-[#DDE5E1] dark:hover:border-slate-700 text-xs font-bold transition-all cursor-pointer group"
          onClick={() => {
            console.log('Logout clicked');
          }}
        >
          <span className="text-[#66716C] dark:text-slate-300 group-hover:text-[#075C42] dark:group-hover:text-emerald-400 transition-colors">↪</span>
          <span>Logout</span>
        </button>
      </div>

      {/* Step-Up Auth Modal */}
      <StepUpAuthModal
        isOpen={isStepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onSuccess={() => {
          setStepUpOpen(false);
          closeDrawer();
          if (typeof navigate === 'function') {
            navigate('/secure-vote');
          } else {
            window.history.pushState({}, '', '/secure-vote');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }}
      />
    </nav>
  );
}
