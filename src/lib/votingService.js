import { supabase } from './supabaseClient';

const VOTED_STORAGE_KEY = 'knust_voted_elections';
const RECEIPTS_STORAGE_KEY = 'knust_vote_receipts';
const VOTE_EVENT_NAME = 'knust_vote_submitted';

// Simple ballot hash generator using native crypto
export async function generateBallotHash(votes) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(votes));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    const str = JSON.stringify(votes);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

// Encrypt votes payload (Base64 wrapper for client-side demo encryption)
export function encryptVotes(votes) {
  const votesJson = JSON.stringify(votes);
  return btoa(votesJson);
}

/**
 * Retrieve all voted elections from local storage
 */
export function getVotedElections() {
  try {
    const raw = localStorage.getItem(VOTED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Check if a student has already voted in an election (supports ID & type aliases)
 */
export function isElectionVoted(electionId, electionType) {
  const votedMap = getVotedElections();
  if (!votedMap) return false;
  if (electionId && votedMap[electionId]) return true;
  if (electionType && votedMap[electionType]) return true;

  // Check common aliases
  if (electionId === 'const' && (votedMap['constituency'] || votedMap['parliamentary'])) return true;
  if (electionId === 'constituency' && votedMap['const']) return true;
  if (electionId === 'dept' && (votedMap['department'] || votedMap['college'])) return true;
  if (electionId === 'department' && votedMap['dept']) return true;
  if (electionId === 'src' && votedMap['src']) return true;
  if (electionId === 'hall' && votedMap['hall']) return true;

  return false;
}

/**
 * Record a vote locally in localStorage and broadcast the update event
 */
export function recordLocalVote({ studentId, electionId, receiptId, sha256Hash, selections, votes, timestamp }) {
  try {
    const current = getVotedElections();
    const voteRecord = {
      voted: true,
      studentId,
      electionId,
      receiptId,
      sha256Hash,
      selections,
      votes,
      timestamp: timestamp || new Date().toISOString()
    };

    current[electionId] = voteRecord;
    if (electionId === 'const') current['constituency'] = voteRecord;
    if (electionId === 'dept') current['department'] = voteRecord;

    localStorage.setItem(VOTED_STORAGE_KEY, JSON.stringify(current));

    // Also persist in receipts list
    const receiptsRaw = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    const receipts = receiptsRaw ? JSON.parse(receiptsRaw) : [];
    receipts.unshift(voteRecord);
    localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(receipts));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(VOTE_EVENT_NAME, { detail: voteRecord }));
    }

    return voteRecord;
  } catch (e) {
    console.error('Failed to record local vote', e);
  }
}

/**
 * Subscribe to vote completion events across components
 */
export function subscribeToVoteUpdates(callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e) => {
    callback(e.detail || getVotedElections());
  };

  window.addEventListener(VOTE_EVENT_NAME, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === VOTED_STORAGE_KEY) {
      callback(getVotedElections());
    }
  });

  return () => {
    window.removeEventListener(VOTE_EVENT_NAME, handler);
  };
}

/**
 * Submit anonymous vote with graceful offline/local storage fallback
 */
export async function submitAnonymousVote({ studentId, electionId, roomId, votes, selections, receiptId, timestamp }) {
  // Check double-vote state first
  if (isElectionVoted(electionId)) {
    throw {
      code: 'DOUBLE_VOTE',
      message: 'You have already cast your vote in this election.',
    };
  }

  const encryptedPayload = encryptVotes(votes);
  const ballotHash = await generateBallotHash(votes);
  const finalReceiptId = receiptId || ('REC-' + Math.random().toString(36).slice(2, 10).toUpperCase());
  const finalTimestamp = timestamp || new Date().toISOString();

  let dbSuccess = false;
  let dbData = null;

  try {
    const { data, error } = await supabase.rpc('submit_anonymous_vote', {
      p_student_id: studentId,
      p_election_id: electionId,
      p_room_id: roomId,
      p_encrypted_payload: encryptedPayload,
      p_ballot_hash: ballotHash,
    });

    if (error) {
      const message = error.message || String(error);
      if (/room.*locked|room_locked/i.test(message)) {
        throw {
          code: 'ROOM_LOCKED',
          message: 'Election room is currently locked by EC. No votes can be submitted at this time.',
        };
      }
      if (/double.*vote|double_vote|already.*cast/i.test(message)) {
        throw {
          code: 'DOUBLE_VOTE',
          message: 'You have already cast your vote in this election.',
        };
      }
      console.warn('Supabase RPC responded with error, falling back to local state recording:', error);
    } else {
      dbSuccess = true;
      dbData = data;
    }
  } catch (err) {
    // If strict business rule violation, rethrow for UI notification
    if (err?.code === 'ROOM_LOCKED' || err?.code === 'DOUBLE_VOTE') {
      throw err;
    }
    // Network / endpoint unreachable / TypeError: Failed to fetch: gracefully fallback to local recording
    console.info('Supabase endpoint unreachable or offline. Recording vote locally in voter ledger.');
  }

  // Always record vote locally in ledger so voter state and receipt persist
  const localRecord = recordLocalVote({
    studentId,
    electionId,
    receiptId: finalReceiptId,
    sha256Hash: ballotHash,
    selections,
    votes,
    timestamp: finalTimestamp
  });

  return {
    success: true,
    dbSuccess,
    data: dbData,
    ballotHash,
    receiptId: finalReceiptId,
    timestamp: finalTimestamp,
    localRecord
  };
}

