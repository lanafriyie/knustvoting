// eligibility.js
// Utility helpers for election eligibility and ballot completeness

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
    const studentConstituency = String(student.constituency_locked || '').toLowerCase();
    const electionConstituency = String(election.constituency || election.code || '').toLowerCase();

    if (!studentConstituency) {
      return {
        eligible: false,
        reason: 'Constituency not selected. Complete constituency selection first.'
      };
    }

    if (electionConstituency && studentConstituency !== electionConstituency) {
      return {
        eligible: false,
        reason: `Only ${electionConstituency} constituency voters can vote`
      };
    }

    return { eligible: true };
  }

  // Step 5: Hall Election - STRICTLY FIRST-YEAR ONLY
  if (electionType === 'hall') {
    if (yearOfStudy !== 1) {
      return {
        eligible: false,
        reason: 'Hall elections are restricted to First-Year students only'
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
      badge = 'Ineligible: Hall elections are restricted to First-Year students only.';
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
