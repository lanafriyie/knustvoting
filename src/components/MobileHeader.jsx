import React from 'react';
import { Menu, X, Vote, ShieldCheck, User } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function MobileHeader({
  route,
  isDrawerOpen,
  onToggleDrawer,
  hasECAccess,
  currentView,
  onViewChange,
  student
}) {
  // Compute user-friendly page title
  const getPageTitle = () => {
    if (route.startsWith('/ballot/')) return 'Official Ballot';
    if (route === '/ec-admin') return 'EC Admin Console';
    if (route === '/secure-vote' || route === '/governance/secure-vote') return 'Secure Vote';
    if (route === '/candidate-agent') return 'Observer Room';
    if (route === '/results' || route === '/public-results') return 'Election Results';
    return 'KNUST AIM Portal';
  };

  const pageTitle = getPageTitle();

  return (
    <header className="mobile-app-header bg-white/90 dark:bg-slate-900/90 border-b border-gray-200/80 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2 shadow-xs transition-colors duration-200">
      {/* Left: Hamburger menu trigger */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onToggleDrawer}
          className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-[#EAF6F0] dark:hover:bg-slate-700 hover:text-[#007A4D] dark:hover:text-emerald-400 flex items-center justify-center transition-colors cursor-pointer border border-gray-200 dark:border-slate-700 shrink-0 touch-target-44 active:scale-95"
          aria-label={isDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isDrawerOpen}
        >
          {isDrawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Brand & Page Title */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-[#D4AF37] p-0.5 shadow-2xs shrink-0 overflow-hidden">
            <img
              src="/logo.png"
              alt="KNUST"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.parentElement) {
                  e.target.parentElement.innerHTML = '<span class="text-[11px] font-black text-[#007A4D]">K</span>';
                }
              }}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-[#007A4D] dark:text-emerald-400 leading-tight uppercase tracking-wide truncate">
              {pageTitle}
            </span>
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-none truncate">
              {currentView === 'ec-admin' ? 'EC Officer Mode' : 'Student Voter'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Quick actions (View switch pill + Theme toggle) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {hasECAccess && (
          <button
            type="button"
            onClick={() => onViewChange(currentView === 'ec-admin' ? 'student' : 'ec-admin')}
            className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border transition-all cursor-pointer touch-target-44 ${
              currentView === 'ec-admin'
                ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
            }`}
            title="Switch between Student and EC Admin View"
          >
            {currentView === 'ec-admin' ? <ShieldCheck size={12} /> : <User size={12} />}
            <span>{currentView === 'ec-admin' ? 'EC' : 'STU'}</span>
          </button>
        )}

        <div className="p-0.5">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
