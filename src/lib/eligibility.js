// eligibility.js
// Utility helpers for election eligibility, dynamic status determination, and ballot completeness

/**
 * Dynamic Election Status Determination
 * Calculates election states automatically based on currentDate relative to startDate and endDate.
 *
 * Rules:
 *  - currentDate < startDate => UPCOMING (Calculate exact countdown timer remaining)
 *  - startDate <= currentDate <= endDate => LIVE NOW / ACTIVE (Show 'Ballot Open')
 *  - currentDate > endDate => CONCLUDED / CLOSED (Show 'View Results')
 *
 * @param {Date|string|number|Object} startDateOrElection - Date, timestamp, or election object
 * @param {Date|string|number} [endDateParam] - End date (if first parameter is start date)
 * @param {Date|number} [currentDate] - Reference date (defaults to new Date())
 */
export function getElectionStatus(startDateOrElection, endDateParam, currentDate = new Date()) {
  let startDate = startDateOrElection;
  let endDate = endDateParam;
  let explicitStatus = null;
  let electionId = null;

  if (startDateOrElection && typeof startDateOrElection === 'object') {
    if (!(startDateOrElection instanceof Date)) {
      electionId = startDateOrElection.id || startDateOrElection.election_id;
      explicitStatus = startDateOrElection.status || null;
      startDate = startDateOrElection.start_time || startDateOrElection.startTime || startDateOrElection.date;
      endDate = startDateOrElection.end_time || startDateOrElection.endTime;
    } else {
      startDate = startDateOrElection;
    }
  }

  // Always check localStorage for admin status overrides
  try {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem('knust_elections_status');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        if (electionId) {
          const match = parsed.find(item => item.id === electionId);
          if (match && match.status) explicitStatus = match.status;
        }
      }
    }
  } catch (e) {}

  // Handle explicit DB / Administrative status overrides
  if (explicitStatus === 'CLOSED' || explicitStatus === 'closed') {
    return {
      status: 'CLOSED',
      label: 'CONCLUDED / CLOSED',
      badgeText: 'Concluded',
      actionText: 'View Results 📊',
      isUpcoming: false,
      isLive: false,
      isClosed: true,
      countdownText: 'Election Concluded',
      diffMs: 0
    };
  }

  if (explicitStatus === 'PAUSED' || explicitStatus === 'paused') {
    return {
      status: 'PAUSED',
      label: 'PAUSED',
      badgeText: 'Paused ⏸️',
      actionText: 'Temporarily Paused',
      isUpcoming: false,
      isLive: false,
      isClosed: false,
      countdownText: 'Paused by EC',
      diffMs: 0
    };
  }

  const now = new Date(currentDate).getTime();
  const start = startDate ? new Date(startDate).getTime() : now;
  // Default end time to 24 hours after start if not explicitly provided
  const end = endDate ? new Date(endDate).getTime() : start + (24 * 60 * 60 * 1000);

  if (now < start) {
    const diffMs = start - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

    let countdownText = '';
    if (days > 0) {
      countdownText = `${days}d ${hours}h ${mins}m`;
    } else if (hours > 0) {
      countdownText = `${hours}h ${mins}m ${secs}s`;
    } else {
      countdownText = `${mins}m ${secs}s`;
    }

    return {
      status: 'UPCOMING',
      label: 'UPCOMING',
      badgeText: `Starts in ${countdownText}`,
      actionText: 'Starts Soon',
      isUpcoming: true,
      isLive: false,
      isClosed: false,
      countdownText,
      diffMs
    };
  } else if (now >= start && now <= end) {
    const diffMs = end - now;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

    const timeRemainingText = hours > 0 ? `${hours}h ${mins}m left` : `${mins}m ${secs}s left`;

    return {
      status: 'ACTIVE',
      label: 'LIVE NOW / ACTIVE',
      badgeText: 'Ballot Open 🟢',
      actionText: 'ENTER BALLOT ROOM ➔',
      isUpcoming: false,
      isLive: true,
      isClosed: false,
      countdownText: timeRemainingText,
      diffMs
    };
  } else {
    return {
      status: 'CLOSED',
      label: 'CONCLUDED / CLOSED',
      badgeText: 'View Results 📊',
      actionText: 'View Results 📊',
      isUpcoming: false,
      isLive: false,
      isClosed: true,
      countdownText: 'Election Concluded',
      diffMs: 0
    };
  }
}

