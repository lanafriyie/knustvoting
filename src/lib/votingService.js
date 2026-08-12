import { supabase } from './supabaseClient';

// Simple ballot hash generator using native crypto
async function generateBallotHash(votes) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(votes));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback: simple hash (not cryptographically secure, for development only)
    const str = JSON.stringify(votes);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

// Encrypt votes payload (placeholder - replace with AES-256-GCM in production)
function encryptVotes(votes) {
  // For now, use base64 encoding + hash for integrity check
  // In production: implement proper AES-256-GCM encryption with key management
  const votesJson = JSON.stringify(votes);
  const encrypted = btoa(votesJson); // Base64 encode for demo
  return encrypted;
}

// Submit anonymous vote via Supabase RPC
export async function submitAnonymousVote({ studentId, electionId, roomId, votes }) {
  // votes should be an array of { candidate_id, position }
  try {
    // Encrypt the votes payload
    const encryptedPayload = encryptVotes(votes);
    const ballotHash = await generateBallotHash(votes);

    const { data, error } = await supabase.rpc('submit_anonymous_vote', {
      p_student_id: studentId,
      p_election_id: electionId,
      p_room_id: roomId,
      p_encrypted_payload: encryptedPayload,
      p_ballot_hash: ballotHash,
    });

    if (error) {
      throw error;
    }

    return { data };
  } catch (err) {
    // Map known Postgres/Supabase error messages to UI-friendly codes
    const message = err?.message || String(err);

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

    if (/biometric/i.test(message)) {
      throw {
        code: 'BIOMETRIC_ERROR',
        message: 'Please verify your biometrics for this semester.',
      };
    }

    throw {
      code: 'UNKNOWN',
      message,
    };
  }
}
