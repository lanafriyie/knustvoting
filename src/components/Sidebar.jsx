import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  LayoutDashboard, 
  BarChart3, 
  Vote, 
  ShieldCheck, 
  Eye, 
  BookOpen, 
  FileText, 
  CreditCard, 
  Coins, 
  Activity, 
  Users, 
  Award, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  X as XIcon
} from 'lucide-react';
import StepUpAuthModal from './StepUpAuthModal';
import AppBarRoleSwitcher from './AppBarRoleSwitcher';
import SidebarSearch from './SidebarSearch';
import { showToast } from '../lib/toast';
import '../styles/SecureVote.css';

export default function Sidebar({
  navigate,
  hasECAccess,
  ecRole,
  ecJurisdictionName,
  currentView,
  onViewChange,
  onNavigate,
  isMobileOpen
}) {
  const [isStepUpOpen, setStepUpOpen] = useState(false);
  const [isCollapsedState, setIsCollapsedState] = useState(false);
  const [activeRoute, setActiveRoute] = useState(() => window.location.pathname || '/');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark';
  });

  const isCollapsed = isCollapsedState && !isMobileOpen;

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

  function handlePlaceholderClick(e, featureName) {
    e.preventDefault();
    showToast(`AIM Portal Simulator: "${featureName}" is a placeholder representing the integration of Secure Vote within the KNUST AIM App.`, 'info');
  }

  function closeDrawer() {
    if (typeof onNavigate === 'function') onNavigate();
  }

  const getItemClass = (path) => {
    const isCurrent =
      path === '/'
        ? activeRoute === '/' || activeRoute === ''
        : activeRoute === path || activeRoute.startsWith(path);

    const baseClass = isCurrent
      ? "bg-[#EAF6F0] dark:bg-slate-800 text-[#075C42] dark:text-emerald-400 font-bold border-l-4 border-[#007A4D] rounded-r-xl transition-colors shadow-2xs"
      : "text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl transition-colors";

    return `${baseClass} px-3 py-2 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`;
  };

  const getSecureVoteClass = () => {
    const isCurrent = activeRoute === '/secure-vote' || activeRoute.startsWith('/secure-vote');
    const baseClass = isCurrent
      ? "bg-[#EAF6F0] dark:bg-slate-800 text-[#075C42] dark:text-emerald-400 font-bold border-l-4 border-[#007A4D] rounded-r-xl transition-colors shadow-2xs"
      : "bg-[#EAF6F0]/60 hover:bg-[#EAF6F0] dark:bg-slate-800/40 dark:hover:bg-slate-800 text-[#075C42] dark:text-emerald-400 font-semibold border-l-4 border-transparent hover:border-[#007A4D] rounded-r-xl transition-colors";

    return `${baseClass} px-3 py-2 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`;
  };

  return (
    <nav 
      className={`app-sidebar fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col justify-between overflow-y-auto shrink-0 bg-white dark:bg-slate-900 border-r border-[#DDE5E1] dark:border-slate-800 p-4 text-[#202522] dark:text-slate-100 transition-all duration-300 ${
        isCollapsed ? 'md:w-20' : 'md:w-64'
      } ${
        isMobileOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full md:translate-x-0'
      }`} 
      aria-label="Main navigation"
    >
      <div>
        {/* Brand / Portal Title */}
        <div className="sidebar-brand flex items-center justify-between pb-3 mb-3 border-b border-[#DDE5E1] dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#004D40] to-[#002d25] flex items-center justify-center text-white border border-[#D4AF37] shadow-sm flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-[#D4AF37]" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col">
                <span className="sidebar-brand-title font-black text-[#007A4D] dark:text-slate-100 text-sm tracking-wider uppercase leading-none">KNUST</span>
                <span className="text-[10px] font-bold text-[#D4AF37] dark:text-amber-400 tracking-widest uppercase leading-none mt-0.5">AIM Portal</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCollapsedState(!isCollapsedState)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 transition-colors border-none bg-transparent cursor-pointer hidden md:flex items-center justify-center"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          
          {/* Mobile close menu button */}
          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 transition-colors border-none bg-transparent cursor-pointer flex md:hidden items-center justify-center"
            title="Close Menu"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Role Switcher - only visible if user has EC access */}
        {(!isCollapsed || isMobileOpen) && (
          <AppBarRoleSwitcher
            hasECAccess={hasECAccess}
            ecRole={ecRole}
            ecJurisdictionName={ecJurisdictionName}
            currentView={currentView}
            onViewChange={onViewChange}
          />
        )}

        {/* Real-time Search Autocomplete */}
        <SidebarSearch
          navigate={navigate}
          onNavigate={onNavigate}
          onSecureVoteClick={handleSecureVoteClick}
          isCollapsed={isCollapsed}
        />

        <ul className="sidebar-list mt-2 space-y-1">
          {/* ── Overview Section ── */}
          <li className={`text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2 ${isCollapsed ? 'text-center text-[9px]' : ''}`}>
            {isCollapsed ? '•' : 'OVERVIEW'}
          </li>
          <li className="sidebar-item">
            <a
              href="#dashboard"
              onClick={e => go(e, '/')}
              className={getItemClass('/')}
              title={isCollapsed ? "Dashboard" : undefined}
            >
              <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Dashboard</span>}
            </a>
          </li>

          {/* ── Academics Section ── */}
          <li className={`text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2 ${isCollapsed ? 'text-center text-[9px]' : ''}`}>
            {isCollapsed ? '•' : 'ACADEMICS'}
          </li>
          <li className="sidebar-subitem sidebar-placeholder-muted">
            <a 
              href="#course-reg" 
              onClick={e => handlePlaceholderClick(e, 'Course Registration')} 
              className={`text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center transition-colors ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}
              title={isCollapsed ? "Course Registration (Mock)" : undefined}
            >
              <BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span>Course Registration</span>
                  <span className="sidebar-placeholder-tag">Mock</span>
                </>
              )}
            </a>
          </li>
          <li className="sidebar-subitem sidebar-placeholder-muted">
            <a 
              href="#reg-slip" 
              onClick={e => handlePlaceholderClick(e, 'Registration Slip')} 
              className={`text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center transition-colors ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}
              title={isCollapsed ? "Registration Slip (Mock)" : undefined}
            >
              <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span>Registration Slip</span>
                  <span className="sidebar-placeholder-tag">Mock</span>
                </>
              )}
            </a>
          </li>
          <li className="sidebar-subitem">
            <a 
              href="#results" 
              onClick={e => go(e, '/results')} 
              className={getItemClass('/results')}
              title={isCollapsed ? "Check Results" : undefined}
            >
              <BarChart3 className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Check Results</span>}
            </a>
          </li>

          {/* ── Finance Section ── */}
          <li className={`text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2 ${isCollapsed ? 'text-center text-[9px]' : ''}`}>
            {isCollapsed ? '•' : 'FINANCE'}
          </li>
          <li className="sidebar-subitem sidebar-placeholder-muted">
            <a 
              href="#bills" 
              onClick={e => handlePlaceholderClick(e, 'Bill & Payment')} 
              className={`text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center transition-colors ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}
              title={isCollapsed ? "Bill & Payment (Mock)" : undefined}
            >
              <CreditCard className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span>Bill &amp; Payment</span>
                  <span className="sidebar-placeholder-tag">Mock</span>
                </>
              )}
            </a>
          </li>
          <li className="sidebar-subitem sidebar-placeholder-muted">
            <a 
              href="#fees" 
              onClick={e => handlePlaceholderClick(e, 'Fees Status')} 
              className={`text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center transition-colors ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}
              title={isCollapsed ? "Fees Status (Mock)" : undefined}
            >
              <Coins className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span>Fees Status</span>
                  <span className="sidebar-placeholder-tag">Mock</span>
                </>
              )}
            </a>
          </li>

          {/* ── Governance Section ── */}
          <li className={`text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2 ${isCollapsed ? 'text-center text-[9px]' : ''}`}>
            {isCollapsed ? '•' : 'GOVERNANCE'}
          </li>

          {/* Secure Vote Item */}
          <li className="secure-vote-item my-1">
            <a
              href="#secure-vote"
              id="sidebar-secure-vote-btn"
              onClick={handleSecureVoteClick}
              aria-haspopup="dialog"
              className={getSecureVoteClass()}
              title={isCollapsed ? "Secure Vote" : undefined}
            >
              <Vote className="w-4 h-4 text-[#007A4D] dark:text-emerald-400 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="text-[#075C42] dark:text-emerald-400">Secure Vote</span>
                  <span className="ml-auto bg-[#FFF7DF] text-[#B88618] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#D6A72C]/40 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60 shadow-2xs">
                    NEW
                  </span>
                </>
              )}
            </a>
          </li>

          {/* EC Admin & Observer Room */}
          <li className="sidebar-subitem">
            <a 
              href="#ec-admin" 
              onClick={e => go(e, '/ec-admin')} 
              className={getItemClass('/ec-admin')}
              title={isCollapsed ? "EC Admin" : undefined}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>EC Admin</span>}
            </a>
          </li>
          <li className="sidebar-subitem">
            <a 
              href="#candidate-agent" 
              onClick={e => go(e, '/candidate-agent')} 
              className={getItemClass('/candidate-agent')}
              title={isCollapsed ? "Observer Room" : undefined}
            >
              <Eye className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Observer Room</span>}
            </a>
          </li>

          {/* ── Utilities Section ── */}
          <li className={`text-[#66716C] dark:text-slate-400 font-bold text-[11px] tracking-wider uppercase mt-4 mb-2 px-2 ${isCollapsed ? 'text-center text-[9px]' : ''}`}>
            {isCollapsed ? '•' : 'UTILITIES'}
          </li>
          <li className="sidebar-subitem sidebar-placeholder-muted">
            <a 
              href="#status" 
              onClick={e => handlePlaceholderClick(e, 'Status Checker')} 
              className={`text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center transition-colors ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}
              title={isCollapsed ? "Status Checker (Mock)" : undefined}
            >
              <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span>Status Checker</span>
                  <span className="sidebar-placeholder-tag">Mock</span>
                </>
              )}
            </a>
          </li>
          <li className="sidebar-subitem sidebar-placeholder-muted">
            <a 
              href="#lecturers" 
              onClick={e => handlePlaceholderClick(e, 'Select Lecturers')} 
              className={`text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center transition-colors ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}
              title={isCollapsed ? "Select Lecturers (Mock)" : undefined}
            >
              <Users className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span>Select Lecturers</span>
                  <span className="sidebar-placeholder-tag">Mock</span>
                </>
              )}
            </a>
          </li>
          <li className="sidebar-subitem sidebar-placeholder-muted">
            <a 
              href="#admission" 
              onClick={e => handlePlaceholderClick(e, 'Admission Letter')} 
              className={`text-[#202522] hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-1.5 flex items-center transition-colors ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}
              title={isCollapsed ? "Admission Letter (Mock)" : undefined}
            >
              <Award className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span>Admission Letter</span>
                  <span className="sidebar-placeholder-tag">Mock</span>
                </>
              )}
            </a>
          </li>
        </ul>
      </div>

      {/* Logout zone with subtle divider */}
      <div className="sidebar-logout pt-3 border-t border-[#DDE5E1] dark:border-slate-800 mt-4">
        <button
          type="button"
          className={`logout-btn w-full flex items-center justify-center rounded-xl text-[#66716C] dark:text-slate-300 hover:text-[#075C42] dark:hover:text-emerald-400 hover:bg-[#F3FAF6] dark:hover:bg-slate-800 border border-transparent hover:border-[#DDE5E1] dark:hover:border-slate-700 text-xs font-bold transition-all cursor-pointer group ${isCollapsed ? 'px-1 py-2' : 'gap-2.5 px-3 py-2'}`}
          onClick={() => {
            console.log('Logout clicked');
          }}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="w-4 h-4 text-[#66716C] dark:text-slate-300 group-hover:text-[#075C42] dark:group-hover:text-emerald-400 transition-colors flex-shrink-0" />
          {!isCollapsed && <span>Logout</span>}
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

