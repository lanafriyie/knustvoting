import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AUTHORIZED_ROLES = ['HEAD', 'DEPUTY', 'PRO', 'ORGANIZER', 'SECRETARY'];

export default function useECAuthContext() {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      setLoading(true);
      try {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        const user = userData?.user;
        if (authError || !user) {
          if (mounted) {
            setContext(null);
            setUnauthorized(true);
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
            setContext(null);
            setUnauthorized(true);
            setLoading(false);
          }
          return;
        }

        const role = String(data.role_in_room || '').toUpperCase();
        const ecContext = {
          student_id: user.id,
          role_in_room: role,
          jurisdiction_id: data.jurisdiction_id,
          jurisdiction_name: data.electoral_jurisdictions?.name || 'Unknown Jurisdiction',
          jurisdiction_tier: String(data.electoral_jurisdictions?.tier || 'UNKNOWN').toUpperCase(),
          isStaff: ['PRO', 'ORGANIZER', 'SECRETARY'].includes(role),
          canCreateRoom: role === 'HEAD' || role === 'DEPUTY',
        };

        const allowed = AUTHORIZED_ROLES.includes(role);
        if (mounted) {
          setContext(ecContext);
          setUnauthorized(!allowed);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setContext(null);
          setUnauthorized(true);
          setLoading(false);
        }
      }
    }

    loadContext();
    return () => {
      mounted = false;
    };
  }, []);

  return { context, loading, unauthorized };
}
