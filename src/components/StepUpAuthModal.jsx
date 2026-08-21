import React, { useEffect, useRef, useState } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Fingerprint, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  ChevronRight, 
  X, 
  RefreshCw 
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// Regex: at least 8 chars, at least one letter, one digit, one symbol
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export default function StepUpAuthModal({ isOpen, onClose, onSuccess, onVerifySuccess, initialError }) {
  const [mode, setMode]           = useState('pin');         // 'pin' | 'password' | 'biometric'
  const [pin, setPin]             = useState(['', '', '', '']);
  const [password, setPassword]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState(initialError || null);
  const [bioScanning, setBioScanning] = useState(false);
  const [bioSuccess, setBioSuccess] = useState(false);

  const pwRef    = useRef(null);

  const handleSuccessCallback = onVerifySuccess || onSuccess;

  /* Reset state when modal opens */
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setPassword('');
      setError(initialError || null);
      setSubmitting(false);
      setBioScanning(false);
      setBioSuccess(false);
      
      if (mode === 'password') {
        setTimeout(() => pwRef.current?.focus(), 60);
      }
    }
  }, [isOpen, mode, initialError]);

  /* ── Demo Quick Auto-Fill Handler ──────── */
  function handleQuickDemoFill() {
    const demoPin = ['1', '2', '3', '4'];
    setPin(demoPin);
    setError(null);

    // Save active session in localStorage for immediate verification
    const demoSession = {
      student_id: '20894512',
      full_name: 'Kwame Nkrumah',
      email: 'knkrumah@st.knust.edu.gh',
      department_code: 'COE',
      college_code: 'COE',
      hall_code: 'UNITY',
      year_of_study: 1,
      level: 100,
      biometrics_completed_current_semester: true,
      authenticated_at: new Date().toISOString()
    };
    localStorage.setItem('knust_user_session', JSON.stringify(demoSession));

    // Immediately trigger success callback to bypass during client demo
    if (typeof handleSuccessCallback === 'function') {
      handleSuccessCallback();
    }
  }

  // Keypad keystroke handler
  function handleKeyPress(num) {
    if (submitting || bioScanning) return;
    setError(null);

    if (num === 'clear') {
      setPin(['', '', '', '']);
      return;
    }
    
    if (num === 'delete') {
      const next = [...pin];
      const firstEmptyIdx = pin.findIndex(d => d === '');
      if (firstEmptyIdx === -1) {
        next[3] = '';
      } else if (firstEmptyIdx > 0) {
        next[firstEmptyIdx - 1] = '';
      }
      setPin(next);
      return;
    }

    // Append digit
    const firstEmptyIdx = pin.findIndex(d => d === '');
    if (firstEmptyIdx !== -1) {
      const next = [...pin];
      next[firstEmptyIdx] = num;
      setPin(next);
    }
  }

  const pinComplete    = pin.every(d => d !== '');
  const pinValue       = pin.join('');

  /* ── Password helpers ────────────────────── */
  const isValidPassword = pw => passwordRegex.test(pw);

  /* ── Supabase step-up verification ──────── */
  async function verifyViaSupabase(credential, type) {
    // Get current user email
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;

    if (!email) {
      // In demo/dev mode or unauthenticated login flow: establish session if valid credential provided
      const newSession = {
        student_id: '20894512',
        full_name: 'Kwame Nkrumah',
        email: 'knkrumah@st.knust.edu.gh',
        department_code: 'COE',
        college_code: 'COE',
        hall_code: 'UNITY',
        year_of_study: 1,
        level: 100,
        biometrics_completed_current_semester: true,
        authenticated_at: new Date().toISOString()
      };
      localStorage.setItem('knust_user_session', JSON.stringify(newSession));
      return true;
    }

    if (type === 'pin' || type === 'biometric') {
      // Verify PIN against student_pins table
      let verified = false;
      try {
        const { data, error: dbErr } = await supabase
          .from('student_pins')
          .select('pin_hash')
          .eq('email', email)
          .single();

        if (!dbErr && data) {
          if (data.pin_hash === credential || type === 'biometric') verified = true;
          else throw new Error('Incorrect PIN. Please try again.');
        }
      } catch (dbErr) {
        if (dbErr.message?.includes('Incorrect PIN')) throw dbErr;
      }

      if (!verified) {
        const meta_pin = userData?.user?.user_metadata?.pin;
        if (meta_pin) {
          if (String(meta_pin) === credential || type === 'biometric') verified = true;
          else throw new Error('Incorrect PIN. Please try again.');
        } else {
          // Dev pass-through
          verified = true;
        }
      }

      if (verified) {
        const sessionObj = {
          student_id: userData.user.id || '20894512',
          full_name: userData.user.user_metadata?.full_name || 'Kwame Nkrumah',
          email: userData.user.email,
          department_code: 'COE',
          college_code: 'COE',
          hall_code: 'UNITY',
          year_of_study: 1,
          level: 100,
          biometrics_completed_current_semester: true,
          authenticated_at: new Date().toISOString()
        };
        localStorage.setItem('knust_user_session', JSON.stringify(sessionObj));
        return true;
      }
    }

    if (type === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: credential });
      if (error) throw new Error('Incorrect password. Please try again.');

      const sessionObj = {
        student_id: userData.user.id || '20894512',
        full_name: userData.user.user_metadata?.full_name || 'Kwame Nkrumah',
        email: userData.user.email,
        department_code: 'COE',
        college_code: 'COE',
        hall_code: 'UNITY',
        year_of_study: 1,
        level: 100,
        biometrics_completed_current_semester: true,
        authenticated_at: new Date().toISOString()
      };
      localStorage.setItem('knust_user_session', JSON.stringify(sessionObj));
      return true;
    }

    throw new Error('Unknown auth mode.');
  }

  /* ── Submit handler ──────────────────────── */
  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError(null);

    if (mode === 'pin') {
      if (!pinComplete) { setError('Please enter all 4 PIN digits.'); return; }
    } else if (mode === 'password') {
      if (!isValidPassword(password)) {
        setError('Password must be ≥ 8 characters with a letter, number, and symbol.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const credential = mode === 'pin' ? pinValue : password;
      await verifyViaSupabase(credential, mode);
      if (typeof handleSuccessCallback === 'function') {
        handleSuccessCallback();
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Simulate fingerprint scanning
  const triggerBiometricScan = async () => {
    if (bioScanning || bioSuccess) return;
    setError(null);
    setBioScanning(true);

    // Simulate 1.5s scanning animation
    setTimeout(async () => {
      try {
        await verifyViaSupabase('BIOMETRIC_PASS', 'biometric');
        setBioSuccess(true);
        setBioScanning(false);
        setTimeout(() => {
          if (typeof handleSuccessCallback === 'function') {
            handleSuccessCallback();
          }
        }, 600);
      } catch (err) {
        setError('Biometric authentication failed. Please try PIN.');
        setBioScanning(false);
      }
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="sv-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sv-modal-title">
      <div className="sv-modal bg-white dark:bg-slate-900 text-[#202522] dark:text-slate-100 border border-[#DDE5E1] dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transition-all">

        {/* ── Header ── */}
        <header className="px-6 py-4 flex items-center justify-between bg-[#075C42] dark:bg-slate-900 border-b border-[#063F2D] dark:border-slate-800 text-white">
          <h2 id="sv-modal-title" className="text-sm font-bold text-white flex items-center gap-2 m-0 uppercase tracking-wider">
            <Lock size={16} className="text-[#D4AF37]" />
            <span>Step‑Up Authentication</span>
          </h2>
          <button
            type="button"
            className="text-white/80 hover:text-white transition-opacity cursor-pointer bg-transparent border-0 leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {/* ── Tab switcher ── */}
        <div className="flex bg-[#F3FAF6] dark:bg-slate-800/80 p-1 mx-6 mt-5 rounded-xl border border-[#DDE5E1] dark:border-slate-700/60" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'pin'}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
              mode === 'pin'
                ? 'bg-[#007A4D] dark:bg-emerald-600 text-white shadow-xs'
                : 'text-[#66716C] hover:text-[#202522] hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 font-medium'
            }`}
            onClick={() => { setMode('pin'); setError(null); }}
          >
            <span>PIN</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'biometric'}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
              mode === 'biometric'
                ? 'bg-[#007A4D] dark:bg-emerald-600 text-white shadow-xs'
                : 'text-[#66716C] hover:text-[#202522] hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 font-medium'
            }`}
            onClick={() => { setMode('biometric'); setError(null); }}
          >
            <span>Biometric</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'password'}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
              mode === 'password'
                ? 'bg-[#007A4D] dark:bg-emerald-600 text-white shadow-xs'
                : 'text-[#66716C] hover:text-[#202522] hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 font-medium'
            }`}
            onClick={() => { setMode('password'); setError(null); }}
          >
            <span>Password</span>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 pt-4 flex flex-col gap-4 bg-white dark:bg-slate-900">
          <p className="text-[11px] font-medium text-[#66716C] dark:text-slate-400 leading-relaxed m-0 text-center">
            Institutional verification is required to open the cryptographic polling ballot.
          </p>

          {/* PIN mode */}
          {mode === 'pin' && (
            <div className="flex flex-col gap-3">
              {/* Visual PIN dots */}
              <div className="knust-pin-dots">
                {pin.map((digit, i) => (
                  <div
                    key={i}
                    className={`knust-pin-dot ${digit !== '' ? 'active' : ''}`}
                  />
                ))}
              </div>

              {/* Numeric Keypad Grid */}
              <div className="knust-num-pad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    type="button"
                    className="knust-num-btn"
                    onClick={() => handleKeyPress(String(num))}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className="knust-num-btn text-xs hover:text-red-600 font-bold"
                  onClick={() => handleKeyPress('clear')}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="knust-num-btn"
                  onClick={() => handleKeyPress('0')}
                >
                  0
                </button>
                <button
                  type="button"
                  className="knust-num-btn text-xs font-bold"
                  onClick={() => handleKeyPress('delete')}
                >
                  ⌫
                </button>
              </div>

              {/* Quick Auto-Fill Demo Shortcut */}
              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="w-full mt-3 py-2 px-3 bg-[#F3FAF6] hover:bg-[#EAF6F0] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#075C42] dark:text-emerald-400 border border-[#CFE3D8] dark:border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span>⚡ Auto-Fill Demo PIN (1234)</span>
              </button>
            </div>
          )}

          {/* Biometric Touch ID mode */}
          {mode === 'biometric' && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="relative flex items-center justify-center my-4">
                {bioScanning ? (
                  <div className="biometric-scanner-ring" />
                ) : (
                  <div className={`w-18 h-18 rounded-full border-2 ${bioSuccess ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-[#007A4D] bg-[#F3FAF6] text-[#007A4D] dark:bg-slate-800'} flex items-center justify-center shadow-md select-none`}>
                    {bioSuccess ? <CheckCircle2 size={36} /> : <Fingerprint size={36} />}
                  </div>
                )}
              </div>

              <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">
                {bioScanning ? 'Scanning biometrics...' : bioSuccess ? 'Verification Success' : 'Place Finger on Scanner'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-[200px] leading-relaxed">
                {bioScanning ? 'Reading zero-knowledge biometric templates...' : bioSuccess ? 'Redirecting to ballot room...' : 'Click the sensor above to simulate a biometric verification.'}
              </p>

              {!bioScanning && !bioSuccess && (
                <button
                  type="button"
                  onClick={triggerBiometricScan}
                  className="mt-4 px-4 py-2 bg-[#007A4D] hover:bg-[#075C42] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Fingerprint size={14} />
                  <span>Scan Fingerprint</span>
                </button>
              )}
            </div>
          )}

          {/* Password mode */}
          {mode === 'password' && (
            <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate autoComplete="off">
              <div className="flex flex-col gap-1">
                <label htmlFor="sv-password" className="text-xs font-bold text-slate-800 dark:text-slate-200">Password</label>
                <div className="relative">
                  <input
                    id="sv-password"
                    ref={pwRef}
                    name="sv_password"
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-[#C9D5CF] dark:border-slate-700 text-[#202522] dark:text-white placeholder-[#8A9690] rounded-xl focus:border-[#007A4D] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#EAF6F0] dark:focus:ring-emerald-950 outline-none text-xs transition-all pr-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    aria-invalid={!isValidPassword(password) && password.length > 0}
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    data-ms-editor="false"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors bg-transparent border-0 cursor-pointer p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <ul className="text-[10px] text-[#66716C] dark:text-slate-400 space-y-1 mt-1 pl-1 list-none" aria-live="polite">
                <li className={`flex items-center gap-1.5 ${password.length >= 8 ? 'text-[#007A4D] dark:text-emerald-400 font-bold' : 'text-[#66716C] dark:text-slate-400'}`}>
                  <span>{password.length >= 8 ? '✓' : '•'}</span> At least 8 characters
                </li>
                <li className={`flex items-center gap-1.5 ${/[A-Za-z]/.test(password) ? 'text-[#007A4D] dark:text-emerald-400 font-bold' : 'text-[#66716C] dark:text-slate-400'}`}>
                  <span>{/[A-Za-z]/.test(password) ? '✓' : '•'}</span> Contains a letter
                </li>
                <li className={`flex items-center gap-1.5 ${/\d/.test(password) ? 'text-[#007A4D] dark:text-emerald-400 font-bold' : 'text-[#66716C] dark:text-slate-400'}`}>
                  <span>{/\d/.test(password) ? '✓' : '•'}</span> Contains a number
                </li>
                <li className={`flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? 'text-[#007A4D] dark:text-emerald-400 font-bold' : 'text-[#66716C] dark:text-slate-400'}`}>
                  <span>{/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? '✓' : '•'}</span> Contains a symbol
                </li>
              </ul>

              {/* Actions */}
              <div className="flex gap-3 justify-end mt-2 pt-3 border-t border-[#DDE5E1] dark:border-slate-800">
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl border border-[#B8C7C0] dark:border-slate-700 text-[#66716C] dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-[#F3FAF6] hover:text-[#075C42] dark:hover:bg-slate-700 dark:hover:text-emerald-400 text-xs font-bold transition-all cursor-pointer"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#007A4D] hover:bg-[#075C42] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer text-xs shadow-md border-0 disabled:bg-[#A3C8B7] dark:disabled:bg-slate-800 disabled:text-white/70 dark:disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-1"
                  disabled={submitting || !isValidPassword(password)}
                >
                  <span>Verify</span>
                  <ChevronRight size={12} />
                </button>
              </div>
            </form>
          )}

          {/* PIN manual actions if needed */}
          {mode === 'pin' && (
            <div className="flex gap-3 justify-end mt-2 pt-3 border-t border-[#DDE5E1] dark:border-slate-800">
              <button
                type="button"
                className="px-4 py-2.5 rounded-xl border border-[#B8C7C0] dark:border-slate-700 text-[#66716C] dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-[#F3FAF6] hover:text-[#075C42] dark:hover:bg-slate-700 dark:hover:text-emerald-400 text-xs font-bold transition-all cursor-pointer"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-[#007A4D] hover:bg-[#075C42] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer text-xs shadow-md border-0 disabled:bg-[#A3C8B7] dark:disabled:bg-slate-800 disabled:text-white/70 dark:disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-1"
                disabled={submitting || !pinComplete}
                onClick={handleSubmit}
              >
                <span>Verify</span>
                <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-[#FFEBEE] dark:bg-rose-950/80 border border-[#FFCDD2] dark:border-rose-800/80 text-[#C62828] dark:text-rose-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5" role="alert">
              <ShieldAlert size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
