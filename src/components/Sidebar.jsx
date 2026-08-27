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
  X
} from 'lucide-react';
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
  isMobileDrawerOpen = false,
  onCloseMobileDrawer
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeRoute, setActiveRoute] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const handleLocationChange = () => {
      setActiveRoute(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Lock background scroll on mobile when drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  // Close drawer when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileDrawerOpen && typeof onCloseMobileDrawer === 'function') {
        onCloseMobileDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen, onCloseMobileDrawer]);

  function handleSecureVoteClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    go(e, '/secure-vote');
  }

  function go(e, path) {
    e.preventDefault();
    setActiveRoute(path);
    if (typeof navigate === 'function') navigate(path);
    closeDrawer();
    if (typeof onNavigate === 'function') onNavigate();
  }

  function handlePlaceholderClick(e, featureName) {
    e.preventDefault();
    showToast(`AIM Portal Simulator: "${featureName}" is a placeholder representing the integration of Secure Vote within the KNUST AIM App.`, 'info');
    closeDrawer();
  }

  function closeDrawer() {
    if (typeof onCloseMobileDrawer === 'function') {
      onCloseMobileDrawer();
    }
    if (typeof onNavigate === 'function') onNavigate();
  }

  const isCurrentRoute = (path) => {
    if (path === '/') return activeRoute === '/' || activeRoute === '';
    if (path === '/secure-vote') return activeRoute === '/secure-vote' || activeRoute.startsWith('/ballot/');
    if (path === '/ec-admin') return activeRoute === '/ec-admin';
    if (path === '/candidate-agent') return activeRoute.startsWith('/candidate-agent');
    if (path === '/results') return activeRoute === '/results' || activeRoute === '/public-results';
    return activeRoute === path;
  };

  // Helper for expanded full menu item styles
  const getItemClassExpanded = (path) => {
    const isCurrent = isCurrentRoute(path);
    return isCurrent
      ? "bg-[#EAF6F0] dark:bg-emerald-950/70 text-[#075C42] dark:text-emerald-400 font-bold border-l-4 border-[#007A4D] rounded-r-xl transition-colors shadow-2xs px-3 py-2.5 min-h-[42px] flex items-center gap-3 text-sm"
      : "text-slate-700 dark:text-slate-200 hover:text-[#075C42] hover:bg-[#F3FAF6] dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl transition-colors px-3 py-2.5 min-h-[42px] flex items-center gap-3";
  };

  // Helper for mini YouTube-style icon tile styles
  const getItemClassMini = (path) => {
    const isCurrent = isCurrentRoute(path);
    return isCurrent
      ? "bg-[#EAF6F0] dark:bg-emerald-950/70 text-[#007A4D] dark:text-emerald-400 font-bold rounded-xl transition-all shadow-2xs w-full py-2 px-1 flex flex-col items-center justify-center gap-1 text-center"
      : "text-slate-600 dark:text-slate-400 hover:text-[#007A4D] hover:bg-[#F3FAF6] dark:hover:text-slate-100 dark:hover:bg-slate-850 font-medium rounded-xl transition-all w-full py-2 px-1 flex flex-col items-center justify-center gap-1 text-center";
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div 
          onClick={closeDrawer}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden animate-fadeIn"
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar bg-white dark:bg-slate-900 border-r border-[#DDE5E1] dark:border-slate-800 h-full md:h-screen flex flex-col justify-between overflow-y-auto shrink-0 text-[#202522] dark:text-slate-100 transition-all duration-300 fixed md:relative top-0 bottom-0 left-0 z-50 md:z-auto ${
          isMobileDrawerOpen
            ? 'translate-x-0 w-72 sm:w-80 shadow-2xl p-4'
            : '-translate-x-full md:translate-x-0'
        } ${
          // Desktop sizing: collapsed is w-18 (72px), expanded is w-64
          isCollapsed ? 'md:w-[76px] md:p-2' : 'md:w-64 md:p-4'
        }`}
        aria-label="Main navigation"
      >
        <div className="flex flex-col min-w-0">
          {/* Brand Header */}
          <div className={`sidebar-brand flex items-center pb-3 mb-2 border-b border-[#DDE5E1] dark:border-slate-800 ${
            isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-[#D4AF37] shadow-sm flex-shrink-0 overflow-hidden p-0.5">
                <img 
                  src="/logo.png" 
                  alt="KNUST Crest" 
                  className="w-8 h-8 object-contain" 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const parent = e.target.parentElement;
                    if (parent) {
                      parent.innerHTML = '<span class="text-xs font-black text-[#007A4D]">K</span>';
                    }
                  }}
                />
              </div>
              {(!isCollapsed || isMobileDrawerOpen) && (
                <div className="flex flex-col animate-fadeIn min-w-0">
                  <span className="sidebar-brand-title font-black text-[#007A4D] dark:text-slate-100 text-sm tracking-wider uppercase leading-none">KNUST</span>
                  <span className="text-[9px] font-black bg-[#991B1B] text-white px-2 py-0.5 rounded-md tracking-wider uppercase leading-none mt-1 select-none w-max">AIM Portal</span>
                </div>
              )}
            </div>

            {/* Collapse toggle (Desktop) / Close button (Mobile) */}
            <div className="flex items-center">
              {/* Mobile Close Button */}
              <button
                onClick={closeDrawer}
                className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>

              {/* Desktop Collapse/Expand Button */}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden md:flex p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors border-none bg-transparent cursor-pointer items-center justify-center"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
          </div>

          {/* Role Switcher - only when expanded */}
          {(!isCollapsed || isMobileDrawerOpen) && (
            <AppBarRoleSwitcher
              hasECAccess={hasECAccess}
              ecRole={ecRole}
              ecJurisdictionName={ecJurisdictionName}
              currentView={currentView}
              onViewChange={onViewChange}
            />
          )}

          {/* Search Bar / Icon */}
          <SidebarSearch
            navigate={navigate}
            onNavigate={onNavigate}
            onSecureVoteClick={handleSecureVoteClick}
            isCollapsed={isCollapsed && !isMobileDrawerOpen}
          />

          {/* ─────────────────────────────────────────────────────────────
              COLLAPSED MINI SIDEBAR (YouTube Style: Clean Tiles, No Dots)
          ───────────────────────────────────────────────────────────── */}
          {isCollapsed && !isMobileDrawerOpen ? (
            <nav className="flex flex-col space-y-1.5 mt-2" aria-label="Mini Navigation">
              {/* Home */}
              <a
                href="#dashboard"
                onClick={e => go(e, '/')}
                className={getItemClassMini('/')}
                title="Dashboard"
              >
                <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                <span className="text-[10px] font-semibold leading-tight truncate w-full">Home</span>
              </a>

              {/* Secure Vote */}
              <a
                href="#secure-vote"
                onClick={handleSecureVoteClick}
                className={getItemClassMini('/secure-vote')}
                title="Secure Vote"
              >
                <div className="relative">
                  <Vote className="w-5 h-5 flex-shrink-0 text-[#007A4D] dark:text-emerald-400" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#D4AF37] ring-1 ring-white dark:ring-slate-900 animate-pulse" />
                </div>
                <span className="text-[10px] font-bold text-[#007A4D] dark:text-emerald-400 leading-tight truncate w-full">Vote</span>
              </a>

              {/* Results */}
              <a
                href="#results"
                onClick={e => go(e, '/results')}
                className={getItemClassMini('/results')}
                title="Results"
              >
                <BarChart3 className="w-5 h-5 flex-shrink-0" />
                <span className="text-[10px] font-semibold leading-tight truncate w-full">Results</span>
              </a>

              {/* EC Admin / Observer */}
              {hasECAccess || currentView === 'ec-admin' ? (
                <a
                  href="#ec-admin"
                  onClick={e => go(e, '/ec-admin')}
                  className={getItemClassMini('/ec-admin')}
                  title="EC Admin"
                >
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[10px] font-semibold leading-tight truncate w-full">Admin</span>
                </a>
              ) : (
                <a
                  href="#candidate-agent"
                  onClick={e => go(e, '/candidate-agent')}
                  className={getItemClassMini('/candidate-agent')}
                  title="Observer Room"
                >
                  <Eye className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[10px] font-semibold leading-tight truncate w-full">Observer</span>
                </a>
              )}

              {/* Course Reg */}
              <a
                href="#course-reg"
                onClick={e => handlePlaceholderClick(e, 'Course Registration')}
                className={getItemClassMini('#course-reg')}
                title="Course Registration"
              >
                <BookOpen className="w-5 h-5 flex-shrink-0 opacity-70" />
                <span className="text-[10px] font-medium leading-tight truncate w-full opacity-70">Courses</span>
              </a>

              {/* Reg Slip */}
              <a
                href="#reg-slip"
                onClick={e => handlePlaceholderClick(e, 'Registration Slip')}
                className={getItemClassMini('#reg-slip')}
                title="Registration Slip"
              >
                <FileText className="w-5 h-5 flex-shrink-0 opacity-70" />
                <span className="text-[10px] font-medium leading-tight truncate w-full opacity-70">Slip</span>
              </a>

              {/* Bills & Payments */}
              <a
                href="#bills"
                onClick={e => handlePlaceholderClick(e, 'Bill & Payment')}
                className={getItemClassMini('#bills')}
                title="Bill & Payment"
              >
                <CreditCard className="w-5 h-5 flex-shrink-0 opacity-70" />
                <span className="text-[10px] font-medium leading-tight truncate w-full opacity-70">Finance</span>
              </a>

              {/* Status */}
              <a
                href="#status"
                onClick={e => handlePlaceholderClick(e, 'Status Checker')}
                className={getItemClassMini('#status')}
                title="Status Checker"
              >
                <Activity className="w-5 h-5 flex-shrink-0 opacity-70" />
                <span className="text-[10px] font-medium leading-tight truncate w-full opacity-70">Status</span>
              </a>
            </nav>
          ) : (
            /* ─────────────────────────────────────────────────────────────
                EXPANDED FULL MENU (Desktop w-64 & Mobile Slide Drawer w-72)
            ───────────────────────────────────────────────────────────── */
            <ul className="sidebar-list mt-1 space-y-1 list-none p-0">
              {/* ── Overview Section ── */}
              <li className="text-slate-400 dark:text-slate-500 font-bold text-[10px] tracking-wider uppercase mt-3 mb-1 px-2">
                Overview
              </li>
              <li className="sidebar-item">
                <a
                  href="#dashboard"
                  onClick={e => go(e, '/')}
                  className={getItemClassExpanded('/')}
                >
                  <LayoutDashboard className="w-4 h-4 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                  <span>Dashboard</span>
                </a>
              </li>

              {/* ── Governance & Elections Section ── */}
              <li className="text-slate-400 dark:text-slate-500 font-bold text-[10px] tracking-wider uppercase mt-4 mb-1 px-2">
                Governance &amp; Elections
              </li>

              {/* Secure Vote Item */}
              <li className="secure-vote-item">
                <a
                  href="#secure-vote"
                  id="sidebar-secure-vote-btn"
                  onClick={handleSecureVoteClick}
                  aria-haspopup="dialog"
                  className={
                    isCurrentRoute('/secure-vote')
                      ? "bg-[#EAF6F0] dark:bg-emerald-950/70 text-[#075C42] dark:text-emerald-400 font-bold border-l-4 border-[#007A4D] rounded-r-xl transition-colors shadow-2xs px-3 py-2.5 min-h-[42px] flex items-center gap-3 text-sm"
                      : "bg-emerald-50/50 hover:bg-[#EAF6F0] dark:bg-slate-800/40 dark:hover:bg-slate-800 text-[#075C42] dark:text-emerald-400 font-semibold border-l-4 border-transparent hover:border-[#007A4D] rounded-r-xl transition-colors px-3 py-2.5 min-h-[42px] flex items-center gap-3 text-sm"
                  }
                >
                  <Vote className="w-4 h-4 text-[#007A4D] dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-[#075C42] dark:text-emerald-400 font-bold">Secure Vote</span>
                  <span className="ml-auto bg-[#FFF7DF] text-[#B88618] text-[9px] font-black px-2 py-0.5 rounded-full border border-[#D6A72C]/40 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60 shadow-2xs">
                    VOTE NOW
                  </span>
                </a>
              </li>

              {/* EC Admin */}
              <li className="sidebar-subitem">
                <a
                  href="#ec-admin"
                  onClick={e => go(e, '/ec-admin')}
                  className={getItemClassExpanded('/ec-admin')}
                >
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                  <span>EC Admin Console</span>
                  {hasECAccess && (
                    <span className="ml-auto bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      EC
                    </span>
                  )}
                </a>
              </li>

              {/* Observer Room */}
              <li className="sidebar-subitem">
                <a
                  href="#candidate-agent"
                  onClick={e => go(e, '/candidate-agent')}
                  className={getItemClassExpanded('/candidate-agent')}
                >
                  <Eye className="w-4 h-4 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                  <span>Observer Room</span>
                </a>
              </li>

              {/* ── Academics Section ── */}
              <li className="text-slate-400 dark:text-slate-500 font-bold text-[10px] tracking-wider uppercase mt-4 mb-1 px-2">
                Academics
              </li>
              <li className="sidebar-subitem">
                <a
                  href="#results"
                  onClick={e => go(e, '/results')}
                  className={getItemClassExpanded('/results')}
                >
                  <BarChart3 className="w-4 h-4 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                  <span>Check Results</span>
                </a>
              </li>
              <li className="sidebar-subitem sidebar-placeholder-muted">
                <a
                  href="#course-reg"
                  onClick={e => handlePlaceholderClick(e, 'Course Registration')}
                  className="text-slate-600 hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-2 flex items-center gap-3 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <span>Course Registration</span>
                  <span className="sidebar-placeholder-tag ml-auto">Mock</span>
                </a>
              </li>
              <li className="sidebar-subitem sidebar-placeholder-muted">
                <a
                  href="#reg-slip"
                  onClick={e => handlePlaceholderClick(e, 'Registration Slip')}
                  className="text-slate-600 hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-2 flex items-center gap-3 transition-colors"
                >
                  <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <span>Registration Slip</span>
                  <span className="sidebar-placeholder-tag ml-auto">Mock</span>
                </a>
              </li>

              {/* ── Finance Section ── */}
              <li className="text-slate-400 dark:text-slate-500 font-bold text-[10px] tracking-wider uppercase mt-4 mb-1 px-2">
                Finance
              </li>
              <li className="sidebar-subitem sidebar-placeholder-muted">
                <a
                  href="#bills"
                  onClick={e => handlePlaceholderClick(e, 'Bill & Payment')}
                  className="text-slate-600 hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-2 flex items-center gap-3 transition-colors"
                >
                  <CreditCard className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <span>Bill &amp; Payment</span>
                  <span className="sidebar-placeholder-tag ml-auto">Mock</span>
                </a>
              </li>
              <li className="sidebar-subitem sidebar-placeholder-muted">
                <a
                  href="#fees"
                  onClick={e => handlePlaceholderClick(e, 'Fees Status')}
                  className="text-slate-600 hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-2 flex items-center gap-3 transition-colors"
                >
                  <Coins className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <span>Fees Status</span>
                  <span className="sidebar-placeholder-tag ml-auto">Mock</span>
                </a>
              </li>

              {/* ── Utilities Section ── */}
              <li className="text-slate-400 dark:text-slate-500 font-bold text-[10px] tracking-wider uppercase mt-4 mb-1 px-2">
                Utilities &amp; Services
              </li>
              <li className="sidebar-subitem sidebar-placeholder-muted">
                <a
                  href="#status"
                  onClick={e => handlePlaceholderClick(e, 'Status Checker')}
                  className="text-slate-600 hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-2 flex items-center gap-3 transition-colors"
                >
                  <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <span>Status Checker</span>
                  <span className="sidebar-placeholder-tag ml-auto">Mock</span>
                </a>
              </li>
              <li className="sidebar-subitem sidebar-placeholder-muted">
                <a
                  href="#lecturers"
                  onClick={e => handlePlaceholderClick(e, 'Select Lecturers')}
                  className="text-slate-600 hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-2 flex items-center gap-3 transition-colors"
                >
                  <Users className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <span>Select Lecturers</span>
                  <span className="sidebar-placeholder-tag ml-auto">Mock</span>
                </a>
              </li>
              <li className="sidebar-subitem sidebar-placeholder-muted">
                <a
                  href="#admission"
                  onClick={e => handlePlaceholderClick(e, 'Admission Letter')}
                  className="text-slate-600 hover:text-[#075C42] hover:bg-[#F3FAF6] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 font-medium text-sm rounded-xl px-3 py-2 flex items-center gap-3 transition-colors"
                >
                  <Award className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <span>Admission Letter</span>
                  <span className="sidebar-placeholder-tag ml-auto">Mock</span>
                </a>
              </li>
            </ul>
          )}
        </div>

        {/* Logout button at bottom */}
        <div className="sidebar-logout pt-2 border-t border-[#DDE5E1] dark:border-slate-800 mt-3 shrink-0">
          <button
            type="button"
            className={`logout-btn w-full flex items-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-[#075C42] dark:hover:text-emerald-400 hover:bg-[#F3FAF6] dark:hover:bg-slate-800 border border-transparent hover:border-[#DDE5E1] dark:hover:border-slate-700 text-xs font-bold transition-all cursor-pointer group ${
              isCollapsed && !isMobileDrawerOpen ? 'justify-center p-2' : 'justify-start gap-3 px-3 py-2'
            }`}
            onClick={() => {
              showToast('You have been logged out (Demo session reset)', 'info');
            }}
            title={isCollapsed && !isMobileDrawerOpen ? "Logout" : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-[#075C42] dark:group-hover:text-emerald-400 transition-colors" />
            {(!isCollapsed || isMobileDrawerOpen) && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
