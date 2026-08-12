import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

// Hook to load current student's academic session and basic attributes
export default function useStudentSession() {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current authenticated user
      let user = null;
      try {
        // supabase v2
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        user = userData?.user || null;
      } catch (err) {
        // fallback for v1
        user = supabase.auth.user ? supabase.auth.user() : null;
      }

      if (!user) {
        setStudent(null);
        setLoading(false);
        return;
      }

      const studentId = user.id;

      // Query the student's active academic session record
      const { data, error: qErr } = await supabase
        .from('student_academic_sessions')
        .select('full_name, student_id, college_code, department_code, hall_code, year_of_study, level, biometrics_completed_current_semester')
        .eq('student_id', studentId)
        .order('is_current', { ascending: false })
        .limit(1)
        .single();

      if (qErr && qErr.code !== 'PGRST116') {
        // PGRST116 can mean no rows found for .single()
        throw qErr;
      }

      if (data) {
        setStudent({
          full_name: data.full_name || user.user_metadata?.full_name || '',
          student_id: data.student_id || studentId,
          college_code: data.college_code || null,
          department_code: data.department_code || null,
          hall_code: data.hall_code || null,
          year_of_study: data.year_of_study || (data.level === 100 ? 1 : null),
          level: data.level || null,
          biometrics_completed_current_semester: data.biometrics_completed_current_semester || false
        });
      } else {
        setStudent(null);
      }
    } catch (err) {
      console.error('useStudentSession error', err);
      setError(err);
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { student, loading, error, refresh };
}
