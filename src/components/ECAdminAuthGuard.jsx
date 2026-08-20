import React, { useState } from 'react';
import ECAdmin from './ECAdmin';

const SEEDED_ADMIN_ID = '2145221';
const VERIFIED_STORAGE_KEY = 'knust_ec_admin_verified_id';

export default function ECAdminAuthGuard({ navigate }) {
  const [studentIdInput, setStudentIdInput] = useState('');
  const [isVerified, setIsVerified] = useState(() => {
    try {
      return sessionStorage.getItem(VERIFIED_STORAGE_KEY) === SEEDED_ADMIN_ID;
    } catch (e) {
      return false;
    }
  });
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerify = (e) => {
    e.preventDefault();
    const cleanId = studentIdInput.trim();

    if (cleanId === SEEDED_ADMIN_ID) {
      try {
        sessionStorage.setItem(VERIFIED_STORAGE_KEY, SEEDED_ADMIN_ID);
      } catch (err) {}
      setIsVerified(true);
      setAccessDenied(false);
      setErrorMessage('');
    } else {
      setAccessDenied(true);
      setErrorMessage(
        'Access Denied: You do not have the required role to access this page. Please return to the main portal.'
      );
    }
  };

  const handleReturnToPortal = () => {
    if (typeof navigate === 'function') {
      navigate('/');
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // If authenticated for this session, render EC Admin Console
  if (isVerified) {
    return <ECAdmin navigate={navigate} />;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-[#007A4D] dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto font-black shadow-inner">
            🔐
          </div>
          <h2 className="text-xl font-extrabold text-[#202522] dark:text-slate-100 tracking-tight">
            EC Admin Verification
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Please enter your assigned Electoral Commission Student ID Number to access the console.
          </p>
        </div>

        {/* Access Denied Alert Box */}
        {accessDenied && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">
              <span className="text-base shrink-0">⚠️</span>
              <p className="m-0 font-bold">{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={handleReturnToPortal}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              ➔ Return to Main Portal
            </button>
          </div>
        )}

        {/* Verification Form */}
        {!accessDenied && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                Officer Student ID Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value)}
                placeholder="Enter Student ID (e.g. 2145221)"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-[#202522] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007A4D] transition-all font-mono"
              />
            </div>

            {/* Note of Seeded Student ID */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-center gap-2">
              <span className="text-base shrink-0">💡</span>
              <div>
                <strong>Seeded Admin ID for testing:</strong> <code className="font-mono font-black text-amber-950 dark:text-amber-100 bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">{SEEDED_ADMIN_ID}</code>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="submit"
                className="w-full py-3 bg-[#007A4D] hover:bg-[#075C42] active:bg-[#054332] text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer tracking-wide"
              >
                CONFIRM & ENTER EC CONSOLE ➔
              </button>

              <button
                type="button"
                onClick={handleReturnToPortal}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Return to Main Portal
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
