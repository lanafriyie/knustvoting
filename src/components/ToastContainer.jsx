import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      if (!e.detail) return;
      const { message, type } = e.detail;
      const id = Date.now() + Math.random().toString(36).substring(2, 7);

      setToasts((prev) => [...prev, { id, message, type, isFading: false }]);

      // Auto dismiss after 3.5s
      setTimeout(() => {
        fadeToast(id);
      }, 3500);
    };

    window.addEventListener('knust_toast', handleToast);
    return () => window.removeEventListener('knust_toast', handleToast);
  }, []);

  const fadeToast = (id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isFading: true } : t))
    );

    // Completely remove after animation (0.2s)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  };

  if (toasts.length === 0) return null;

  const iconMap = {
    success: <CheckCircle2 size={16} className="text-emerald-500" />,
    warning: <AlertTriangle size={16} className="text-amber-500" />,
    info: <Info size={16} className="text-blue-500" />,
  };

  return (
    <div className="sv-toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`sv-toast sv-toast-${t.type} ${t.isFading ? 'sv-toast-fadeout' : ''}`}
        >
          {iconMap[t.type] || iconMap.info}
          <div className="flex-1 font-medium">{t.message}</div>
          <button
            onClick={() => fadeToast(t.id)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
            aria-label="Dismiss notification"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
