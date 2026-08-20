import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Regex: at least 8 chars, at least one letter, one digit, one symbol
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export default function StepUpAuthModal({ isOpen, onClose, onSuccess, onVerifySuccess, initialError }) {
  const [mode, setMode]           = useState('pin');         // 'pin' | 'password'
  const [pin, setPin]             = useState(['', '', '', '']);
  const [password, setPassword]   = useState('');
  const [showPin, setShowPin]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState(initialError || null);

  const pinRefs  = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const pwRef    = useRef(null);

  const handleSuccessCallback = onVerifySuccess || onSuccess;

  /* Reset state when modal opens */
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setPassword('');
      setError(initialError || null);
      setSubmitting(false);
      // Focus first relevant input after paint
      setTimeout(() => {
        if (mode === 'pin') pinRefs[0].current?.focus();
        else pwRef.current?.focus();
      }, 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  function handlePinChange(idx, val) {
    const digit = val.replace(/\D/g, '').slice(-1); // only last digit
    const next  = [...pin];
    next[idx]   = digit;
    setPin(next);
    if (digit && idx < 3) pinRefs[idx + 1].current?.focus();
  }

  function handlePinKeyDown(idx, e) {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) pinRefs[idx - 1].current?.focus();
    if (e.key === 'ArrowRight' && idx < 3) pinRefs[idx + 1].current?.focus();
  }

  function handlePinPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (text.length === 4) {
      e.preventDefault();
      setPin(text.split(''));
      pinRefs[3].current?.focus();
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

    if (type === 'pin') {
      // Verify PIN against student_pins table (if it exists)
      // Falls back to checking user_metadata.pin
      const pin_hash = credential; // In production, hash client-side before sending

      let verified = false;
      try {
        const { data, error } = await supabase
          .from('student_pins')
          .select('pin_hash')
          .eq('email', email)
          .single();

        if (!error && data) {
          if (data.pin_hash === pin_hash) verified = true;
          else throw new Error('Incorrect PIN. Please try again.');
        }
      } catch (dbErr) {
        if (dbErr.message?.includes('Incorrect PIN')) throw dbErr;
      }

      if (!verified) {
        const meta_pin = userData?.user?.user_metadata?.pin;
        if (meta_pin) {
          if (String(meta_pin) === credential) verified = true;
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
      // Re-authenticate with Supabase using current email + entered password
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
    e.preventDefault();
    setError(null);

    if (mode === 'pin') {
      if (!pinComplete) { setError('Please enter all 4 PIN digits.'); return; }
    } else {
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

  if (!isOpen) return null;

    return (
      <div className="sv-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sv-modal-title">
        <div className="sv-modal bg-white dark:bg-slate-900 text-[#202522] dark:text-slate-100 border border-[#DDE5E1] dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all">

          {/* ── Header ── */}
          <header className="px-6 py-4 flex items-center justify-between bg-[#075C42] dark:bg-slate-900 border-b border-[#063F2D] dark:border-slate-800 text-white">
            <h2 id="sv-modal-title" className="text-lg font-bold text-white flex items-center gap-2 m-0">
              <span className="text-[#D6A72C] text-xl">🔐</span>
              Step‑Up Authentication
            </h2>
            <button
              type="button"
              className="text-white/80 hover:text-white text-2xl font-bold transition-opacity cursor-pointer bg-transparent border-0 leading-none"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>

          {/* ── Tab switcher ── */}
          <div className="flex bg-[#F3FAF6] dark:bg-slate-800/80 p-1.5 mx-6 mt-5 rounded-xl border border-[#DDE5E1] dark:border-slate-700/60" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'pin'}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                mode === 'pin'
                  ? 'bg-[#007A4D] dark:bg-emerald-600 text-white shadow-xs'
                  : 'text-[#66716C] hover:text-[#202522] hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 font-medium'
              }`}
              onClick={() => { setMode('pin'); setError(null); }}
            >
              🔢 4-Digit PIN
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                mode === 'password'
                  ? 'bg-[#007A4D] dark:bg-emerald-600 text-white shadow-xs'
                  : 'text-[#66716C] hover:text-[#202522] hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 font-medium'
              }`}
              onClick={() => { setMode('password'); setError(null); }}
            >
              🔑 Password
            </button>
          </div>

          {/* ── Body ── */}
          <form className="p-6 pt-4 flex flex-col gap-4 bg-white dark:bg-slate-900" onSubmit={handleSubmit} noValidate autoComplete="off">
            {/* Honeypot to discourage browser autofill / credential managers */}
            <input
              type="text"
              name="sv_honeypot"
              tabIndex={-1}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
              aria-hidden="true"
            />
            <p className="text-xs font-medium text-[#66716C] dark:text-slate-400 leading-relaxed m-0">
              For your security, please verify your identity to access <strong className="text-[#007A4D] dark:text-emerald-400 font-bold">Secure Vote</strong>.
            </p>

            {/* PIN mode */}
            {mode === 'pin' && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-[#202522] dark:text-slate-200 m-0">Enter your 4-digit portal PIN</p>
                <div className="sv-pin-row flex flex-row gap-3 justify-center items-center my-2" onPaste={handlePinPaste}>
                  {pin.map((digit, i) => (
                    <input
                      key={i}
                      ref={pinRefs[i]}
                      id={`sv-pin-${i}`}
                      name={`sv_pin_${i}`}
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={1}
                      pattern="[0-9]*"
                      style={{ width: '52px', height: '56px', flexShrink: 0 }}
                      className={`sv-pin-digit w-13 h-14 flex-shrink-0 bg-white dark:bg-slate-800 border border-[#C9D5CF] dark:border-slate-700 text-[#202522] dark:text-white font-black text-xl text-center rounded-xl focus:border-[#007A4D] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#EAF6F0] dark:focus:ring-emerald-950 outline-none transition-all placeholder-[#8A9690] ${
                        digit ? 'border-[#007A4D] bg-[#F3FAF6] dark:bg-slate-800/90 dark:border-emerald-500' : ''
                      }`}
                      value={digit}
                      onChange={e => handlePinChange(i, e.target.value)}
                      onKeyDown={e => handlePinKeyDown(i, e)}
                      onFocus={e => e.target.select()}
                      autoComplete="off"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                      data-ms-editor="false"
                      aria-label={`PIN digit ${i + 1}`}
                    />
                  ))}
                  {/* Custom show/hide toggle */}
                  <button
                    type="button"
                    className="text-[#66716C] hover:text-[#007A4D] dark:text-slate-400 dark:hover:text-white p-2 text-lg cursor-pointer transition-colors bg-transparent border-0 flex-shrink-0"
                    onClick={() => setShowPin(s => !s)}
                    aria-pressed={showPin}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                    title={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? '🙈' : '👁️'}
                  </button>
                </div>

                {/* Demo Auto-Fill / Quick Verify Shortcut */}
                <button
                  type="button"
                  onClick={handleQuickDemoFill}
                  className="w-full mt-2 py-2.5 px-3 bg-[#F3FAF6] hover:bg-[#EAF6F0] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#075C42] dark:text-emerald-400 border border-[#CFE3D8] dark:border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  title="Auto-fill 1234 and bypass verification for demo"
                >
                  <span className="text-[#D6A72C]">⚡</span> Auto-Fill Demo PIN (1234)
                </button>
              </div>
            )}

            {/* Password mode */}
            {mode === 'password' && (
              <div className="flex flex-col gap-2">
                <label htmlFor="sv-password" className="text-xs font-bold text-[#202522] dark:text-slate-200">Password</label>
                <input
                  id="sv-password"
                  ref={pwRef}
                  name="sv_password"
                  type="password"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-[#C9D5CF] dark:border-slate-700 text-[#202522] dark:text-white placeholder-[#8A9690] rounded-xl focus:border-[#007A4D] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#EAF6F0] dark:focus:ring-emerald-950 outline-none text-sm transition-all"
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
                <ul className="text-xs text-[#66716C] dark:text-slate-400 space-y-1.5 mt-1 pl-1 list-none" aria-live="polite">
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
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-[#FFEBEE] dark:bg-rose-950/80 border border-[#FFCDD2] dark:border-rose-800/80 text-[#C62828] dark:text-rose-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold" role="alert">
                ⚠️ {error}
              </div>
            )}

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
                className="bg-[#007A4D] hover:bg-[#075C42] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer text-xs shadow-md border-0 disabled:bg-[#A3C8B7] dark:disabled:bg-slate-800 disabled:text-white/70 dark:disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none"
                disabled={submitting || (mode === 'pin' ? !pinComplete : !isValidPassword(password))}
              >
                {submitting ? 'Verifying…' : 'Verify & Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
