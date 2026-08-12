# Voter Dashboard & Dynamic Eligibility Engine — Implementation Checklist

## Phase: First-Year Hall Rule & Dynamic Eligibility

### 1. Academic Year & Level Detector / Dynamic Eligibility Engine
- [x] Add `tier` column to `elections` table (SRC, DEPARTMENT, COLLEGE, CONSTITUENCY, HALL)
- [x] Add `hall_code`, `college_code`, `department_code`, `year_of_study`, `level`, `biometrics_completed_current_semester` columns to `student_academic_sessions`
- [x] Refactor `src/lib/eligibility.js` to use explicit `getElectionTier()`
- [x] Add `getElectionCardState()` helper for dynamic card filtering

### 2. Dynamic Election Cards Filtering
- [x] Hall Election card rendered in **disabled state** for non-first-years with badge: "Ineligible: Hall elections are restricted to First-Year students only."
- [x] First-year students see their specific Hall Election card alongside SRC and Departmental elections

### 3. Biometric & Status Checker Card
- [x] Top Status Banner: Student Name & ID, Program & Academic Level, Assigned Hall
- [x] Biometric Badge: Green "Current Semester Verified" vs Red "Biometrics Pending"

### 4. Styling
- [x] Add `.sv-badge-green` (green verified) and `.sv-badge-red` (red pending) to `SecureVote.css`

### 5. Verification
- [x] Run `npm run build` to verify no errors
