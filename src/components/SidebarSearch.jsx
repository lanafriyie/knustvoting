import React, { useState, useRef, useEffect } from 'react';
import { 
  Search as SearchIcon, 
  X as XIcon,
  LayoutDashboard,
  Vote,
  ShieldCheck,
  Eye,
  BookOpen,
  FileText,
  BarChart3,
  CreditCard,
  Coins,
  Activity,
  Users,
  Award
} from 'lucide-react';
import { showToast } from '../lib/toast';
import '../styles/SecureVote.css';

const MODULES = [
  { id: 'dashboard', title: 'Dashboard', path: '/', category: 'Overview', keywords: 'home overview analytics main' },
  { id: 'secure-vote', title: 'Secure Vote', path: '/secure-vote', category: 'Governance', badge: 'New', isSecureVote: true, keywords: 'elections vote ballot src governance candidate' },
  { id: 'ec-admin', title: 'EC Admin Console', path: '/ec-admin', category: 'Governance', badge: 'EC', keywords: 'electoral commission admin management election control' },
  { id: 'candidate-agent', title: 'Observer Room', path: '/candidate-agent', category: 'Governance', keywords: 'candidate agent observer tally live results' },
  { id: 'course-reg', title: 'Course Registration', path: '#course-reg', category: 'Academics', keywords: 'register courses classes semester' },
  { id: 'reg-slip', title: 'Registration Slip', path: '#reg-slip', category: 'Academics', keywords: 'print slip courses verification' },
  { id: 'results', title: 'Check Results', path: '/results', category: 'Academics', keywords: 'grades cwa gpa marks exam results check' },
  { id: 'bills', title: 'Bill & Payment', path: '#bills', category: 'Finance', keywords: 'pay fees tuition bill bank receipt' },
  { id: 'fees', title: 'Fees Status', path: '#fees', category: 'Finance', keywords: 'balance fees payment status' },
  { id: 'status', title: 'Status Checker', path: '#status', category: 'Utilities', keywords: 'student status verification portal' },
  { id: 'lecturers', title: 'Select Lecturers', path: '#lecturers', category: 'Utilities', keywords: 'evaluation lecturer assessment course' },
  { id: 'admission', title: 'Admission Letter', path: '#admission', category: 'Utilities', keywords: 'admission letter pdf download' },
];

const iconMap = {
  'dashboard': LayoutDashboard,
  'secure-vote': Vote,
  'ec-admin': ShieldCheck,
  'candidate-agent': Eye,
  'course-reg': BookOpen,
  'reg-slip': FileText,
  'results': BarChart3,
  'bills': CreditCard,
  'fees': Coins,
  'status': Activity,
  'lecturers': Users,
  'admission': Award
};

export default function SidebarSearch({ navigate, onNavigate, onSecureVoteClick, isCollapsed }) {
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
    if (!isCollapsed) setIsOpen(true);
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
      showToast(`AIM Portal Simulator: "${item.title}" is a placeholder representing the integration of Secure Vote within the KNUST AIM App.`, 'info');
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

  if (isCollapsed) {
    return (
      <div 
        className="flex items-center justify-center py-2.5 text-[#66716C] dark:text-slate-400 cursor-pointer hover:text-[#075C42] dark:hover:text-emerald-400 transition-colors"
        title="Search Modules"
      >
        <SearchIcon size={15} />
      </div>
    );
  }

  return (
    <div className="sidebar-search-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Pill-shaped search bar inside white sidebar */}
      <div className="flex items-center gap-2.5 w-full px-3 py-2 bg-[#F3FAF6] dark:bg-slate-800 text-[#202522] dark:text-slate-100 rounded-xl border border-[#DDE5E1] dark:border-slate-700 transition-all focus-within:ring-2 focus-within:ring-[#007A4D]/30" role="search">
        <SearchIcon size={14} className="text-[#66716C] dark:text-slate-400 flex-shrink-0" />
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
            className="text-[#66716C] hover:text-[#202522] dark:text-slate-400 dark:hover:text-slate-100 transition-colors bg-transparent border-none cursor-pointer p-0 flex items-center justify-center"
            onClick={() => { setQuery(''); setIsOpen(true); }}
            aria-label="Clear search"
          >
            <XIcon size={14} />
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
            <div className="sv-search-no-results flex flex-col items-center py-6 text-slate-500">
              <SearchIcon size={20} className="text-slate-400 mb-1" />
              <span className="text-xs font-semibold">No matching modules found</span>
            </div>
          ) : (
            <ul className="sv-search-results-list">
              {filteredModules.map((item) => (
                <li
                  key={item.id}
                  className="sv-search-result-item"
                  onClick={() => handleSelectModule(item)}
                >
                  <span className="sv-search-result-icon text-slate-500 dark:text-slate-400 flex-shrink-0">
                    {(() => {
                      const IconComp = iconMap[item.id];
                      return IconComp ? <IconComp size={16} /> : null;
                    })()}
                  </span>
                  <div className="sv-search-result-info">
                    <span className="sv-search-result-title font-bold">
                      {highlightMatch(item.title, query)}
                    </span>
                    <span className="sv-search-result-category">{item.category}</span>
                  </div>
                  {item.badge ? (
                    <span className={`sv-badge-${item.badge.toLowerCase()} sv-search-result-badge`}>
                      {item.badge}
                    </span>
                  ) : item.path.startsWith('#') ? (
                    <span className="sidebar-placeholder-tag text-[7px] py-0.5 px-1 ml-auto">
                      Mock
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
