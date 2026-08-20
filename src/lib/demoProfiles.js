// src/lib/demoProfiles.js
// Quick Demo Switcher configuration and profile state manager for KNUST portal

export const DEMO_PROFILES = {
  A: {
    id: 'A',
    key: 'level-100',
    full_name: 'Kwame Nkrumah',
    name: 'Kwame Nkrumah',
    student_id: '20894512',
    studentId: '20894512',
    email: 'knkrumah@st.knust.edu.gh',
    level: 100,
    year_of_study: 1,
    program: 'BSc. Computer Eng.',
    department: 'Computer Engineering',
    department_code: 'COE',
    college: 'CoE',
    college_code: 'COE',
    hall: 'Unity Hall',
    hall_code: 'UNITY',
    constituency: 'Ayeduase',
    constituency_locked: 'Ayeduase',
    biometrics_completed_current_semester: true,
    student_academic_sessions: [
      { session: '2025/2026', is_current: true, level: 100, year_of_study: 1 }
    ],
    label: 'Option A (Default - Level 100)',
    shortLabel: 'Option A (Level 100)',
    roleBadge: 'First-Year Resident',
    description: 'Kwame Nkrumah | Level 100 | Unity Hall (First-Year) — Hall Elections active and unlocked',
    hallEligible: true
  },
  B: {
    id: 'B',
    key: 'level-300',
    full_name: 'Akosua Mensah',
    name: 'Akosua Mensah',
    student_id: '20783421',
    studentId: '20783421',
    email: 'amensah@st.knust.edu.gh',
    level: 300,
    year_of_study: 3,
    program: 'BSc. Computer Eng.',
    department: 'Computer Engineering',
    department_code: 'COE',
    college: 'CoE',
    college_code: 'COE',
    hall: 'Ayeduase (Off-Campus)',
    hall_code: null,
    constituency: 'Ayeduase',
    constituency_locked: 'Ayeduase',
    biometrics_completed_current_semester: true,
    student_academic_sessions: [
      { session: '2025/2026', is_current: true, level: 300, year_of_study: 3 }
    ],
    label: 'Option B (Continuing Student)',
    shortLabel: 'Option B (Level 300)',
    roleBadge: 'Continuing Student',
    description: 'Akosua Mensah | Level 300 | Computer Eng | Ayeduase (Off-Campus) — Hall Elections locked/ineligible',
    hallEligible: false
  }
};

const STORAGE_KEY = 'knust_user_session';
const DEMO_KEY = 'knust_demo_profile_key';
const EVENT_NAME = 'knust_demo_profile_changed';

/**
 * Get active profile key ('A' or 'B') from localStorage
 */
export function getStoredDemoProfileKey() {
  try {
    const saved = localStorage.getItem(DEMO_KEY);
    if (saved === 'B' || saved === 'level-300') return 'B';
    if (saved === 'A' || saved === 'level-100') return 'A';

    const sessionRaw = localStorage.getItem(STORAGE_KEY);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed.level >= 200 || parsed.year_of_study > 1 || parsed.student_id === '20783421') {
        return 'B';
      }
    }
  } catch (e) {}
  return 'A';
}

/**
 * Get the full active student profile object
 */
export function getStoredStudentProfile() {
  try {
    const sessionRaw = localStorage.getItem(STORAGE_KEY);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed && (parsed.full_name || parsed.name || parsed.student_id)) {
        return parsed;
      }
    }
  } catch (e) {}

  const profileKey = getStoredDemoProfileKey();
  return DEMO_PROFILES[profileKey];
}

/**
 * Switch demo profile to Option A or Option B and broadcast changes
 */
export function switchDemoProfile(profileId) {
  const targetKey = profileId === 'B' || profileId === 'level-300' ? 'B' : 'A';
  const newProfile = DEMO_PROFILES[targetKey];

  try {
    localStorage.setItem(DEMO_KEY, targetKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
  } catch (e) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: newProfile }));
  }

  return newProfile;
}

/**
 * Hook or helper to subscribe to profile changes across windows/components
 */
export function subscribeToDemoProfile(callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e) => {
    callback(e.detail || getStoredStudentProfile());
  };

  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === DEMO_KEY) {
      callback(getStoredStudentProfile());
    }
  });

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
  };
}
