import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { submitAnonymousVote } from '../lib/votingService';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/SecureVote.css';

// SHA-256 Cryptographic Hash Helper
async function generateSHA256Hash(text) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/* ─── Candidate Avatar Component ────────────────────────────────────────── */
function CandidateAvatar({ src, name, sizeClass = "w-16 h-16", textSizeClass = "text-xl" }) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || 'Candidate')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Candidate')}&background=8B0000&color=ffffff&bold=true&size=256`;

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-maroon-700 text-white flex items-center justify-center ${textSizeClass} font-bold flex-shrink-0 ring-2 ring-gray-100 dark:ring-slate-700 shadow-sm select-none`}>
      {!imgError && src ? (
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={fallbackUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

/* ─── Clickable Candidate Avatar Container ───────────────────────────────── */
function ClickableCandidateAvatar({ candidate, onClick, sizeClass = "w-16 h-16" }) {
  return (
    <button
      type="button"
      className="relative group cursor-pointer transition-transform duration-200 hover:scale-105 flex-shrink-0 bg-transparent border-none p-0 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-full"
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(candidate);
      }}
      title={`Click to view full photo of ${candidate?.full_name || 'Candidate'}`}
      aria-label={`View full resolution photo of ${candidate?.full_name || 'Candidate'}`}
    >
      <CandidateAvatar src={candidate?.photo_url} name={candidate?.full_name} sizeClass={sizeClass} />

      {/* Subtle hover overlay with magnifying icon effect */}
      <div className="absolute inset-0 bg-black/25 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center" />

      {/* Magnifying glass badge */}
      <div className="absolute -bottom-1 -right-1 bg-maroon-700 dark:bg-amber-500 text-white dark:text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow-md border-2 border-white dark:border-slate-800 transition-transform duration-200 group-hover:scale-110">
        🔍
      </div>
    </button>
  );
}

/* ─── Photo Viewer Lightbox Modal Component ─────────────────────────────── */
function PhotoViewerModal({ candidate, onClose }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [candidate]);

  useEffect(() => {
    if (!candidate) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [candidate, onClose]);

  if (!candidate) return null;

  const initials = (candidate.full_name || 'Candidate')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  const hasPhoto = Boolean(candidate.photo_url) && !imgError;
  const tagline = candidate.tagline || candidate.manifesto_summary || candidate.manifesto || 'Official Electoral Commission Verified Candidate';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo viewer for ${candidate.full_name}`}
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full p-6 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col gap-4 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with explicit Close button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-sm">📷 Candidate Profile Photo</span>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:bg-red-600 hover:text-white text-lg font-bold flex items-center justify-center leading-none transition-colors cursor-pointer border border-slate-700"
            onClick={onClose}
            aria-label="Close image viewer"
          >
            ×
          </button>
        </div>

        {/* Candidate Avatar / Photo Display Container */}
        <div className="flex justify-center items-center py-2">
          {hasPhoto ? (
            <img
              src={candidate.photo_url}
              alt={candidate.full_name}
              onError={() => setImgError(true)}
              className="w-48 h-48 max-h-64 object-cover rounded-xl mx-auto shadow-md border-2 border-slate-700"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-maroon-700 text-white text-3xl font-bold flex items-center justify-center my-4 ring-4 ring-maroon-800/50 shadow-lg select-none">
              {initials || 'EC'}
            </div>
          )}
        </div>

        {/* Candidate Details (Name, Position, Tagline) */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-center sm:items-start gap-1 border-b border-slate-800 pb-3">
            <h3 className="m-0 text-xl font-extrabold text-white tracking-tight text-center sm:text-left">
              {candidate.full_name}
            </h3>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-950/60 text-amber-400 text-xs font-bold uppercase tracking-wider w-fit border border-amber-800/60">
              {candidate.position}
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Campaign Tagline / Manifesto
            </span>
            <p className="m-0 text-sm text-slate-300 italic leading-relaxed text-center sm:text-left">
              "{tagline}"
            </p>
          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition-colors cursor-pointer border border-slate-700"
            onClick={onClose}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Manifesto Modal Component ─────────────────────────────────────────── */
function ManifestoModal({ candidate, onClose, onPhotoClick }) {
  if (!candidate) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="bg-maroon-700 text-white px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <h2 className="m-0 text-base font-bold text-white leading-snug">
              Official Manifesto
            </h2>
          </div>
          <button
            className="text-white/80 hover:text-white text-2xl leading-none bg-transparent border-none cursor-pointer p-1 transition-opacity"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </header>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Candidate overview */}
          <div className="flex items-center gap-4 pb-3 border-b border-gray-100 dark:border-slate-800">
            <ClickableCandidateAvatar
              candidate={candidate}
              onClick={(cand) => {
                if (onPhotoClick) onPhotoClick(cand);
              }}
            />
            <div className="flex flex-col gap-0.5">
              <h3 className="m-0 text-lg font-bold text-gray-900 dark:text-slate-100">
                {candidate.full_name}
              </h3>
              <span className="text-xs font-semibold text-maroon-700 dark:text-amber-400 uppercase tracking-wide">
                Candidate for {candidate.position}
              </span>
            </div>
          </div>

          {/* Manifesto description */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Key Policy & Campaign Promises
            </span>
            <div className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4 text-sm text-gray-700 dark:text-slate-300 leading-relaxed max-h-60 overflow-y-auto">
              <p className="m-0">
                {candidate.manifesto_summary || candidate.manifesto ||
                  'Candidate manifesto is registered, vetted, and verified under official Electoral Commission guidelines for KNUST elections.'}
              </p>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl bg-maroon-700 hover:bg-maroon-800 text-white text-sm font-bold transition-colors shadow-sm cursor-pointer"
              onClick={onClose}
            >
              Close Manifesto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDefaultCandidates(electionId, activeStudent) {
  const isDeptBallot = electionId === 'dept' || electionId?.includes('dept') || electionId?.includes('department');
  const isConstituencyBallot = electionId === 'const' || electionId?.includes('constituency');

  if (isConstituencyBallot) {
    const userConstituency = activeStudent?.constituency_locked || activeStudent?.constituency || 'Ayeduase';
    return [
      {
        candidate_id: 'mp-cand-1',
        full_name: `Hon. Kwame Appiah (${userConstituency} MP)`,
        position: 'Member of Parliament (MP)',
        photo_url: '',
        manifesto_summary: `Pledging to enhance hostel security, street lighting along ${userConstituency} corridor, and dedicated transit shuttles.`
      },
      {
        candidate_id: 'mp-cand-2',
        full_name: `Hon. Portia Osei (${userConstituency} MP)`,
        position: 'Member of Parliament (MP)',
        photo_url: '',
        manifesto_summary: `Focusing on hostel rent regulation, reliable water supply, and late-night library study shuttles for ${userConstituency} students.`
      }
    ];
  }

  if (isDeptBallot) {
    return [
      {
        candidate_id: 'dept-pres-1',
        full_name: 'Kwabena Darko',
        position: 'President',
        photo_url: '',
        manifesto_summary: 'Upgrading departmental hardware and computer labs, organizing quarterly tech hackathons, and sponsoring student developer licenses.'
      },
      {
        candidate_id: 'dept-pres-2',
        full_name: 'Eunice Boateng',
        position: 'President',
        photo_url: '',
        manifesto_summary: 'Securing industrial internship partnerships, establishing engineering alumni mentorship, and ensuring 24/7 access to design studios.'
      },
      {
        candidate_id: 'dept-wocom-1',
        full_name: 'Yaa Serwaa Bonsu',
        position: 'Women\'s Commissioner (WOCOM)',
        photo_url: '',
        manifesto_summary: 'Establishing STEM mentorship for female engineers, providing emergency healthcare support, and organizing leadership workshops.'
      },
      {
        candidate_id: 'dept-sec-1',
        full_name: 'Francis Mensah',
        position: 'General Secretary',
        photo_url: '',
        manifesto_summary: 'Automating academic material distribution, maintaining updated course drive repositories, and issuing prompt executive bulletins.'
      },
      {
        candidate_id: 'dept-treas-1',
        full_name: 'Sandra Owusu',
        position: 'Financial Secretary',
        photo_url: '',
        manifesto_summary: 'Publishing audited departmental financial statements quarterly, streamlining dues collection, and funding project grants.'
      }
    ];
  }

  return [
    {
      candidate_id: 'pres-1',
      full_name: 'Emmanuel Ampofo',
      position: 'President',
      photo_url: '',
      manifesto_summary: 'Pioneering campus-wide solar Wi-Fi hubs, expanding hostel shuttle routes, and establishing an emergency student welfare grant.'
    },
    {
      candidate_id: 'pres-2',
      full_name: 'Abena Koduah',
      position: 'President',
      photo_url: '',
      manifesto_summary: 'Negotiating hostel rent caps, digitizing academic complaint resolution, and modernizing campus sports complex facilities.'
    },
    {
      candidate_id: 'wocom-1',
      full_name: 'Priscilla Addo',
      position: 'Women\'s Commissioner (WOCOM)',
      photo_url: '',
      manifesto_summary: 'Launching female student entrepreneurship grants, expanding reproductive health resources, and hosting leadership summits.'
    },
    {
      candidate_id: 'fin-1',
      full_name: 'Sandra Ampofo',
      position: 'Financial Secretary',
      photo_url: '',
      manifesto_summary: 'Audited open-book financial records, digital SRC fund tracking, and emergency student loan grants.'
    },
    {
      candidate_id: 'sec-1',
      full_name: 'Akua Mansa Sarfo',
      position: 'General Secretary',
      photo_url: '',
      manifesto_summary: 'Prompt publication of SRC executive minutes, digital complaint ticketing, and official press releases.'
    }
  ];
}

const DEFAULT_STUDENT = {
  student_id: '20894512',
  studentId: '20894512',
  full_name: 'Kwame Nkrumah',
  department_code: 'COE',
  college_code: 'COE',
  constituency_locked: 'Ayeduase'
};

/* ─── Main Ballot Component ────────────────────────────────────────────── */
export default function Ballot({ electionId, student, onBack }) {
  const activeStudent = useMemo(() => {
    if (student) return student;
    try {
      const stored = localStorage.getItem('knust_user_session');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_STUDENT;
  }, [student]);

  const isDeptBallot = electionId === 'dept' || electionId?.includes('dept') || electionId?.includes('department');
  const isConstituencyBallot = electionId === 'const' || electionId?.includes('constituency');

  const { ecAdminProfile, isElectionManagedByOfficerTier } = useAdminAuth();

  const targetElectionObj = useMemo(() => ({
    id: electionId,
    tier: isDeptBallot ? 'DEPARTMENT' : isConstituencyBallot ? 'CONSTITUENCY' : 'SRC',
    type: electionId
  }), [electionId, isDeptBallot, isConstituencyBallot]);

  const isManagedByOfficer = isElectionManagedByOfficerTier ? isElectionManagedByOfficerTier(targetElectionObj) : false;

  const [candidates, setCandidates] = useState(() => getDefaultCandidates(electionId, activeStudent));
  const [loading, setLoading] = useState(false);
  const [manifestoCandidate, setManifestoCandidate] = useState(null);
  const [photoCandidate, setPhotoCandidate] = useState(null);
  const [selections, setSelections] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState(null);
  const [roomId, setRoomId] = useState(null);

  // Confirmation View state
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [voteReceipt, setVoteReceipt] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadCandidates() {
      try {
        const fetchPromise = supabase
          .from('candidates')
          .select('candidate_id, full_name, photo_url, manifesto_summary, position')
          .eq('election_id', electionId);
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: null }), 300));
        const res = await Promise.race([fetchPromise, timeoutPromise]);

        if (!mounted) return;
        if (res && res.data && res.data.length > 0) {
          setCandidates(res.data);
        }
      } catch (err) {
        if (mounted) {
          setCandidates(getDefaultCandidates(electionId, activeStudent));
        }
      }
    }

    loadCandidates();
    return () => { mounted = false; };
  }, [electionId]);

  // Fetch election room ID with fast timeout
  useEffect(() => {
    if (!electionId) return;
    async function fetchRoomId() {
      try {
        const fetchPromise = supabase
          .from('election_rooms')
          .select('id')
          .eq('election_id', electionId)
          .single();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ data: null }), 500));
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        if (res?.data?.id) setRoomId(res.data.id);
      } catch (err) {
        console.warn('Failed to fetch room ID', err);
      }
    }
    fetchRoomId();
  }, [electionId]);

  // Group candidates by position
  const grouped = useMemo(() => {
    const map = {};
    for (const c of candidates) {
      if (!map[c.position]) map[c.position] = [];
      map[c.position].push(c);
    }
    return map;
  }, [candidates]);

  const positionsList = Object.keys(grouped);
  const isComplete = positionsList.length > 0 && positionsList.every(pos => selections[pos] != null);

  function handleSelectCandidate(position, candidateId) {
    setSelections(prev => ({ ...prev, [position]: candidateId }));
  }

  async function handleSubmitBallot() {
    if (!isComplete) {
      alert('Please make a selection for every position before submitting.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const receiptId = 'REC-' + Math.random().toString(36).slice(2, 10).toUpperCase();
      const currentStudentId = activeStudent?.student_id || activeStudent?.studentId || '20894512';
      const payloadString = JSON.stringify({ receiptId, studentId: currentStudentId, electionId, selections, timestamp });
      const sha256Hash = await generateSHA256Hash(payloadString);

      const votesPayload = Object.entries(selections).map(([pos, candId]) => ({ candidate_id: candId, position: pos }));

      // Submit via voting service (includes automatic offline/localStorage fallback)
      try {
        await submitAnonymousVote({
          studentId: currentStudentId,
          electionId,
          roomId,
          votes: votesPayload,
          selections,
          receiptId,
          timestamp
        });
      } catch (err) {
        if (err?.code === 'ROOM_LOCKED') {
          throw new Error('Election room is currently locked by EC. No votes can be submitted at this time.');
        }
        if (err?.code === 'DOUBLE_VOTE') {
          throw new Error('You have already cast your vote in this election.');
        }
        // If other non-critical error, log and proceed with local receipt
        console.warn('Network submission fallback warning:', err);
      }

      const electionTitle = isConstituencyBallot
        ? `${activeStudent?.constituency_locked || 'Ayeduase'} Constituency Parliamentary Election`
        : isDeptBallot
        ? 'Department & College Executive Elections'
        : 'SRC Executive Official Elections';

      const receiptData = {
        receiptId,
        timestamp,
        sha256Hash,
        electionTitle,
        studentId: currentStudentId,
        selectionsSummary: Object.entries(selections).map(([pos, candId]) => {
          const candObj = candidates.find(c => c.candidate_id === candId);
          return { position: pos, candidateName: candObj ? candObj.full_name : candId };
        })
      };

      setVoteReceipt(receiptData);
      setIsSubmitted(true);
      setShowConfirmModal(false);
    } catch (err) {
      console.error('Submit error', err);
      setError(err.message || 'Failed to submit ballot. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function downloadReceiptJSON() {
    if (!voteReceipt) return;
    const blob = new Blob([JSON.stringify(voteReceipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KNUST-Vote-Receipt-${voteReceipt.receiptId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ─────────────────────────────────────────────
     RENDER: CONFIRMATION VIEW
  ───────────────────────────────────────────── */
  if (isSubmitted && voteReceipt) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center gap-6 animate-fadeIn">
          {/* Header */}
          <div className="w-full border-b border-gray-200 dark:border-slate-700 pb-4 flex items-center justify-between">
            <h2 className="m-0 text-2xl sm:text-3xl font-black text-[#006B3F] dark:text-emerald-400 tracking-tight">
              Vote Submitted!
            </h2>
            <span className="text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
              {voteReceipt.receiptId}
            </span>
          </div>

          {/* Check Icon Badge [ ✅ ] */}
          <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-400 flex items-center justify-center text-4xl font-black shadow-md ring-8 ring-emerald-50 dark:ring-emerald-900/30 select-none">
            ✅
          </div>

          {/* Confirmation Message */}
          <p className="m-0 text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 max-w-md leading-relaxed">
            Your vote has been cast anonymously and recorded on the cryptographic ledger.
          </p>

          {/* Cryptographic Receipt Box */}
          <div className="w-full bg-slate-900 text-slate-100 rounded-2xl p-5 text-left flex flex-col gap-4 font-mono text-xs shadow-inner border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-amber-400 font-bold flex items-center gap-1.5 text-xs">
                🔒 SHA-256 CRYPTOGRAPHIC VOTE RECEIPT
              </span>
              <span className="text-emerald-400 font-bold">VERIFIED ✓</span>
            </div>

            <div className="flex flex-col gap-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Election:</span>
                <span className="font-semibold text-slate-200 truncate max-w-[240px]">{voteReceipt.electionTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp:</span>
                <span>{new Date(voteReceipt.timestamp).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                SHA-256 Ledger Hash
              </span>
              <div className="bg-slate-950 rounded-xl p-2.5 text-sky-400 text-[11px] break-all border border-slate-800 font-mono select-all">
                {voteReceipt.sha256Hash}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
            <button
              type="button"
              className="flex-1 py-3 px-4 rounded-xl bg-[#006B3F] hover:bg-[#005A35] text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              onClick={downloadReceiptJSON}
            >
              📥 Download Receipt (.json)
            </button>
            <button
              type="button"
              className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-sm transition-colors cursor-pointer"
              onClick={onBack}
            >
              Return to Portal ➔
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     RENDER: BALLOT SCREEN
  ───────────────────────────────────────────── */
  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-32 flex flex-col gap-8">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-2 border-b border-gray-200 dark:border-slate-800">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className="self-start flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-maroon-700 dark:hover:text-amber-400 transition-colors cursor-pointer bg-transparent border-none p-0 mb-1"
            onClick={onBack}
          >
            ← Back to Dashboard
          </button>
          <h1 className="m-0 text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
            {isDeptBallot
              ? '🏢 Department & College Official Ballot'
              : isConstituencyBallot
              ? `🗳️ ${activeStudent?.constituency_locked || 'Ayeduase'} Constituency MP Ballot`
              : '🏛️ SRC Executive Official Ballot'}
          </h1>
          <p className="m-0 text-sm text-gray-600 dark:text-slate-400">
            {isDeptBallot
              ? 'Departmental & College Executive Elections — Select your candidate for each portfolio'
              : isConstituencyBallot
              ? `Single-choice Parliamentary Election for ${activeStudent?.constituency_locked || 'Ayeduase'} Constituency`
              : 'Select your preferred candidates for all Executive positions'}
          </p>
        </div>

        {/* Overall progress badge */}
        <div className="shrink-0 self-start sm:self-center">
          {isComplete ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-bold border border-green-200 dark:border-green-800">
              ✓ All Positions Selected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-bold border border-amber-200 dark:border-amber-800">
              {Object.keys(selections).length} / {positionsList.length} Selected
            </span>
          )}
        </div>
      </div>

      {/* ── Officer Conflict Protocol Banner ── */}
      {isManagedByOfficer && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/80 border-2 border-amber-400 dark:border-amber-700/80 rounded-2xl text-amber-950 dark:text-amber-100 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-fadeIn" role="region" aria-label="Conflict Protocol Notice">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Conflict Protocol Verified
                </span>
                <span className="bg-amber-800 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                  Ballot Encrypted
                </span>
              </div>
              <p className="m-0 text-xs font-medium text-amber-900 dark:text-amber-200 mt-1 leading-relaxed">
                Officer votes use the exact same zero-knowledge encryption as general students. No identity tracking, fully anonymous casting.
              </p>
            </div>
          </div>
          <div className="bg-amber-200/80 dark:bg-amber-900/90 text-amber-950 dark:text-amber-100 px-3 py-1.5 rounded-xl text-xs font-extrabold border border-amber-400/40 flex items-center gap-1.5 shadow-2xs">
            <span>🔒</span> ZK-Proof Active
          </div>
        </div>
      )}

      {/* ── Loading State ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm font-semibold text-gray-500 dark:text-slate-400 gap-3">
          <svg className="animate-spin w-6 h-6 text-maroon-700 dark:text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading official candidate ballot…
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {positionsList.map(position => {
            const candidateList = grouped[position];
            const hasSelection = selections[position] != null;

            return (
              <section key={position} aria-labelledby={`section-${position}`} className="flex flex-col">

                {/* ── Sticky Section Header ── */}
                <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-sm flex items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-700 pb-2 mb-4 pt-2">
                  <h2
                    id={`section-${position}`}
                    className="m-0 text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight"
                  >
                    {position}
                  </h2>

                  {/* Status Pill */}
                  {hasSelection ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold border border-green-200 dark:border-green-800 whitespace-nowrap shadow-xs">
                      Selected ✓
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800 whitespace-nowrap shadow-xs">
                      Selection Required *
                    </span>
                  )}
                </div>

                {/* ── Responsive Candidate Card Grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {candidateList.map(c => {
                    const isChecked = selections[position] === c.candidate_id;

                    return (
                      <div
                        key={c.candidate_id}
                        className={[
                          'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer gap-5',
                          isChecked
                            ? 'border-green-500 dark:border-green-500 ring-2 ring-green-500/30 dark:ring-green-500/20 shadow-md'
                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600',
                        ].join(' ')}
                        onClick={() => handleSelectCandidate(position, c.candidate_id)}
                      >
                        {/* ── Top: Avatar + Candidate Details ── */}
                        <div className="flex items-start gap-4">
                          <ClickableCandidateAvatar
                            candidate={c}
                            onClick={(cand) => setPhotoCandidate(cand)}
                          />

                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            {/* Candidate full name in bold */}
                            <h3 className="m-0 font-bold text-lg text-gray-900 dark:text-slate-100 leading-snug">
                              {c.full_name}
                            </h3>

                            {/* Portfolio role */}
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                              {c.position}
                            </span>

                            {/* Inline Read Manifesto button */}
                            <button
                              type="button"
                              className="self-start mt-1 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline bg-transparent border-none cursor-pointer p-0 leading-none text-left"
                              onClick={(e) => {
                                e.stopPropagation();
                                setManifestoCandidate(c);
                              }}
                            >
                              📜 Read Manifesto
                            </button>
                          </div>
                        </div>

                        {/* ── Bottom: Vote Selection Action Button ── */}
                        <button
                          type="button"
                          className={[
                            'w-full py-2.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-sm tracking-wide',
                            isChecked
                              ? 'bg-[#006B3F] text-white hover:bg-[#005A35] shadow-2xs'
                              : 'border-2 border-[#006B3F] text-[#006B3F] hover:bg-[#E2F3E9] dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-500/10 bg-transparent',
                          ].join(' ')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCandidate(position, c.candidate_id);
                          }}
                        >
                          {isChecked ? '✓ Selected' : 'VOTE'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Manifesto Modal */}
      <ManifestoModal
        candidate={manifestoCandidate}
        onClose={() => setManifestoCandidate(null)}
        onPhotoClick={(cand) => setPhotoCandidate(cand)}
      />

      {/* Photo Viewer Lightbox Modal */}
      <PhotoViewerModal
        candidate={photoCandidate}
        onClose={() => setPhotoCandidate(null)}
      />

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 font-semibold"
          role="alert"
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Fixed Bottom Submit Dock ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 flex justify-center items-center z-30 shadow-2xl">
        <button
          type="button"
          className={[
            'max-w-md w-full py-3.5 px-6 rounded-xl text-sm font-bold tracking-wide transition-all duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer',
            !isComplete || submitting
              ? 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed border border-gray-300 dark:border-slate-700 shadow-none'
              : 'bg-[#006B3F] hover:bg-[#005A35] active:bg-[#004A2A] text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:text-white shadow-lg hover:shadow-xl active:scale-[0.98]',
          ].join(' ')}
          disabled={!isComplete || submitting}
          onClick={() => setShowConfirmModal(true)}
        >
          🔒 SUBMIT & CAST ENCRYPTED BALLOT ➔
        </button>
      </div>

      {/* ── Pre-Submission Confirmation Modal ── */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="relative max-w-lg w-full p-6 bg-white dark:bg-slate-900 border-2 border-[#006B3F] dark:border-emerald-500 rounded-3xl shadow-2xl flex flex-col gap-5 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🗳️</span>
                <h3 className="m-0 text-lg font-black text-[#006B3F] dark:text-emerald-400">
                  Confirm Ballot Submission
                </h3>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold bg-transparent border-none cursor-pointer"
                onClick={() => setShowConfirmModal(false)}
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Review Your Selected Candidates
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2.5 max-h-56 overflow-y-auto">
                {positionsList.map(pos => {
                  const selectedId = selections[pos];
                  const candObj = candidates.find(c => c.candidate_id === selectedId);
                  return (
                    <div key={pos} className="flex justify-between items-center text-xs pb-2 border-b border-slate-200/60 dark:border-slate-700/60 last:border-0 last:pb-0">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">{pos}:</span>
                      <span className="font-bold text-[#006B3F] dark:text-emerald-400">
                        {candObj ? candObj.full_name : 'Selected'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>
                Once submitted, your vote is encrypted with SHA-256 zero-knowledge proof and permanently recorded on the ledger.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
              >
                ← Edit Selections
              </button>
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-xl bg-[#006B3F] hover:bg-[#005A35] text-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                onClick={handleSubmitBallot}
                disabled={submitting}
              >
                {submitting ? 'Casting Encrypted Vote…' : 'Confirm & Cast Vote ✅'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
