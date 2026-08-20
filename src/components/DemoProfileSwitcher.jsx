// src/components/DemoProfileSwitcher.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  DEMO_PROFILES,
  getStoredDemoProfileKey,
  switchDemoProfile,
  subscribeToDemoProfile
} from '../lib/demoProfiles';

export default function DemoProfileSwitcher({ onProfileChange, className = '' }) {
  const [activeKey, setActiveKey] = useState(getStoredDemoProfileKey);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToDemoProfile((profile) => {
      setActiveKey(profile.id || (profile.level === 300 ? 'B' : 'A'));
      if (onProfileChange) onProfileChange(profile);
    });
    return unsubscribe;
  }, [onProfileChange]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeProfile = DEMO_PROFILES[activeKey] || DEMO_PROFILES.A;

  const handleSelect = (key) => {
    const newProfile = switchDemoProfile(key);
    setActiveKey(key);
    setIsOpen(false);
    if (onProfileChange) onProfileChange(newProfile);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="demo-switcher-btn"
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-maroon-700/30"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Switch between Level 100 First-Year and Level 300 Continuing Student demo profiles"
      >
        <span className="text-sm">🎭</span>
        <span className="font-semibold text-slate-500 dark:text-slate-400">Demo View:</span>
        <span className="font-bold text-maroon-700 dark:text-amber-400">
          {activeProfile.shortLabel}
        </span>
        <span className="text-[10px] text-slate-400">▼</span>
      </button>

      {/* Floating Dropdown Card */}
      {isOpen && (
        <div
          className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl z-50 p-2 animate-fadeIn"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>🎭</span> Switch Demo View
            </span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              Eligibility Simulator
            </span>
          </div>

          <div className="flex flex-col gap-1.5 py-2">
            {/* Option A: Level 100 */}
            <button
              type="button"
              className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border flex flex-col gap-1.5 ${
                activeKey === 'A'
                  ? 'bg-maroon-50/60 dark:bg-maroon-900/20 border-maroon-300 dark:border-maroon-700 ring-1 ring-maroon-400/30'
                  : 'bg-white dark:bg-slate-800/60 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
              }`}
              onClick={() => handleSelect('A')}
              role="menuitem"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${activeKey === 'A' ? 'bg-green-500 ring-2 ring-green-200 dark:ring-green-900' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Option A (Default - Level 100)
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                  Hall Unlocked ✓
                </span>
              </div>

              <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium pl-4">
                <strong>Kwame Nkrumah</strong> · Level 100 · Unity Hall (First-Year)
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-4 leading-tight">
                Hall Elections active and unlocked. Full ballot access.
              </div>
            </button>

            {/* Option B: Level 300 Continuing Student */}
            <button
              type="button"
              className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border flex flex-col gap-1.5 ${
                activeKey === 'B'
                  ? 'bg-maroon-50/60 dark:bg-maroon-900/20 border-maroon-300 dark:border-maroon-700 ring-1 ring-maroon-400/30'
                  : 'bg-white dark:bg-slate-800/60 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
              }`}
              onClick={() => handleSelect('B')}
              role="menuitem"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${activeKey === 'B' ? 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Option B (Continuing Student)
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                  Hall Locked 🔒
                </span>
              </div>

              <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium pl-4">
                <strong>Akosua Mensah</strong> · Level 300 · Ayeduase (Off-Campus)
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-4 leading-tight">
                Hall Elections locked/ineligible. Dept, SRC &amp; Constituency remain accessible.
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
