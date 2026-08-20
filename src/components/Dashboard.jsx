import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import useStudentSession from '../hooks/useStudentSession';
import StepUpAuthModal from './StepUpAuthModal';
import ConstituencyModal from './ConstituencyModal';
import DemoProfileSwitcher from './DemoProfileSwitcher';
import { deriveYearOfStudy, isBiometricVerified, checkElectionEligibility, getElectionStatus, mockElections, mergeWithMockElections, formatUnlockDate } from '../lib/eligibility';
import { getStoredStudentProfile, subscribeToDemoProfile } from '../lib/demoProfiles';
import { isElectionVoted, subscribeToVoteUpdates } from '../lib/votingService';
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
  const [elections, setElections] = useState(() => mockElections);
  const [loadingElections, setLoadingElections] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showConstituencyModal, setShowConstituencyModal] = useState(false);
  const [authModalError, setAuthModalError] = useState(null);
  const [votedTick, setVotedTick] = useState(0);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('sv_redirect_notification');
      if (stored) {
        setNotification(stored);
        sessionStorage.removeItem('sv_redirect_notification');
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToVoteUpdates(() => {
      setVotedTick(t => t + 1);
    });
    return unsubscribe;
  }, []);

  // Helper to read active user from hook, state, or localStorage
  const getActiveUser = () => {
    if (sessionStudent) return sessionStudent;
    try {
      const stored = localStorage.getItem('knust_user_session');
      return stored ? JSON.parse(stored) : getStoredStudentProfile();
    } catch (e) {
      return getStoredStudentProfile();
    }
  };

  useEffect(() => {
    const active = getActiveUser();
    if (active) {
      setStudent(active);
    }
    const unsubscribe = subscribeToDemoProfile((newProfile) => {
      setStudent(newProfile);
    });
    return unsubscribe;
  }, [sessionStudent]);

  // Load elections from Supabase with fast timeout fallback
  useEffect(() => {
    let mounted = true;
    async function loadElections() {
      try {
        const fetchPromise = supabase
          .from('elections')
          .select('election_id, title, start_time, end_time, is_active, status, jurisdiction_id, electoral_jurisdictions(*)');
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ data: null }), 500));

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        if (!mounted) return;
        if (res && res.data && res.data.length > 0) {
          const mapped = mergeWithMockElections(res.data);
          setElections(mapped);
        }
      } catch (err) {
        // Retain mockElections
      } finally {
        if (mounted) setLoadingElections(false);
      }
    }

    loadElections();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen for election status overrides across tabs/components
  useEffect(() => {
    const handleStatusChange = () => {
      setElections(prev => mergeWithMockElections(prev));
    };
    window.addEventListener('knust_elections_status_changed', handleStatusChange);
    window.addEventListener('storage', handleStatusChange);
    return () => {
      window.removeEventListener('knust_elections_status_changed', handleStatusChange);
      window.removeEventListener('storage', handleStatusChange);
    };
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
      {/* Header Banner (White surface with KNUST Green Title & Gold Accent) */}
      {notification && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 rounded-2xl text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 shadow-sm" role="alert">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none">🔒</span>
            <div>
              <h4 className="text-sm font-bold m-0 text-amber-900 dark:text-amber-100">Access Restricted</h4>
              <p className="text-xs font-medium mt-1 m-0 text-amber-800 dark:text-amber-300 leading-relaxed">{notification}</p>
            </div>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-100 text-lg font-bold leading-none bg-transparent border-none cursor-pointer p-1"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
      <div className="sv-dash-banner bg-white dark:bg-slate-800 border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="m-0 text-2xl font-black text-[#007A4D] dark:text-slate-100 tracking-tight">
              👋 Welcome back, {student ? (student.full_name || student.name || 'Student') : 'Student'}!
            </h1>
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-[#EAF6F0] dark:bg-slate-700 text-[#075C42] dark:text-emerald-400 border border-[#C3E8D7] dark:border-slate-600 shadow-2xs">
              {yearOfStudy === 1 ? 'Level 100 · First-Year' : `Level ${student?.level || (yearOfStudy * 100)} · Continuing Student`}
            </span>
          </div>
          <p className="m-0 text-sm font-medium text-[#66716C] dark:text-slate-400">
            KNUST Student Portal — Governance, Elections &amp; Student Services
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap mr-12">
          {/* Quick Demo Switcher Control */}
          <DemoProfileSwitcher onProfileChange={setStudent} />

          <button
            id="dashboard-cta-btn"
            className="px-5 py-2.5 rounded-xl bg-[#007A4D] hover:bg-[#075C42] text-white font-bold text-sm shadow-xs transition-all cursor-pointer flex items-center gap-2"
            onClick={handleCtaClick}
          >
            🗳️ Go to Secure Vote ➔
          </button>
        </div>
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
              {(() => {
                const cVal = student ? (student.constituency || student.constituency_locked || null) : null;
                if (!cVal) return 'Constituency Not Assigned';
                return cVal.toLowerCase().includes('constituency') ? cVal : `${cVal} Constituency`;
              })()}
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
                    <th className="py-3 px-3">Election</th>
                    <th className="py-3 px-3 min-w-[140px] flex-shrink-0">Status</th>
                    <th className="py-3 px-3 min-w-[140px] flex-shrink-0">Polling Closes</th>
                    <th className="py-3 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {elections.map((e) => {
                    const hasVoted = isElectionVoted(e.id, e.type);
                    const isConstituency = e.type === 'constituency' || e.tier === 'CONSTITUENCY';
                    const cVal = student ? (student.constituency || student.constituency_locked || null) : null;
                    const hasConstituency = Boolean(cVal);
                    const elig = checkElectionEligibility(student || {}, e);
                    const statusInfo = getElectionStatus(e, e.endTime, now);

                    return (
                      <tr key={e.id}>
                        <td className="py-3.5 px-3">
                          <strong>{e.title}</strong>
                          {e.jurisdiction?.name && (
                            <span className="sv-elec-juris">
                              {e.jurisdiction.name}
                            </span>
                          )}
                          {!elig.eligible && !hasVoted && elig.reason && (
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                              ⚠️ {elig.reason}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 min-w-[140px] flex-shrink-0">
                          {hasVoted ? (
                            <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-1.5 shadow-2xs">
                              ✓ Voted
                            </span>
                          ) : !elig.eligible ? (
                            <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60 gap-1.5" title={elig.reason}>
                              ⚠️ Ineligible
                            </span>
                          ) : statusInfo.isLive ? (
                            <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-1.5 shadow-2xs">
                              🟢 Live — Ballot Open
                            </span>
                          ) : statusInfo.isUpcoming ? (
                            <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/60 gap-1.5">
                              ⏳ Starts in {statusInfo.countdownText}
                            </span>
                          ) : (
                            <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 gap-1.5">
                              🔒 Polls Closed
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 min-w-[140px] flex-shrink-0">
                          {statusInfo.isLive ? (
                            <span className="text-xs font-bold text-[#08754B] dark:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
                              <span>⏱️</span>
                              <span className="text-[#202522] dark:text-slate-100">
                                {statusInfo.countdownText.includes('left') ? statusInfo.countdownText : `${statusInfo.countdownText} left`}
                              </span>
                            </span>
                          ) : statusInfo.isUpcoming ? (
                            <span className="text-xs font-semibold text-[#66716C] dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                              <span>⏱️</span>
                              <span>Starts in {statusInfo.countdownText}</span>
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-[#66716C] dark:text-slate-500 inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span>🔒</span>
                              <span>Polls Closed</span>
                            </span>
                          )}
                        </td>
                        <td>
                          {hasVoted ? (
                            <button
                              className="sv-btn-card secondary sv-polling-btn"
                              disabled
                              style={{ background: '#EAF6F0', color: '#08754B', borderColor: '#C3E8D7', cursor: 'default' }}
                            >
                              ✓ Voted
                            </button>
                          ) : isConstituency && !hasConstituency ? (
                            <div className="flex items-center gap-2">
                              <button
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                onClick={() => setShowConstituencyModal(true)}
                              >
                                Select Constituency
                              </button>
                              <button
                                className="bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                                disabled={true}
                              >
                                Unlocks {formatUnlockDate(e)}
                              </button>
                            </div>
                          ) : statusInfo.isClosed ? (
                            <button
                              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                              onClick={() => goTo('/results', navigate)}
                            >
                              View Results 📊
                            </button>
                          ) : (
                            <button
                              className={
                                elig.eligible && statusInfo.isLive
                                  ? "bg-red-800 hover:bg-red-700 text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                                  : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                              }
                              disabled={!(elig.eligible && statusInfo.isLive)}
                              title={!elig.eligible ? elig.reason : undefined}
                              onClick={(elig.eligible && statusInfo.isLive) ? () => goTo(`/ballot/${e.id}`, navigate) : undefined}
                            >
                              {elig.eligible && statusInfo.isLive
                                ? 'Enter Polling Station ➔'
                                : `Unlocks ${formatUnlockDate(e)}`}
                            </button>
                          )}
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

      {/* Constituency Selection Modal */}
      <ConstituencyModal
        isOpen={showConstituencyModal}
        studentId={student?.student_id || student?.studentId}
        onLocked={(selectedConstituency) => {
          setShowConstituencyModal(false);
          setStudent(s => {
            const updated = {
              ...(s || {}),
              constituency: selectedConstituency,
              constituency_locked: selectedConstituency
            };
            try {
              localStorage.setItem('knust_user_session', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
        }}
      />
    </div>
  );
}
