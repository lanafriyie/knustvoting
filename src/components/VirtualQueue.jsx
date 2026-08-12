import React, { useEffect, useState, useRef } from 'react';
import '../styles/SecureVote.css';

function formatETA(seconds) {
  if (seconds <= 0) return 'Ready to enter now';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function formatTimer(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Storage keys
const TOKEN_KEY = 'sv_queue_token';
const PRIORITY_KEY = 'sv_priority_pass';

export default function VirtualQueue({ onReady, avgServiceSeconds = 15, pollIntervalMs = 3000 }) {
  const [position, setPosition] = useState(142); // Default initial position to showcase #142
  const [estimatedSeconds, setEstimatedSeconds] = useState(142 * 15);
  const [activeVotersCount, setActiveVotersCount] = useState(482); // Max 500 capacity
  const [inQueueCount, setInQueueCount] = useState(9420);
  
  // State modes: 'waiting' | 'active_token' | 'snoozed'
  const [queueState, setQueueState] = useState('waiting');
  
  // Active Ballot 5-Min Window timer (300 seconds)
  const [ballotWindowSeconds, setBallotWindowSeconds] = useState(300);
  
  // Priority Snooze Pass 10-Min Grace Period timer (600 seconds)
  const [snoozeGraceSeconds, setSnoozeGraceSeconds] = useState(600);
  const [snoozeNotice, setSnoozeNotice] = useState('');
  const [isFastTracking, setIsFastTracking] = useState(false);

  const timerRef = useRef(null);
  const windowTimerRef = useRef(null);
  const snoozeTimerRef = useRef(null);

  // Initialize or load queue token
  useEffect(() => {
    let rawToken = localStorage.getItem(TOKEN_KEY);
    let tokenData = null;
    try {
      tokenData = rawToken ? JSON.parse(rawToken) : null;
    } catch (e) {
      tokenData = null;
    }

    if (!tokenData || !tokenData.position) {
      tokenData = {
        tokenId: 'QTK-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        position: 142,
        createdAt: Date.now(),
        expiresAt: Date.now() + 15 * 60 * 1000
      };
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
    }

    setPosition(tokenData.position || 142);
    setEstimatedSeconds((tokenData.position || 142) * avgServiceSeconds);
  }, [avgServiceSeconds]);

  // Main Queue Decrement Loop
  useEffect(() => {
    if (queueState !== 'waiting' || position === null) return;

    timerRef.current = setInterval(() => {
      setPosition(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setQueueState('active_token');
          setBallotWindowSeconds(300);
          return 0;
        }

        const nextPos = prev - 1;
        setEstimatedSeconds(nextPos * avgServiceSeconds);

        try {
          const raw = localStorage.getItem(TOKEN_KEY);
          if (raw) {
            const tok = JSON.parse(raw);
            tok.position = nextPos;
            localStorage.setItem(TOKEN_KEY, JSON.stringify(tok));
          }
        } catch (e) {}

        return nextPos;
      });
    }, pollIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [queueState, position, pollIntervalMs, avgServiceSeconds]);

  // Ballot Window Countdown (5-Minute Active Token Window)
  useEffect(() => {
    if (queueState !== 'active_token') return;

    windowTimerRef.current = setInterval(() => {
      setBallotWindowSeconds(prev => {
        if (prev <= 1) {
          clearInterval(windowTimerRef.current);
          triggerSnoozePass('Queue token expired because you stepped away/slept during the 5-minute ballot window.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (windowTimerRef.current) clearInterval(windowTimerRef.current);
    };
  }, [queueState]);

  // Priority Snooze Grace Period Countdown (10-Minute Grace Period)
  useEffect(() => {
    if (queueState !== 'snoozed') return;

    snoozeTimerRef.current = setInterval(() => {
      setSnoozeGraceSeconds(prev => {
        if (prev <= 1) {
          clearInterval(snoozeTimerRef.current);
          setSnoozeNotice('Priority Snooze 10-minute grace period expired. Re-joining standard queue line.');
          setQueueState('waiting');
          setPosition(142);
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (snoozeTimerRef.current) clearInterval(snoozeTimerRef.current);
    };
  }, [queueState]);

  // Helper to trigger Snooze Pass (10-Min Grace Period + SMS/Push Notification)
  function triggerSnoozePass(reason) {
    setQueueState('snoozed');
    setSnoozeGraceSeconds(600); // 10 minutes
    setSnoozeNotice(reason || 'Your queue token expired because you stepped away or slept.');

    const passObj = {
      passId: 'SNZ-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      issuedAt: Date.now(),
      graceExpiresAt: Date.now() + 10 * 60 * 1000,
      smsAlertSent: true,
      pushAlertSent: true
    };
    localStorage.setItem(PRIORITY_KEY, JSON.stringify(passObj));

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 SECURE VOTE - PRIORITY SNOOZE PASS ISSUED', {
        body: 'Queue token expired while away. Use your Priority Snooze Pass upon re-opening to fast-track back within 1–2 minutes!',
        icon: '🔒'
      });
    }
  }

  // Handle Fast-Track Re-entry (Re-claims access within 1-2 minutes)
  function claimFastTrackReentry() {
    setIsFastTracking(true);
    setSnoozeNotice('Fast-tracking your priority token... Re-entering Active Queue in short priority buffer line (1–2 mins).');

    setTimeout(() => {
      setIsFastTracking(false);
      setQueueState('active_token');
      setBallotWindowSeconds(300);
      setPosition(0);
      setSnoozeNotice('');
    }, 1500);
  }

  return (
    <div className="sv-queue-container" role="region" aria-label="High Traffic Virtual Queue">

      {/* ── Infrastructure Header ── */}
      <div className="sv-queue-header">
        <div className="sv-queue-header-left">
          <h2 className="sv-queue-title">🛡️ HIGH-TRAFFIC VIRTUAL QUEUE SYSTEM</h2>
          <p className="sv-queue-subtitle">Database Capacity Full — Automated Traffic Control Active</p>
        </div>
        <div className="sv-queue-capacity-badge">
          <span className="sv-cap-indicator">🔴 FULL CAPACITY</span>
          <span className="sv-cap-count">{activeVotersCount} / 500 Active Voters</span>
        </div>
      </div>

      {/* ── System Surge Banner ── */}
      <div className="sv-surge-banner">
        <div className="sv-surge-stat">
          <span className="sv-stat-label">Incoming Traffic Surge:</span>
          <span className="sv-stat-value">🔥 {inQueueCount.toLocaleString()} Active Students</span>
        </div>
        <div className="sv-surge-stat">
          <span className="sv-stat-label">Database Control:</span>
          <span className="sv-stat-value">Max 500 Concurrent Voters</span>
        </div>
        <div className="sv-surge-stat">
          <span className="sv-stat-label">Snooze Engine:</span>
          <span className="sv-stat-value">10-Min Grace Fast-Track</span>
        </div>
      </div>

      {/* ── MAIN QUEUE CARD BODY ── */}

      {/* MODE 1: In-Queue Waiting Line */}
      {queueState === 'waiting' && (
        <div className="sv-queue-card waiting-mode">
          <div className="sv-queue-status-bar">
            <span className="sv-status-pill yellow">⏳ IN-QUEUE WAITING LINE</span>
            <span className="sv-queue-token-id">Token ID: QTK-2089-VAL</span>
          </div>

          <div className="sv-queue-main-display">
            <div className="sv-position-box">
              <span className="sv-pos-label">DYNAMIC POSITION IN LINE</span>
              <h3 className="sv-pos-heading">You are #{position} in line</h3>
              <span className="sv-pos-subtext">out of {inQueueCount.toLocaleString()} waiting voters</span>
            </div>

            <div className="sv-eta-box">
              <span className="sv-eta-label">ESTIMATED WAIT TIME</span>
              <span className="sv-eta-time">{formatETA(estimatedSeconds)}</span>
              <span className="sv-eta-subtext">Auto-updating live every {pollIntervalMs / 1000}s</span>
            </div>
          </div>

          <div className="sv-queue-notice-box">
            ℹ️ <strong>Capacity Protection Active:</strong> Due to heavy traffic, voters enter the ballot room in batches of 500. Once your position reaches #0, an Active Token will grant your 5-minute session.
          </div>

          {/* Dev Simulation Actions */}
          <div className="sv-dev-queue-actions">
            <span className="sv-dev-label">Dev Controls (Test Queue &amp; Snooze Features):</span>
            <div className="sv-dev-btn-row">
              <button
                className="sv-btn-dev"
                onClick={() => setPosition(1)}
              >
                ⏩ Fast Forward to Front (#1)
              </button>

              <button
                className="sv-btn-dev danger"
                onClick={() => triggerSnoozePass('Queue token expired because you stepped away or slept.')}
              >
                💤 Simulate Token Expiry / Stepped Away (Trigger Snooze Engine)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: Active Queue Token Issued (5-Min Ballot Window) */}
      {queueState === 'active_token' && (
        <div className="sv-queue-card active-mode">
          <div className="sv-queue-status-bar">
            <span className="sv-status-pill green">✅ ACTIVE QUEUE TOKEN ISSUED</span>
            <span className="sv-queue-token-id">Session Token: ACT-500-ACCESS</span>
          </div>

          <div className="sv-token-granted-box">
            <h3>🎉 IT'S YOUR TURN TO VOTE!</h3>
            <p>Your 5-Minute Voting Session Window is active. Access the ballot room now.</p>

            <div className="sv-timer-countdown">
              <span className="sv-timer-label">SESSION WINDOW EXPIRES IN:</span>
              <span className="sv-timer-digits">{formatTimer(ballotWindowSeconds)}</span>
            </div>

            <div className="sv-active-actions">
              <button
                className="sv-btn-card primary pulse"
                onClick={() => {
                  if (onReady) onReady();
                  else alert('Opening ballot room...');
                }}
              >
                🗳️ ENTER BALLOT ROOM NOW ➔
              </button>
            </div>
          </div>

          {/* Dev simulation */}
          <div className="sv-dev-queue-actions">
            <button
              className="sv-btn-dev danger"
              onClick={() => triggerSnoozePass('Queue token expired because 5-minute voting window timed out.')}
            >
              ⏱️ Simulate Token Expiry (Stepped Away / Slept)
            </button>
          </div>
        </div>
      )}

      {/* MODE 3: Priority Snooze Engine Activated (Feature 2) */}
      {queueState === 'snoozed' && (
        <div className="sv-queue-card snooze-mode">
          <div className="sv-queue-status-bar">
            <span className="sv-status-pill purple">🚨 PRIORITY SNOOZE PASS ACTIVATED</span>
            <span className="sv-queue-token-id">Pass ID: SNZ-10MIN-GRACE</span>
          </div>

          <div className="sv-snooze-body">
            <div className="sv-snooze-header-box">
              <h3>📱 Priority Snooze Pass Available</h3>
              <p>Your queue token expired because you stepped away or slept. Re-opening the app activates your Priority Snooze Pass grace period.</p>
            </div>

            <div className="sv-snooze-metrics">
              <div className="sv-snooze-stat-card">
                <span className="sv-snooze-label">10-MIN GRACE PERIOD REMAINING</span>
                <span className="sv-snooze-timer">{formatTimer(snoozeGraceSeconds)}</span>
                <span className="sv-snooze-sub">Grace Window Active</span>
              </div>

              <div className="sv-snooze-stat-card">
                <span className="sv-snooze-label">PRIORITY BUFFER FAST-TRACK</span>
                <span className="sv-snooze-val">⚡ 1 – 2 Minutes</span>
                <span className="sv-snooze-sub">Short Buffer Line Access</span>
              </div>
            </div>

            {/* Notification Delivery Status */}
            <div className="sv-notification-channels">
              <span className="sv-channel-badge success">📲 Push Notification Alert Dispatched</span>
              <span className="sv-channel-badge success">💬 SMS Reminder Sent (+233 24 **** 89)</span>
            </div>

            {/* Fast-Track Re-entry CTA Button */}
            <div className="sv-snooze-action-area">
              <button
                className="sv-btn-card warning pulse"
                disabled={isFastTracking}
                onClick={claimFastTrackReentry}
              >
                {isFastTracking ? '⚡ Fast-Tracking to Short Priority Buffer Line...' : '⚡ RE-CLAIM FAST-TRACK ACCESS (1–2 MINS) ➔'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
