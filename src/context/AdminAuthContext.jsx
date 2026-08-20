import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * EC Admin Officer Personas & Demo Presets
 */
export const EC_ADMIN_PRESETS = {
  OPTION_A: {
    id: 'OPTION_A',
    key: 'option-a',
    name: 'Commissioner Kwame Appiah',
    roleTitle: 'Chief Electoral Commissioner (SRC Tier)',
    roleTier: 'SRC',
    assignedJurisdiction: {
      id: 'src-all',
      name: 'University-Wide (SRC Executive & All Jurisdictions)',
      tier: 'SRC',
      code: 'KNUST_ALL',
      description: 'Full campus-wide jurisdiction covering all student bodies',
    },
    badgeLabel: 'SRC Chief Officer - Full System Access',
    badgeVariant: 'src',
    avatar: '🏛️',
    description: 'Full administrative access to manage SRC Executive elections, publish university-wide declarations, execute system overrides, and supervise all campus tiers.',
    permissions: [
      'MANAGE_SRC',
      'MANAGE_ALL_TIERS',
      'PUBLISH_UNIVERSITY_WIDE',
      'VERIFY_CANDIDATES',
      'DISQUALIFY_CANDIDATES',
      'OVERRIDE_POLLS',
      'CREATE_BALLOTS',
      'EXPORT_AUDIT_LOGS',
      'CREATE_ROOMS',
      'TALLY_ALL',
      'SYSTEM_HEALTH_CONTROL',
    ],
    allowedTiers: ['SRC', 'DEPARTMENT', 'COLLEGE', 'HALL', 'CONSTITUENCY', 'PARLIAMENTARY'],
    studentProfile: {
      id: 'OPTION_A',
      full_name: 'Commissioner Kwame Appiah',
      name: 'Commissioner Kwame Appiah',
      student_id: '20998811',
      studentId: '20998811',
      email: 'kappiah.ec@st.knust.edu.gh',
      level: 400,
      year_of_study: 4,
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
      isEcOfficer: true,
      roleTitle: 'Chief Electoral Commissioner (SRC Tier)',
      roleTier: 'SRC',
      assignedJurisdictionName: 'University-Wide (SRC Executive & All Jurisdictions)'
    },
  },
  OPTION_B: {
    id: 'OPTION_B',
    key: 'option-b',
    name: 'Officer Francis Mensah',
    roleTitle: 'College & Departmental EC Officer',
    roleTier: 'DEPARTMENT',
    assignedJurisdiction: {
      id: 'coe-comp-eng',
      name: 'College of Engineering (CoE) / Computer Engineering',
      tier: 'DEPARTMENT',
      code: 'COE',
      college_code: 'COE',
      department_code: 'COE',
      description: 'Scope restricted to College of Engineering & Computer Eng. portfolios',
    },
    badgeLabel: 'CoE Departmental Officer - Scope: Computer Eng',
    badgeVariant: 'dept',
    avatar: '🏢',
    description: 'Administrative access restricted strictly to College of Engineering (CoE) and Computer Engineering departmental elections, candidate verifications, and CoE turnout tracking.',
    permissions: [
      'MANAGE_DEPARTMENT',
      'MANAGE_COLLEGE',
      'VERIFY_CANDIDATES',
      'DISQUALIFY_CANDIDATES',
      'OVERRIDE_POLLS',
      'CREATE_BALLOTS',
      'EXPORT_AUDIT_LOGS',
      'CREATE_ROOMS',
    ],
    allowedTiers: ['DEPARTMENT', 'COLLEGE'],
    studentProfile: {
      id: 'OPTION_B',
      full_name: 'Officer Francis Mensah',
      name: 'Officer Francis Mensah',
      student_id: '20998822',
      studentId: '20998822',
      email: 'fmensah.ec@st.knust.edu.gh',
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
      isEcOfficer: true,
      roleTitle: 'College & Departmental EC Officer',
      roleTier: 'DEPARTMENT',
      assignedJurisdictionName: 'College of Engineering (CoE) / Computer Engineering'
    },
  },
  OPTION_C: {
    id: 'OPTION_C',
    key: 'option-c',
    name: 'Commissioner Yaa Serwaa',
    roleTitle: 'Hall & Constituency Commissioner',
    roleTier: 'HALL_CONSTITUENCY',
    assignedJurisdiction: {
      id: 'unity-ayeduase',
      name: 'Unity Hall & Ayeduase Constituency',
      tier: 'HALL',
      code: 'UNITY_AYEDUASE',
      hall_code: 'UNITY',
      constituency: 'Ayeduase',
      description: 'Scope restricted to first-year Unity Hall ballots & Ayeduase Constituency',
    },
    badgeLabel: 'Hall & Constituency Officer - Scope: Unity Hall & Ayeduase',
    badgeVariant: 'hall',
    avatar: '🏰',
    description: 'Administrative access restricted to first-year resident ballots for Unity Hall and off-campus parliamentary polling for Ayeduase Constituency.',
    permissions: [
      'MANAGE_HALL',
      'MANAGE_CONSTITUENCY',
      'VERIFY_CANDIDATES',
      'DISQUALIFY_CANDIDATES',
      'OVERRIDE_POLLS',
      'EXPORT_AUDIT_LOGS',
    ],
    allowedTiers: ['HALL', 'CONSTITUENCY', 'PARLIAMENTARY'],
    studentProfile: {
      id: 'OPTION_C',
      full_name: 'Commissioner Yaa Serwaa',
      name: 'Commissioner Yaa Serwaa',
      student_id: '20998833',
      studentId: '20998833',
      email: 'yserwaa.ec@st.knust.edu.gh',
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
      isEcOfficer: true,
      roleTitle: 'Hall & Constituency Commissioner',
      roleTier: 'HALL_CONSTITUENCY',
      assignedJurisdictionName: 'Unity Hall & Ayeduase Constituency'
    },
  },
};

