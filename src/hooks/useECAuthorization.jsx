import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useECAuthorization Hook
 * Detects if the current user has EC administrative rights for any jurisdiction
 * Also tracks their personal vote status in each election
 * 
 * Dual-Identity Pattern:
 * - Returns EC role + jurisdiction if user is an EC member
 * - Returns null if user is a regular voter
 * - Separately tracks if EC member has already voted in current election
 */
export default function useECAuthorization() {
  const [ecRole, setEcRole] = useState(null);           // 'EC_HEAD', 'EC_DEPUTY', 'EC_COMMISSIONER'
  const [ecJurisdictionId, setEcJurisdictionId] = useState(null);
  const [ecJurisdictionName, setEcJurisdictionName] = useState(null);
  const [hasECAccess, setHasECAccess] = useState(false);
  const [voteStatus, setVoteStatus] = useState(null);   // { has_voted: bool, voted_at: timestamp }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentElectionId, setCurrentElectionId] = useState(null);

  // Fetch EC authorization + vote status
  useEffect(() => {
    let mounted = true;

    async function checkECAuthorization() {
      setLoading(true);
      setError(null);

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          if (mounted) setLoading(false);
          return;
        }

        // Query EC jurisdiction assignments
        const { data: ecData, error: ecError } = await supabase
          .from('ec_jurisdiction_assignments')
          .select('role_type, jurisdiction_id, electoral_jurisdictions(name)')
          .eq('student_id', user.id)
          .single();

        if (ecError && ecError.code !== 'PGRST116') {
          // PGRST116 = no rows found (regular voter)
          throw ecError;
        }

        if (ecData) {
          // User has EC role
          if (mounted) {
            setEcRole(ecData.role_type);
            setEcJurisdictionId(ecData.jurisdiction_id);
            setEcJurisdictionName(ecData.electoral_jurisdictions?.name || 'Unknown');
            setHasECAccess(true);
          }
        } else {
          // Regular voter
          if (mounted) {
            setHasECAccess(false);
          }
        }
      } catch (err) {
        console.warn('EC authorization check failed:', err);
        if (mounted) setError(err?.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkECAuthorization();
    return () => { mounted = false; };
  }, []);

  // Fetch EC member's personal vote status in current election
  const checkVoteStatus = async (electionId) => {
    if (!hasECAccess || !electionId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc(
        'get_ec_member_vote_status',
        {
          p_student_id: user.id,
          p_election_id: electionId
        }
      );

      if (!error && data) {
        setVoteStatus(data);
        setCurrentElectionId(electionId);
      }
    } catch (err) {
      console.warn('Failed to check vote status:', err);
    }
  };

  return {
    // EC role information
    hasECAccess,
    ecRole,
    ecJurisdictionId,
    ecJurisdictionName,
    
    // Vote status tracking
    voteStatus,
    currentElectionId,
    checkVoteStatus,
    
    // Loading state
    loading,
    error
  };
}
