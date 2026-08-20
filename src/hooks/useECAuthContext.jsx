import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { EC_ADMIN_PRESETS } from '../context/AdminAuthContext';

const AUTHORIZED_ROLES = ['HEAD', 'DEPUTY', 'PRO', 'ORGANIZER', 'SECRETARY'];

function getActiveAdminPreset() {
  try {
    const saved = localStorage.getItem('knust_ec_admin_profile_key');
    if (saved && EC_ADMIN_PRESETS[saved]) return EC_ADMIN_PRESETS[saved];
    if (saved === 'option-b' || saved === 'OPTION_B') return EC_ADMIN_PRESETS.OPTION_B;
    if (saved === 'option-c' || saved === 'OPTION_C') return EC_ADMIN_PRESETS.OPTION_C;
  } catch (e) {}
  return EC_ADMIN_PRESETS.OPTION_A;
}

export default function useECAuthContext() {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    function buildContextFromPreset(preset) {
      return {
        student_id: preset.id.toLowerCase() + '-officer',
        full_name: `${preset.name} (${preset.roleTitle})`,
        role_in_room: preset.id === 'OPTION_A' ? 'HEAD' : preset.id === 'OPTION_B' ? 'DEPUTY' : 'ORGANIZER',
        jurisdiction_id: preset.assignedJurisdiction.id,
        jurisdiction_name: preset.assignedJurisdiction.name,
        jurisdiction_tier: preset.assignedJurisdiction.tier,
        isStaff: preset.id !== 'OPTION_A',
        canCreateRoom: preset.permissions.includes('CREATE_ROOMS'),
        profile: preset,
      };
    }

    async function loadContext() {
      setLoading(true);
      const activePreset = getActiveAdminPreset();
      const demoContext = buildContextFromPreset(activePreset);

      try {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        const user = userData?.user;
        if (authError || !user) {
          if (mounted) {
            setContext(demoContext);
            setUnauthorized(false);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('election_room_members')
          .select('role_in_room, jurisdiction_id, student_id, electoral_jurisdictions(id, name, tier)')
          .eq('student_id', user.id)
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          if (mounted) {
            setContext(demoContext);
            setUnauthorized(false);
            setLoading(false);
          }
          return;
        }

        const role = String(data.role_in_room || 'HEAD').toUpperCase();
        const ecContext = {
          student_id: user.id,
          full_name: user.user_metadata?.full_name || demoContext.full_name,
          role_in_room: role,
          jurisdiction_id: data.jurisdiction_id || demoContext.jurisdiction_id,
          jurisdiction_name: data.electoral_jurisdictions?.name || demoContext.jurisdiction_name,
          jurisdiction_tier: String(data.electoral_jurisdictions?.tier || demoContext.jurisdiction_tier).toUpperCase(),
          isStaff: ['PRO', 'ORGANIZER', 'SECRETARY'].includes(role),
          canCreateRoom: role === 'HEAD' || role === 'DEPUTY',
          profile: activePreset,
        };

        const allowed = AUTHORIZED_ROLES.includes(role);
        if (mounted) {
          setContext(ecContext);
          setUnauthorized(!allowed);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setContext(demoContext);
          setUnauthorized(false);
          setLoading(false);
        }
      }
    }

    loadContext();

    // Listen for preset switch event
    const handleProfileChange = (e) => {
      if (e.detail) {
        setContext(buildContextFromPreset(e.detail));
      }
    };
    window.addEventListener('knust_ec_admin_profile_changed', handleProfileChange);

    return () => {
      mounted = false;
      window.removeEventListener('knust_ec_admin_profile_changed', handleProfileChange);
    };
  }, []);

  return { context, loading, unauthorized };
}
