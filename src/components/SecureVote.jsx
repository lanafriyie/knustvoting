import React, { useEffect, useState } from 'react';
import VirtualQueue from './VirtualQueue';
import useStudentSession from '../hooks/useStudentSession';
import { supabase } from '../lib/supabaseClient';
import ConstituencyModal from './ConstituencyModal';
import { submitAnonymousVote } from '../lib/votingService';
import {
  checkElectionEligibility,
  deriveYearOfStudy,
  isBiometricVerified,
  getElectionTier,
  getElectionCardState
} from '../lib/eligibility';

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
  const { student: sessionStudent } = useStudentSession();

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

  // Default mock student if offline / initial load
  useEffect(() => {
    if (!student) {
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
  }, [student]);

  // Election schedule list loaded from Supabase schema
  const [elections, setElections] = useState([]);
  const [loadingElections, setLoadingElections] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadElections() {
      setLoadingElections(true);
      try {
        const { data, error } = await supabase
          .from('elections')
          .select('election_id, title, description, start_time, end_time, is_active, jurisdiction_id, electoral_jurisdictions(*)');
        if (error || !data || data.length === 0) throw error || new Error('No DB data');
        if (!mounted) return;
const mapped = data.map(e => {
          const raw = {
            id: e.election_id,
            title: e.title,
            description: e.description,
            date: e.start_time ? new Date(e.start_time) : new Date(),
            type: e.tier || (e.title.toLowerCase().includes('department') ? 'department' :
                e.title.toLowerCase().includes('src') ? 'src' :
                e.title.toLowerCase().includes('constituency') ? 'constituency' : 'hall'),
            active: e.is_active,
            jurisdiction: e.electoral_jurisdictions || null,
            hall_code: e.hall_code || null,
            college_code: e.college_code || null,
            department_code: e.department_code || null,
            tier: getElectionTier(e)
          };
          return raw;
        });
        setElections(mapped);
      } catch (err) {
        setElections([
          {
            id: 'dept',
            icon: '🏢',
            title: 'DEPARTMENT & COLLEGE ELECTIONS',
            date: new Date(Date.now() + 3 * 86400000 + 14 * 3600000 + 22 * 60000),
            dateLabel: 'July 30',
            type: 'department',
            target: 'CoE & Computer Engineering Students',
            active: true
          },
          {
            id: 'src',
            icon: '🏛️',
            title: 'SRC EXECUTIVE ELECTIONS',
            date: new Date(Date.now() + 9 * 86400000 + 14 * 3600000 + 22 * 60000),
            dateLabel: 'August 5',
            type: 'src',
            target: 'All Active Students',
            active: true
          },
          {
            id: 'const',
            icon: '🗳️',
            title: 'CONSTITUENCY PARLIAMENTARY ELECTIONS',
            date: new Date(Date.now() + 11 * 86400000),
            dateLabel: 'August 7',
            type: 'constituency',
            target: 'Selected Constituency Voters',
            active: true
          },
          {
            id: 'hall',
            icon: '🏰',
            title: 'HALL ELECTIONS',
            date: new Date(Date.now() + 23 * 86400000),
            dateLabel: 'August 25',
            type: 'hall',
            target: 'Unity Hall Residents/Affiliates',
            active: true
          }
        ]);
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
          <h1>🗳️ SECURE VOTE - DASHBOARD</h1>
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
          <h1 className="sv-title">🗳️ SECURE VOTE - DASHBOARD</h1>
          <p className="sv-subtitle">KNUST Electoral Management &amp; Student Verification System</p>
        </div>
        <button
          className="sv-dev-toggle-btn"
          onClick={toggleBiometricsState}
          title="Toggle biometrics verification state to test valid/missing branches"
        >
          🔄 Dev Test: Biometrics {biometricsOk ? 'Valid ✅' : 'Missing ❌'}
        </button>
      </div>

{/* ── Top Card: Biometric & Status Checker ── */}
      <div className="sv-card sv-verify-card-full" role="region" aria-label="Biometric & Status Checker">
        <div className="sv-card-title-bar">
          <h2>🎫 BIOMETRIC &amp; STATUS CHECKER</h2>
          {biometricsOk ? (
            <div className="sv-badge sv-badge-green">
              ✅ CURRENT SEMESTER VERIFIED
            </div>
          ) : (
            <div className="sv-badge sv-badge-red">
              ❌ BIOMETRICS PENDING
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
            <span className="sv-field-label">Assigned Hall:</span>
            <span className="sv-field-value">
              {student.hall || '—'} {yearOfStudy === 1 ? '(First-Year)' : ''}
            </span>
          </div>
        </div>

        {!biometricsOk && (
          <div className="sv-ineligible-banner" role="alert">
            🛑 <strong>Biometrics Verification Pending</strong> — Your biometric verification record for the active academic session is incomplete. You cannot enter ballot rooms until biometrics are verified at the ICT center.
          </div>
        )}
      </div>

      {/* ── Constituency Selection Modal ── */}
      <ConstituencyModal
        isOpen={showConstituencyModal}
        studentId={student?.studentId}
        onLocked={(constituency) => {
          setShowConstituencyModal(false);
          setStudent(s => ({ ...(s || {}), constituency_locked: constituency }));
        }}
      />

      {/* ── Schedule Section Title ── */}
      <div className="sv-section-header">
        <h2>UPCOMING &amp; ACTIVE ELECTIONS</h2>
      </div>

      {/* ── Schedule Cards Grid ── */}
      <div className="sv-schedule-grid">
{elections.map((e) => {
          const diff = e.date ? (e.date.getTime() - now) : 0;
          const isLive = diff <= 0;
          const cardState = getElectionCardState(student, e);

          /* Card 1: Department & College Elections */
          if (e.type === 'department') {
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student);
            
            return (
              <div key={e.id} className={`sv-card sv-schedule-card ${!isEligible ? 'ineligible-card' : ''}`}>
                <div className="sv-card-head">
                  <span className="sv-card-icon">{e.icon || '🏢'}</span>
                  <h3>{e.title}</h3>
                  {!isEligible && (
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
                  <p><strong>Election Date:</strong> {e.dateLabel || 'July 30'}</p>
                  <p><strong>Target:</strong> {e.target || `${student.college} & ${student.department} Students`}</p>
                  <p className="sv-status-line">
                    <strong>Status:</strong>{' '}
                    {!isBiometricVerified(student) ? (
                      <span className="sv-warning-tag">🛑 INELIGIBLE (BIOMETRICS MISSING)</span>
                    ) : !isEligible ? (
                      <span className="sv-warning-tag">⚠️ {eligibilityCheck.reason}</span>
                    ) : isLive ? (
                      <span className="sv-live-tag">🔴 LIVE NOW</span>
                    ) : (
                      <span className="sv-countdown-tag">⏳ COUNTDOWN LIVE</span>
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
                  {formatCountdown(diff)}
                </div>

                <div className="sv-card-action">
                  <button
                    className={`sv-btn-card ${isEligible ? (isLive ? 'primary' : 'secondary') : 'locked'}`}
                    disabled={!isEligible}
                    onClick={() => handleNavigate(`/ballot/${e.id}`)}
                  >
                    {!isBiometricVerified(student)
                      ? '🔒 LOCKED (Biometrics Required)'
                      : !isEligible
                      ? '🔒 INELIGIBLE'
                      : isLive
                      ? 'ENTER BALLOT ROOM ➔'
                      : `ENTER BALLOT ROOM (Unlocks ${e.dateLabel || 'July 30'})`}
                  </button>
                </div>
              </div>
            );
          }

          /* Card 2: SRC Executive Elections */
          if (e.type === 'src') {
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student);
            
            return (
              <div key={e.id} className={`sv-card sv-schedule-card ${!isEligible ? 'ineligible-card' : ''}`}>
                <div className="sv-card-head">
                  <span className="sv-card-icon">{e.icon || '🏛️'}</span>
                  <h3>{e.title}</h3>
                  {!isEligible && (
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
                  <p><strong>Election Date:</strong> {e.dateLabel || 'August 5'}</p>
                  <p><strong>Target:</strong> All Active Students</p>
                  <p className="sv-status-line">
                    <strong>Status:</strong>{' '}
                    {!isBiometricVerified(student) ? (
                      <span className="sv-warning-tag">🛑 INELIGIBLE (BIOMETRICS MISSING)</span>
                    ) : (
                      <span className="sv-upcoming-tag">📅 UPCOMING</span>
                    )}
                  </p>
                </div>

                <div className="sv-countdown-box">
                  {formatCountdown(diff)}
                </div>

                <div className="sv-card-action sv-action-group">
                  <button
                    className="sv-btn-card outline"
                    onClick={() => alert('Viewing candidates & manifestos for SRC Executive Elections...')}
                  >
                    VIEW CANDIDATES &amp; MANIFESTOS
                  </button>
                  <button
                    className={`sv-btn-card ${isEligible ? 'primary' : 'locked'}`}
                    disabled={!isEligible}
                    onClick={() => handleNavigate(`/ballot/${e.id}`)}
                  >
                    {!isBiometricVerified(student) ? '🔒 LOCKED (Biometrics Required)' : 'ENTER BALLOT ROOM'}
                  </button>
                </div>
              </div>
            );
          }

          /* Card 3: Constituency Parliamentary Elections */
          if (e.type === 'constituency') {
            const hasConstituency = Boolean(student.constituency_locked);
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student) && hasConstituency;
            
            return (
              <div key={e.id} className={`sv-card sv-schedule-card ${!isEligible ? 'ineligible-card' : ''}`}>
                <div className="sv-card-head">
                  <span className="sv-card-icon">{e.icon || '🗳️'}</span>
                  <h3>{e.title}</h3>
                  {!isEligible && (
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
                  <p><strong>Election Date:</strong> {e.dateLabel || 'August 7'}</p>
                  <p><strong>Target:</strong> {hasConstituency ? `Voters in ${student.constituency_locked}` : 'Selected Constituency Voters'}</p>
                  <p className="sv-status-line">
                    <strong>Status:</strong>{' '}
                    {!isBiometricVerified(student) ? (
                      <span className="sv-warning-tag">🛑 INELIGIBLE (BIOMETRICS MISSING)</span>
                    ) : !hasConstituency ? (
                      <span className="sv-warning-tag">⚠️ CONSTITUENCY SELECTION REQUIRED</span>
                    ) : isLive ? (
                      <span className="sv-live-tag">🔴 LIVE NOW</span>
                    ) : (
                      <span className="sv-upcoming-tag">📅 UPCOMING</span>
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
                  {formatCountdown(diff)}
                </div>

                <div className="sv-card-action">
                  {!isBiometricVerified(student) ? (
                    <button className="sv-btn-card locked" disabled>
                      🔒 LOCKED (Biometrics Required)
                    </button>
                  ) : !hasConstituency ? (
                    <button
                      className="sv-btn-card warning"
                      onClick={() => setShowConstituencyModal(true)}
                    >
                      SELECT YOUR CONSTITUENCY (Ayeduase, Kotei, etc.)
                    </button>
                  ) : (
                    <button
                      className="sv-btn-card primary"
                      onClick={() => handleNavigate(`/ballot/${e.id}`)}
                    >
                      ENTER BALLOT ROOM
                    </button>
                  )}
                </div>
              </div>
            );
          }

/* Card 4: Hall Elections — DYNAMIC FILTERING (First-Year Hall Rule) */
          if (e.type === 'hall' || cardState.tier === 'HALL') {
            const eligibilityCheck = cardState.eligibility;
            const isFirstYear = cardState.isFirstYear;
            const isEligible = cardState.eligible && isBiometricVerified(student);
            const disabledForNonFirstYear = !isFirstYear;
            
            return (
              <div key={e.id} className={`sv-card sv-schedule-card ${!isEligible ? 'ineligible-card' : ''}`}>
                <div className="sv-card-head">
                  <span className="sv-card-icon">{e.icon || '🏰'}</span>
                  <h3>{e.title}</h3>
                  {!isEligible && (
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

                {/* First-Year Hall Rule disabled badge for non-first-years */}
                {disabledForNonFirstYear && cardState.badge && (
                  <div style={{
                    marginBottom: 12,
                    padding: '10px 12px',
                    background: '#FFF0F0',
                    border: '1px solid #FFCDD2',
                    borderLeft: '4px solid var(--sv-error)',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#B71C1C',
                    fontWeight: 600
                  }}>
                    🏰 <strong>Ineligible:</strong> Hall elections are restricted to First-Year students only.
                  </div>
                )}

                <div className="sv-card-meta">
                  <p><strong>Election Date:</strong> {e.dateLabel || 'August 25'}</p>
                  <p><strong>Target:</strong> {student.hall ? `${student.hall} Residents/Affiliates` : 'Unity Hall Residents/Affiliates'}</p>
                  <p className="sv-status-line">
                    <strong>Status:</strong>{' '}
                    {!isBiometricVerified(student) ? (
                      <span className="sv-warning-tag">🛑 INELIGIBLE (BIOMETRICS MISSING)</span>
) : !isFirstYear ? (
                      <span className="sv-warning-tag">🚫 FIRST-YEAR ONLY</span>
                    ) : (
                      <span className={`${isLive ? 'sv-live-tag' : 'sv-upcoming-tag'}`}>
                        {isLive ? '🔴 LIVE NOW' : '📅 UPCOMING'}
                      </span>
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
                  {formatCountdown(diff)}
                </div>

                <div className="sv-card-action sv-action-group">
                  <button
                    className="sv-btn-card outline"
                    onClick={() => alert(`Hall Election Schedule for ${student.hall}:\nVoting opens August 25, 08:00 AM.`)}
                  >
                    VIEW SCHEDULE
                  </button>
                  <button
                    className={`sv-btn-card ${isEligible ? 'primary' : 'locked'}`}
                    disabled={!isEligible}
                    onClick={() => handleNavigate(`/ballot/${e.id}`)}
                  >
{!isBiometricVerified(student)
                      ? '🔒 LOCKED (Biometrics Required)'
                      : !isFirstYear
                      ? '🔒 LOCKED (First-Year Only)'
                      : 'ENTER BALLOT ROOM'}
                  </button>
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