/**
 * Format the unlock target date label for locked/upcoming elections (e.g. 'Aug 25')
 */
export function formatUnlockDate(election) {
  if (!election) return 'Soon';
  if (election.dateLabel) {
    try {
      const parsed = new Date(election.dateLabel);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (err) {}
    const parts = String(election.dateLabel).trim().split(' ');
    if (parts.length >= 2) {
      const shortMonth = parts[0].slice(0, 3);
      const day = parts[1].replace(',', '');
      return `${shortMonth} ${day}`;
    }
    return election.dateLabel;
  }
  if (election.startTime || election.date) {
    try {
      const d = new Date(election.startTime || election.date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (err) {}
  }
  return 'Soon';
}

/**
 * Seeded Mock Elections Dataset
 * Test dates aligned realistically relative to today (August 19, 2026)
 */
export const mockElections = [
  {
    id: 'src',
    icon: '🏛️',
    title: '2026 SRC Executive Council Elections',
    type: 'src',
    tier: 'SRC',
    startTime: new Date(Date.now() - 24 * 3600000),
    endTime: new Date(Date.now() + 2 * 86400000),
    date: new Date(Date.now() - 24 * 3600000),
    dateLabel: 'August 21, 2026',
    target: 'All Active Students',
    active: true,
    status: 'ACTIVE'
  },
  {
    id: 'dept',
    icon: '🏢',
    title: 'DEPARTMENT & COLLEGE ELECTIONS',
    type: 'department',
    tier: 'DEPARTMENT',
    startTime: new Date(Date.now() - 24 * 3600000),
    endTime: new Date(Date.now() + 3 * 86400000),
    date: new Date(Date.now() - 24 * 3600000),
    dateLabel: 'August 22, 2026',
    target: 'CoE & Computer Engineering Students',
    active: true,
    status: 'ACTIVE'
  },
  {
    id: 'const',
    icon: '🗳️',
    title: 'CONSTITUENCY PARLIAMENTARY ELECTIONS',
    type: 'constituency',
    tier: 'CONSTITUENCY',
    startTime: new Date(Date.now() - 12 * 3600000),
    endTime: new Date(Date.now() + 4 * 86400000),
    date: new Date(Date.now() - 12 * 3600000),
    dateLabel: 'August 26, 2026',
    target: 'Selected Constituency Voters',
    active: true,
    status: 'ACTIVE'
  },
  {
    id: 'hall',
    icon: '🏰',
    title: 'HALL OF RESIDENCE ELECTIONS',
    type: 'hall',
    tier: 'HALL',
    startTime: new Date(Date.now() - 12 * 3600000),
    endTime: new Date(Date.now() + 5 * 86400000),
    date: new Date(Date.now() - 12 * 3600000),
    dateLabel: 'August 28, 2026',
    target: 'Unity Hall Residents/Affiliates',
    active: true,
    status: 'ACTIVE'
  }
];

/**
 * Merge raw database election records with seeded mock election definitions
 * Ensures startTime, endTime, dateLabel, icon, and tier are always populated accurately.
 */
export function mergeWithMockElections(dbElections = []) {
  let storedStatusMap = {};
  try {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem('knust_elections_status');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => { storedStatusMap[item.id] = item.status; });
      }
    }
  } catch (e) {}

  const baseElections = mockElections.map(m => ({
    ...m,
    status: storedStatusMap[m.id] || m.status
  }));

  if (!Array.isArray(dbElections) || dbElections.length === 0) {
    return baseElections;
  }

  const mockMap = {};
  mockElections.forEach(m => {
    mockMap[m.id] = m;
    mockMap[m.type] = m;
  });

  const merged = dbElections.map(e => {
    const type = e.tier?.toLowerCase() || (
      e.title?.toLowerCase().includes('department') ? 'department' :
      e.title?.toLowerCase().includes('src') ? 'src' :
      e.title?.toLowerCase().includes('constituency') ? 'constituency' : 'hall'
    );
    const mock = mockMap[e.election_id] || mockMap[e.id] || mockMap[type] || mockElections[0];

    const startTime = e.start_time ? new Date(e.start_time) : mock.startTime;
    const endTime = e.end_time ? new Date(e.end_time) : mock.endTime;

    return {
      ...mock,
      ...e,
      id: e.election_id || e.id || mock.id,
      title: e.title || mock.title,
      description: e.description || mock.description,
      type: mock.type || type,
      tier: e.tier || mock.tier,
      startTime,
      endTime,
      date: startTime,
      dateLabel: mock.dateLabel,
      icon: mock.icon,
      target: mock.target,
      active: e.is_active ?? mock.active,
      status: e.status || mock.status,
      jurisdiction: e.electoral_jurisdictions || e.jurisdiction || null,
      hall_code: e.hall_code || mock.hall_code || null,
      college_code: e.college_code || mock.college_code || null,
      department_code: e.department_code || mock.department_code || null,
    };
  });

  const existingTypes = new Set(merged.map(m => m.type));
  mockElections.forEach(m => {
    if (!existingTypes.has(m.type)) {
      merged.push(m);
    }
  });

  return merged;
}

