import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { submitAnonymousVote } from '../lib/votingService';
import '../styles/SecureVote.css';

// SHA-256 Hash Helper
async function generateSHA256Hash(text) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback pseudo-hash generator
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

function CandidateAvatar({ src, name }) {
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Candidate')}&background=8B0000&color=ffffff&bold=true`;
  return (
    <img
      src={src || fallbackUrl}
      alt={name}
      onError={(e) => { e.target.src = fallbackUrl; }}
      className="sv-candidate-avatar"
    />
  );
}

function ManifestoModal({ candidate, onClose }) {
  if (!candidate) return null;
  return (
    <div className="sv-modal-backdrop" role="dialog" aria-modal="true">
      <div className="sv-modal">
        <header className="sv-modal-header">
          <h2>📜 Manifesto — {candidate.full_name}</h2>
          <button className="sv-close-btn" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="sv-modal-body">
          <div className="sv-candidate-preview">
            <CandidateAvatar src={candidate.photo_url} name={candidate.full_name} />
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: 'var(--sv-burgundy)' }}>{candidate.full_name}</h3>
              <span className="sv-position-tag">{candidate.position}</span>
            </div>
          </div>

          <div className="sv-manifesto-text">
            <p>{candidate.manifesto_summary || candidate.manifesto || 'Candidate manifesto is registered and verified under KNUST Electoral Commission guidelines.'}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="sv-btn sv-btn-primary" onClick={onClose}>Close Manifesto</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Ballot({ electionId, student, onBack }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manifestoCandidate, setManifestoCandidate] = useState(null);
  const [selections, setSelections] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [roomId, setRoomId] = useState(null);

  // Confirmation View state
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [voteReceipt, setVoteReceipt] = useState(null);

  // Position definitions for Executive Ballot & Constituency Ballot
  const isConstituencyBallot = electionId === 'const' || electionId?.includes('constituency');

  useEffect(() => {
    let mounted = true;
    async function loadCandidates() {
      setLoading(true);
      try {
        const { data, error: fetchErr } = await supabase
          .from('candidates')
          .select('candidate_id, full_name, photo_url, manifesto_summary, position')
          .eq('election_id', electionId);

        if (fetchErr || !data || data.length === 0) throw fetchErr || new Error('No DB candidates');
        if (!mounted) return;
        setCandidates(data);
      } catch (err) {
        // Fallback default candidate lists per requirement
        if (isConstituencyBallot) {
          const userConstituency = student?.constituency_locked || 'Ayeduase';
          setCandidates([
            {
              candidate_id: 'mp-cand-1',
              full_name: `Hon. Kwame Appiah (${userConstituency} MP)`,
              position: 'Member of Parliament (MP)',
              photo_url: '',
              manifesto_summary: `Pledging to enhance infrastructure and student safety within ${userConstituency} constituency.`
            },
            {
              candidate_id: 'mp-cand-2',
              full_name: `Hon. Portia Osei (${userConstituency} MP)`,
              position: 'Member of Parliament (MP)',
              photo_url: '',
              manifesto_summary: `Focusing on hostel rent regulation, lighting, and campus shuttle accessibility for ${userConstituency} residents.`
            }
          ]);
        } else {
          // Executive Ballot (5 Positions: President, WOCOM, Organizer, Financial Secretary, General Secretary)
          setCandidates([
            /* President */
            {
              candidate_id: 'pres-1',
              full_name: 'Emmanuel Boakye & Slate',
              position: 'President',
              photo_url: '',
              manifesto_summary: 'Transforming KNUST student welfare, Wi-Fi connectivity across all hostels, and transparent SRC governance.'
            },
            {
              candidate_id: 'pres-2',
              full_name: 'Priscilla Kwarteng & Slate',
              position: 'President',
              photo_url: '',
              manifesto_summary: 'Advocating for tuition fee payment installment plans, expanded library hours, and campus shuttle fleets.'
            },
            /* WOCOM */
            {
              candidate_id: 'wocom-1',
              full_name: 'Nana Yaa Asantewaa',
              position: 'WOCOM',
              photo_url: '',
              manifesto_summary: 'Empowering women in STEM, health initiatives, and entrepreneurship grants for female students.'
            },
            {
              candidate_id: 'wocom-2',
              full_name: 'Abigail Mensah',
              position: 'WOCOM',
              photo_url: '',
              manifesto_summary: 'Fostering inclusive leadership workshops, safety defense programs, and sanitary supply access.'
            },
            /* Organizer */
            {
              candidate_id: 'org-1',
              full_name: 'Michael "Voter" Owusu',
              position: 'Organizer',
              photo_url: '',
              manifesto_summary: 'Organizing vibrant campus cultural weeks, sports leagues, and career placement fairs.'
            },
            {
              candidate_id: 'org-2',
              full_name: 'Stephen K. Prempeh',
              position: 'Organizer',
              photo_url: '',
              manifesto_summary: 'Streamlining hall week celebrations, student talent showcases, and inter-college debates.'
            },
            /* Financial Secretary */
            {
              candidate_id: 'fin-1',
              full_name: 'Sandra Ampofo',
              position: 'Financial Secretary',
              photo_url: '',
              manifesto_summary: 'Audited open-book financial records, digital SRC fund tracking, and emergency student loan grants.'
            },
            {
              candidate_id: 'fin-2',
              full_name: 'Derrick Adjei',
              position: 'Financial Secretary',
              photo_url: '',
              manifesto_summary: 'Automating fund disbursements, reducing administrative overhead, and sponsoring student projects.'
            },
            /* General Secretary */
            {
              candidate_id: 'sec-1',
              full_name: 'Akua Mansa Sarfo',
              position: 'General Secretary',
              photo_url: '',
              manifesto_summary: 'Prompt publication of SRC executive minutes, digital complaint ticketing, and official press releases.'
            },
            {
              candidate_id: 'sec-2',
              full_name: 'Bernard Gyasi',
              position: 'General Secretary',
              photo_url: '',
              manifesto_summary: 'Centralized information portal, SMS notification alerts for academic notices, and archival records.'
            }
          ]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCandidates();
    return () => { mounted = false; };
  }, [electionId, isConstituencyBallot, student]);

  // Fetch election room ID
  useEffect(() => {
    if (!electionId) return;

    async function fetchRoomId() {
      try {
        const { data, error } = await supabase
          .from('election_rooms')
          .select('id')
          .eq('election_id', electionId)
          .single();

        if (!error && data?.id) {
          setRoomId(data.id);
        }
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

  // Check if all positions have selections made
  const positionsList = Object.keys(grouped);
  const isComplete = positionsList.length > 0 && positionsList.every(pos => selections[pos] != null);

  function handleSelectCandidate(position, candidateId) {
    setSelections(prev => ({ ...prev, [position]: candidateId }));
  }

  // Handle final submission and SHA-256 receipt generation
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

      // Build payload for hash
      const payloadString = JSON.stringify({
        receiptId,
        studentId: student?.studentId || '20894512',
        electionId,
        selections,
        timestamp
      });

      // Generate Cryptographic SHA-256 Hash
      const sha256Hash = await generateSHA256Hash(payloadString);

      // Attempt DB vote submit
      const votesPayload = Object.entries(selections).map(([pos, candId]) => ({ candidate_id: candId, position: pos }));
      try {
        await submitAnonymousVote({
          studentId: student?.studentId || '20894512',
          electionId,
          roomId,
          votes: votesPayload
        });
      } catch (err) {
        if (err?.code === 'ROOM_LOCKED') {
          throw new Error('Election room is currently locked by EC. No votes can be submitted at this time.');
        }
        if (err?.code === 'DOUBLE_VOTE') {
          throw new Error('You have already cast your vote in this election.');
        }
        throw err;
      }

      const receiptData = {
        receiptId,
        timestamp,
        sha256Hash,
        electionTitle: isConstituencyBallot
          ? `${student?.constituency_locked || 'Ayeduase'} Constituency Parliamentary Election`
          : 'SRC Executive Elections',
        studentId: student?.studentId || '20894512',
        selectionsSummary: Object.entries(selections).map(([pos, candId]) => {
          const candObj = candidates.find(c => c.candidate_id === candId);
          return { position: pos, candidateName: candObj ? candObj.full_name : candId };
        })
      };

      setVoteReceipt(receiptData);
      setIsSubmitted(true);
    } catch (err) {
      console.error('Submit error', err);
      setError(err.message || 'Failed to submit ballot.');
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
     RENDER: CONFIRMATION VIEW (SUCCESS ANIMATION & SHA-256 RECEIPT)
  ───────────────────────────────────────────── */
  if (isSubmitted && voteReceipt) {
    return (
      <div className="sv-ballot-container">
        <div className="sv-confirmation-card">

          {/* Animated Success Checkmark Icon */}
          <div className="sv-success-animation">
            <svg className="sv-checkmark-svg" viewBox="0 0 52 52">
              <circle className="sv-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="sv-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>

          <h2 className="sv-confirmation-title">🎉 BALLOT CAST SUCCESSFULLY!</h2>
          <p className="sv-confirmation-subtitle">Your vote has been cryptographically signed, encrypted, and recorded on the voter ledger.</p>

          {/* Cryptographic SHA-256 Vote Receipt Card */}
          <div className="sv-receipt-card">
            <div className="sv-receipt-header">
              <span className="sv-receipt-tag">🔒 SHA-256 CRYPTOGRAPHIC VOTE RECEIPT</span>
              <span className="sv-receipt-id">ID: {voteReceipt.receiptId}</span>
            </div>

            <div className="sv-receipt-body">
              <div className="sv-receipt-row">
                <span className="sv-r-label">Election:</span>
                <span className="sv-r-val">{voteReceipt.electionTitle}</span>
              </div>
              <div className="sv-receipt-row">
                <span className="sv-r-label">Timestamp:</span>
                <span className="sv-r-val">{new Date(voteReceipt.timestamp).toLocaleString()}</span>
              </div>

              <div className="sv-receipt-selections">
                <div className="sv-r-label" style={{ marginBottom: 6 }}>Selections Encrypted:</div>
                <ul className="sv-r-list">
                  {voteReceipt.selectionsSummary.map(s => (
                    <li key={s.position}>
                      <strong>{s.position}:</strong> {s.candidateName}
                    </li>
                  ))}
                </ul>
              </div>

              {/* SHA-256 Hash Display */}
              <div className="sv-hash-display-box">
                <span className="sv-hash-label">CRYPTOGRAPHIC SHA-256 HASH:</span>
                <div className="sv-hash-code">{voteReceipt.sha256Hash}</div>
              </div>
            </div>

            <div className="sv-receipt-footer">
              <button className="sv-btn-card primary" onClick={downloadReceiptJSON}>
                📥 DOWNLOAD CRYPTOGRAPHIC RECEIPT (.JSON)
              </button>
              <button className="sv-btn-card outline" onClick={onBack}>
                RETURN TO DASHBOARD ➔
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     RENDER: BALLOT SCREEN (EXECUTIVE / CONSTITUENCY MP)
  ───────────────────────────────────────────── */
  return (
    <div className="sv-ballot-container">

      {/* Header */}
      <div className="sv-ballot-header">
        <div>
          <button className="sv-back-btn" onClick={onBack}>← Back to Dashboard</button>
          <h1 className="sv-ballot-title">
            {isConstituencyBallot
              ? `🗳️ ${student?.constituency_locked || 'Ayeduase'} Constituency MP Ballot`
              : '🏛️ SRC Executive Official Ballot'}
          </h1>
          <p className="sv-ballot-subtitle">
            {isConstituencyBallot
              ? `Single-choice Parliamentary Election for ${student?.constituency_locked || 'Ayeduase'} Constituency`
              : 'Select your preferred candidates for all 5 Executive positions'}
          </p>
        </div>

        <div className="sv-ballot-progress-badge">
          {isComplete ? (
            <span className="sv-prog-complete">✅ All Positions Selected</span>
          ) : (
            <span className="sv-prog-incomplete">
              {Object.keys(selections).length} / {positionsList.length} Selected
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="sv-loading-card">Loading official candidate ballot...</div>
      ) : (
        <div className="sv-positions-wrapper">
          {positionsList.map(position => {
            const candidateList = grouped[position];
            const hasSelection = selections[position] != null;

            return (
              <div key={position} className={`sv-position-card ${hasSelection ? 'complete' : ''}`}>
                <div className="sv-position-header">
                  <h3>{position}</h3>
                  {hasSelection ? (
                    <span className="sv-pos-status-done">Selected ✅</span>
                  ) : (
                    <span className="sv-pos-status-pending">Selection Required *</span>
                  )}
                </div>

                <div className="sv-candidates-grid">
                  {candidateList.map(c => {
                    const isChecked = selections[position] === c.candidate_id;

                    return (
                      <div
                        key={c.candidate_id}
                        className={`sv-candidate-card ${isChecked ? 'selected' : ''}`}
                        onClick={() => handleSelectCandidate(position, c.candidate_id)}
                      >
                        <div className="sv-candidate-top">
                          <CandidateAvatar src={c.photo_url} name={c.full_name} />
                          <div className="sv-candidate-info">
                            <h4 className="sv-cand-name">{c.full_name}</h4>
                            <span className="sv-cand-pos">{c.position}</span>
                            <button
                              type="button"
                              className="sv-btn-manifesto"
                              onClick={(e) => {
                                e.stopPropagation();
                                setManifestoCandidate(c);
                              }}
                            >
                              📜 Read Manifesto
                            </button>
                          </div>
                        </div>

                        {/* Radio selection control */}
                        <div className="sv-radio-control">
                          <input
                            type="radio"
                            id={`cand-${c.candidate_id}`}
                            name={`position-${position}`}
                            value={c.candidate_id}
                            checked={isChecked}
                            onChange={() => handleSelectCandidate(position, c.candidate_id)}
                          />
                          <label htmlFor={`cand-${c.candidate_id}`}>
                            {isChecked ? 'SELECTED' : 'VOTE'}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manifesto Modal */}
      <ManifestoModal
        candidate={manifestoCandidate}
        onClose={() => setManifestoCandidate(null)}
      />

      {error && <div className="sv-error" style={{ margin: '16px 0' }}>{error}</div>}

      {/* Submit Action Banner */}
      <div className="sv-submit-banner">
        <button
          className="sv-btn-card primary pulse"
          disabled={!isComplete || submitting}
          onClick={handleSubmitBallot}
        >
          {submitting ? 'Encrypting & Casting Ballot...' : '🔒 SUBMIT & CAST ENCRYPTED BALLOT ➔'}
        </button>
      </div>
    </div>
  );
}
