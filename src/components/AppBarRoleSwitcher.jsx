import React, { useState } from 'react';

/**
 * AppBarRoleSwitcher Component
 * Displays in top navigation bar when user has dual identity (EC member + voter)
 * Allows switching between "Student View" and "EC Admin Console"
 */
export default function AppBarRoleSwitcher({
  hasECAccess,
  ecRole,
  ecJurisdictionName,
  currentView,  // 'student' or 'ec-admin'
  onViewChange  // callback: (view: 'student' | 'ec-admin') => void
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isECAdminActive = currentView === 'ec-admin' || (typeof window !== 'undefined' && window.location.pathname === '/ec-admin');

  if (!hasECAccess || !isECAdminActive) {
    // Only show EC Role Switcher when EC Admin is selected or active
    return null;
  }

  return (
    <div className="sv-role-switcher-wrap my-2 flex items-center justify-between gap-2 relative">
      {/* Current View Badge */}
      <div className="px-2.5 py-1 bg-[#EAF6F0] dark:bg-slate-800 text-[#075C42] dark:text-emerald-400 rounded-lg text-xs font-bold border border-[#007A4D]/30 dark:border-slate-700 whitespace-nowrap">
        {currentView === 'ec-admin' ? '🔐 EC Admin' : '👤 Student View'}
      </div>

      {/* Role Switcher Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="px-2.5 py-1 bg-[#F3FAF6] dark:bg-slate-800 text-[#202522] dark:text-slate-200 border border-[#DDE5E1] dark:border-slate-700 rounded-lg cursor-pointer text-xs font-semibold flex items-center gap-1 hover:bg-[#EAF6F0] dark:hover:bg-slate-700 transition-colors"
          aria-label="Switch view"
        >
          {currentView === 'student' ? '👤' : '🔐'} Switch
          <span className="text-[9px]">▼</span>
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Student View Option */}
            <button
              type="button"
              onClick={() => {
                onViewChange('student');
                setIsDropdownOpen(false);
              }}
              className={`w-full p-3 text-left border-b border-[#DDE5E1] dark:border-slate-800 transition-colors cursor-pointer ${
                currentView === 'student'
                  ? 'bg-[#EAF6F0] dark:bg-slate-800 text-[#075C42] dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-900 text-[#202522] dark:text-slate-200 hover:bg-[#F3FAF6] dark:hover:bg-slate-800'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span>👤 Student View</span>
                {currentView === 'student' && <span className="ml-auto text-[#075C42] dark:text-emerald-400">✓</span>}
              </div>
              <div className="text-[10px] text-[#66716C] dark:text-slate-400 mt-1">
                Cast votes and view eligible elections
              </div>
            </button>

            {/* EC Admin Option */}
            <button
              type="button"
              onClick={() => {
                onViewChange('ec-admin');
                setIsDropdownOpen(false);
              }}
              className={`w-full p-3 text-left transition-colors cursor-pointer ${
                currentView === 'ec-admin'
                  ? 'bg-[#EAF6F0] dark:bg-slate-800 text-[#075C42] dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-900 text-[#202522] dark:text-slate-200 hover:bg-[#F3FAF6] dark:hover:bg-slate-800'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span>🔐 EC Admin Console</span>
                {currentView === 'ec-admin' && <span className="ml-auto text-[#075C42] dark:text-emerald-400">✓</span>}
              </div>
              <div className="text-[10px] text-[#66716C] dark:text-slate-400 mt-1">
                Manage polls ({ecRole} • {ecJurisdictionName})
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
