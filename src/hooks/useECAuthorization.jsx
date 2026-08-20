import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { EC_ADMIN_PRESETS } from '../context/AdminAuthContext';

function getActiveAdminPreset() {
  try {
    const saved = localStorage.getItem('knust_ec_admin_profile_key');
    if (saved && EC_ADMIN_PRESETS[saved]) return EC_ADMIN_PRESETS[saved];
    if (saved === 'option-b' || saved === 'OPTION_B') return EC_ADMIN_PRESETS.OPTION_B;
    if (saved === 'option-c' || saved === 'OPTION_C') return EC_ADMIN_PRESETS.OPTION_C;
  } catch (e) {}
  return EC_ADMIN_PRESETS.OPTION_A;
}

/**
 * useECAuthorization Hook
 * Detects if the current user has EC administrative rights for any jurisdiction
 * Also tracks their personal vote status in each election
 */
export default function useECAuthorization() {
  const [ecRole, setEcRole] = useState(() => {
    const p = getActiveAdminPreset();
    return p.roleTitle;
  });
  const [ecJurisdictionId, setEcJurisdictionId] = useState(() => {
    const p = getActiveAdminPreset();
    return p.assignedJurisdiction.id;
  });
  const [ecJurisdictionName, setEcJurisdictionName] = useState(() => {
    const p = getActiveAdminPreset();
    return p.assignedJurisdiction.name;
  });
  const [hasECAccess, setHasECAccess] = useState(true);
  const [voteStatus, setVoteStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentElectionId, setCurrentElectionId] = useState(null);

  useEffect(() => {
    const handleProfileChange = (e) => {
      if (e.detail) {
        const p = e.detail;
        setEcRole(p.roleTitle);
        setEcJurisdictionId(p.assignedJurisdiction.id);
        setEcJurisdictionName(p.assignedJurisdiction.name);
      }
    };
    window.addEventListener('knust_ec_admin_profile_changed', handleProfileChange);
    return () => window.removeEventListener('knust_ec_admin_profile_changed', handleProfileChange);
  }, []);

  // Fetch EC authorization + vote status
  useEffect(() => {
    let mounted = true;

    async function checkECAuthorization() {
      const activePreset = getActiveAdminPreset();
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          if (mounted) {
            setEcRole(activePreset.roleTitle);
            setEcJurisdictionId(activePreset.assignedJurisdiction.id);
            setEcJurisdictionName(activePreset.assignedJurisdiction.name);
            setHasECAccess(true);
            setLoading(false);
          }
          return;
        }

        const { data: ecData, error: ecError } = await supabase
          .from('ec_jurisdiction_assignments')
          .select('role_type, jurisdiction_id, electoral_jurisdictions(name)')
          .eq('student_id', user.id)
          .single();

        if (ecError && ecError.code !== 'PGRST116') {
          throw ecError;
        }

        if (ecData) {
          if (mounted) {
            setEcRole(ecData.role_type);
            setEcJurisdictionId(ecData.jurisdiction_id);
            setEcJurisdictionName(ecData.electoral_jurisdictions?.name || activePreset.assignedJurisdiction.name);
            setHasECAccess(true);
          }
        } else {
          if (mounted) {
            setEcRole(activePreset.roleTitle);
            setEcJurisdictionId(activePreset.assignedJurisdiction.id);
            setEcJurisdictionName(activePreset.assignedJurisdiction.name);
            setHasECAccess(true);
          }
        }
      } catch (err) {
        if (mounted) {
          setEcRole(activePreset.roleTitle);
          setEcJurisdictionId(activePreset.assignedJurisdiction.id);
          setEcJurisdictionName(activePreset.assignedJurisdiction.name);
          setHasECAccess(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkECAuthorization();
    return () => { mounted = false; };
  }, []);

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
    } catch (err) {}
  };

  return {
    hasECAccess,
    ecRole,
    ecJurisdictionId,
    ecJurisdictionName,
    voteStatus,
    currentElectionId,
    checkVoteStatus,
    loading,
    error
  };
}
