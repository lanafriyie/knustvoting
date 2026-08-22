import React, { useEffect, useState } from 'react';
import {
  Fingerprint,
  Timer,
  Building2,
  Megaphone,
  UserCheck,
  AlertTriangle,
  Vote,
  BarChart3,
  Clock,
  Lock,
  ChevronRight,
  User,
  GraduationCap,
  ShieldAlert,
  CheckCircle2,
  Eye,
  ShieldCheck,
  X,
  RefreshCw,
  Building,
  Home
} from 'lucide-react';
import VirtualQueue from './VirtualQueue';
import useStudentSession from '../hooks/useStudentSession';
import { supabase } from '../lib/supabaseClient';
import ConstituencyModal from './ConstituencyModal';
import StepUpAuthModal from './StepUpAuthModal';
import DemoProfileSwitcher from './DemoProfileSwitcher';
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
import { showToast } from '../lib/toast';
import '../styles/SecureVote.css';

function formatCountdown(ms) {
  if (ms <= 0) return '00 Days : 00 Hours : 00 Mins : 00 Secs (LIVE NOW)';
  const totalSeconds = Math.floor(ms / 1000);
  const days = String(Math.floor(totalSeconds / (24 * 3600))).padStart(2, '0');
  const hours = String(Math.floor((totalSeconds % (24 * 3600)) / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${days}d : ${hours}h : ${minutes}m : ${seconds}s`;
}

function StudentProfilePopover({ student }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!student) return null;

  const initials = (student.name || 'Kwame Nkrumah')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  const biometricsOk = Boolean(student.biometrics_completed_current_semester);

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-8 h-8 rounded-full bg-[#004D40] text-white flex items-center justify-center text-xs font-bold border border-[#D4AF37] cursor-pointer hover:scale-105 transition-transform"
        aria-label="Student details popover"
      >
        <span>{initials}</span>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${biometricsOk ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl z-50 p-4 animate-fadeIn font-sans text-slate-950 dark:text-slate-100">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#004D40] text-white flex items-center justify-center text-sm font-bold border border-[#D4AF37]">
              {initials}
            </div>
            <div className="min-w-0">
              <h4 className="m-0 text-xs font-bold truncate leading-tight">{student.name}</h4>
              <span className="text-[10px] font-semibold text-slate-400 font-mono">ID: {student.studentId || student.student_id}</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Program:</span>
              <span className="font-bold truncate max-w-[150px]">{student.program}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Academic Level:</span>
              <span className="font-bold">Year {student.year_of_study || 1} (Level {student.level || 100})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Assigned Hall:</span>
              <span className="font-bold truncate max-w-[150px]">{student.hall || 'Off-Campus'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Constituency:</span>
              <span className="font-bold font-mono">{student.constituency_locked || student.constituency || 'Not Selected'}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-center">
            {biometricsOk ? (
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-250 dark:border-emerald-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                ✓ Verified Voter
              </span>
            ) : (
              <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-250 dark:border-amber-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
                ⚠ Pending Verification
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SecureVoteModule({ navigate }) {
  const [student, setStudent] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showConstituencyModal, setShowConstituencyModal] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [votedUpdateTick, setVotedUpdateTick] = useState(0);
  const [notification, setNotification] = useState(null);
  const { student: sessionStudent, loading: sessionLoading } = useStudentSession();
  const { ecAdminProfile, isElectionManagedByOfficerTier } = useAdminAuth();

  const [isBiometricsModalOpen, setIsBiometricsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleVerifyBiometrics = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setStudent(s => {
        const updated = {
          ...s,
          biometrics_completed_current_semester: true
        };
        try {
          localStorage.setItem('knust_user_session', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      });
      setIsBiometricsModalOpen(false);
      showToast('Biometric Verification Completed Successfully!', 'success');
    }, 2000);
  };

  const handleBiometricsClick = () => {
    const biometricsOk = Boolean(student?.biometrics_completed_current_semester);
    if (!biometricsOk) {
      setIsBiometricsModalOpen(true);
    } else {
      showToast('Your biometrics are already verified for this semester.', 'success');
    }
  };

  // Check for route guard notification
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('sv_redirect_notification');
      if (stored) {
        setNotification(stored);
        sessionStorage.removeItem('sv_redirect_notification');
      }
    } catch (e) { }
  }, []);

  // Subscribe to local/external vote submission events
  useEffect(() => {
    const unsubscribe = subscribeToVoteUpdates(() => {
      setVotedUpdateTick(t => t + 1);
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
      <div className="p-8 flex justify-center items-center min-h-[60vh] bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full text-center p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto mb-4 text-rose-700 dark:text-rose-400">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
            You must be logged in with an active session to access the <strong>KNUST Secure Vote</strong> voting module.
          </p>

          <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs font-semibold mb-6 flex items-center justify-center gap-1.5">
            <ShieldAlert size={14} />
            <span>No active session. Please log in first.</span>
          </div>

          <button
            className="w-full bg-[#007A4D] hover:bg-[#075C42] text-white py-3 px-6 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            onClick={() => setIsAuthModalOpen(true)}
          >
            <span>Log In / Authenticate</span>
            <ChevronRight size={16} />
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

  // Listen for election status overrides
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
      } catch (err) { }
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
        <div className="mb-6 flex items-center gap-3">
          <div className="p-2 bg-[#EAF6F0] dark:bg-slate-800 rounded-xl text-[#007A4D] dark:text-emerald-400">
            <Vote size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Secure Vote Portal</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Virtual Queue — High Traffic Protection Mode</p>
          </div>
        </div>
        <VirtualQueue onReady={() => {
          setShowQueue(false);
          handleNavigate('/ballot/src');
        }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto bg-[#F3F6F8] dark:bg-slate-900 text-[#171717] dark:text-slate-100 transition-colors duration-200 min-h-screen">
      {/* ── 1. Secure Vote Banner ── */}
      <div className="mb-6 p-6 knust-hero-card rounded-2xl shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-[#D4AF37] text-white">
            <Vote size={24} className="text-[#007A4D]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Secure Vote Portal
            </h1>
            <p className="text-sm font-medium text-emerald-100/90 mt-1">
              KNUST Electoral Management &amp; Student Verification System
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap mr-12">
          {/* Quick Demo Profile Switcher */}
          <DemoProfileSwitcher onProfileChange={setStudent} />

          {/* Student Profile popover details */}
          <StudentProfilePopover student={student} />

          <button
            className="bg-[#E2F3E9] dark:bg-slate-700 hover:bg-[#BDE3D2] dark:hover:bg-slate-600 text-[#006B3F] dark:text-emerald-400 text-xs font-bold rounded-xl px-3.5 py-2 border border-[#BDE3D2] dark:border-slate-600 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            onClick={toggleBiometricsState}
            title="Toggle biometrics verification state to test valid/missing branches"
          >
            <RefreshCw size={12} />
            <span>Dev Test: Biometrics {biometricsOk ? 'Valid' : 'Missing'}</span>
          </button>
        </div>
      </div>

      {/* ── EC Officer Persona & Student Profile Binding Banner ── */}
      {ecAdminProfile && (
        <div className="mb-6 p-4 bg-[#F3FAF6] dark:bg-slate-800/90 border-2 border-[#007A4D] rounded-2xl text-slate-800 dark:text-slate-100 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#007A4D]/15 flex items-center justify-center text-[#007A4D] dark:text-emerald-400 font-bold">
              {ecAdminProfile.avatar || <User size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#007A4D] dark:text-emerald-400">
                  Officer Identity &amp; Student Profile Bound
                </span>
                <span className="bg-[#007A4D] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                  {ecAdminProfile.roleTier}
                </span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                {student.name || ecAdminProfile.name} | Level {student.level || (yearOfStudy * 100)} | {student.college || 'CoE'} | {student.constituency_locked || student.constituency || 'Ayeduase'} Constituency
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Scope: {ecAdminProfile.assignedJurisdiction?.name}
              </div>
            </div>
          </div>
          <div className="bg-[#EAF6F0] dark:bg-slate-700/80 text-[#007A4D] dark:text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-extrabold border border-[#007A4D]/30 flex items-center gap-1.5 shadow-2xs">
            <Lock size={12} />
            <span>Dual-Identity Session Active</span>
          </div>
        </div>
      )}

      {/* ── 2. Clean Biometric & Status Checker Card ── */}
      <div
        onClick={handleBiometricsClick}
        className="bg-white dark:bg-slate-800 border border-[#E1E7E4] dark:border-slate-700 text-[#171717] dark:text-slate-100 rounded-2xl p-6 shadow-2xs mb-6 knust-glass-card cursor-pointer hover:border-[#007A4D]/50 hover:shadow-xs transition-all"
        role="button"
        aria-label="Biometric & Status Checker"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Fingerprint size={18} className="text-[#007A4D]" />
            <span>Biometric &amp; Status Checker</span>
          </h2>
          {biometricsOk ? (
            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              <span>Current Semester Verified</span>
            </span>
          ) : (
            <span className="bg-amber-50 dark:bg-slate-700 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
              <ShieldAlert size={12} />
              <span>Biometrics Pending</span>
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
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
              {(() => {
                const cVal = student ? (student.constituency || student.constituency_locked || null) : null;
                if (!cVal) return 'Constituency Not Assigned';
                return cVal.toLowerCase().includes('constituency') ? cVal : `${cVal} Constituency`;
              })()}
            </span>
          </div>
        </div>

        {!biometricsOk && (
          <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold flex items-start gap-2.5" role="alert">
            <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Biometrics Verification Pending — Your biometric verification record for the active academic session is incomplete. Please visit the UITS office.</span>
          </div>
        )}
      </div>

      {/* ── Route Guard Notification Alert ── */}
      {notification && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 rounded-2xl text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 shadow-sm" role="alert">
          <div className="flex items-start gap-3">
            <Lock className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0" />
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
            } catch (e) { }
            return updated;
          });
        }}
      />

      {/* ── 3. Modernized Election Cards & Buttons ── */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Vote className="text-[#007A4D]" size={20} />
          <span>Upcoming &amp; Active Elections</span>
        </h2>
      </div>
      <div className="space-y-6">
        {elections.map((e) => {
          const statusInfo = getElectionStatus(e, e.endTime, now);
          const cardState = getElectionCardState(student, e);

          /* Card 1: Department & College Elections */
          if (e.type === 'department') {
            const hasVoted = isElectionVoted(e.id, e.type);
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student);
            const targetText = e.target || `${student.college} & ${student.department} Students`;
            const isLiveAndEligible = isEligible && statusInfo.isLive;
            const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(e) : false;

            return (
              <div key={e.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 knust-glass-card hover:-translate-y-0.5 transition-all">
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
                        <Building2 size={16} className="text-[#007A4D] dark:text-emerald-400" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{e.title}</h3>
                      {isManagedByOfficer && (
                        <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-700 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold shadow-2xs inline-flex items-center gap-1.5" title="Officer votes use the exact same zero-knowledge encryption as general students.">
                          <ShieldCheck size={12} />
                          Conflict Protocol Verified / Ballot Encrypted
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 space-y-1 mt-1.5">
                      <span className="block"><strong className="text-slate-700 dark:text-slate-300">Eligibility:</strong> Verified ({targetText})</span>
                      <span className="block"><strong className="text-slate-700 dark:text-slate-300">Ends in:</strong> {statusInfo.countdownText}</span>
                      <span className="block">
                        <strong className="text-slate-700 dark:text-slate-300">Status:</strong>{' '}
                        {hasVoted ? (
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-150 dark:bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">VOTED ✅</span>
                        ) : (
                          <span className="font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">NOT VOTED</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {hasVoted ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-1.5 shadow-2xs">
                        <CheckCircle2 size={12} />
                        Voted
                      </span>
                    ) : statusInfo.isLive && isEligible ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-2 shadow-2xs font-black">
                        <span className="live-pulse-container">
                          <span className="live-pulse-dot" />
                        </span>
                        <span>LIVE — BALLOT OPEN</span>
                      </span>
                    ) : !isEligible ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60 gap-1.5">
                        <AlertTriangle size={12} />
                        Ineligible
                      </span>
                    ) : statusInfo.isUpcoming ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/60 gap-1.5">
                        <Clock size={12} />
                        <span>Upcoming</span>
                      </span>
                    ) : (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 gap-1.5">
                        <Lock size={12} />
                        Closed
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  {/* Bottom-Left: Countdown Timer */}
                  <div className="bg-[#F3F6F8] dark:bg-slate-900 border border-[#E1E7E4] dark:border-slate-700 rounded-xl px-4 py-2 font-mono text-xs font-bold text-[#171717] dark:text-slate-300 flex items-center gap-2 self-start sm:self-auto">
                    <Clock size={12} className="text-[#D4AF37]" />
                    <span>
                      {statusInfo.isUpcoming
                        ? `Starts in ${statusInfo.countdownText}`
                        : statusInfo.isLive
                          ? `Polls Close in ${statusInfo.countdownText}`
                          : 'Election Concluded'}
                    </span>
                  </div>

                  {/* Bottom-Right: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {hasVoted ? (
                      <button
                        className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-default flex items-center gap-1.5"
                        disabled
                      >
                        <CheckCircle2 size={12} />
                        Ballot Cast &amp; Recorded
                      </button>
                    ) : statusInfo.isClosed ? (
                      <button
                        className="bg-[#007A4D] hover:bg-[#075C42] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        onClick={() => handleNavigate('/results')}
                      >
                        <span>View Results</span>
                        <BarChart3 size={12} />
                      </button>
                    ) : (
                      <button
                        className={
                          isLiveAndEligible
                            ? "bg-[#007A4D] hover:bg-[#075C42] text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                            : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                        }
                        disabled={!isLiveAndEligible}
                        onClick={isLiveAndEligible ? () => handleNavigate(`/ballot/${e.id}`) : undefined}
                      >
                        {isLiveAndEligible ? (
                          <span className="flex items-center gap-1">
                            <span>Enter Polling Station</span>
                            <ChevronRight size={12} />
                          </span>
                        ) : (
                          <span>Unlocks {formatUnlockDate(e)}</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          /* Card 2: SRC Executive Elections */
          if (e.type === 'src') {
            const hasVoted = isElectionVoted(e.id, e.type);
            const eligibilityCheck = checkElectionEligibility(student, e);
            const isEligible = eligibilityCheck.eligible && isBiometricVerified(student);
            const isLiveAndEligible = isEligible && statusInfo.isLive;
            const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(e) : false;

            return (
              <div key={e.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 knust-glass-card hover:-translate-y-0.5 transition-all">
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
                        <GraduationCap size={16} className="text-[#007A4D] dark:text-emerald-400" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{e.title}</h3>
                      {isManagedByOfficer && (
                        <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-700 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold shadow-2xs inline-flex items-center gap-1.5" title="Officer votes use the exact same zero-knowledge encryption as general students.">
                          <ShieldCheck size={12} />
                          Conflict Protocol Verified / Ballot Encrypted
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 space-y-1 mt-1.5">
                      <span className="block"><strong className="text-slate-700 dark:text-slate-300">Eligibility:</strong> Verified (All Students)</span>
                      <span className="block"><strong className="text-slate-700 dark:text-slate-300">Ends in:</strong> {statusInfo.countdownText}</span>
                      <span className="block">
                        <strong className="text-slate-700 dark:text-slate-300">Status:</strong>{' '}
                        {hasVoted ? (
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-150 dark:bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">VOTED ✅</span>
                        ) : (
                          <span className="font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">NOT VOTED</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {hasVoted ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-1.5 shadow-2xs">
                        <CheckCircle2 size={12} />
                        Voted
                      </span>
                    ) : statusInfo.isLive && isEligible ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-2 shadow-2xs font-black">
                        <span className="live-pulse-container">
                          <span className="live-pulse-dot" />
                        </span>
                        <span>LIVE — BALLOT OPEN</span>
                      </span>
                    ) : !isEligible ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60 gap-1.5">
                        <AlertTriangle size={12} />
                        Ineligible
                      </span>
                    ) : statusInfo.isUpcoming ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/60 gap-1.5">
                        <Clock size={12} />
                        <span>Upcoming</span>
                      </span>
                    ) : (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 gap-1.5">
                        <Lock size={12} />
                        Closed
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  {/* Bottom-Left: Countdown Timer */}
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 self-start sm:self-auto">
                    <Clock size={12} className="text-[#D4AF37]" />
                    <span>
                      {statusInfo.isUpcoming
                        ? `Starts in ${statusInfo.countdownText}`
                        : statusInfo.isLive
                          ? `Polls Close in ${statusInfo.countdownText}`
                          : 'Election Concluded'}
                    </span>
                  </div>

                  {/* Bottom-Right: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      onClick={() => handleNavigate(`/ballot/${e.id}`)}
                    >
                      <Eye size={12} />
                      <span>View Candidates &amp; Manifestos</span>
                    </button>
                    {hasVoted ? (
                      <button
                        className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-default flex items-center gap-1.5"
                        disabled
                      >
                        <CheckCircle2 size={12} />
                        Ballot Cast &amp; Recorded
                      </button>
                    ) : statusInfo.isClosed ? (
                      <button
                        className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        onClick={() => handleNavigate('/results')}
                      >
                        <span>View Results</span>
                        <BarChart3 size={12} />
                      </button>
                    ) : (
                      <button
                        className={
                          isLiveAndEligible
                            ? "bg-[#007A4D] hover:bg-[#075C42] text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                            : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                        }
                        disabled={!isLiveAndEligible}
                        onClick={isLiveAndEligible ? () => handleNavigate(`/ballot/${e.id}`) : undefined}
                      >
                        {isLiveAndEligible ? (
                          <span className="flex items-center gap-1">
                            <span>Enter Polling Station</span>
                            <ChevronRight size={12} />
                          </span>
                        ) : (
                          <span>Unlocks {formatUnlockDate(e)}</span>
                        )}
                      </button>
                    )}
                  </div>
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
            const isLiveAndEligible = isEligible && statusInfo.isLive;
            const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(e) : false;
            const targetText = hasConstituency
              ? `Voters in ${constituencyName.toLowerCase().includes('constituency') ? constituencyName : `${constituencyName} Constituency`}`
              : 'Selected Constituency Voters';

            return (
              <div key={e.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 knust-glass-card hover:-translate-y-0.5 transition-all">
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
                        <Building size={16} className="text-[#007A4D] dark:text-emerald-400" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{e.title}</h3>
                      {isManagedByOfficer && (
                        <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-700 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold shadow-2xs inline-flex items-center gap-1.5" title="Officer votes use the exact same zero-knowledge encryption as general students.">
                          <ShieldCheck size={12} />
                          Conflict Protocol Verified / Ballot Encrypted
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 space-y-1 mt-1.5">
                      <span className="block"><strong className="text-slate-700 dark:text-slate-300">Eligibility:</strong> Verified ({targetText})</span>
                      <span className="block"><strong className="text-slate-700 dark:text-slate-300">Ends in:</strong> {statusInfo.countdownText}</span>
                      <span className="block">
                        <strong className="text-slate-700 dark:text-slate-300">Status:</strong>{' '}
                        {hasVoted ? (
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-150 dark:bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">VOTED ✅</span>
                        ) : (
                          <span className="font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">NOT VOTED</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {hasVoted ? (
                      <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5 shadow-xs">
                        <CheckCircle2 size={12} />
                        Voted
                      </span>
                    ) : statusInfo.isLive && isEligible ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-2 shadow-2xs font-black">
                        <span className="live-pulse-container">
                          <span className="live-pulse-dot" />
                        </span>
                        <span>LIVE — BALLOT OPEN</span>
                      </span>
                    ) : !hasConstituency ? (
                      <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        <ShieldAlert size={12} />
                        Action Required
                      </span>
                    ) : (
                      <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5 font-mono">
                        <Clock size={12} />
                        <span>{statusInfo.badgeText}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  {/* Bottom-Left: Countdown Timer */}
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 self-start sm:self-auto">
                    <Clock size={12} className="text-[#D4AF37]" />
                    <span>
                      {statusInfo.isUpcoming
                        ? `Starts in ${statusInfo.countdownText}`
                        : statusInfo.isLive
                          ? `Polls Close in ${statusInfo.countdownText}`
                          : 'Election Concluded'}
                    </span>
                  </div>

                  {/* Bottom-Right: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {hasVoted ? (
                      <button
                        className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-default flex items-center gap-1.5"
                        disabled
                      >
                        <CheckCircle2 size={12} />
                        Ballot Cast &amp; Recorded
                      </button>
                    ) : !isBiometricVerified(student) ? (
                      <button className="bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5" disabled>
                        Unlocks {formatUnlockDate(e)}
                      </button>
                    ) : !hasConstituency ? (
                      <div className="flex items-center gap-2">
                        <button
                          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                          onClick={() => setShowConstituencyModal(true)}
                        >
                          Select Constituency
                        </button>
                        <button className="bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5" disabled>
                          Unlocks {formatUnlockDate(e)}
                        </button>
                      </div>
                    ) : statusInfo.isClosed ? (
                      <button
                        className="bg-[#007A4D] hover:bg-[#075C42] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        onClick={() => handleNavigate('/results')}
                      >
                        <span>View Results</span>
                        <BarChart3 size={12} />
                      </button>
                    ) : (
                      <button
                        className={
                          isLiveAndEligible
                            ? "bg-[#007A4D] hover:bg-[#075C42] text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                            : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                        }
                        disabled={!isLiveAndEligible}
                        onClick={isLiveAndEligible ? () => handleNavigate(`/ballot/${e.id}`) : undefined}
                      >
                        {isLiveAndEligible ? (
                          <span className="flex items-center gap-1">
                            <span>Enter Polling Station</span>
                            <ChevronRight size={12} />
                          </span>
                        ) : (
                          <span>Unlocks {formatUnlockDate(e)}</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          /* Card 4: Hall Elections */
          if (e.type === 'hall' || cardState.tier === 'HALL') {
            const hasVoted = isElectionVoted(e.id, e.type);
            const isFirstYear = yearOfStudy === 1;
            const isEligible = cardState.eligible && isBiometricVerified(student) && isFirstYear;
            const isLiveAndEligible = isEligible && statusInfo.isLive;
            const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(e) : false;
            const targetText = isFirstYear
              ? `${student.hall || 'Unity Hall'} Residents (First-Year Only)`
              : 'Hall Residents (Restricted to Level 100)';
            const restrictionMessage =
              'Hall elections are restricted strictly to Level 100 resident students. Continuing students vote in Off-Campus / Constituency elections.';

            return (
              <div key={e.id} className={`bg-white dark:bg-slate-800 border ${!isEligible && !hasVoted ? 'border-rose-200 dark:border-rose-900/60' : 'border-slate-200 dark:border-slate-700'} rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 transition-all knust-glass-card hover:-translate-y-0.5`}>
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
                        <Home size={16} className="text-[#007A4D] dark:text-emerald-400" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{e.title}</h3>
                      {isManagedByOfficer && (
                        <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-700 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold shadow-2xs inline-flex items-center gap-1.5" title="Officer votes use the exact same zero-knowledge encryption as general students.">
                          <ShieldCheck size={12} />
                          Conflict Protocol Verified / Ballot Encrypted
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 space-y-1 mt-1.5">
                      <span className="block"><strong className="text-slate-700 dark:text-slate-300">Eligibility:</strong> Verified ({targetText})</span>
                      <span className="block"><strong className="text-slate-700 dark:text-slate-300">Ends in:</strong> {statusInfo.countdownText}</span>
                      <span className="block">
                        <strong className="text-slate-700 dark:text-slate-300">Status:</strong>{' '}
                        {hasVoted ? (
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-150 dark:bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">VOTED ✅</span>
                        ) : (
                          <span className="font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">NOT VOTED</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {hasVoted ? (
                      <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5 shadow-xs">
                        <CheckCircle2 size={12} />
                        Voted
                      </span>
                    ) : !isFirstYear ? (
                      <span className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5 shadow-xs">
                        <Lock size={12} />
                        Continuing Student
                      </span>
                    ) : !isBiometricVerified(student) ? (
                      <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                        <ShieldAlert size={12} />
                        Biometrics Pending
                      </span>
                    ) : statusInfo.isLive ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-2 shadow-2xs font-black">
                        <span className="live-pulse-container">
                          <span className="live-pulse-dot" />
                        </span>
                        <span>LIVE NOW</span>
                      </span>
                    ) : (
                      <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 text-xs font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5 font-mono">
                        <Clock size={12} />
                        <span>{statusInfo.badgeText}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Ineligible Continuing Student Subtle Explanation Banner */}
                {!isFirstYear && !hasVoted && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-start gap-2" role="alert">
                    <Home size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Hall Elections Policy:</strong> {restrictionMessage}
                    </span>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  {/* Bottom-Left: Countdown Timer */}
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 self-start sm:self-auto">
                    <Clock size={12} className="text-[#D4AF37]" />
                    <span>
                      {statusInfo.isUpcoming
                        ? `Starts in ${statusInfo.countdownText}`
                        : statusInfo.isLive
                          ? `Polls Close in ${statusInfo.countdownText}`
                          : 'Election Concluded'}
                    </span>
                  </div>

                  {/* Bottom-Right: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {hasVoted ? (
                      <button
                        className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-default flex items-center gap-1.5"
                        disabled
                      >
                        <CheckCircle2 size={12} />
                        Ballot Cast &amp; Recorded
                      </button>
                    ) : statusInfo.isClosed ? (
                      <button
                        className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        onClick={() => handleNavigate('/results')}
                      >
                        <span>View Results</span>
                        <BarChart3 size={12} />
                      </button>
                    ) : (
                      <button
                        className={
                          isLiveAndEligible
                            ? "bg-[#007A4D] hover:bg-[#075C42] text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                            : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                        }
                        disabled={!isLiveAndEligible}
                        title={!isEligible ? restrictionMessage : undefined}
                        onClick={isLiveAndEligible ? () => handleNavigate(`/ballot/${e.id}`) : undefined}
                      >
                        {isLiveAndEligible ? (
                          <span className="flex items-center gap-1">
                            <span>Enter Polling Station</span>
                            <ChevronRight size={12} />
                          </span>
                        ) : (
                          <span>Unlocks {formatUnlockDate(e)}</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Biometric Scanner Simulator Modal */}
      {isBiometricsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn font-sans"
          role="dialog"
          aria-modal="true"
          onClick={() => { if (!isScanning) setIsBiometricsModalOpen(false); }}
        >
          <div
            className="relative max-w-sm w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-5 animate-modal-pop text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="w-full border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#007A4D]">
                <Fingerprint size={18} />
                <h3 className="m-0 text-sm font-extrabold uppercase tracking-wider">
                  Biometric Verification
                </h3>
              </div>
              {!isScanning && (
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-transparent border-0 cursor-pointer p-0"
                  onClick={() => setIsBiometricsModalOpen(false)}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed m-0">
              {isScanning
                ? 'Scanning fingerprint... Please hold your finger steady on the sensor.'
                : 'Place your finger on the scanner below to verify your academic session eligibility.'}
            </p>

            {/* Scanner Button Container */}
            <div
              onClick={!isScanning ? handleVerifyBiometrics : undefined}
              className={`biometrics-scanner-box my-4 ${isScanning ? 'scanning' : ''}`}
            >
              {isScanning && <div className="biometrics-laser-line" />}
              <Fingerprint
                size={54}
                className={isScanning ? 'text-emerald-500 animate-pulse' : 'text-slate-400 hover:text-[#007A4D] transition-colors'}
              />
            </div>

            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isScanning ? 'SCANNING SECURE ZONE...' : 'TOUCH SENSOR TO START'}
            </div>

            {!isScanning && (
              <button
                type="button"
                className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer bg-white dark:bg-slate-900"
                onClick={() => setIsBiometricsModalOpen(false)}
              >
                Cancel Scanner
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
