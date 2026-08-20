import React, { useEffect, useState } from 'react';
import VirtualQueue from './VirtualQueue';
import useStudentSession from '../hooks/useStudentSession';
import { supabase } from '../lib/supabaseClient';
import ConstituencyModal from './ConstituencyModal';
import StepUpAuthModal from './StepUpAuthModal';
import DemoProfileSwitcher from './DemoProfileSwitcher';
import { submitAnonymousVote } from '../lib/votingService';
import {
  checkElectionEligibility,
  deriveYearOfStudy,
  isBiometricVerified,
  getElectionTier,
  getElectionCardState,
  getElectionStatus,
  mockElections,
  mergeWithMockElections,
  formatUnlockDate
} from '../lib/eligibility';
import { getStoredStudentProfile, subscribeToDemoProfile } from '../lib/demoProfiles';
import { isElectionVoted, subscribeToVoteUpdates } from '../lib/votingService';
import { useAdminAuth } from '../context/AdminAuthContext';

function formatCountdown(ms) {
  if (ms <= 0) return '00 Days : 00 Hours : 00 Mins : 00 Secs (LIVE NOW)';
  const totalSeconds = Math.floor(ms / 1000);
  const days = String(Math.floor(totalSeconds / (24 * 3600))).padStart(2, '0');
  const hours = String(Math.floor((totalSeconds % (24 * 3600)) / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${days} Days : ${hours} Hours : ${minutes} Mins : ${seconds} Secs`;
}

export default function SecureVote({ navigate }) {
  const [student, setStudent] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showConstituencyModal, setShowConstituencyModal] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [votedTick, setVotedTick] = useState(0);
  const { student: sessionStudent, loading: sessionLoading } = useStudentSession();
  const { ecAdminProfile, isElectionManagedByOfficerTier } = useAdminAuth();

  useEffect(() => {
    const unsubscribe = subscribeToVoteUpdates(() => {
      setVotedTick(t => t + 1);
    });
    return unsubscribe;
  }, []);

  // Helper to read active session from state or localStorage
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
    const initial = getActiveUser();
    if (initial) {
      setStudent(initial);
    }
    const unsubscribe = subscribeToDemoProfile((newProfile) => {
      setStudent(newProfile);
    });
    return unsubscribe;
  }, []);

  // Map sessionStudent into local student shape when available
  useEffect(() => {
    if (sessionStudent) {
      setStudent(prev => ({
        ...prev,
        name: sessionStudent.full_name || 'Kwame Nkrumah',
        studentId: sessionStudent.student_id || '20894512',
        program: sessionStudent.program || prev?.program || 'BSc. Computer Eng.',
        department: sessionStudent.department || prev?.department || 'Computer Engineering',
        department_code: sessionStudent.department_code || 'COE',
        college: sessionStudent.college || prev?.college || 'CoE',
        college_code: sessionStudent.college_code || 'COE',
        hall: sessionStudent.hall || prev?.hall || 'Unity Hall',
        hall_code: sessionStudent.hall_code || 'UNITY',
        constituency_locked: sessionStudent.constituency_locked || null,
        biometrics_completed_current_semester: sessionStudent.biometrics_completed_current_semester ?? true,
        student_academic_sessions: sessionStudent.student_academic_sessions || [],
        year_of_study: sessionStudent.year_of_study || 1
      }));

      // Check if constituency locked
      (async () => {
        try {
          const { data: existing, error } = await supabase
            .from('student_constituency_selections')
            .select('jurisdiction_id, electoral_jurisdictions(name)')
            .eq('student_id', sessionStudent.student_id)
            .limit(1)
            .single();
          if (!error && existing) {
            const constituencyName = existing.electoral_jurisdictions?.name || 'Ayeduase';
            setStudent(s => ({ ...s, constituency_locked: constituencyName }));
          }
        } catch (err) {
          console.warn('constituency check skipped', err);
        }
      })();

      (async () => {
        try {
          const { data: udata } = await supabase.auth.getUser();
          const user = udata?.user;
          if (user) {
            const roles = (user.user_metadata && user.user_metadata.roles) || [];
            setUserRoles(Array.isArray(roles) ? roles : [roles]);
          }
        } catch (err) { /* ignore */ }
      })();
    }
  }, [sessionStudent]);

  // PAGE-LEVEL SESSION GUARD
  const activeSession = getActiveUser();

  // Default mock student if offline / initial load
  useEffect(() => {
    if (!student && activeSession) {
      setStudent({
        name: 'Kwame Nkrumah',
        studentId: '20894512',
        program: 'BSc. Computer Eng.',
        department: 'Computer Engineering',
        department_code: 'COE',
        college: 'CoE',
        college_code: 'COE',
        hall: 'Unity Hall',
        hall_code: 'UNITY',
        constituency_locked: null,
        biometrics_completed_current_semester: true,
        student_academic_sessions: [{ session: '2025/2026', is_current: true, level: 100, year_of_study: 1 }],
        year_of_study: 1
      });
    }
  }, [student, activeSession]);

  if (!sessionLoading && !activeSession) {
    return (
      <div className="sv-access-denied-wrapper" style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="sv-card" style={{ maxWidth: '520px', width: '100%', textAlign: 'center', padding: '36px 28px', borderTop: '4px solid #8B0000', borderRadius: '16px', background: '#ffffff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: '54px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#8B0000', margin: '0 0 12px 0', fontSize: '24px', fontWeight: '800' }}>Access Denied</h2>
          <p style={{ color: '#4A4A4A', fontSize: '15px', lineHeight: '1.5', marginBottom: '20px' }}>
            You must be logged in with an active session to access the <strong>KNUST Secure Vote</strong> voting module.
          </p>

          <div style={{ background: '#FFF0F0', border: '1.5px solid #C62828', color: '#C62828', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', marginBottom: '24px' }}>
            ⚠️ No active session. Please log in first.
          </div>

          <button
            className="sv-btn-card primary"
            onClick={() => setIsAuthModalOpen(true)}
            style={{ width: '100%', padding: '12px 24px', fontSize: '16px', fontWeight: '800', background: 'linear-gradient(135deg, #4A0000 0%, #8B0000 100%)', color: '#ffffff', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(139, 0, 0, 0.3)' }}
          >
            🔑 Log In / Authenticate
          </button>

          <StepUpAuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            initialError="No active session. Please log in first."
            onSuccess={() => {
              setIsAuthModalOpen(false);
              window.location.reload();
            }}
          />
        </div>
      </div>
    );
  }

  // Election schedule list loaded from Supabase schema with fast timeout fallback
  const [elections, setElections] = useState(() => mockElections);
  const [loadingElections, setLoadingElections] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadElections() {
      try {
        const fetchPromise = supabase
          .from('elections')
          .select('election_id, title, description, start_time, end_time, is_active, jurisdiction_id, electoral_jurisdictions(*)');
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
    return () => { mounted = false; };
  }, []);

  // Tick timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Virtual queue check
  const [showQueue, setShowQueue] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function checkQueue() {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('queue') === '1' || url.searchParams.get('simulate_queue') === '1') {
          if (mounted) setShowQueue(true);
        }
      } catch (err) {}
    }
    checkQueue();
    return () => { mounted = false; };
  }, []);

  if (!student) return <div className="sv-dashboard"><p>Loading voter profile...</p></div>;

  const biometricsOk = Boolean(student.biometrics_completed_current_semester);
  const yearOfStudy = deriveYearOfStudy(student);

  // Safe navigation helper
  function handleNavigate(path) {
    if (typeof navigate === 'function') {
      navigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  // Dev helper to toggle biometrics state for testing
  function toggleBiometricsState() {
    setStudent(s => ({
      ...s,
      biometrics_completed_current_semester: !s.biometrics_completed_current_semester
    }));
  }

  if (showQueue) {
    return (
      <div className="sv-dashboard">
        <div className="sv-header">
          <h1>🗳️ Secure Vote Portal</h1>
          <p>Virtual Queue — High Traffic Protection Mode</p>
        </div>
        <VirtualQueue onReady={() => {
          setShowQueue(false);
          handleNavigate('/ballot/src');
        }} />
      </div>
    );
  }

  return (
    <div className="sv-dashboard">
      {/* ── Dashboard Header ── */}
      <div className="sv-header-banner">
        <div>
          <h1 className="sv-title">🗳️ Secure Vote Portal</h1>
          <p className="sv-subtitle">KNUST Electoral Management &amp; Student Verification System</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginRight: '48px' }}>
          <DemoProfileSwitcher onProfileChange={setStudent} />
          <button
            className="sv-dev-toggle-btn"
            onClick={toggleBiometricsState}
            title="Toggle biometrics verification state to test valid/missing branches"
          >
            🔄 Dev Test: Biometrics {biometricsOk ? 'Valid ✅' : 'Missing ❌'}
          </button>
        </div>
      </div>

      {/* ── EC Officer Persona & Student Profile Binding Banner ── */}
      {ecAdminProfile && (
        <div style={{
          marginBottom: 20,
          padding: 16,
          background: '#F3FAF6',
          border: '2px solid #007A4D',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{ecAdminProfile.avatar}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: '#007A4D', letterSpacing: '0.5px' }}>
                  Officer Identity &amp; Student Profile Bound
                </span>
                <span style={{ background: '#007A4D', color: '#ffffff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                  {ecAdminProfile.roleTier}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#202522', marginTop: 2 }}>
                {student.name || ecAdminProfile.name} | Level {student.level || (yearOfStudy * 100)} | {student.college || 'CoE'} | {student.constituency_locked || student.constituency || 'Ayeduase'} Constituency
              </div>
              <div style={{ fontSize: 12, color: '#66716C', fontWeight: 500 }}>
                Scope: {ecAdminProfile.assignedJurisdiction?.name}
              </div>
            </div>
          </div>
          <div style={{ background: '#EAF6F0', color: '#007A4D', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800, border: '1px solid rgba(0,122,77,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔐</span> Dual-Identity Session Active
          </div>
        </div>
      )}

      {/* ── Top Card: Biometric & Status Checker ── */}
      <div className="sv-card sv-verify-card-full" role="region" aria-label="Biometric & Status Checker">
        <div className="sv-card-title-bar">
          <h2>🎫 Biometric &amp; Status Checker</h2>
          {biometricsOk ? (
            <div className="sv-badge sv-badge-green">
              ✅ Current Semester Verified
            </div>
          ) : (
            <div className="sv-badge sv-badge-red">
              ❌ Biometrics Pending
            </div>
          )}
        </div>

        <div className="sv-verify-grid">
          <div className="sv-verify-field">
            <span className="sv-field-label">Name:</span>
            <span className="sv-field-value bold">{student.name}</span>
          </div>
          <div className="sv-verify-field">
            <span className="sv-field-label">Student ID:</span>
            <span className="sv-field-value highlight">{student.studentId}</span>
          </div>
          <div className="sv-verify-field">
            <span className="sv-field-label">Program:</span>
            <span className="sv-field-value">{student.program}</span>
          </div>
          <div className="sv-verify-field">
            <span className="sv-field-label">Academic Level:</span>
            <span className="sv-field-value">
              {yearOfStudy === 1 ? 'Year 1 (100 Level)' : yearOfStudy === 2 ? 'Year 2 (200 Level)' : yearOfStudy === 3 ? 'Year 3 (300 Level)' : yearOfStudy === 4 ? 'Year 4 (400 Level)' : `Year ${yearOfStudy}`}
            </span>
          </div>
          <div className="sv-verify-field">
            <span className="sv-field-label">College:</span>
            <span className="sv-field-value">{student.college}</span>
          </div>
          <div className="sv-verify-field">
            <span className="sv-field-label">Department:</span>
            <span className="sv-field-value">{student.department}</span>
          </div>
          <div className="sv-verify-field">
            <span className="sv-field-label">Locked Constituency:</span>
            <span className="sv-field-value">
              {(() => {
                const cVal = student ? (student.constituency || student.constituency_locked || null) : null;
                if (!cVal) return 'Constituency Not Assigned';
                return cVal.toLowerCase().includes('constituency') ? cVal : `${cVal} Constituency`;
              })()}
            </span>
          </div>
        </div>

        {!biometricsOk && (
          <div className="sv-ineligible-banner" role="alert">
            🛑 <strong>Biometrics Verification Pending</strong> — Your biometric verification record for the active academic session is incomplete. Please visit the UITS office.
          </div>
        )}
      </div>

      {/* ── Constituency Selection Modal ── */}
      <ConstituencyModal
        isOpen={showConstituencyModal}
        studentId={student?.studentId || student?.student_id}
        onLocked={(constituency) => {
          setShowConstituencyModal(false);
          setStudent(s => {
            const updated = {
              ...(s || {}),
              constituency: constituency,
              constituency_locked: constituency
            };
            try {
              localStorage.setItem('knust_user_session', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
        }}
      />

      {/* ── Schedule Section Title ── */}
      <div className="sv-section-header">
        <h2>Upcoming &amp; Active Elections</h2>
      </div>

      {/* ── Schedule Cards Grid ── */}
      <div className="sv-schedule-grid">
        {elections.map((e) => {
          const statusInfo = getElectionStatus(e, e.endTime, now);
          const cardState = getElectionCardState(student, e);

          /* Card 1: Department & College Elections */
          if (e.type === 'department') {
            const hasVoted = isElectionVoted(e.id, e.type);
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student);
            const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(e) : false;

            return (
              <div key={e.id} className={`sv-card sv-schedule-card ${!isEligible ? 'ineligible-card' : ''}`}>
                <div className="sv-card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <span className="sv-card-icon">{e.icon || '🏢'}</span>
                  <h3>{e.title}</h3>
                  {isManagedByOfficer && (
                    <span style={{
                      padding: '3px 8px',
                      background: '#FFF7ED',
                      color: '#9A3412',
                      border: '1px solid #FDBA74',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }} title="Officer votes use the exact same zero-knowledge encryption as general students.">
                      🛡️ Conflict Protocol Verified / Ballot Encrypted
                    </span>
                  )}
                  {hasVoted ? (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#ecfdf5',
                      color: '#047857',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      ✓ VOTED
                    </span>
                  ) : !isEligible && (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#ffebee',
                      color: '#c62828',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      🔒 INELIGIBLE
                    </span>
                  )}
                </div>
                <div className="sv-card-meta">
                  <p><strong>Election Date:</strong> {e.dateLabel || 'August 22, 2026'}</p>
                  <p><strong>Target:</strong> {e.target || `${student.college} & ${student.department} Students`}</p>
                  <p className="sv-status-line">
                    <strong>Status:</strong>{' '}
                    {hasVoted ? (
                      <span className="sv-live-tag" style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>✓ VOTED</span>
                    ) : !isBiometricVerified(student) ? (
                      <span className="sv-warning-tag">🛑 INELIGIBLE (BIOMETRICS MISSING)</span>
                    ) : !isEligible ? (
                      <span className="sv-warning-tag">⚠️ {eligibilityCheck.reason}</span>
                    ) : statusInfo.isLive ? (
                      <span className="sv-live-tag">🟢 Live — Ballot Open</span>
                    ) : statusInfo.isUpcoming ? (
                      <span className="sv-countdown-tag">⏳ UPCOMING ({statusInfo.badgeText})</span>
                    ) : (
                      <span className="sv-warning-tag" style={{ background: '#F1F5F9', color: '#475569' }}>📊 CONCLUDED</span>
                    )}
                  </p>
                </div>

                {!isEligible && eligibilityCheck.reason && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: '#ffebee',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#c62828',
                    fontWeight: 500
                  }}>
                    📋 {eligibilityCheck.reason}
                  </div>
                )}

                <div className="sv-countdown-box">
                  {statusInfo.isUpcoming
                    ? `Starts in ${statusInfo.countdownText}`
                    : statusInfo.isLive
                    ? `Polls Close in ${statusInfo.countdownText}`
                    : 'Election Concluded'}
                </div>

                <div className="sv-card-action">
                  {hasVoted ? (
                    <button className="sv-btn-card secondary" disabled style={{ background: '#F0FDF4', color: '#166534', cursor: 'default' }}>
                      ✓ BALLOT CAST &amp; RECORDED
                    </button>
                  ) : statusInfo.isClosed ? (
                    <button className="sv-btn-card secondary" onClick={() => alert(`Results published for ${e.title}`)}>
                      View Results 📊
                    </button>
                  ) : (
                    <button
                      className={
                        isEligible && statusInfo.isLive
                          ? "bg-red-800 hover:bg-red-700 text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                          : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      }
                      disabled={!(isEligible && statusInfo.isLive)}
                      onClick={(isEligible && statusInfo.isLive) ? () => handleNavigate(`/ballot/${e.id}`) : undefined}
                    >
                      {isEligible && statusInfo.isLive
                        ? 'Enter Polling Station ➔'
                        : `Unlocks ${formatUnlockDate(e)}`}
                    </button>
                  )}
                </div>
              </div>
            );
          }

          /* Card 2: SRC Executive Elections */
          if (e.type === 'src') {
            const hasVoted = isElectionVoted(e.id, e.type);
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student);
            const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(e) : false;

            return (
              <div key={e.id} className={`sv-card sv-schedule-card ${!isEligible ? 'ineligible-card' : ''}`}>
                <div className="sv-card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <span className="sv-card-icon">{e.icon || '🏛️'}</span>
                  <h3>{e.title}</h3>
                  {isManagedByOfficer && (
                    <span style={{
                      padding: '3px 8px',
                      background: '#FFF7ED',
                      color: '#9A3412',
                      border: '1px solid #FDBA74',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }} title="Officer votes use the exact same zero-knowledge encryption as general students.">
                      🛡️ Conflict Protocol Verified / Ballot Encrypted
                    </span>
                  )}
                  {hasVoted ? (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#ecfdf5',
                      color: '#047857',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      ✓ VOTED
                    </span>
                  ) : !isEligible && (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#ffebee',
                      color: '#c62828',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      🔒 INELIGIBLE
                    </span>
                  )}
                </div>
                <div className="sv-card-meta">
                  <p><strong>Election Date:</strong> {e.dateLabel || 'August 25, 2026'}</p>
                  <p><strong>Target:</strong> All Active Students</p>
                  <p className="sv-status-line">
                    <strong>Status:</strong>{' '}
                    {hasVoted ? (
                      <span className="sv-live-tag" style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>✓ VOTED</span>
                    ) : !isBiometricVerified(student) ? (
                      <span className="sv-warning-tag">🛑 INELIGIBLE (BIOMETRICS MISSING)</span>
                    ) : statusInfo.isLive ? (
                      <span className="sv-live-tag">🟢 Live — Ballot Open</span>
                    ) : statusInfo.isUpcoming ? (
                      <span className="sv-countdown-tag">⏳ UPCOMING ({statusInfo.badgeText})</span>
                    ) : (
                      <span className="sv-warning-tag" style={{ background: '#F1F5F9', color: '#475569' }}>📊 CONCLUDED</span>
                    )}
                  </p>
                </div>

                <div className="sv-countdown-box">
                  {statusInfo.isUpcoming
                    ? `Starts in ${statusInfo.countdownText}`
                    : statusInfo.isLive
                    ? `Polls Close in ${statusInfo.countdownText}`
                    : 'Election Concluded'}
                </div>

                <div className="sv-card-action sv-action-group">
                  <button
                    className="sv-btn-card outline"
                    onClick={() => handleNavigate(`/ballot/${e.id}`)}
                  >
                    VIEW CANDIDATES &amp; MANIFESTOS
                  </button>
                  {hasVoted ? (
                    <button className="sv-btn-card secondary" disabled style={{ background: '#F0FDF4', color: '#166534', cursor: 'default' }}>
                      ✓ BALLOT CAST &amp; RECORDED
                    </button>
                  ) : statusInfo.isClosed ? (
                    <button className="sv-btn-card secondary" onClick={() => alert(`Results published for ${e.title}`)}>
                      View Results 📊
                    </button>
                  ) : (
                    <button
                      className={
                        isEligible && statusInfo.isLive
                          ? "bg-red-800 hover:bg-red-700 text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                          : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      }
                      disabled={!(isEligible && statusInfo.isLive)}
                      onClick={(isEligible && statusInfo.isLive) ? () => handleNavigate(`/ballot/${e.id}`) : undefined}
                    >
                      {isEligible && statusInfo.isLive
                        ? 'Enter Ballot Room ➔'
                        : `Unlocks ${formatUnlockDate(e)}`}
                    </button>
                  )}
                </div>
              </div>
            );
          }

          /* Card 3: Constituency Parliamentary Elections */
          if (e.type === 'constituency') {
            const hasVoted = isElectionVoted(e.id, e.type);
            const constituencyName = student ? (student.constituency || student.constituency_locked || null) : null;
            const hasConstituency = Boolean(constituencyName);
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student) && hasConstituency;
            const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(e) : false;

            return (
              <div key={e.id} className={`sv-card sv-schedule-card ${!isEligible ? 'ineligible-card' : ''}`}>
                <div className="sv-card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <span className="sv-card-icon">{e.icon || '🗳️'}</span>
                  <h3>{e.title}</h3>
                  {isManagedByOfficer && (
                    <span style={{
                      padding: '3px 8px',
                      background: '#FFF7ED',
                      color: '#9A3412',
                      border: '1px solid #FDBA74',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }} title="Officer votes use the exact same zero-knowledge encryption as general students.">
                      🛡️ Conflict Protocol Verified / Ballot Encrypted
                    </span>
                  )}
                  {hasVoted ? (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#ecfdf5',
                      color: '#047857',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      ✓ VOTED
                    </span>
                  ) : !isEligible && (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#ffebee',
                      color: '#c62828',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      🔒 INELIGIBLE
                    </span>
                  )}
                </div>
                <div className="sv-card-meta">
                  <p><strong>Election Date:</strong> {e.dateLabel || 'August 26, 2026'}</p>
                  <p><strong>Target:</strong> {hasConstituency ? `Voters in ${student.constituency_locked}` : 'Selected Constituency Voters'}</p>
                  <p className="sv-status-line">
                    <strong>Status:</strong>{' '}
                    {hasVoted ? (
                      <span className="sv-live-tag" style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>✓ VOTED</span>
                    ) : !isBiometricVerified(student) ? (
                      <span className="sv-warning-tag">🛑 INELIGIBLE (BIOMETRICS MISSING)</span>
                    ) : !hasConstituency ? (
                      <span className="sv-warning-tag">⚠️ CONSTITUENCY SELECTION REQUIRED</span>
                    ) : statusInfo.isLive ? (
                      <span className="sv-live-tag">🟢 Live — Ballot Open</span>
                    ) : statusInfo.isUpcoming ? (
                      <span className="sv-countdown-tag">⏳ UPCOMING ({statusInfo.badgeText})</span>
                    ) : (
                      <span className="sv-warning-tag" style={{ background: '#F1F5F9', color: '#475569' }}>📊 CONCLUDED</span>
                    )}
                  </p>
                </div>

                {!isBiometricVerified(student) && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: '#ffebee',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#c62828',
                    fontWeight: 500
                  }}>
                    📋 Biometrics verification pending for current semester.
                  </div>
                )}

                <div className="sv-countdown-box">
                  {statusInfo.isUpcoming
                    ? `Starts in ${statusInfo.countdownText}`
                    : statusInfo.isLive
                    ? `Polls Close in ${statusInfo.countdownText}`
                    : 'Election Concluded'}
                </div>

                <div className="sv-card-action">
                  {hasVoted ? (
                    <button className="sv-btn-card secondary" disabled style={{ background: '#F0FDF4', color: '#166534', cursor: 'default' }}>
                      ✓ BALLOT CAST &amp; RECORDED
                    </button>
                  ) : !isBiometricVerified(student) ? (
                    <button className="sv-btn-card locked" disabled>
                      🔒 LOCKED (Biometrics Required)
                    </button>
                  ) : !hasConstituency ? (
                    <div className="flex items-center gap-2">
                      <button
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
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
                    <button className="sv-btn-card secondary" onClick={() => alert(`Results published for ${e.title}`)}>
                      View Results 📊
                    </button>
                  ) : (
                    <button
                      className={
                        isEligible && statusInfo.isLive
                          ? "bg-red-800 hover:bg-red-700 text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                          : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      }
                      disabled={!(isEligible && statusInfo.isLive)}
                      onClick={(isEligible && statusInfo.isLive) ? () => handleNavigate(`/ballot/${e.id}`) : undefined}
                    >
                      {isEligible && statusInfo.isLive
                        ? 'Enter Ballot Room ➔'
                        : `Unlocks ${formatUnlockDate(e)}`}
                    </button>
                  )}
                </div>
              </div>
            );
          }

          /* Card 4: Hall Elections — DYNAMIC FILTERING (First-Year Hall Rule) */
          if (e.type === 'hall' || cardState.tier === 'HALL') {
            const hasVoted = isElectionVoted(e.id, e.type);
            const eligibilityCheck = cardState.eligibility;
            const isFirstYear = yearOfStudy === 1;
            const isEligible = cardState.eligible && isBiometricVerified(student) && isFirstYear;
            const disabledForNonFirstYear = !isFirstYear;
            const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(e) : false;
            const restrictionMessage =
              'Hall elections are restricted strictly to Level 100 resident students. Continuing students vote in Off-Campus / Constituency elections.';

            return (
              <div key={e.id} className={`sv-card sv-schedule-card ${!isEligible && !hasVoted ? 'ineligible-card' : ''}`}>
                <div className="sv-card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <span className="sv-card-icon">{e.icon || '🏰'}</span>
                  <h3>{e.title}</h3>
                  {isManagedByOfficer && (
                    <span style={{
                      padding: '3px 8px',
                      background: '#FFF7ED',
                      color: '#9A3412',
                      border: '1px solid #FDBA74',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }} title="Officer votes use the exact same zero-knowledge encryption as general students.">
                      🛡️ Conflict Protocol Verified / Ballot Encrypted
                    </span>
                  )}
                  {hasVoted ? (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#ecfdf5',
                      color: '#047857',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      ✓ VOTED
                    </span>
                  ) : !isEligible && (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#ffebee',
                      color: '#c62828',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      🔒 Ineligible — Continuing Student
                    </span>
                  )}
                </div>

                {/* First-Year Hall Rule disabled badge for non-first-years */}
                {disabledForNonFirstYear && !hasVoted && (
                  <div style={{
                    marginBottom: 12,
                    padding: '10px 12px',
                    background: '#FFF0F0',
                    border: '1px solid #FFCDD2',
                    borderLeft: '4px solid #B71C1C',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#B71C1C',
                    fontWeight: 600
                  }}>
                    🏰 <strong>Hall Elections Policy:</strong> {restrictionMessage}
                  </div>
                )}

                <div className="sv-card-meta">
                  <p><strong>Election Date:</strong> {e.dateLabel || 'August 28, 2026'}</p>
                  <p><strong>Target:</strong> {isFirstYear ? (student.hall ? `${student.hall} Residents/Affiliates` : 'Unity Hall Residents/Affiliates') : 'Hall Residents (Restricted to Level 100)'}</p>
                  <p className="sv-status-line">
                    <strong>Status:</strong>{' '}
                    {hasVoted ? (
                      <span className="sv-live-tag" style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>✓ VOTED</span>
                    ) : !isBiometricVerified(student) ? (
                      <span className="sv-warning-tag">🛑 INELIGIBLE (BIOMETRICS MISSING)</span>
                    ) : !isFirstYear ? (
                      <span className="sv-warning-tag">🚫 INELIGIBLE — CONTINUING STUDENT</span>
                    ) : statusInfo.isLive ? (
                      <span className="sv-live-tag">🟢 Live — Ballot Open</span>
                    ) : statusInfo.isUpcoming ? (
                      <span className="sv-countdown-tag">⏳ UPCOMING ({statusInfo.badgeText})</span>
                    ) : (
                      <span className="sv-warning-tag" style={{ background: '#F1F5F9', color: '#475569' }}>📊 CONCLUDED</span>
                    )}
                  </p>
                </div>

                {!isEligible && isFirstYear && eligibilityCheck.reason && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: '#ffebee',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#c62828',
                    fontWeight: 500
                  }}>
                    📋 {eligibilityCheck.reason}
                  </div>
                )}

                <div className="sv-countdown-box">
                  {statusInfo.isUpcoming
                    ? `Starts in ${statusInfo.countdownText}`
                    : statusInfo.isLive
                    ? `Polls Close in ${statusInfo.countdownText}`
                    : 'Election Concluded'}
                </div>

                <div className="sv-card-action sv-action-group">
                  <button
                    className="sv-btn-card outline"
                    onClick={() => handleNavigate(`/ballot/${e.id}`)}
                  >
                    VIEW SCHEDULE
                  </button>
                  {hasVoted ? (
                    <button className="sv-btn-card secondary" disabled style={{ background: '#F0FDF4', color: '#166534', cursor: 'default' }}>
                      ✓ BALLOT CAST &amp; RECORDED
                    </button>
                  ) : statusInfo.isClosed ? (
                    <button className="sv-btn-card secondary" onClick={() => alert(`Results published for ${e.title}`)}>
                      View Results 📊
                    </button>
                  ) : (
                    <button
                      className={
                        isEligible && statusInfo.isLive
                          ? "bg-red-800 hover:bg-red-700 text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                          : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      }
                      disabled={!(isEligible && statusInfo.isLive)}
                      title={!isEligible ? restrictionMessage : undefined}
                      onClick={(isEligible && statusInfo.isLive) ? () => handleNavigate(`/ballot/${e.id}`) : undefined}
                    >
                      {isEligible && statusInfo.isLive
                        ? 'Enter Ballot Room ➔'
                        : `Unlocks ${formatUnlockDate(e)}`}
                    </button>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
