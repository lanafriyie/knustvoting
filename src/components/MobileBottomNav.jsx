import React from 'react';
import { LayoutDashboard, Vote, BarChart3, ShieldCheck, Menu } from 'lucide-react';

export default function MobileBottomNav({
  route,
  navigate,
  onOpenDrawer,
  hasECAccess,
  currentView
}) {
  const isDashboard = route === '/' || route === '';
  const isVote = route.startsWith('/secure-vote') || route.startsWith('/ballot/');
  const isResults = route === '/results' || route === '/public-results';
  const isAdmin = route === '/ec-admin' || route.startsWith('/candidate-agent');

  function handleNav(e, path) {
    e.preventDefault();
    if (typeof navigate === 'function') {
      navigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  return (
    <nav
      className="mobile-bottom-nav bg-white/95 dark:bg-slate-900/95 border-t border-gray-200/80 dark:border-slate-800 flex items-center justify-around px-2"
      aria-label="Mobile Bottom Navigation"
    >
      {/* 1. Dashboard */}
      <a
        href="#dashboard"
        onClick={(e) => handleNav(e, '/')}
        className={`mobile-nav-item flex-1 ${isDashboard ? 'active' : ''}`}
        aria-current={isDashboard ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap">
          <LayoutDashboard size={18} />
        </div>
        <span>Home</span>
      </a>

      {/* 2. Secure Vote */}
      <a
        href="#secure-vote"
        onClick={(e) => handleNav(e, '/secure-vote')}
        className={`mobile-nav-item flex-1 ${isVote ? 'active' : ''}`}
        aria-current={isVote ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap relative">
          <Vote size={18} />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#D4AF37] ring-1 ring-white dark:ring-slate-900 animate-pulse" />
        </div>
        <span className="flex items-center gap-0.5">
          <span>Vote</span>
        </span>
      </a>

      {/* 3. Results */}
      <a
        href="#results"
        onClick={(e) => handleNav(e, '/results')}
        className={`mobile-nav-item flex-1 ${isResults ? 'active' : ''}`}
        aria-current={isResults ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap">
          <BarChart3 size={18} />
        </div>
        <span>Results</span>
      </a>

      {/* 4. EC Admin / Observer */}
      <a
        href="#admin"
        onClick={(e) => handleNav(e, hasECAccess || currentView === 'ec-admin' ? '/ec-admin' : '/candidate-agent')}
        className={`mobile-nav-item flex-1 ${isAdmin ? 'active' : ''}`}
        aria-current={isAdmin ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap">
          <ShieldCheck size={18} />
        </div>
        <span>{hasECAccess || currentView === 'ec-admin' ? 'Admin' : 'Observer'}</span>
      </a>

      {/* 5. Menu / More Drawer */}
      <button
        type="button"
        onClick={onOpenDrawer}
        className="mobile-nav-item flex-1 bg-transparent border-none cursor-pointer"
        aria-label="Open full navigation drawer"
      >
        <div className="mobile-nav-icon-wrap">
          <Menu size={18} />
        </div>
        <span>Menu</span>
      </button>
    </nav>
  );
}
