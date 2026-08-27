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
  CheckCircle2 
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import useStudentSession from '../hooks/useStudentSession';
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
  return `${days}d : ${hours}h : ${minutes}m : ${seconds}s`;
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
  const [showConstituencyModal, setShowConstituencyModal] = useState(false);
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

  // Sync clock
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // CTA Button: Direct navigation to Secure Vote Portal
  const handleCtaClick = (e) => {
    if (e) e.preventDefault();
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
      {/* Route guard notification */}
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

      {/* Premium Digital KNUST Student ID Card */}
      <div className="knust-student-card mb-6">
        {/* Holographic Watermark Background */}
        <div className="knust-card-watermark">
          <GraduationCap size={200} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-4">
            {/* Student Photo Placeholder / Icon */}
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <User size={32} className="text-[#D4AF37]" />
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#D4AF37] tracking-widest uppercase">STUDENT IDENTITY CARD</span>
              <h1 className="m-0 text-2xl font-black tracking-tight text-white mt-0.5">
                {student ? (student.full_name || student.name || 'Student') : 'Student'}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] font-semibold bg-white/15 text-white px-2.5 py-0.5 rounded-md border border-white/10">
                  ID: {student ? (student.studentId || student.student_id || '20894512') : '20894512'}
                </span>
                <span className="text-[11px] font-semibold bg-[#D4AF37]/20 text-[#FFE082] px-2.5 py-0.5 rounded-md border border-[#D4AF37]/30">
                  {yearOfStudy === 1 ? 'Level 100 · Freshperson' : `Level ${student?.level || (yearOfStudy * 100)} · Continuing`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Card Metadata Columns */}
            <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-1.5 text-xs bg-black/20 backdrop-blur-xs p-3 sm:p-3.5 rounded-xl border border-white/10 font-semibold text-white/90">
              <div className="text-white/60">COLLEGE:</div>
              <div className="text-white font-extrabold">{student?.college_code || student?.college || 'COE'}</div>
              <div className="text-white/60">PROGRAM:</div>
              <div className="text-white font-extrabold max-w-[140px] sm:max-w-[150px] truncate">{student?.program || 'BSc. Computer Eng.'}</div>
              <div className="text-white/60">HALL:</div>
              <div className="text-white font-extrabold">{student?.hall || 'Unity Hall'}</div>
            </div>

            <div className="flex flex-col sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
              <DemoProfileSwitcher onProfileChange={setStudent} className="w-full" />
              <button
                id="dashboard-cta-btn"
                className="w-full py-3 sm:py-2.5 px-5 rounded-xl bg-[#D4AF37] hover:bg-[#C5A030] active:bg-[#B89220] text-slate-900 font-extrabold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] touch-active"
                onClick={handleCtaClick}
              >
                <Vote size={15} className="flex-shrink-0" />
                <span>Go to Secure Vote</span>
                <ChevronRight size={15} className="flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Card Footer Decoration: Gold Chip + Barcode lines */}
        <div className="relative z-10 flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <div className="knust-card-chip" />
          <div className="knust-card-barcode">
            <span className="w-[1px] h-full"></span>
            <span className="w-[3px] h-full"></span>
            <span className="w-[1px] h-full"></span>
            <span className="w-[2px] h-full"></span>
            <span className="w-[4px] h-full"></span>
            <span className="w-[1px] h-full"></span>
            <span className="w-[2px] h-full"></span>
            <span className="w-[1px] h-full"></span>
            <span className="w-[3px] h-full"></span>
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="sv-stats-row mb-6">
        {/* Voter Eligibility */}
        <div className="sv-stat-card knust-glass-card border-t-4 border-[#007A4D]">
          <div className="sv-stat-card-icon bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
            <Fingerprint className="text-[#007A4D] dark:text-emerald-400 w-6 h-6" />
          </div>
          <div className="sv-stat-card-body">
            <span className="sv-stat-label">Voter Eligibility</span>
            <span className="sv-stat-value">
              {biometricsOk ? 'Verified' : 'Pending Verification'}
            </span>
            <span className={`sv-stat-badge ${biometricsOk ? 'verified' : 'unverified'} inline-flex items-center gap-1 mt-1`}>
              <UserCheck size={12} />
              <span>{biometricsOk ? 'VERIFIED' : 'NOT VERIFIED'}</span>
            </span>
          </div>
        </div>

        {/* Time Remaining for Polls */}
        <div className="sv-stat-card knust-glass-card border-t-4 border-[#D4AF37]">
          <div className="sv-stat-card-icon bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800">
            <Timer className="text-[#D4AF37] dark:text-amber-400 w-6 h-6 animate-pulse" />
          </div>
          <div className="sv-stat-card-body">
            <span className="sv-stat-label">Time Remaining for Polls</span>
            <span className="sv-stat-value sv-stat-countdown text-slate-800 dark:text-slate-100 font-mono text-sm font-black">
              {formatCountdown(pollRemainingMs)}
            </span>
          </div>
        </div>

        {/* Student Constituency Info */}
        <div className="sv-stat-card knust-glass-card border-t-4 border-slate-400">
          <div className="sv-stat-card-icon bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Building2 className="text-slate-500 dark:text-slate-400 w-6 h-6" />
          </div>
          <div className="sv-stat-card-body">
            <span className="sv-stat-label">Constituency Info</span>
            <span className="sv-stat-value">
              {(() => {
                const cVal = student ? (student.constituency || student.constituency_locked || null) : null;
                if (!cVal) return 'Constituency Not Assigned';
                return cVal.toLowerCase().includes('constituency') ? cVal : `${cVal} Constituency`;
              })()}
            </span>
            <span className="sv-stat-sub text-xs text-slate-500 dark:text-slate-400 mt-1">
              {(student && (student.program || student.department)) || 'BSc. Computer Eng.'} · Year {yearOfStudy}
            </span>
          </div>
        </div>
      </div>

      {/* Active Elections Table & Side Widget */}
      <div className="sv-dash-grid">
        {/* Active Elections Card */}
        <div className="sv-card sv-elections-card knust-glass-card shadow-xs">
          <div className="sv-card-title-bar flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-slate-800">
            <h2 className="flex items-center gap-2 font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 m-0">
              <Vote className="w-5 h-5 text-[#007A4D] dark:text-emerald-400" />
              <span>Active &amp; Upcoming Elections</span>
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EAF6F0] dark:bg-slate-800 text-[#007A4D] dark:text-emerald-400">
              {elections.length} Scheduled
            </span>
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
            <>
              {/* ── MOBILE CARDS VIEW (Displayed on < md / < 768px) ── */}
              <div className="flex flex-col gap-3.5 md:hidden">
                {elections.map((e) => {
                  const hasVoted = isElectionVoted(e.id, e.type);
                  const isConstituency = e.type === 'constituency' || e.tier === 'CONSTITUENCY';
                  const cVal = student ? (student.constituency || student.constituency_locked || null) : null;
                  const hasConstituency = Boolean(cVal);
                  const elig = checkElectionEligibility(student || {}, e);
                  const statusInfo = getElectionStatus(e, e.endTime, now);

                  return (
                    <div
                      key={e.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 shadow-xs flex flex-col gap-3 transition-all"
                    >
                      {/* Top: Title, Tier & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 m-0 leading-snug">
                            {e.title}
                          </h3>
                          {e.jurisdiction?.name && (
                            <span className="inline-block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                              📍 {e.jurisdiction.name}
                            </span>
                          )}
                        </div>

                        {/* Status Pill */}
                        <div className="shrink-0">
                          {hasVoted ? (
                            <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800">
                              <CheckCircle2 size={12} />
                              Voted
                            </span>
                          ) : !elig.eligible ? (
                            <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-400 dark:border-rose-800" title={elig.reason}>
                              <AlertTriangle size={12} />
                              Ineligible
                            </span>
                          ) : statusInfo.isLive ? (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                              LIVE
                            </span>
                          ) : statusInfo.isUpcoming ? (
                            <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-400 dark:border-amber-800">
                              <Clock size={12} />
                              Upcoming
                            </span>
                          ) : (
                            <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                              <Lock size={12} />
                              Closed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ineligibility Reason Note */}
                      {!elig.eligible && !hasVoted && elig.reason && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-2 rounded-xl flex items-center gap-1.5">
                          <ShieldAlert size={13} className="shrink-0" />
                          <span>{elig.reason}</span>
                        </div>
                      )}

                      {/* Countdown Timer Row */}
                      <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-xl">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          {statusInfo.isLive ? 'Polling Window Closes:' : statusInfo.isUpcoming ? 'Voting Starts In:' : 'Poll Status:'}
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                          {statusInfo.isLive ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">
                              {statusInfo.countdownText.includes('left') ? statusInfo.countdownText : `${statusInfo.countdownText} left`}
                            </span>
                          ) : statusInfo.isUpcoming ? (
                            statusInfo.countdownText
                          ) : (
                            'Polls Concluded'
                          )}
                        </span>
                      </div>

                      {/* Action Button */}
                      <div>
                        {hasVoted ? (
                          <button
                            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default flex items-center justify-center gap-1.5 min-h-[44px]"
                            disabled
                          >
                            <CheckCircle2 size={14} />
                            <span>Ballot Recorded &amp; Certified</span>
                          </button>
                        ) : isConstituency && !hasConstituency ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 min-h-[44px] touch-active"
                              onClick={() => setShowConstituencyModal(true)}
                            >
                              <span>Select Constituency</span>
                              <ChevronRight size={14} />
                            </button>
                            <button
                              className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                              disabled
                            >
                              Unlocks {formatUnlockDate(e)}
                            </button>
                          </div>
                        ) : statusInfo.isClosed ? (
                          <button
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] touch-active"
                            onClick={() => goTo('/results', navigate)}
                          >
                            <span>View Final Results</span>
                            <BarChart3 size={14} />
                          </button>
                        ) : (
                          <button
                            className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-2 min-h-[44px] ${
                              elig.eligible && statusInfo.isLive
                                ? "bg-[#007A4D] hover:bg-[#075C42] text-white cursor-pointer touch-active"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                            }`}
                            disabled={!(elig.eligible && statusInfo.isLive)}
                            title={!elig.eligible ? elig.reason : undefined}
                            onClick={(elig.eligible && statusInfo.isLive) ? () => goTo(`/ballot/${e.id}`, navigate) : undefined}
                          >
                            {elig.eligible && statusInfo.isLive ? (
                              <>
                                <Vote size={15} />
                                <span>Enter Polling Station</span>
                                <ChevronRight size={14} />
                              </>
                            ) : (
                              <span>Unlocks {formatUnlockDate(e)}</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP TABLE VIEW (Displayed on md+ / >= 768px) ── */}
              <div className="hidden md:block sv-elections-table-wrap">
                <table className="sv-elections-table w-full">
                  <thead>
                    <tr>
                      <th className="py-3 px-3 text-left">Election</th>
                      <th className="py-3 px-3 min-w-[140px] text-center">Status</th>
                      <th className="py-3 px-3 min-w-[140px] text-left">Polling Closes</th>
                      <th className="py-3 px-3 text-right">Action</th>
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
                            <strong className="text-slate-800 dark:text-slate-200">{e.title}</strong>
                            {e.jurisdiction?.name && (
                              <span className="sv-elec-juris block text-xs text-slate-500 dark:text-slate-400">
                                {e.jurisdiction.name}
                              </span>
                            )}
                            {!elig.eligible && !hasVoted && elig.reason && (
                              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5 flex items-center gap-1">
                                <ShieldAlert size={11} />
                                <span>{elig.reason}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 min-w-[140px] text-center">
                            {hasVoted ? (
                              <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-1 shadow-2xs">
                                <CheckCircle2 size={12} />
                                Voted
                              </span>
                            ) : !elig.eligible ? (
                              <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60 gap-1" title={elig.reason}>
                                <AlertTriangle size={12} />
                                Ineligible
                              </span>
                            ) : statusInfo.isLive ? (
                              <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 gap-2 shadow-2xs font-black">
                                <span className="live-pulse-container">
                                  <span className="live-pulse-dot" />
                                </span>
                                <span>LIVE — BALLOT OPEN</span>
                              </span>
                            ) : statusInfo.isUpcoming ? (
                              <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/60 gap-1">
                                <Clock size={12} />
                                <span>Upcoming</span>
                              </span>
                            ) : (
                              <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 gap-1">
                                <Lock size={12} />
                                <span>Closed</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 min-w-[140px]">
                            {statusInfo.isLive ? (
                              <span className="text-xs font-bold text-[#08754B] dark:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
                                <Clock size={12} />
                                <span className="text-[#202522] dark:text-slate-100 font-bold font-mono">
                                  {statusInfo.countdownText.includes('left') ? statusInfo.countdownText : `${statusInfo.countdownText} left`}
                                </span>
                              </span>
                            ) : statusInfo.isUpcoming ? (
                              <span className="text-xs font-semibold text-[#66716C] dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                                <Clock size={12} />
                                <span>Starts in {statusInfo.countdownText}</span>
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-[#66716C] dark:text-slate-500 inline-flex items-center gap-1.5 whitespace-nowrap">
                                <Lock size={12} />
                                <span>Polls Closed</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {hasVoted ? (
                              <button
                                className="sv-btn-card secondary sv-polling-btn"
                                disabled
                                style={{ background: '#EAF6F0', color: '#08754B', borderColor: '#C3E8D7', cursor: 'default' }}
                              >
                                Voted
                              </button>
                            ) : isConstituency && !hasConstituency ? (
                              <div className="flex items-center justify-end gap-2">
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
                                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
                                onClick={() => goTo('/results', navigate)}
                              >
                                <span>View Results</span>
                                <BarChart3 size={12} />
                              </button>
                            ) : (
                              <button
                                className={
                                  elig.eligible && statusInfo.isLive
                                    ? "bg-[#007A4D] hover:bg-[#075C42] text-white cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 ml-auto"
                                    : "bg-gray-700/50 text-gray-400 cursor-not-allowed border border-gray-600 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ml-auto"
                                }
                                disabled={!(elig.eligible && statusInfo.isLive)}
                                title={!elig.eligible ? elig.reason : undefined}
                                onClick={(elig.eligible && statusInfo.isLive) ? () => goTo(`/ballot/${e.id}`, navigate) : undefined}
                              >
                                {elig.eligible && statusInfo.isLive ? (
                                  <span className="flex items-center gap-1">
                                    <span>Enter Polling Station</span>
                                    <ChevronRight size={12} />
                                  </span>
                                ) : (
                                  <span>Unlocks {formatUnlockDate(e)}</span>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Electoral Announcements Widget */}
        <div className="sv-card sv-announcements-card knust-glass-card shadow-xs">
          <div className="sv-card-title-bar">
            <h2 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
              <Megaphone className="w-5 h-5 text-[#D4AF37]" />
              <span>Electoral Announcements</span>
            </h2>
          </div>
          <div className="sv-announcement-item">
            <h3 className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
              <Lock size={14} className="text-[#007A4D]" />
              <span>Step-Up Authentication Required</span>
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed text-xs">
              Accessing the Secure Vote module triggers a mandatory Step-Up
              authentication flow. Verify your identity with your KNUST PIN and
              biometrics to unlock ballot rooms.
            </p>
          </div>
          <div className="sv-announcement-item">
            <h3 className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
              <UserCheck size={14} className="text-[#007A4D]" />
              <span>Zero-Trace Privacy Guarantee</span>
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed text-xs">
              Your ballot is AES-256-GCM encrypted and hashed with SHA-256 before
              submission. Votes are anonymized — no one can link your ballot back
              to your identity. Full cryptographic receipt is issued upon casting.
            </p>
          </div>
        </div>
      </div>

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
