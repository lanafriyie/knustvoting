import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import useStudentSession from '../hooks/useStudentSession';
import StepUpAuthModal from './StepUpAuthModal';
import { deriveYearOfStudy, isBiometricVerified, checkElectionEligibility } from '../lib/eligibility';
import '../styles/SecureVote.css';

// Live countdown formatter
function formatCountdown(ms) {
  if (ms <= 0) return '00 Days : 00 Hours : 00 Mins : 00 Secs (LIVE NOW)';
  const totalSeconds = Math.floor(ms / 1000);
  const days = String(Math.floor(totalSeconds / (24 * 3600))).padStart(2, '0');
  const hours = String(Math.floor((totalSeconds % (24 * 3600)) / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${days} Days : ${hours} Hours : ${minutes} Mins : ${seconds} Secs`;
}

// CTA navigation helper
function goTo(path, navigate) {
  if (typeof navigate === 'function') {
    navigate(path);
  } else {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export default function Dashboard({ navigate }) {
  const { student: sessionStudent, loading: loadingSession } = useStudentSession();
  const [student, setStudent] = useState(null);
  const [elections, setElections] = useState([]);
  const [loadingElections, setLoadingElections] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalError, setAuthModalError] = useState(null);

  // Helper to read active user from hook, state, or localStorage
  const getActiveUser = () => {
    if (sessionStudent) return sessionStudent;
    try {
      const stored = localStorage.getItem('knust_user_session');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const active = getActiveUser();
    if (active) {
      setStudent(active);
    }
  }, [sessionStudent]);

  // Load elections from Supabase or fallback demo data
  useEffect(() => {
    let mounted = true;
    async function loadElections() {
      setLoadingElections(true);
      try {
        const { data, error } = await supabase
          .from('elections')
          .select('election_id, title, start_time, end_time, is_active, status, jurisdiction_id, electoral_jurisdictions(*)');
        if (error || !data || data.length === 0) throw error || new Error('No DB data');
        if (!mounted) return;
        const mapped = data.map((e) => ({
          id: e.election_id,
          title: e.title,
          startTime: e.start_time ? new Date(e.start_time) : null,
          endTime: e.end_time ? new Date(e.end_time) : null,
          active: e.is_active,
          status: e.status,
          type: e.title.toLowerCase().includes('department')
            ? 'department'
            : e.title.toLowerCase().includes('src')
            ? 'src'
            : e.title.toLowerCase().includes('constituency')
            ? 'constituency'
            : 'hall',
          jurisdiction: e.electoral_jurisdictions || null,
        }));
        setElections(mapped);
      } catch (err) {
        setElections([
          {
            id: 'src',
            title: '2026 SRC Executive Council Elections',
            startTime: new Date(Date.now() - 2 * 86400000),
            endTime: new Date(Date.now() + 5 * 86400000),
            active: true,
            status: 'ACTIVE',
            type: 'src',
          },
          {
            id: 'dept',
            title: 'DEPARTMENT & COLLEGE ELECTIONS',
            startTime: new Date(Date.now() + 3 * 86400000),
            endTime: new Date(Date.now() + 4 * 86400000),
            active: false,
            status: 'SCHEDULED',
            type: 'department',
          },
          {
            id: 'const',
            title: 'CONSTITUENCY PARLIAMENTARY ELECTIONS',
            startTime: new Date(Date.now() + 11 * 86400000),
            endTime: new Date(Date.now() + 12 * 86400000),
            active: false,
            status: 'SCHEDULED',
            type: 'constituency',
          },
        ]);
      } finally {
        if (mounted) setLoadingElections(false);
      }
    }

    loadElections();
    return () => {
      mounted = false;
    };
  }, []);

  // Tick timer for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // CTA Button Guard: Check active user/session before opening voting module
  const handleCtaClick = async (e) => {
    if (e) e.preventDefault();

    let activeUser = getActiveUser();

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) activeUser = userData.user;
    } catch (err) {
      /* ignore */
    }

    if (!activeUser) {
      // Prevent navigation & trigger Auth Modal with explicit error message
      setAuthModalError("No active session. Please log in first.");
      setIsAuthModalOpen(true);
      return;
    }

    // Active session exists: trigger Step-Up Auth modal
    setAuthModalError(null);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    goTo('/secure-vote', navigate);
  };

  const yearOfStudy = student ? (student.year_of_study || deriveYearOfStudy(student) || 1) : 1;
  const biometricsOk = student ? isBiometricVerified(student) : false;

  const activeElections = elections.filter((e) => e.title && e.status === 'ACTIVE');
  const nextElection = activeElections[0] || elections.find((e) => e.title);
  const pollEndTime = nextElection?.endTime?.getTime() || now;
  const pollRemainingMs = pollEndTime - now;

  return (
    <div className="sv-dashboard sv-student-dashboard">
      {/* Header Banner (KNUST Crimson) */}
      <div className="sv-header-banner sv-dash-banner">
        <div>
          <h1 className="sv-title">
            👋 Welcome back, {student ? (student.full_name || student.name || 'Student') : 'Student'}!
          </h1>
          <p className="sv-subtitle">
            KNUST Student Portal — Governance, Elections &amp; Student Services
          </p>
        </div>
        <button
          id="dashboard-cta-btn"
          className="sv-dash-cta"
          onClick={handleCtaClick}
        >
          🗳️ Go to Secure Vote ➔
        </button>
      </div>

      {/* Stats Cards Row */}
      <div className="sv-stats-row">
        {/* Voter Eligibility */}
        <div className="sv-stat-card">
          <div className="sv-stat-card-icon">✅</div>
          <div className="sv-stat-card-body">
            <span className="sv-stat-label">Voter Eligibility</span>
            <span className="sv-stat-value">
              {biometricsOk ? 'Verified' : 'Pending Verification'}
            </span>
            <span className={`sv-stat-badge ${biometricsOk ? 'verified' : 'unverified'}`}>
              {biometricsOk ? 'VERIFIED' : 'NOT VERIFIED'}
            </span>
          </div>
        </div>

        {/* Time Remaining for Polls */}
        <div className="sv-stat-card">
          <div className="sv-stat-card-icon">⏳</div>
          <div className="sv-stat-card-body">
            <span className="sv-stat-label">Time Remaining for Polls</span>
            <span className="sv-stat-value sv-stat-countdown">
              {formatCountdown(pollRemainingMs)}
            </span>
          </div>
        </div>

        {/* Student Constituency Info */}
        <div className="sv-stat-card">
          <div className="sv-stat-card-icon">🏛️</div>
          <div className="sv-stat-card-body">
            <span className="sv-stat-label">Constituency Info</span>
            <span className="sv-stat-value">
              {(student && (student.constituency_locked || student.hall)) || 'Ayeduase'} Constituency
            </span>
            <span className="sv-stat-sub">
              {(student && (student.program || student.department)) || 'BSc. Computer Eng.'} · Year {yearOfStudy}
            </span>
          </div>
        </div>
      </div>

      {/* Active Elections Table & Side Widget */}
      <div className="sv-dash-grid">
        {/* Active Elections Card */}
        <div className="sv-card sv-elections-card">
          <div className="sv-card-title-bar">
            <h2>🗳️ Active &amp; Upcoming Elections</h2>
          </div>
          {loadingElections ? (
            <p style={{ padding: 16, color: 'var(--sv-text-mid)' }}>
              Loading elections...
            </p>
          ) : elections.length === 0 ? (
            <p style={{ padding: 16, color: 'var(--sv-text-mid)' }}>
              No elections scheduled at this time.
            </p>
          ) : (
            <div className="sv-elections-table-wrap">
              <table className="sv-elections-table">
                <thead>
                  <tr>
                    <th>Election</th>
                    <th>Status</th>
                    <th>Polling Closes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {elections.map((e) => {
                    const elig = checkElectionEligibility(student || {}, e);
                    const isLive =
                      e.status === 'ACTIVE' &&
                      e.startTime &&
                      e.endTime &&
                      e.startTime.getTime() <= now &&
                      e.endTime.getTime() >= now;
                    const statusLabel = isLive
                      ? 'LIVE NOW'
                      : e.status === 'ACTIVE'
                      ? 'LIVE'
                      : e.status === 'PAUSED'
                      ? 'PAUSED'
                      : 'SCHEDULED';
                    return (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.title}</strong>
                          {e.jurisdiction?.name && (
                            <span className="sv-elec-juris">
                              {e.jurisdiction.name}
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`sv-elec-status ${
                              isLive ? 'live' : 'scheduled'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          {e.endTime
                            ? e.endTime.toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td>
                          <button
                            className="sv-btn-card primary sv-polling-btn"
                            disabled={!elig.eligible}
                            onClick={handleCtaClick}
                          >
                            Enter Polling Station ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Electoral Announcements Widget */}
        <div className="sv-card sv-announcements-card">
          <div className="sv-card-title-bar">
            <h2>📢 Electoral Announcements</h2>
          </div>
          <div className="sv-announcement-item">
            <h3>🔐 Step-Up Authentication Required</h3>
            <p>
              Accessing the Secure Vote module triggers a mandatory Step-Up
              authentication flow. Verify your identity with your KNUST PIN and
              biometrics to unlock ballot rooms.
            </p>
          </div>
          <div className="sv-announcement-item">
            <h3>🛡️ Zero-Trace Privacy Guarantee</h3>
            <p>
              Your ballot is AES-256-GCM encrypted and hashed with SHA-256 before
              submission. Votes are anonymized — no one can link your ballot back
              to your identity. Full cryptographic receipt is issued upon casting.
            </p>
          </div>
        </div>
      </div>

      {/* Step-Up Auth Modal */}
      <StepUpAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialError={authModalError}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
