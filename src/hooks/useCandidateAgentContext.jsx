import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function useCandidateAgentContext() {
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

        const { data, error } = await supabase.rpc('get_candidate_room_announcement', {
          p_student_id: user.id,
        });

        if (error || !data) {
          if (mounted) {
            setContext(null);
            setUnauthorized(true);
            setLoading(false);
          }
          return;
        }

        const role = String(data.role_in_room || '').toUpperCase();
        if (role !== 'CANDIDATE_AGENT') {
          if (mounted) {
            setContext(null);
            setUnauthorized(true);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setContext({
            student_id: user.id,
            member_id: data.member_id || null,
            room_id: data.room_id,
            room_code: data.room_code,
            room_status: data.room_status,
            room_active: data.room_active,
            election_id: data.election_id,
            election_title: data.election_title,
            event_title: data.election_title,
            candidate_id: data.candidate_id,
            candidate_name: data.candidate_name,
            role_in_room: role,
          });
          setUnauthorized(false);
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
