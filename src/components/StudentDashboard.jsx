import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import useStudentSession from '../hooks/useStudentSession';
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

// CTA navigation helper (works with or without the App-provided navigate)
function goTo(path, navigate) {
  if (typeof navigate === 'function') {
    navigate(path);
  } else {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export default function StudentDashboard({ navigate }) {
  const { student: sessionStudent, loading: loadingSession } = useStudentSession();
  const [student, setStudent] = useState(null);
  const [elections, setElections] = useState([]);
  const [loadingElections, setLoadingElections] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Map sessionStudent into a local student shape
  useEffect(() => {
    if (sessionStudent) {
      setStudent({
        name: sessionStudent.full_name || 'Kwame Nkrumah',
        studentId: sessionStudent.student_id || '20894512',
        program: sessionStudent.program || 'BSc. Computer Eng.',
        department: sessionStudent.department || 'Computer Engineering',
        department_code: sessionStudent.department_code || 'COE',
        college: sessionStudent.college || sessionStudent.college_code || 'CoE',
        college_code: sessionStudent.college_code || 'COE',
        hall: sessionStudent.hall || 'Unity Hall',
        hall_code: sessionStudent.hall_code || 'UNITY',
        constituency_locked: sessionStudent.constituency_locked || null,
        year_of_study: sessionStudent.year_of_study || deriveYearOfStudy(sessionStudent) || 1,
        level: sessionStudent.level || null,
        biometrics_completed_current_semester:
          sessionStudent.biometrics_completed_current_semester ?? true,
        student_academic_sessions: sessionStudent.student_academic_sessions || [],
      });
    }
  }, [sessionStudent]);

  // Default mock student if offline / initial load
  useEffect(() => {
    if (!student && !loadingSession) {
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
        constituency_locked: 'Ayeduase',
        year_of_study: 1,
        level: 100,
        biometrics_completed_current_semester: true,
        student_academic_sessions: [
          { session: '2025/2026', is_current: true, level: 100, year_of_study: 1 },
        ],
      });
    }
  }, [student, loadingSession]);

  // Load elections from Supabase
  useEffect(() => {
    let mounted = true;
    async function loadElections() {
      setLoadingElections(true);
      try {
        const { data, error } = await supabase
          .from('elections')
          .select(
            'election_id, title, start_time, end_time, is_active, status, jurisdiction_id, electoral_jurisdictions(*)'
          );
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
        // Fallback demo elections
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

  if (!student) {
    return (
      <div className="sv-dashboard">
        <p>Loading your portal...</p>
      </div>
    );
  }

  const yearOfStudy = deriveYearOfStudy(student);
  const biometricsOk = isBiometricVerified(student);

  // Determine time remaining for polls (nearest active/scheduled election end)
  const activeElections = elections.filter((e) => e.title && e.status === 'ACTIVE');
  const nextElection = activeElections[0] || elections.find((e) => e.title);
  const pollEndTime = nextElection?.endTime?.getTime() || now;
  const pollRemainingMs = pollEndTime - now;

  return (
    <div className="sv-dashboard sv-student-dashboard">
      {/* ── Header Banner (KNUST Crimson) ── */}
      <div className="sv-header-banner sv-dash-banner">
        <div>
          <h1 className="sv-title">👋 Welcome back, {student.name}!</h1>
          <p className="sv-subtitle">
            KNUST Student Portal — Governance, Elections &amp; Student Services
          </p>
        </div>
        <button
          className="sv-dash-cta"
          onClick={() => goTo('/governance/secure-vote', navigate)}
        >
          🗳️ Go to Secure Vote ➔
        </button>
      </div>

      {/* ── Stats Cards Row ── */}
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
              {student.constituency_locked || 'Ayeduase'} Constituency
            </span>
            <span className="sv-stat-sub">
              {student.program} · Year {yearOfStudy}
            </span>
          </div>
        </div>
      </div>

      {/* ── Active Elections + Announcements Layout ── */}
      <div className="sv-dash-grid">
        {/* Active Elections Table/Card */}
        <div className="sv-card sv-elections-card">
          <div className="sv-card-title-bar">
            <h2>🗳️ ACTIVE &amp; UPCOMING ELECTIONS</h2>
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
                    const elig = checkElectionEligibility(student, e);
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
                          {!elig.eligible && (
                            <span className="sv-elec-notice">🔒 {elig.reason}</span>
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
                            onClick={() => goTo(`/ballot/${e.id}`, navigate)}
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
            <h2>📢 ELECTORAL ANNOUNCEMENTS</h2>
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
          <div className="sv-announcement-item">
            <h3>📅 Polling Schedule</h3>
            <p>
              SRC Executive Council Elections are currently open. Department,
              Constituency, and Hall elections open on their scheduled dates.
              Stay tuned for official EC timelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