/**
 * Derive year of study from student profile
 * Supports: year_of_study, level (100=Y1, 200=Y2), or student_academic_sessions
 */
export function deriveYearOfStudy(student) {
  if (!student) return 1;
  if (typeof student.year_of_study === 'number') return student.year_of_study;
  if (student.level && typeof student.level === 'number') {
    return student.level === 100 ? 1 : Math.floor(student.level / 100);
  }

  const sessions = student.student_academic_sessions || [];
  if (Array.isArray(sessions) && sessions.length) {
    const current = sessions.find(s => s.is_current) || sessions[sessions.length - 1];
    if (current) {
      if (typeof current.year_of_study === 'number') return current.year_of_study;
      if (current.level) {
        const lvl = Number(current.level);
        if (!Number.isNaN(lvl)) return lvl === 100 ? 1 : Math.floor(lvl / 100);
      }
    }
  }
  return 1;
}

/**
 * Check if student is biometric-verified for current semester
 */
export function isBiometricVerified(student) {
  return Boolean(student?.biometrics_completed_current_semester);
}

/**
 * Determine election tier.
 * Prefers an explicit `tier` field; falls back to title/type inference.
 * Returns one of: 'SRC', 'DEPARTMENT', 'COLLEGE', 'CONSTITUENCY', 'HALL'
 */
export function getElectionTier(election) {
  if (!election) return 'SRC';

  const explicitTier = String(election.tier || '').toUpperCase();
  if (['SRC', 'DEPARTMENT', 'COLLEGE', 'CONSTITUENCY', 'HALL'].includes(explicitTier)) {
    return explicitTier;
  }

  const type = String(election.type || '').toUpperCase();
  const title = String(election.title || '').toUpperCase();

  if (type === 'SRC' || title.includes('SRC')) return 'SRC';
  if (type === 'DEPARTMENT' || title.includes('DEPARTMENT')) return 'DEPARTMENT';
  if (type === 'COLLEGE' || title.includes('COLLEGE')) return 'COLLEGE';
  if (type === 'CONSTITUENCY' || type === 'PARLIAMENTARY' || title.includes('CONSTITUENCY')) return 'CONSTITUENCY';
  if (type === 'HALL' || title.includes('HALL')) return 'HALL';

  // Fallback
  return 'SRC';
}

/**
 * Comprehensive election eligibility check
 * Returns: { eligible: boolean, reason?: string }
 */
