import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function getInitialStudent() {
  try {
    const stored = localStorage.getItem('knust_user_session');
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

// Hook to load current student's academic session and basic attributes with localStorage persistence
export default function useStudentSession() {
  const [student, setStudent] = useState(getInitialStudent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current authenticated user
      let user = null;
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (!userErr) user = userData?.user || null;
      } catch (err) {
        user = supabase.auth.user ? supabase.auth.user() : null;
      }

      if (!user) {
        const cached = getInitialStudent();
        if (cached) {
          setStudent(cached);
        } else {
          setStudent(null);
        }
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
        throw qErr;
      }

      const studentObj = {
        full_name: data?.full_name || user.user_metadata?.full_name || 'Kwame Nkrumah',
        student_id: data?.student_id || studentId,
        email: user.email || '',
        college_code: data?.college_code || 'COE',
        department_code: data?.department_code || 'COE',
        hall_code: data?.hall_code || 'UNITY',
        year_of_study: data?.year_of_study || (data?.level === 100 ? 1 : 1),
        level: data?.level || 100,
        biometrics_completed_current_semester: data?.biometrics_completed_current_semester ?? true
      };

      setStudent(studentObj);
      localStorage.setItem('knust_user_session', JSON.stringify(studentObj));
    } catch (err) {
      console.error('useStudentSession error', err);
      setError(err);
      const cached = getInitialStudent();
      if (cached) {
        setStudent(cached);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { student, loading, error, refresh };
}