const STORAGE_KEY = 'knust_ec_admin_profile_key';
const EVENT_NAME = 'knust_ec_admin_profile_changed';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [activePresetKey, setActivePresetKey] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && EC_ADMIN_PRESETS[saved]) return saved;
      if (saved === 'option-b' || saved === 'OPTION_B') return 'OPTION_B';
      if (saved === 'option-c' || saved === 'OPTION_C') return 'OPTION_C';
    } catch (e) {}
    return 'OPTION_A';
  });

  const ecAdminProfile = EC_ADMIN_PRESETS[activePresetKey] || EC_ADMIN_PRESETS.OPTION_A;

  const switchPreset = useCallback((presetId) => {
    let targetKey = 'OPTION_A';
    if (presetId === 'OPTION_B' || presetId === 'option-b') targetKey = 'OPTION_B';
    if (presetId === 'OPTION_C' || presetId === 'option-c') targetKey = 'OPTION_C';

    const targetPreset = EC_ADMIN_PRESETS[targetKey];

    setActivePresetKey(targetKey);
    try {
      localStorage.setItem(STORAGE_KEY, targetKey);
      if (targetPreset && targetPreset.studentProfile) {
        localStorage.setItem('knust_user_session', JSON.stringify(targetPreset.studentProfile));
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: targetPreset }));
      if (targetPreset && targetPreset.studentProfile) {
        window.dispatchEvent(new CustomEvent('knust_demo_profile_changed', { detail: targetPreset.studentProfile }));
      }
    }
  }, []);

  // Listen for storage changes across tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue && EC_ADMIN_PRESETS[e.newValue]) {
        setActivePresetKey(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  /**
   * Check if a specific permission is held by active profile
   */
  const hasPermission = useCallback((permission) => {
    if (!ecAdminProfile || !ecAdminProfile.permissions) return false;
    if (ecAdminProfile.permissions.includes('MANAGE_ALL_TIERS')) return true;
    return ecAdminProfile.permissions.includes(permission);
  }, [ecAdminProfile]);

  /**
   * Check if an election is within active officer's assigned jurisdiction scope
   */
  const isElectionInScope = useCallback((election) => {
    if (!election || !ecAdminProfile) return false;
    // Option A has system-wide access to all elections
    if (ecAdminProfile.id === 'OPTION_A') return true;

    const tier = String(election.tier || election.type || '').toUpperCase();
    const electionId = String(election.id || '').toLowerCase();
    const title = String(election.title || '').toUpperCase();

    // Option B: College / Department Tier
    if (ecAdminProfile.id === 'OPTION_B') {
      if (tier === 'DEPARTMENT' || tier === 'COLLEGE') return true;
      if (electionId.includes('dept') || electionId.includes('department') || electionId.includes('college')) return true;
      if (title.includes('DEPARTMENT') || title.includes('COLLEGE')) return true;
      return false;
    }

    // Option C: Hall & Constituency Tier
    if (ecAdminProfile.id === 'OPTION_C') {
      if (tier === 'HALL' || tier === 'CONSTITUENCY' || tier === 'PARLIAMENTARY') return true;
      if (electionId.includes('hall') || electionId.includes('const') || electionId.includes('parliamentary')) return true;
      if (title.includes('HALL') || title.includes('CONSTITUENCY') || title.includes('PARLIAMENTARY')) return true;
      return false;
    }

    return false;
  }, [ecAdminProfile]);

  /**
   * Check if an election is managed directly by the active officer's assigned tier
   */
  const isElectionManagedByOfficerTier = useCallback((election) => {
    if (!election || !ecAdminProfile) return false;
    const tier = String(election.tier || election.type || '').toUpperCase();
    const title = String(election.title || '').toUpperCase();

    if (ecAdminProfile.id === 'OPTION_A') {
      // SRC Chief Officer directly manages SRC elections
      return tier === 'SRC' || title.includes('SRC');
    }
    if (ecAdminProfile.id === 'OPTION_B') {
      // Departmental Officer directly manages Department/College elections
      return tier === 'DEPARTMENT' || tier === 'COLLEGE' || title.includes('DEPARTMENT') || title.includes('COLLEGE');
    }
    if (ecAdminProfile.id === 'OPTION_C') {
      // Hall & Constituency Commissioner directly manages Hall & Constituency/Parliamentary elections
      return tier === 'HALL' || tier === 'CONSTITUENCY' || tier === 'PARLIAMENTARY' || title.includes('HALL') || title.includes('CONSTITUENCY');
    }
    return false;
  }, [ecAdminProfile]);

  /**
   * Get restriction reason if an election is out of scope
   */
  const getScopeRestrictionReason = useCallback((election) => {
    if (isElectionInScope(election)) return null;
    return `Restricted — Outside Assigned Jurisdiction (${ecAdminProfile.assignedJurisdiction.name} Only)`;
  }, [isElectionInScope, ecAdminProfile]);

  const value = {
    ecAdminProfile,
    activePresetKey,
    switchPreset,
    hasPermission,
    isElectionInScope,
    isElectionManagedByOfficerTier,
    getScopeRestrictionReason,
    presets: EC_ADMIN_PRESETS,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    // Fallback default state if used outside provider
    const defaultProfile = EC_ADMIN_PRESETS.OPTION_A;
    return {
      ecAdminProfile: defaultProfile,
      activePresetKey: 'OPTION_A',
      switchPreset: () => {},
      hasPermission: () => true,
      isElectionInScope: () => true,
      isElectionManagedByOfficerTier: () => true,
      getScopeRestrictionReason: () => null,
      presets: EC_ADMIN_PRESETS,
    };
  }
  return ctx;
}

export default AdminAuthContext;
