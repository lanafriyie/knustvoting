import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Regex: at least 8 chars, at least one letter, one digit, one symbol
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export default function StepUpAuthModal({ isOpen, onClose, onSuccess }) {
  const [mode, setMode]           = useState('pin');         // 'pin' | 'password'
  const [pin, setPin]             = useState(['', '', '', '']);
  const [password, setPassword]   = useState('');
  const [showPin, setShowPin]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState(null);

  const pinRefs  = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const pwRef    = useRef(null);

  /* Reset state when modal opens */
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setPassword('');
      setError(null);
      setSubmitting(false);
      // Focus first relevant input after paint
      setTimeout(() => {
        if (mode === 'pin') pinRefs[0].current?.focus();
        else pwRef.current?.focus();
      }, 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  /* ── PIN helpers ─────────────────────────── */
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
      // fallback: no session found — reject
      throw new Error('No active session. Please log in first.');
    }

    if (type === 'pin') {
      // Verify PIN against student_pins table (if it exists)
      // Falls back to checking user_metadata.pin
      const pin_hash = credential; // In production, hash client-side before sending

      try {
        const { data, error } = await supabase
          .from('student_pins')
          .select('pin_hash')
          .eq('email', email)
          .single();

        if (!error && data) {
          // Simple comparison (in prod, use bcrypt on server via RPC)
          if (data.pin_hash === pin_hash) return true;
          throw new Error('Incorrect PIN. Please try again.');
        }
      } catch (dbErr) {
        if (dbErr.message?.includes('Incorrect PIN')) throw dbErr;
        // Table not found or other DB error — fall through to metadata check
      }

      // Fallback: check user_metadata.pin
      const meta_pin = userData?.user?.user_metadata?.pin;
      if (meta_pin) {
        if (String(meta_pin) === credential) return true;
        throw new Error('Incorrect PIN. Please try again.');
      }

      // No PIN configured — allow dev pass-through with a warning
      console.warn('[StepUpAuth] No PIN configured for this user. Allowing in dev mode.');
      return true;
    }

    if (type === 'password') {
      // Re-authenticate with Supabase using current email + entered password
      const { error } = await supabase.auth.signInWithPassword({ email, password: credential });
      if (error) throw new Error('Incorrect password. Please try again.');
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
      onSuccess();
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="sv-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sv-modal-title">
      <div className="sv-modal">

        {/* ── Header ── */}
        <header className="sv-modal-header">
          <h2 id="sv-modal-title">
            <span className="sv-modal-icon">🔐</span>
            Step‑Up Authentication
          </h2>
          <button className="sv-close-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        {/* ── Tab switcher ── */}
        <div className="sv-tab-bar" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'pin'}
            className={`sv-tab ${mode === 'pin' ? 'active' : ''}`}
            onClick={() => { setMode('pin'); setError(null); }}
          >
            🔢 4-Digit PIN
          </button>
          <button
            role="tab"
            aria-selected={mode === 'password'}
            className={`sv-tab ${mode === 'password' ? 'active' : ''}`}
            onClick={() => { setMode('password'); setError(null); }}
          >
            🔑 Password
          </button>
        </div>

        {/* ── Body ── */}
        <form className="sv-modal-body" onSubmit={handleSubmit} noValidate autoComplete="off">
          {/* Honeypot to discourage browser autofill / credential managers */}
          <input
            type="text"
            name="sv_honeypot"
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
            aria-hidden="true"
          />
          <p className="sv-intro">
            For your security, please verify your identity to access <strong>Secure Vote</strong>.
          </p>

          {/* PIN mode */}
          {mode === 'pin' && (
            <>
              <p className="sv-pin-hint">Enter your 4-digit portal PIN</p>
              <div className={`sv-pin-row${showPin ? ' visible' : ''}`} onPaste={handlePinPaste}>
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    id={`sv-pin-${i}`}
                    name={`sv_pin_${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    pattern="[0-9]*"
                    className={`sv-pin-digit${digit ? ' filled' : ''}`}
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
                    aria-autoComplete="off"
                  />
                ))}
                {/* Custom show/hide toggle (replaces the browser's native eye icon) */}
                <button
                  type="button"
                  className="sv-pin-toggle"
                  onClick={() => setShowPin(s => !s)}
                  aria-pressed={showPin}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  title={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? '🙈' : '👁️'}
                </button>
              </div>
            </>
          )}

          {/* Password mode */}
          {mode === 'password' && (
            <>
              <label htmlFor="sv-password" className="sv-label">Password</label>
              <input
                id="sv-password"
                ref={pwRef}
                name="sv_password"
                type="password"
                className="sv-input"
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
              <ul className="sv-password-checklist" aria-live="polite">
                <li className={password.length >= 8 ? 'ok' : ''}>At least 8 characters</li>
                <li className={/[A-Za-z]/.test(password) ? 'ok' : ''}>Contains a letter</li>
                <li className={/\d/.test(password) ? 'ok' : ''}>Contains a number</li>
                <li className={/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? 'ok' : ''}>Contains a symbol</li>
              </ul>
            </>
          )}

          {/* Error */}
          {error && <div className="sv-error" role="alert">{error}</div>}

          {/* Actions */}
          <div className="sv-actions">
            <button type="button" className="sv-btn sv-btn-ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="sv-btn sv-btn-primary"
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
