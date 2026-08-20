import React, { useState, useRef, useEffect } from 'react';
import { useAdminAuth, EC_ADMIN_PRESETS } from '../context/AdminAuthContext';

export default function ECAdminRoleSwitcher({ className = '' }) {
  const { ecAdminProfile, activePresetKey, switchPreset } = useAdminAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const presetList = Object.values(EC_ADMIN_PRESETS);

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-[#F3FAF6] dark:hover:bg-slate-800 text-[#202522] dark:text-slate-100 border-2 border-[#007A4D] rounded-xl shadow-sm text-xs font-bold transition-all cursor-pointer group"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Switch EC Officer Demo Persona & Jurisdiction Scope"
      >
        <span className="text-base">{ecAdminProfile.avatar}</span>
        <div className="text-left flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-[#075C42] dark:text-emerald-400">
              {ecAdminProfile.name}
            </span>
            <span className="text-[10px] bg-[#EAF6F0] dark:bg-slate-800 text-[#007A4D] dark:text-emerald-400 px-1.5 py-0.2 rounded font-extrabold border border-[#007A4D]/30">
              {ecAdminProfile.roleTier}
            </span>
          </div>
          <span className="text-[10px] text-[#66716C] dark:text-slate-400 font-medium truncate max-w-[200px]">
            {ecAdminProfile.assignedJurisdiction.name}
          </span>
        </div>
        <span className="text-[10px] text-[#007A4D] dark:text-emerald-400 transition-transform duration-200 group-hover:scale-110 ml-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-84 sm:w-96 bg-white dark:bg-slate-900 border-2 border-[#007A4D] rounded-2xl shadow-2xl z-50 p-2 space-y-1.5 animate-fadeIn">
          <div className="px-3 py-2 border-b border-[#DDE5E1] dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-[#075C42] dark:text-emerald-400 uppercase tracking-wider block">
                EC Officer Demo Switcher
              </span>
              <span className="text-[11px] text-[#66716C] dark:text-slate-400">
                Select an EC tier preset to test scoped permissions
              </span>
            </div>
            <span className="text-xs bg-[#EAF6F0] dark:bg-slate-800 text-[#007A4D] dark:text-emerald-400 font-black px-2 py-0.5 rounded-full">
              3 PRESETS
            </span>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto pt-1">
            {presetList.map((preset) => {
              const isSelected = preset.id === activePresetKey;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    switchPreset(preset.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-[#EAF6F0] dark:bg-slate-800/90 border-[#007A4D] text-[#202522] dark:text-slate-100 shadow-xs'
                      : 'bg-transparent hover:bg-[#F3FAF6] dark:hover:bg-slate-800/50 border-transparent text-[#202522] dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{preset.avatar}</span>
                      <div>
                        <div className="font-extrabold text-xs flex items-center gap-1.5">
                          <span>{preset.name}</span>
                          {isSelected && (
                            <span className="text-[10px] bg-[#007A4D] text-white px-1.5 py-0.2 rounded font-black">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-[#007A4D] dark:text-emerald-400">
                          {preset.roleTitle}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                      preset.roleTier === 'SRC'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : preset.roleTier === 'DEPARTMENT'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {preset.roleTier}
                    </span>
                  </div>

                  {/* Scope & Description */}
                  <div className="text-[11px] text-[#66716C] dark:text-slate-300 leading-snug pl-7">
                    <strong>Scope:</strong> {preset.assignedJurisdiction.name}
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic pl-7 line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#DDE5E1] dark:border-slate-800 text-[10px] text-[#66716C] dark:text-slate-400 px-3 py-1 flex items-center justify-between">
            <span>Enforces active tier boundaries on actions</span>
            <span className="text-[#007A4D] dark:text-emerald-400 font-bold">Live Synced</span>
          </div>
        </div>
      )}
    </div>
  );
}
