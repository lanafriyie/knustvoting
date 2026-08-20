import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

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

  return (
    <button
      type="button"
      className={`p-2.5 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer text-slate-800 dark:text-slate-100 flex items-center justify-center ${className}`}
      onClick={() => setIsDarkMode(!isDarkMode)}
      title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle theme mode"
    >
      {isDarkMode ? (
        <Sun className="w-5 h-5 text-amber-400 drop-shadow-sm" />
      ) : (
        <Moon className="w-5 h-5 text-slate-700 dark:text-slate-200 drop-shadow-sm" />
      )}
    </button>
  );
}
