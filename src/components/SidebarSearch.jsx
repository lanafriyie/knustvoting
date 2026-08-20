import React, { useState, useRef, useEffect } from 'react';
import '../styles/SecureVote.css';

const MODULES = [
  { id: 'dashboard', title: 'Dashboard', path: '/', icon: '📊', category: 'Overview', keywords: 'home overview analytics main' },
  { id: 'secure-vote', title: 'Secure Vote', path: '/secure-vote', icon: '🗳️', category: 'Governance', badge: 'New', isSecureVote: true, keywords: 'elections vote ballot src governance candidate' },
  { id: 'ec-admin', title: 'EC Admin Console', path: '/ec-admin', icon: '🛡️', category: 'Governance', badge: 'EC', keywords: 'electoral commission admin management election control' },
  { id: 'candidate-agent', title: 'Observer Room', path: '/candidate-agent', icon: '👁️', category: 'Governance', keywords: 'candidate agent observer tally live results' },
  { id: 'course-reg', title: 'Course Registration', path: '#course-reg', icon: '📚', category: 'Academics', keywords: 'register courses classes semester' },
  { id: 'reg-slip', title: 'Registration Slip', path: '#reg-slip', icon: '📄', category: 'Academics', keywords: 'print slip courses verification' },
  { id: 'results', title: 'Check Results', path: '#results', icon: '🎓', category: 'Academics', keywords: 'grades cwa gpa marks exam' },
  { id: 'bills', title: 'Bill & Payment', path: '#bills', icon: '💳', category: 'Finance', keywords: 'pay fees tuition bill bank receipt' },
  { id: 'fees', title: 'Fees Status', path: '#fees', icon: '💰', category: 'Finance', keywords: 'balance fees payment status' },
  { id: 'status', title: 'Status Checker', path: '#status', icon: '📋', category: 'Utilities', keywords: 'student status verification portal' },
  { id: 'lecturers', title: 'Select Lecturers', path: '#lecturers', icon: '👨‍🏫', category: 'Utilities', keywords: 'evaluation lecturer assessment course' },
  { id: 'admission', title: 'Admission Letter', path: '#admission', icon: '✉️', category: 'Utilities', keywords: 'admission letter pdf download' },
];

export default function SidebarSearch({ navigate, onNavigate, onSecureVoteClick }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Click-outside listener to automatically close the suggestion dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  // Filter modules by search query
  const filteredModules = MODULES.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.toLowerCase().includes(q))
    );
  });

  const handleSelectModule = (item) => {
    setQuery('');
    setIsOpen(false);

    if (item.isSecureVote && typeof onSecureVoteClick === 'function') {
      onSecureVoteClick();
      return;
    }

    if (item.path.startsWith('#')) {
      if (typeof onNavigate === 'function') onNavigate(item.path);
      return;
    }

    if (typeof navigate === 'function') {
      navigate(item.path);
    } else {
      window.history.pushState({}, '', item.path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }

    if (typeof onNavigate === 'function') {
      onNavigate(item.path);
    }
  };

  // Helper to highlight matching text in title
  const highlightMatch = (title, q) => {
    if (!q.trim()) return title;
    const index = title.toLowerCase().indexOf(q.toLowerCase());
    if (index === -1) return title;
    const before = title.substring(0, index);
    const match = title.substring(index, index + q.length);
    const after = title.substring(index + q.length);
    return (
      <>
        {before}
        <mark className="sv-search-highlight">{match}</mark>
        {after}
      </>
    );
  };

  return (
    <div className="sidebar-search-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Pill-shaped search bar inside white sidebar */}
      <div className="flex items-center gap-2 w-full px-3 py-2 bg-[#F3FAF6] dark:bg-slate-800 text-[#202522] dark:text-slate-100 rounded-xl border border-[#DDE5E1] dark:border-slate-700 transition-all focus-within:ring-2 focus-within:ring-[#007A4D]/30" role="search">
        <span aria-hidden="true" className="text-[#66716C] dark:text-slate-400 text-sm">🔍</span>
        <input
          type="search"
          placeholder="Search modules..."
          aria-label="Search modules"
          value={query}
          onFocus={handleFocus}
          onChange={handleChange}
          autoComplete="off"
          className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-[#202522] dark:text-slate-100 placeholder-[#66716C] dark:placeholder-slate-400"
        />
        {query && (
          <button
            type="button"
            className="text-[#66716C] hover:text-[#202522] dark:text-slate-400 dark:hover:text-slate-100 text-sm font-bold bg-transparent border-none cursor-pointer p-0"
            onClick={() => { setQuery(''); setIsOpen(true); }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Floating Autocomplete Dropdown Card (absolute z-50) */}
      {isOpen && (
        <div className="sv-search-dropdown absolute z-50">
          <div className="sv-search-dropdown-header">
            <span>{query.trim() ? `Search Results (${filteredModules.length})` : 'Portal Modules'}</span>
          </div>

          {filteredModules.length === 0 ? (
            <div className="sv-search-no-results">
              <span>🔍 No matching modules found</span>
            </div>
          ) : (
            <ul className="sv-search-results-list">
              {filteredModules.map((item) => (
                <li
                  key={item.id}
                  className="sv-search-result-item"
                  onClick={() => handleSelectModule(item)}
                >
                  <span className="sv-search-result-icon">{item.icon}</span>
                  <div className="sv-search-result-info">
                    <span className="sv-search-result-title">
                      {highlightMatch(item.title, query)}
                    </span>
                    <span className="sv-search-result-category">{item.category}</span>
                  </div>
                  {item.badge && (
                    <span className={`sv-badge-${item.badge.toLowerCase()} sv-search-result-badge`}>
                      {item.badge}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