export function checkElectionEligibility(student, election) {
  if (!student || !election) {
    return { eligible: false, reason: 'Missing student or election data' };
  }

  // Step 1: All elections require biometric verification
  if (!isBiometricVerified(student)) {
    return { eligible: false, reason: 'Biometrics verification pending' };
  }

  const electionTier = getElectionTier(election);
  const electionType = electionTier.toLowerCase();
  const yearOfStudy = deriveYearOfStudy(student);

  // Step 2: SRC Election - ALL active biometric-verified students
  if (electionType === 'src') {
    return { eligible: true };
  }

  // Step 3: College/Department Election - Filtered by college_code + department_code
  if (electionType === 'department' || electionType === 'college') {
    const studentCollege = String(student.college_code || '').toUpperCase();
    const studentDept = String(student.department_code || '').toUpperCase();
    const electionCollege = String(election.college_code || '').toUpperCase();
    const electionDept = String(election.department_code || '').toUpperCase();

    // Must match college
    if (electionCollege && studentCollege !== electionCollege) {
      return {
        eligible: false,
        reason: `Only ${electionCollege} students can vote`
      };
    }

    // If election specifies a department, student must match
    if (electionDept && studentDept !== electionDept) {
      return {
        eligible: false,
        reason: `Only ${electionDept} students can vote`
      };
    }

    return { eligible: true };
  }

  // Step 4: Constituency Election - Filtered by locked constituency
  if (electionType === 'constituency' || electionType === 'parliamentary') {
    const studentConstituency = String(student.constituency || student.constituency_locked || '').trim();

    if (!studentConstituency) {
      return {
        eligible: false,
        reason: 'Constituency not selected. Complete constituency selection first.'
      };
    }

    const electionConstituency = String(election.constituency || election.code || '').trim().toLowerCase();
    if (electionConstituency) {
      const normalizedStudent = studentConstituency.toLowerCase().replace(/ constituency$/i, '');
      const normalizedElection = electionConstituency.replace(/ constituency$/i, '');
      if (normalizedStudent !== normalizedElection) {
        return {
          eligible: false,
          reason: `Only ${election.constituency || electionConstituency} constituency voters can vote`
        };
      }
    }

    return { eligible: true };
  }

  // Step 5: Hall Election - STRICTLY FIRST-YEAR (LEVEL 100) RESIDENT ONLY
  if (electionType === 'hall') {
    if (yearOfStudy !== 1) {
      return {
        eligible: false,
        reason: 'Hall elections are restricted strictly to Level 100 resident students. Continuing students vote in Off-Campus / Constituency elections.'
      };
    }

    // Check hall match
    const studentHall = String(student.hall_code || '').toUpperCase();
    const electionHall = String(election.hall_code || '').toUpperCase();

    if (electionHall && studentHall !== electionHall) {
      return {
        eligible: false,
        reason: `Only ${electionHall} residents can vote in this election`
      };
    }

    return { eligible: true };
  }

  // Default: eligible if biometrically verified
  return { eligible: true };
}

/**
 * Get the dynamic card state for an election based on the student's session profile.
 * Drives the First-Year Hall Rule card filtering on the dashboard.
 * Returns: {
 *   tier, isFirstYear, showHallCard, eligible, eligibility, hallCode, badge
 * }
 */
export function getElectionCardState(student, election) {
  const tier = getElectionTier(election);
  const isFirstYear = deriveYearOfStudy(student) === 1;
  const eligibility = checkElectionEligibility(student, election);

  // Hall elections are dynamic:
  //  - First-years: show their specific hall card (eligible or gated by hall match)
  //  - Non-first-years: render in a disabled state with the first-year-only badge
  let showHallCard = true;
  let showcase = true;
  let badge = null;

  if (tier === 'HALL') {
    if (!isFirstYear) {
      showHallCard = true; // render in disabled state
      showcase = false;
      badge = 'Ineligible — Continuing Student';
    } else {
      showHallCard = true;
      showcase = true;
    }
  }

  return {
    tier,
    isFirstYear,
    showHallCard,
    showcase,
    eligible: eligibility.eligible,
    eligibility,
    hallCode: student?.hall_code || null,
    badge
  };
}

/**
 * Get all eligible elections for a student
 */
export function getEligibleElections(student, elections = []) {
  return elections.map(election => ({
    ...election,
    eligibility: checkElectionEligibility(student, election)
  }));
}

export function isConstituencyMatch(studentConst, jurisdictions = []) {
  if (!jurisdictions || jurisdictions.length === 0) return true; // no restriction
  if (!studentConst) return false;
  const locked = String(studentConst).toLowerCase();
  for (const j of jurisdictions) {
    if (!j) continue;
    // support multiple possible shapes: { constituency }, { code }
    if (j.constituency && String(j.constituency).toLowerCase() === locked) return true;
    if (j.code && String(j.code).toLowerCase() === locked) return true;
  }
  return false;
}

export function getRequiredPositionsMap(requiredPositionsArray = []) {
  // requiredPositionsArray: [{ position, required: boolean }]
  const map = {};
  for (const r of requiredPositionsArray) {
    if (!r || !r.position) continue;
    map[r.position] = Boolean(r.required);
  }
  return map;
}

export function getMissingRequiredPositions(selections = {}, positions = [], requiredMap = null) {
  // positions: array of position names available on the ballot
  // requiredMap: object { position: boolean } - if null, treat all positions as required
  const missing = [];
  for (const p of positions) {
    const required = requiredMap ? Boolean(requiredMap[p]) : true;
    if (!required) continue;
    if (!selections || selections[p] == null) missing.push(p);
  }
  return missing;
}
