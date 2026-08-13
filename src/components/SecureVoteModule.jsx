import React, { useEffect, useState } from 'react';
import VirtualQueue from './VirtualQueue';
import useStudentSession from '../hooks/useStudentSession';
import { supabase } from '../lib/supabaseClient';
import ConstituencyModal from './ConstituencyModal';
import StepUpAuthModal from './StepUpAuthModal';
import {
  checkElectionEligibility,
  deriveYearOfStudy,
  isBiometricVerified,
  getElectionTier,
  getElectionCardState
} from '../lib/eligibility';
import '../styles/SecureVote.css';

function formatCountdown(ms) {
  if (ms <= 0) return '00 Days : 00 Hours : 00 Mins : 00 Secs (LIVE NOW)';
  const totalSeconds = Math.floor(ms / 1000);
  const days = String(Math.floor(totalSeconds / (24 * 3600))).padStart(2, '0');
  const hours = String(Math.floor((totalSeconds % (24 * 3600)) / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${days} Days : ${hours} Hours : ${minutes} Mins : ${seconds} Secs`;
}

export default function SecureVoteModule({ navigate }) {
  const [student, setStudent] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showConstituencyModal, setShowConstituencyModal] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { student: sessionStudent, loading: sessionLoading } = useStudentSession();

  // Helper to read active session from state or localStorage
  const getActiveUser = () => {
    if (sessionStudent) return sessionStudent;
    try {
      const stored = localStorage.getItem('knust_user_session');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  };

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
      <div className="p-8 flex justify-center items-center min-h-[60vh] bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full text-center p-8 shadow-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
            You must be logged in with an active session to access the <strong>KNUST Secure Vote</strong> voting module.
          </p>

          <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs font-semibold mb-6">
            ⚠️ No active session. Please log in first.
          </div>

          <button
            className="w-full bg-[#8B0000] hover:bg-[#6B0000] text-white py-3 px-6 rounded-xl font-bold text-sm shadow-sm transition-all"
            onClick={() => setIsAuthModalOpen(true)}
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
        const mapped = data.map(e => ({
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
        }));
        setElections(mapped);
      } catch (err) {
        setElections([
          {
            id: 'dept',
            icon: '🏢',
            title: 'Department & College Elections',
            date: new Date(Date.now() + 3 * 86400000 + 14 * 3600000 + 22 * 60000),
            dateLabel: 'July 30',
            type: 'department',
            target: 'CoE & Computer Engineering Students',
            active: true
          },
          {
            id: 'src',
            icon: '🏛️',
            title: 'SRC Executive Elections',
            date: new Date(Date.now() + 9 * 86400000 + 14 * 3600000 + 22 * 60000),
            dateLabel: 'August 5',
            type: 'src',
            target: 'All Active Students',
            active: true
          },
          {
            id: 'const',
            icon: '🗳️',
            title: 'Constituency Parliamentary Elections',
            date: new Date(Date.now() + 11 * 86400000),
            dateLabel: 'August 7',
            type: 'constituency',
            target: 'Selected Constituency Voters',
            active: true
          },
          {
            id: 'hall',
            icon: '🏰',
            title: 'Hall Elections',
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

  if (!student) return <div className="p-8 text-slate-500 font-medium">Loading voter profile...</div>;

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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">🗳️ Secure Vote Portal</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Virtual Queue — High Traffic Protection Mode</p>
        </div>
        <VirtualQueue onReady={() => {
          setShowQueue(false);
          handleNavigate('/ballot/src');
        }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors duration-200 min-h-screen">
      {/* ── 1. Header Contrast Fix ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            🗳️ Secure Vote Portal
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            KNUST Electoral Management &amp; Student Verification System
          </p>
        </div>
        <button
          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl px-4 py-2.5 shadow-sm transition-all cursor-pointer"
          onClick={toggleBiometricsState}
          title="Toggle biometrics verification state to test valid/missing branches"
        >
          🔄 Dev Test: Biometrics {biometricsOk ? 'Valid ✅' : 'Missing ❌'}
        </button>
      </div>

      {/* ── 2. Clean Biometric & Status Checker Card ── */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-2xl p-6 shadow-sm mb-6" role="region" aria-label="Biometric & Status Checker">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            🎫 Biometric &amp; Status Checker
          </h2>
          {biometricsOk ? (
            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
              ✅ Current Semester Verified
            </span>
          ) : (
            <span className="bg-amber-50 dark:bg-slate-700 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
              ❌ Biometrics Pending
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="block text-xs text-slate-400 dark:text-slate-400 font-medium">Name:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{student.name}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400 dark:text-slate-400 font-medium">Student ID:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{student.studentId}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400 dark:text-slate-400 font-medium">Program:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{student.program}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400 dark:text-slate-400 font-medium">Academic Level:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {yearOfStudy === 1 ? 'Year 1 (100 Level)' : yearOfStudy === 2 ? 'Year 2 (200 Level)' : yearOfStudy === 3 ? 'Year 3 (300 Level)' : yearOfStudy === 4 ? 'Year 4 (400 Level)' : `Year ${yearOfStudy}`}
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-400 dark:text-slate-400 font-medium">College:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{student.college}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400 dark:text-slate-400 font-medium">Department:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{student.department}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400 dark:text-slate-400 font-medium">Assigned Hall:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {student.hall || '—'} {yearOfStudy === 1 ? '(First-Year)' : ''}
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-400 dark:text-slate-400 font-medium">Locked Constituency:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {student.constituency_locked || 'Not Selected'}
            </span>
          </div>
        </div>

        {!biometricsOk && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-slate-700 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-2" role="alert">
            🛑 <span>Biometrics Verification Pending — Your biometric verification record for the active academic session is incomplete. Please visit the ICT center.</span>
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

      {/* ── 3. Modernized Election Cards & Buttons ── */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">Upcoming &amp; Active Elections</h2>
      </div>
      <div className="space-y-6">
        {elections.map((e) => {
          const diff = e.date ? (e.date.getTime() - now) : 0;
          const isLive = diff <= 0;
          const cardState = getElectionCardState(student, e);

          /* Card 1: Department & College Elections */
          if (e.type === 'department') {
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student);
            const targetText = e.target || `${student.college} & ${student.department} Students`;

            return (
              <div key={e.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl" role="img" aria-label="Department Icon">{e.icon || '🏢'}</span>
                      <h3 className="text-base font-bold text-slate-900">{e.title}</h3>
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      <strong className="text-slate-700">Target Audience:</strong> {targetText}
                      <span className="mx-2 text-slate-300">•</span>
                      <strong className="text-slate-700">Election Date:</strong> {e.dateLabel || 'July 30'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {isLive && isEligible ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        🔴 LIVE NOW
                      </span>
                    ) : !isEligible ? (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        ⚠️ INELIGIBLE
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        📅 UPCOMING
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  {/* Bottom-Left: Countdown Timer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-mono text-xs font-bold text-slate-700 flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-slate-400">⏳</span>
                    <span>{formatCountdown(diff)}</span>
                  </div>

                  {/* Bottom-Right: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      className={
                        isEligible && isLive
                          ? "bg-[#8B0000] hover:bg-[#6B0000] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                          : isEligible
                          ? "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                          : "bg-slate-100 border border-slate-200 text-slate-400 px-4 py-2 rounded-xl text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                      }
                      disabled={!isEligible}
                      onClick={() => handleNavigate(`/ballot/${e.id}`)}
                    >
                      {!isBiometricVerified(student)
                        ? '🔒 Locked (Biometrics Required)'
                        : !isEligible
                        ? '🔒 Ineligible'
                        : isLive
                        ? 'Enter Ballot Room ➔'
                        : `Enter Ballot Room (Unlocks ${e.dateLabel || 'July 30'})`}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          /* Card 2: SRC Executive Elections */
          if (e.type === 'src') {
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student);

            return (
              <div key={e.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl" role="img" aria-label="SRC Icon">{e.icon || '🏛️'}</span>
                      <h3 className="text-base font-bold text-slate-900">{e.title}</h3>
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      <strong className="text-slate-700">Target Audience:</strong> All Active Students
                      <span className="mx-2 text-slate-300">•</span>
                      <strong className="text-slate-700">Election Date:</strong> {e.dateLabel || 'August 5'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {isLive && isEligible ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        🔴 LIVE NOW
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        📅 UPCOMING
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  {/* Bottom-Left: Countdown Timer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-mono text-xs font-bold text-slate-700 flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-slate-400">⏳</span>
                    <span>{formatCountdown(diff)}</span>
                  </div>

                  {/* Bottom-Right: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      onClick={() => alert('Viewing candidates & manifestos for SRC Executive Elections...')}
                    >
                      View Candidates &amp; Manifestos
                    </button>
                    <button
                      className={
                        isEligible
                          ? "bg-[#8B0000] hover:bg-[#6B0000] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                          : "bg-slate-100 border border-slate-200 text-slate-400 px-4 py-2 rounded-xl text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                      }
                      disabled={!isEligible}
                      onClick={() => handleNavigate(`/ballot/${e.id}`)}
                    >
                      {!isBiometricVerified(student) ? '🔒 Locked' : 'Enter Ballot Room ➔'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          /* Card 3: Constituency Parliamentary Elections */
          if (e.type === 'constituency') {
            const hasConstituency = Boolean(student.constituency_locked);
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student) && hasConstituency;
            const targetText = hasConstituency ? `Voters in ${student.constituency_locked}` : 'Selected Constituency Voters';

            return (
              <div key={e.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl" role="img" aria-label="Constituency Icon">{e.icon || '🗳️'}</span>
                      <h3 className="text-base font-bold text-slate-900">{e.title}</h3>
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      <strong className="text-slate-700">Target Audience:</strong> {targetText}
                      <span className="mx-2 text-slate-300">•</span>
                      <strong className="text-slate-700">Election Date:</strong> {e.dateLabel || 'August 7'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {isLive && isEligible ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        🔴 LIVE NOW
                      </span>
                    ) : !hasConstituency ? (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        ⚠️ Action Required
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        📅 UPCOMING
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  {/* Bottom-Left: Countdown Timer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-mono text-xs font-bold text-slate-700 flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-slate-400">⏳</span>
                    <span>{formatCountdown(diff)}</span>
                  </div>

                  {/* Bottom-Right: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {!isBiometricVerified(student) ? (
                      <button className="bg-slate-100 border border-slate-200 text-slate-400 px-4 py-2 rounded-xl text-xs font-semibold cursor-not-allowed flex items-center gap-1.5" disabled>
                        🔒 Locked (Biometrics Required)
                      </button>
                    ) : !hasConstituency ? (
                      <button
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        onClick={() => setShowConstituencyModal(true)}
                      >
                        Select Constituency
                      </button>
                    ) : (
                      <button
                        className="bg-[#8B0000] hover:bg-[#6B0000] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        onClick={() => handleNavigate(`/ballot/${e.id}`)}
                      >
                        Enter Ballot Room ➔
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          /* Card 4: Hall Elections */
          if (e.type === 'hall' || cardState.tier === 'HALL') {
            const isEligible = cardState.eligible && isBiometricVerified(student);
            const targetText = `${student.hall || 'Unity Hall'} Residents`;

            return (
              <div key={e.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl" role="img" aria-label="Hall Icon">{e.icon || '🏰'}</span>
                      <h3 className="text-base font-bold text-slate-900">{e.title}</h3>
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      <strong className="text-slate-700">Target Audience:</strong> {targetText}
                      <span className="mx-2 text-slate-300">•</span>
                      <strong className="text-slate-700">Election Date:</strong> {e.dateLabel || 'August 25'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {isEligible && isLive ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        🔴 LIVE NOW
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        📅 UPCOMING
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  {/* Bottom-Left: Countdown Timer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-mono text-xs font-bold text-slate-700 flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-slate-400">⏳</span>
                    <span>{formatCountdown(diff)}</span>
                  </div>

                  {/* Bottom-Right: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      className={
                        isEligible
                          ? "bg-[#8B0000] hover:bg-[#6B0000] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                          : "bg-slate-100 border border-slate-200 text-slate-400 px-4 py-2 rounded-xl text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                      }
                      disabled={!isEligible}
                      onClick={() => handleNavigate(`/ballot/${e.id}`)}
                    >
                      {!isBiometricVerified(student) ? '🔒 Locked' : 'Enter Ballot Room ➔'}
                    </button>
                  </div>
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
