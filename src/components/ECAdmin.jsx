import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import useECAuthContext from '../hooks/useECAuthContext';
import { useAdminAuth, EC_ADMIN_PRESETS } from '../context/AdminAuthContext';
import ECAdminRoleSwitcher from './ECAdminRoleSwitcher';
import RoomCreationModal from './RoomCreationModal';
import RoomMembersPanel from './RoomMembersPanel';
import { CandidateAgentObserverDemo } from './CandidateAgentRoom';
import { mockElections, mergeWithMockElections } from '../lib/eligibility';
import { 
  BarChart3, 
  Users, 
  FileText, 
  Zap, 
  TrendingUp, 
  ShieldCheck, 
  Building2, 
  Play, 
  Pause, 
  Lock, 
  Unlock, 
  Clock, 
  CheckCircle2, 
  X, 
  RefreshCw, 
  User, 
  Activity, 
  ArrowRight,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import '../styles/SecureVote.css';

const DEFAULT_POSITIONS_BY_TIER = {
  SRC: [
    'PRESIDENT',
    'VICE_PRESIDENT',
    'WOMEN_COMMISSIONER',
    'GENERAL_SECRETARY',
    'FINANCIAL_SECRETARY',
    'ORGANIZER',
  ],
  DEPARTMENT: [
    'PRESIDENT',
    'WOMEN_COMMISSIONER',
    'ORGANIZER',
    'FINANCIAL_SECRETARY',
    'GENERAL_SECRETARY',
  ],
  COLLEGE: [
    'COLLEGE_PRESIDENT',
    'COLLEGE_VICE_PRESIDENT',
    'COLLEGE_FINANCE',
    'COLLEGE_ORGANIZER',
  ],
  HALL: [
    'HALL_PRESIDENT',
    'HALL_SECRETARY',
    'HALL_FINANCE',
    'HALL_SPORTS_COMMISSIONER',
  ],
  CONSTITUENCY: [
    'MEMBER_OF_PARLIAMENT',
  ],
  PARLIAMENTARY: [
    'MEMBER_OF_PARLIAMENT',
  ],
  DEFAULT: [
    'CHAIRPERSON',
    'VICE_CHAIR',
    'SECRETARY',
    'FINANCIAL_SECRETARY',
    'ORGANIZER',
  ],
};

const INITIAL_AUDIT_LOGS = [
  {
    id: 'log-001',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    event_type: 'POLL_STATUS_OVERRIDE',
    actor: 'EC Commissioner Kwame Appiah (ID: EC-HEAD-01)',
    description: 'Poll status overridden from SCHEDULED to ACTIVE for 2026 SRC Executive Council Elections.',
    hash: '8f4c2e9b1a0d3f6e8b7c5a2d4e1f9b0a3c5d7e9f1a2b3c4d5e6f7a8b9c0d1e2f',
    severity: 'INFO',
    category: 'STATUS_OVERRIDE',
    tier: 'SRC',
  },
  {
    id: 'log-002',
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    event_type: 'CANDIDATE_VETTING',
    actor: 'Officer Francis Mensah (ID: EC-COE-02)',
    description: 'Candidate Emmanuel Boakye verified and certified for Department President portfolio.',
    hash: '3a1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    severity: 'INFO',
    category: 'CANDIDATE_VETTING',
    tier: 'DEPARTMENT',
  },
  {
    id: 'log-003',
    timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    event_type: 'TAMPER_CHECK_PASS',
    actor: 'Automated Cryptographic Ledger Daemon',
    description: 'SHA-256 integrity audit: 100% blocks verified. Zero ledger anomalies or collision detected.',
    hash: 'a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8',
    severity: 'SECURITY',
    category: 'SYSTEM',
    tier: 'ALL',
  },
  {
    id: 'log-004',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    event_type: 'ENCRYPTED_VOTE_CAST',
    actor: 'Anonymous Voter Envelope (Zero-Knowledge)',
    description: 'Encrypted vote receipt batch [REC-89A0F2B] registered to anonymous ballot ledger.',
    hash: '4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
    severity: 'INFO',
    category: 'ENCRYPTED_VOTE',
    tier: 'SRC',
  },
  {
    id: 'log-005',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    event_type: 'BALLOT_CONFIG_UPDATE',
    actor: 'Commissioner Yaa Serwaa (ID: EC-HALL-03)',
    description: 'Unity Hall First-Year Residency rule validated: Mandatory Level 100 verification filter enabled.',
    hash: '7e6f5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e',
    severity: 'INFO',
    category: 'BALLOT_CONFIG',
    tier: 'HALL',
  },
];

const INITIAL_CANDIDATES = [
  {
    id: 'cand-001',
    election_id: 'src',
    full_name: 'Emmanuel Boakye',
    student_id: '20814912',
    position: 'PRESIDENT',
    slate: 'The Vanguard Slate',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Digital Campus infrastructure, Wi-Fi overhaul, and rapid grievance settlement.',
    votes: 14230,
    disqualification_reason: null,
  },
  {
    id: 'cand-002',
    election_id: 'src',
    full_name: 'Serwaa Akoto Boateng',
    student_id: '20793210',
    position: 'PRESIDENT',
    slate: 'Renaissance Coalition',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Transparency in hostel price regulation, bursary funding, and student welfare.',
    votes: 11420,
    disqualification_reason: null,
  },
  {
    id: 'cand-003',
    election_id: 'src',
    full_name: 'Kofi Mensah Mensah',
    student_id: '20658421',
    position: 'PRESIDENT',
    slate: 'Integrity Alliance',
    status: 'DISQUALIFIED',
    photo_url: '',
    manifesto: 'Inclusive student leadership and subsidized shuttle fleet expansion.',
    votes: 0,
    disqualification_reason: 'Academic Standing (CWA < 60.0 statutory requirement)',
  },
  {
    id: 'cand-004',
    election_id: 'src',
    full_name: 'Abena Osei Poku',
    student_id: '20845129',
    position: 'VICE_PRESIDENT',
    slate: 'The Vanguard Slate',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Academic mentoring networks and round-the-clock library resource access.',
    votes: 16800,
    disqualification_reason: null,
  },
  {
    id: 'cand-005',
    election_id: 'src',
    full_name: 'Kwabena Appiah',
    student_id: '20712398',
    position: 'VICE_PRESIDENT',
    slate: 'Renaissance Coalition',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Career incubator funding and campus safety light corridors.',
    votes: 9840,
    disqualification_reason: null,
  },
  {
    id: 'cand-006',
    election_id: 'src',
    full_name: 'Akua Mansa',
    student_id: '20894512',
    position: 'WOMEN_COMMISSIONER',
    slate: 'Independent',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Empowering female student entrepreneurs and sanitary supply stations.',
    votes: 18450,
    disqualification_reason: null,
  },
  {
    id: 'cand-007',
    election_id: 'src',
    full_name: 'Yaa Asantewaa Bonsu',
    student_id: '20743219',
    position: 'WOMEN_COMMISSIONER',
    slate: 'The Vanguard Slate',
    status: 'PENDING_REVIEW',
    photo_url: '',
    manifesto: 'STEM mentorship and gender inclusivity symposiums.',
    votes: 8200,
    disqualification_reason: null,
  },
  {
    id: 'cand-008',
    election_id: 'dept',
    full_name: 'Felix Darko',
    student_id: '20938471',
    position: 'PRESIDENT',
    slate: 'CoE Pioneers',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Computer Engineering lab modernizations and hackathons.',
    votes: 4210,
    disqualification_reason: null,
  },
  {
    id: 'cand-009',
    election_id: 'dept',
    full_name: 'Priscilla Mensah',
    student_id: '20912384',
    position: 'PRESIDENT',
    slate: 'Innovate CoE',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Software licenses and industry internships for engineering students.',
    votes: 2630,
    disqualification_reason: null,
  },
  {
    id: 'cand-010',
    election_id: 'hall',
    full_name: 'Richmond Ofori',
    student_id: '20812345',
    position: 'HALL_PRESIDENT',
    slate: 'Unity Continentals',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Hall maintenance, water pressure pumps, and Continental heritage week.',
    votes: 1450,
    disqualification_reason: null,
  },
  {
    id: 'cand-011',
    election_id: 'const',
    full_name: 'Gifty Addo',
    student_id: '20789123',
    position: 'MEMBER_OF_PARLIAMENT',
    slate: 'Ayeduase Voice',
    status: 'VERIFIED',
    photo_url: '',
    manifesto: 'Street lighting in Ayeduase and hostel security patrols.',
    votes: 2890,
    disqualification_reason: null,
  },
];

export default function ECAdmin({ navigate }) {
  const { context } = useECAuthContext();
  const {
    ecAdminProfile,
    activePresetKey,
    hasPermission,
    isElectionInScope,
    getScopeRestrictionReason,
  } = useAdminAuth();

  const [activeTab, setActiveTab] = useState('analytics');
  const [elections, setElections] = useState(mockElections);
  const [selectedElectionId, setSelectedElectionId] = useState('src');

  // Candidate Vetting & Roster State
  const [candidates, setCandidates] = useState(INITIAL_CANDIDATES);
  const [candidateFilter, setCandidateFilter] = useState('ALL');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [disqualifyModal, setDisqualifyModal] = useState({
    isOpen: false,
    candidate: null,
    reason: 'Academic Standing (CWA < 60.0)',
    notes: '',
  });

  // Custom Position Mapping State
  const [customPositions, setCustomPositions] = useState([]);
  const [newCustomPosition, setNewCustomPosition] = useState('');

  // Ballot Creation Form State
  const [ballotForm, setBallotForm] = useState({
    title: '',
    tier: 'SRC',
    start_time: '',
    end_time: '',
    expected_voters: 68400,
    jurisdiction_name: 'All Registered Students',
    require_all_positions: true,
    randomize_candidates: true,
    hall_first_year_only: false,
  });
  const [ballotSuccessMessage, setBallotSuccessMessage] = useState(null);
  const [showBallotPreview, setShowBallotPreview] = useState(false);

  // Status Override State
  const [statusOverrideReason, setStatusOverrideReason] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [logFilter, setLogFilter] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');

  // Rooms Management State
  const [createdRooms, setCreatedRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [observerDemoMode, setObserverDemoMode] = useState('roster');

  // Tally Chamber & Decryption State
  const [tallyDecrypted, setTallyDecrypted] = useState(false);
  const [tallyResults, setTallyResults] = useState(null);
  const [publishFeedback, setPublishFeedback] = useState(null);

  // Telemetry Refresh Pulse
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Auto-switch to in-scope election when preset changes if current election is out of scope
  useEffect(() => {
    const currentElection = elections.find(e => e.id === selectedElectionId);
    if (currentElection && !isElectionInScope(currentElection)) {
      const inScope = elections.find(e => isElectionInScope(e));
      if (inScope) {
        setSelectedElectionId(inScope.id);
      }
    }
  }, [activePresetKey, elections, isElectionInScope, selectedElectionId]);

  // Load elections and rooms from database
  useEffect(() => {
    let mounted = true;
    async function fetchElectionsAndRooms() {
      try {
        const { data: electionData } = await supabase
          .from('elections')
          .select('*, electoral_jurisdictions(*)');
        if (electionData && electionData.length > 0 && mounted) {
          setElections(mergeWithMockElections(electionData));
        }

        const { data: roomData } = await supabase
          .from('election_rooms')
          .select('*')
          .order('created_at', { ascending: false });
        if (roomData && mounted) {
          setCreatedRooms(roomData);
        }
      } catch (err) {
        // Fallback to local mock data
      }
    }
    fetchElectionsAndRooms();
    return () => {
      mounted = false;
    };
  }, []);

  // Periodic Telemetry Pulse
  useEffect(() => {
    const timer = setInterval(() => {
      setLastRefreshedAt(new Date());
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const selectedElection = useMemo(() => {
    return elections.find((e) => e.id === selectedElectionId) || elections[0] || mockElections[0];
  }, [elections, selectedElectionId]);

  // Scope verification for currently selected election
  const isCurrentElectionInScope = isElectionInScope(selectedElection);
  const scopeRestrictionReason = getScopeRestrictionReason(selectedElection);

  // Positions available for current tier
  const currentTier = selectedElection?.tier || 'SRC';
  const availablePositions = useMemo(() => {
    const base = DEFAULT_POSITIONS_BY_TIER[currentTier] || DEFAULT_POSITIONS_BY_TIER.DEFAULT;
    return [...new Set([...base, ...customPositions])];
  }, [currentTier, customPositions]);

  // Record Audit Log helper
  const recordAuditLog = (eventType, description, severity = 'INFO', category = 'GENERAL') => {
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event_type: eventType,
      actor: `${ecAdminProfile.name} (${ecAdminProfile.roleTitle})`,
      description,
      hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      severity,
      category,
      tier: selectedElection?.tier || 'ALL',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // ── Handlers: Status Overrides ──
  const handleStatusOverride = async (actionType) => {
    if (!isCurrentElectionInScope) {
      alert(`Access Denied: You do not have jurisdiction to modify ${selectedElection.tier} elections. Scope restricted to: ${ecAdminProfile.assignedJurisdiction.name}`);
      return;
    }
    if (!hasPermission('OVERRIDE_POLLS')) {
      alert(`Access Denied: Your officer role lacks OVERRIDE_POLLS permission.`);
      return;
    }

    setActionLoading(true);
    let newStatus = selectedElection.status || 'ACTIVE';
    let statusDesc = '';

    if (actionType === 'OPEN_POLLS') {
      newStatus = 'ACTIVE';
      statusDesc = `Polls forcefully OPENED across all stations for election: "${selectedElection.title}"`;
    } else if (actionType === 'PAUSE_POLLS') {
      newStatus = 'PAUSED';
      statusDesc = `Emergency PAUSE triggered for election: "${selectedElection.title}". Reason: ${statusOverrideReason || 'Routine Technical Audit'}`;
    } else if (actionType === 'CLOSE_POLLS') {
      newStatus = 'CLOSED';
      statusDesc = `Polls CONCLUDED and CLOSED for election: "${selectedElection.title}". Ledger locked for final decryption.`;
    } else if (actionType === 'EXTEND_1H') {
      statusDesc = `Voting window EXTENDED by +1 hour for election: "${selectedElection.title}". Reason: ${statusOverrideReason || 'High Queue Latency Extension'}`;
    }

    try {
      await supabase
        .from('elections')
        .update({ status: newStatus })
        .eq('election_id', selectedElection.id);
    } catch (e) {}

    setElections((prev) => {
      const updated = prev.map((el) => (el.id === selectedElection.id ? { ...el, status: newStatus } : el));
      try {
        localStorage.setItem('knust_elections_status', JSON.stringify(updated.map(e => ({ id: e.id, status: e.status }))));
        window.dispatchEvent(new CustomEvent('knust_elections_status_changed', { detail: updated }));
      } catch (e) {}
      return updated;
    });

    recordAuditLog(
      'POLL_STATUS_OVERRIDE',
      statusDesc,
      actionType === 'PAUSE_POLLS' ? 'WARNING' : 'INFO',
      'STATUS_OVERRIDE'
    );

    setStatusMessage(`Successfully executed status action: ${actionType}`);
    setStatusOverrideReason('');
    setActionLoading(false);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // ── Handlers: Candidate Vetting ──
  const handleVerifyCandidate = (candidateId) => {
    if (!isCurrentElectionInScope) {
      alert(`Access Denied: Cannot vet candidate outside assigned jurisdiction.`);
      return;
    }
    const cand = candidates.find((c) => c.id === candidateId);
    if (!cand) return;

    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, status: 'VERIFIED', disqualification_reason: null } : c))
    );

    recordAuditLog(
      'CANDIDATE_VETTING',
      `Candidate "${cand.full_name}" (ID: ${cand.student_id}) certified and VERIFIED for ballot placement in portfolio [${cand.position}].`,
      'INFO',
      'CANDIDATE_VETTING'
    );
  };

  const openDisqualifyModal = (candidate) => {
    if (!isCurrentElectionInScope) {
      alert(`Access Denied: Cannot disqualify candidate outside assigned jurisdiction.`);
      return;
    }
    setDisqualifyModal({
      isOpen: true,
      candidate,
      reason: 'Academic Standing (CWA < 60.0)',
      notes: '',
    });
  };

  const handleConfirmDisqualify = () => {
    const { candidate, reason, notes } = disqualifyModal;
    if (!candidate) return;

    const fullReason = notes ? `${reason} — Note: ${notes}` : reason;

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidate.id
          ? { ...c, status: 'DISQUALIFIED', disqualification_reason: fullReason }
          : c
      )
    );

    recordAuditLog(
      'CANDIDATE_DISQUALIFIED',
      `Candidate "${candidate.full_name}" (ID: ${candidate.student_id}) DISQUALIFIED from [${candidate.position}]. Reason: ${fullReason}`,
      'WARNING',
      'CANDIDATE_VETTING'
    );

    setDisqualifyModal({ isOpen: false, candidate: null, reason: '', notes: '' });
  };

  const handleReinstateCandidate = (candidateId) => {
    if (!isCurrentElectionInScope) {
      alert(`Access Denied: Cannot reinstate candidate outside assigned jurisdiction.`);
      return;
    }
    const cand = candidates.find((c) => c.id === candidateId);
    if (!cand) return;

    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, status: 'VERIFIED', disqualification_reason: null } : c))
    );

    recordAuditLog(
      'CANDIDATE_REINSTATED',
      `Candidate "${cand.full_name}" (ID: ${cand.student_id}) REINSTATED after review clearance for [${cand.position}].`,
      'INFO',
      'CANDIDATE_VETTING'
    );
  };

  // Add Candidate Form
  const [newCandidate, setNewCandidate] = useState({
    full_name: '',
    student_id: '',
    position: '',
    slate: '',
    manifesto: '',
    photo_url: '',
    status: 'VERIFIED',
  });

  const handleAddCandidate = (e) => {
    e.preventDefault();
    if (!isCurrentElectionInScope) {
      alert(`Access Denied: Cannot enroll candidate for an out-of-scope election.`);
      return;
    }
    if (!newCandidate.full_name || !newCandidate.position) return;

    const created = {
      id: `cand-${Date.now()}`,
      election_id: selectedElection.id,
      full_name: newCandidate.full_name,
      student_id: newCandidate.student_id || Math.floor(10000000 + Math.random() * 90000000).toString(),
      position: newCandidate.position,
      slate: newCandidate.slate || 'Independent',
      manifesto: newCandidate.manifesto || '',
      photo_url: newCandidate.photo_url || '',
      status: newCandidate.status,
      votes: 0,
      disqualification_reason: null,
    };

    setCandidates((prev) => [created, ...prev]);
    recordAuditLog(
      'CANDIDATE_ENROLLED',
      `Candidate "${created.full_name}" enrolled onto official roster for [${created.position}] with status ${created.status}.`,
      'INFO',
      'CANDIDATE_VETTING'
    );

    setNewCandidate({
      full_name: '',
      student_id: '',
      position: '',
      slate: '',
      manifesto: '',
      photo_url: '',
      status: 'VERIFIED',
    });
  };

  // ── Handlers: Custom Position Mapping ──
  const handleAddCustomPosition = (e) => {
    e.preventDefault();
    if (!newCustomPosition.trim()) return;
    const formatted = newCustomPosition.trim().toUpperCase().replace(/\s+/g, '_');
    if (!availablePositions.includes(formatted)) {
      setCustomPositions((prev) => [...prev, formatted]);
      recordAuditLog(
        'POSITION_MAPPED',
        `New portfolio "${formatted}" mapped to ${currentTier} election tier.`,
        'INFO',
        'BALLOT_CONFIG'
      );
    }
    setNewCustomPosition('');
  };

  // ── Handlers: Ballot Creator ──
  const handleCreateBallot = (e) => {
    e.preventDefault();
    if (!ballotForm.title.trim()) return;

    if (!ecAdminProfile.allowedTiers.includes(ballotForm.tier)) {
      alert(`Access Restricted: Your officer profile (${ecAdminProfile.badgeLabel}) does not have permission to deploy ballots for the ${ballotForm.tier} tier.`);
      return;
    }

    const newElectionObj = {
      id: `ballot-${Date.now()}`,
      title: ballotForm.title,
      tier: ballotForm.tier,
      type: ballotForm.tier.toLowerCase(),
      status: 'ACTIVE',
      startTime: ballotForm.start_time ? new Date(ballotForm.start_time) : new Date(),
      endTime: ballotForm.end_time ? new Date(ballotForm.end_time) : new Date(Date.now() + 86400000 * 2),
      target: ballotForm.jurisdiction_name,
      active: true,
      rules: {
        require_all_positions: ballotForm.require_all_positions,
        randomize_candidates: ballotForm.randomize_candidates,
        hall_first_year_only: ballotForm.hall_first_year_only,
      },
    };

    setElections((prev) => [newElectionObj, ...prev]);
    setSelectedElectionId(newElectionObj.id);

    recordAuditLog(
      'BALLOT_CREATED',
      `New official ballot created: "${newElectionObj.title}" [Tier: ${newElectionObj.tier}, Quorum: ${ballotForm.expected_voters.toLocaleString()}]. Envelopes initialized.`,
      'INFO',
      'BALLOT_CONFIG'
    );

    setBallotSuccessMessage(`Ballot "${newElectionObj.title}" created successfully and deployed to student voter portals.`);
    setTimeout(() => setBallotSuccessMessage(null), 6000);
  };

  // ── Handlers: Tally Decryption ──
  const handleTallyAndDecrypt = () => {
    const posTallies = {};
    candidates
      .filter((c) => c.status !== 'DISQUALIFIED')
      .forEach((c) => {
        if (!posTallies[c.position]) posTallies[c.position] = [];
        posTallies[c.position].push(c);
      });

    setTallyResults({
      decryptedAt: new Date().toISOString(),
      officer: `${ecAdminProfile.name} (${ecAdminProfile.roleTitle})`,
      ledgerHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      positions: posTallies,
    });
    setTallyDecrypted(true);

    recordAuditLog(
      'TALLY_DECRYPTED',
      `Ballot ledger decrypted and verified. Zero-knowledge checksum validated. Final certified vote aggregates compiled.`,
      'SECURITY',
      'SYSTEM'
    );
  };

  const handlePublishResults = () => {
    if (!isCurrentElectionInScope) {
      alert(`Access Denied: You cannot broadcast results for an election outside your jurisdiction scope.`);
      return;
    }
    setPublishFeedback('✅ Certified election results broadcasted live to Student AIM Mobile App & Public Ledger.');
    recordAuditLog(
      'RESULTS_PUBLISHED',
      `Official certified results for "${selectedElection.title}" broadcasted to all KNUST Student AIM portals and external auditor endpoints.`,
      'SECURITY',
      'STATUS_OVERRIDE'
    );
    setTimeout(() => setPublishFeedback(null), 7000);
  };

  // Export audit logs
  const handleExportAuditLogs = (format = 'json') => {
    const scopeLogs = auditLogs.filter(l => l.tier === 'ALL' || l.tier === currentTier || ecAdminProfile.id === 'OPTION_A');
    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(scopeLogs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `ec_audit_ledger_${currentTier.toLowerCase()}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      const headers = ['Timestamp', 'Event Type', 'Severity', 'Actor', 'Description', 'Hash', 'Tier'];
      const rows = scopeLogs.map((l) => [
        l.timestamp,
        `"${l.event_type}"`,
        l.severity,
        `"${l.actor}"`,
        `"${l.description.replace(/"/g, '""')}"`,
        l.hash,
        l.tier || 'ALL',
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `ec_audit_ledger_${currentTier.toLowerCase()}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  // ── Dynamic Turnout Metrics Based on Active Officer Scope ──
  const dynamicTurnout = useMemo(() => {
    if (ecAdminProfile.id === 'OPTION_B') {
      return {
        turnoutPercent: 72.0,
        ballotsCount: 6840,
        expectedVoters: 9500,
        activeSessions: 340,
        velocityRate: 48,
        scopeLabel: 'College of Engineering (CoE) / Computer Eng.',
        breakdown: [
          { name: 'Computer Engineering Dept', ballots: 2150, expected: 2800, percent: 76.8 },
          { name: 'Electrical/Electronic Dept', ballots: 1980, expected: 2750, percent: 72.0 },
          { name: 'Mechanical & Materials Dept', ballots: 1640, expected: 2450, percent: 66.9 },
          { name: 'Civil & Geomatic Engineering', ballots: 1070, expected: 1500, percent: 71.3 },
        ],
      };
    }
    if (ecAdminProfile.id === 'OPTION_C') {
      return {
        turnoutPercent: 69.5,
        ballotsCount: 6470,
        expectedVoters: 9300,
        activeSessions: 280,
        velocityRate: 36,
        scopeLabel: 'Unity Hall Residents & Ayeduase Constituency',
        breakdown: [
          { name: 'Unity Hall (First-Year Residents)', ballots: 2150, expected: 2800, percent: 76.8 },
          { name: 'Unity Hall (Affiliate Diaspora)', ballots: 1120, expected: 1800, percent: 62.2 },
          { name: 'Ayeduase Sector 1 (Off-Campus)', ballots: 1890, expected: 2600, percent: 72.7 },
          { name: 'Ayeduase Sector 2 (Hostel Hub)', ballots: 1310, expected: 2100, percent: 62.4 },
        ],
      };
    }
    // Default Option A: Campus-Wide
    return {
      turnoutPercent: 64.8,
      ballotsCount: 44355,
      expectedVoters: 68400,
      activeSessions: 1420,
      velocityRate: 185,
      scopeLabel: 'University-Wide (SRC Executive)',
      breakdown: [
        { name: 'Ayeduase Central Polling Station', ballots: 12450, expected: 18200, percent: 68.4 },
        { name: 'Traditional Halls (Unity, Queen, Africa, Katanga)', ballots: 14200, expected: 21000, percent: 67.6 },
        { name: 'Bomso & Kotei Commercial Sector', ballots: 8940, expected: 14500, percent: 61.7 },
        { name: 'Kentinkrono & Gaza Polling Station', ballots: 5120, expected: 8200, percent: 62.4 },
        { name: 'Brunei Complex & Diaspora Hub', ballots: 3645, expected: 6500, percent: 56.1 },
      ],
    };
  }, [ecAdminProfile.id]);

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Filter by election
      const matchElection = !selectedElection || c.election_id === selectedElection.id;
      const matchPosition = candidateFilter === 'ALL' || c.position === candidateFilter;
      const matchSearch =
        !candidateSearch.trim() ||
        c.full_name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.student_id.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.slate.toLowerCase().includes(candidateSearch.toLowerCase());
      return matchElection && matchPosition && matchSearch;
    });
  }, [candidates, selectedElection, candidateFilter, candidateSearch]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((l) => {
      const matchCategory = logFilter === 'ALL' || l.category === logFilter || l.severity === logFilter;
      const matchSearch =
        !logSearch.trim() ||
        l.description.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.event_type.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.actor.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.hash.toLowerCase().includes(logSearch.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [auditLogs, logFilter, logSearch]);

  const currentElectionStatus = selectedElection ? selectedElection.status || 'ACTIVE' : 'ACTIVE';

  return (
    <div className="ec-admin-dashboard max-w-7xl mx-auto space-y-6 pb-20 text-[#202522] dark:text-slate-100">

      {/* ── TOP HEADER BAR: Institutional Identity & EC Admin Role Switcher ── */}
      <div className="knust-glass-card relative z-30 border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-[#007A4D] text-white flex items-center justify-center shadow-md border border-[#0B7A53] flex-shrink-0">
            <User size={26} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#007A4D] dark:text-emerald-400 bg-[#EAF6F0] dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-[#007A4D]/20">
                Electoral Commission Oversight
              </span>

              {/* Prominent Active Officer Jurisdiction Badge */}
              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-md border shadow-2xs ${
                ecAdminProfile.badgeVariant === 'src'
                  ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800'
                  : ecAdminProfile.badgeVariant === 'dept'
                  ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'
              }`}>
                [{ecAdminProfile.badgeLabel}]
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#202522] dark:text-slate-100 tracking-tight mt-1">
              EC Management Command Center
            </h1>

            <p className="text-xs text-[#66716C] dark:text-slate-400 mt-0.5">
              Active Officer: <strong className="text-[#202522] dark:text-slate-200">{ecAdminProfile.name}</strong> · Role: <strong className="text-[#007A4D] dark:text-emerald-400">{ecAdminProfile.roleTitle}</strong>
            </p>
          </div>
        </div>

        {/* Top Right: Demo Auth Role Switcher & Create Room */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {/* EC Admin Demo Role Switcher Dropdown */}
          <ECAdminRoleSwitcher />

          <button
            type="button"
            onClick={() => setRoomModalOpen(true)}
            className="px-3.5 py-2 bg-[#007A4D] hover:bg-[#075C42] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            + Create Room
          </button>
        </div>
      </div>

      {/* ── Election Scope Selector Bar & Jurisdiction Boundaries Notice ── */}
      <div className="knust-glass-card relative z-20 border border-[#DDE5E1] dark:border-slate-700 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#66716C] dark:text-slate-400 whitespace-nowrap">
            Selected Election:
          </span>
          <select
            value={selectedElectionId || ''}
            onChange={(e) => setSelectedElectionId(e.target.value)}
            className="flex-1 sm:w-96 bg-[#F3FAF6] dark:bg-slate-900 text-[#202522] dark:text-slate-100 border border-[#DDE5E1] dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#007A4D]"
          >
            {elections.map((el) => {
              const inScope = isElectionInScope(el);
              return (
                <option key={el.id} value={el.id}>
                  {inScope ? '✓ ' : '[Locked - Outside Scope] '} {el.title} [{el.status || 'ACTIVE'}]
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Poll Status:</span>
          <span
            className={`px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${
              currentElectionStatus === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                : currentElectionStatus === 'PAUSED'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
            }`}
          >
            {currentElectionStatus === 'ACTIVE' ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                <span>POLLS OPEN</span>
              </span>
            ) : currentElectionStatus === 'PAUSED' ? (
              <span className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                <Pause size={10} className="inline mr-1" />
                <span>POLLS PAUSED</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-400">
                <Lock size={10} className="inline mr-1" />
                <span>POLLS CLOSED</span>
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ── RESTRICTION BANNER (When viewing Out-of-Scope Election) ── */}
      {!isCurrentElectionInScope && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 flex items-start gap-3.5 shadow-sm animate-fadeIn">
          <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1 text-xs">
            <h4 className="font-black text-amber-900 dark:text-amber-300 uppercase tracking-wide">
              Restricted — Outside Assigned Jurisdiction ({ecAdminProfile.assignedJurisdiction.name} Only)
            </h4>
            <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
              You are currently inspecting <strong>"{selectedElection.title}"</strong> ({selectedElection.tier} Tier). Your active officer profile (<strong>{ecAdminProfile.name}</strong>) is restricted to <strong>{ecAdminProfile.assignedJurisdiction.name}</strong>. Administrative actions (candidate vetting, status overrides, and candidate enrollment) for this election are locked in accordance with electoral commission bylaws.
            </p>
          </div>
        </div>
      )}

      {/* ── Navigation Tab Bar ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#DDE5E1] dark:border-slate-700">
        {[
          { key: 'analytics', label: 'Live Turnout Analytics', icon: BarChart3 },
          { key: 'candidates', label: 'Candidate Roster & Vetting', icon: Users },
          { key: 'ballot-creator', label: 'Ballot Creator', icon: FileText },
          { key: 'status-overrides', label: 'Poll Status Overrides', icon: Zap },
          { key: 'live-tally', label: 'Anonymized Vote Counting', icon: TrendingUp },
          { key: 'health-logs', label: 'System Health & Audit Logs', icon: ShieldCheck },
          { key: 'rooms', label: 'Observer Rooms', icon: Building2 },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#007A4D] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-[#66716C] dark:text-slate-300 hover:text-[#007A4D] dark:hover:text-emerald-400 hover:bg-[#F3FAF6] dark:hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              <IconComponent size={14} className={isActive ? 'text-white' : 'text-[#66716C] dark:text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>


      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: LIVE TURNOUT ANALYTICS
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Active Jurisdiction Scope Indicator */}
          <div className="flex items-center justify-between text-xs px-1 text-slate-600 dark:text-slate-400">
            <span>
              Turnout Telemetry Scope: <strong className="text-[#007A4D] dark:text-emerald-400">{dynamicTurnout.scopeLabel}</strong>
            </span>
            <span>
              Live Auto-Refresh: <strong className="text-emerald-600">8s cycle</strong> (Updated: {lastRefreshedAt.toLocaleTimeString()})
            </span>
          </div>

          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#66716C] dark:text-slate-400 uppercase tracking-wider">
                  Live Turnout
                </span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  <Activity size={15} />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-[#202522] dark:text-slate-100 tracking-tight">
                  {dynamicTurnout.turnoutPercent}%
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                  <span className="text-xs">▲ Active Pace</span> <span className="text-slate-400 font-normal">in assigned scope</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-[#007A4D] h-full rounded-full transition-all duration-500"
                  style={{ width: `${dynamicTurnout.turnoutPercent}%` }}
                />
              </div>
            </div>

            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#66716C] dark:text-slate-400 uppercase tracking-wider">
                  Ballots Cast
                </span>
                <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                  <FileText size={15} />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-[#202522] dark:text-slate-100 tracking-tight">
                  {dynamicTurnout.ballotsCount.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  of <strong>{dynamicTurnout.expectedVoters.toLocaleString()}</strong> registered voters
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-3 font-mono">
                Quorum threshold met ({dynamicTurnout.turnoutPercent}% &gt; 50%)
              </div>
            </div>

            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#66716C] dark:text-slate-400 uppercase tracking-wider">
                  Active Sessions
                </span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                  <Zap size={15} />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-[#202522] dark:text-slate-100 tracking-tight">
                  {dynamicTurnout.activeSessions.toLocaleString()}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                  Concurrent voting sockets
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-3 font-mono">
                Socket latency: 16ms (Optimal)
              </div>
            </div>

            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#66716C] dark:text-slate-400 uppercase tracking-wider">
                  Voting Velocity
                </span>
                <span className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                  <TrendingUp size={15} />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-[#202522] dark:text-slate-100 tracking-tight">
                  {dynamicTurnout.velocityRate} <span className="text-sm font-semibold text-slate-400">/min</span>
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-1">
                  Scope throughput sustained
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-3 font-mono">
                Load capacity: 22% nominal
              </div>
            </div>
          </div>

          {/* Regional & Constituency Turnout Progress Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                    Jurisdiction &amp; Sector Turnout Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time ballot casting volume for: <strong>{dynamicTurnout.scopeLabel}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLastRefreshedAt(new Date())}
                  className="px-3 py-1 bg-[#F3FAF6] dark:bg-slate-900 hover:bg-[#EAF6F0] text-xs font-bold text-[#007A4D] dark:text-emerald-400 rounded-lg border border-[#DDE5E1] dark:border-slate-700 cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={11} className="animate-spin-slow" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="space-y-3.5 pt-2">
                {dynamicTurnout.breakdown.map((item) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#202522] dark:text-slate-200">{item.name}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">
                        <strong>{item.ballots.toLocaleString()}</strong> / {item.expected.toLocaleString()} ({item.percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#007A4D] h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Voting Activity Timeline Sparkline & Summary */}
            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                  Hourly Polling Activity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Hourly voter check-in distribution
                </p>

                <div className="relative mt-6 p-2 pb-0 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 rounded-xl overflow-hidden">
                  {/* Subtle Gridlines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.07] py-4 px-2">
                    <div className="border-t border-dashed border-slate-500 w-full" />
                    <div className="border-t border-dashed border-slate-500 w-full" />
                    <div className="border-t border-dashed border-slate-500 w-full" />
                  </div>
                  
                  <div className="relative grid grid-cols-6 gap-3 h-32 items-end z-10 px-2">
                    {[
                      { hour: '08:00', val: 35, peak: false },
                      { hour: '10:00', val: 68, peak: false },
                      { hour: '12:00', val: 95, peak: true },
                      { hour: '14:00', val: 82, peak: false },
                      { hour: '16:00', val: 74, peak: false },
                      { hour: '18:00', val: 40, peak: false },
                    ].map((bar) => (
                      <div key={bar.hour} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                        {/* Value indicator on top */}
                        <span className={`text-[9px] font-mono font-extrabold ${bar.peak ? 'text-[#991B1B] dark:text-red-400' : 'text-slate-400 dark:text-slate-500'} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                          {bar.val}%
                        </span>
                        <div
                          className={`w-full rounded-t-lg transition-all duration-500 cursor-pointer shadow-inner ${
                            bar.peak
                              ? 'bg-gradient-to-t from-[#991B1B] via-[#007A4D] to-[#D4AF37]'
                              : 'bg-gradient-to-t from-[#063B2A] to-[#0B7A53]'
                          }`}
                          style={{ height: `${bar.val - 12}%` }}
                          title={`${bar.hour}: ${bar.val}% Turnout (~${(bar.val * (dynamicTurnout.expectedVoters / 100)).toFixed(0)} votes)`}
                        />
                        <span className={`text-[9px] font-bold font-mono pb-1 ${bar.peak ? 'text-[#991B1B] dark:text-red-400' : 'text-slate-500'}`}>
                          {bar.hour}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#DDE5E1] dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Auto-refresh: <strong className="text-emerald-600">8s interval</strong></span>
                <span>Active Scope: <strong>{ecAdminProfile.roleTier}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: CANDIDATE ROSTER EDITOR & VETTING TOGGLES
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'candidates' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Position Mapping & Portfolio Manager */}
          <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                  Position Portfolio Mapping ({currentTier} Tier)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Designate and map required ballot portfolios for candidate contestation
                </p>
              </div>

              <form onSubmit={handleAddCustomPosition} className="flex items-center gap-2">
                <input
                  type="text"
                  disabled={!isCurrentElectionInScope}
                  placeholder={isCurrentElectionInScope ? "e.g. PUBLIC_RELATIONS_OFFICER" : "Locked: Outside Scope"}
                  value={newCustomPosition}
                  onChange={(e) => setNewCustomPosition(e.target.value)}
                  className="bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#202522] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!isCurrentElectionInScope}
                  className="px-3.5 py-1.5 bg-[#007A4D] hover:bg-[#075C42] disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                >
                  + Add Portfolio
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {availablePositions.map((pos) => (
                <div
                  key={pos}
                  className="bg-[#EAF6F0] dark:bg-slate-900 text-[#075C42] dark:text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#007A4D]/30 flex items-center gap-2"
                >
                  <span>{pos.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] bg-[#007A4D] text-white px-1.5 py-0.2 rounded-full">
                    {candidates.filter((c) => c.position === pos).length} Cand.
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Candidate Roster Filter & Table */}
          <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#DDE5E1] dark:border-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                  Candidate Roster &amp; Vetting Controls ({filteredCandidates.length})
                </h3>
                {!isCurrentElectionInScope && (
                  <span className="text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 rounded font-bold border border-amber-300 flex items-center gap-1">
                    <Lock size={10} />
                    <span>Read-Only (Outside Assigned Jurisdiction)</span>
                  </span>
                )}
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Search candidate or ID..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-[#202522] dark:text-slate-100 focus:outline-none"
                />

                <select
                  value={candidateFilter}
                  onChange={(e) => setCandidateFilter(e.target.value)}
                  className="bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-[#202522] dark:text-slate-100 focus:outline-none"
                >
                  <option value="ALL">All Portfolios</option>
                  {availablePositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Candidate Roster Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#DDE5E1] dark:border-slate-700 text-[#66716C] dark:text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Candidate</th>
                    <th className="py-3 px-3">Portfolio</th>
                    <th className="py-3 px-3">Affiliation / Slate</th>
                    <th className="py-3 px-3">Vetting Status</th>
                    <th className="py-3 px-3 text-right">EC Vetting Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5E1] dark:divide-slate-700/60 font-medium">
                  {filteredCandidates.map((cand) => {
                    const isDisqualified = cand.status === 'DISQUALIFIED';
                    const isPending = cand.status === 'PENDING_REVIEW';
                    const isVerified = cand.status === 'VERIFIED';

                    return (
                      <tr
                        key={cand.id}
                        className={isDisqualified ? 'bg-red-50/40 dark:bg-red-950/20' : 'hover:bg-[#F3FAF6] dark:hover:bg-slate-700/30'}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#007A4D] text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                              {cand.photo_url ? (
                                <img src={cand.photo_url} alt={cand.full_name} className="w-full h-full object-cover" />
                              ) : (
                                cand.full_name
                                  .split(' ')
                                  .map((w) => w[0])
                                  .join('')
                                  .slice(0, 2)
                              )}
                            </div>
                            <div>
                              <div className="font-extrabold text-[#202522] dark:text-slate-100 flex items-center gap-1.5">
                                {cand.full_name}
                                {isDisqualified && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold rounded">
                                    Disqualified
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                ID: {cand.student_id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-bold text-[#075C42] dark:text-emerald-400">
                          {cand.position.replace(/_/g, ' ')}
                        </td>

                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {cand.slate}
                        </td>

                        <td className="py-3 px-3">
                          {isVerified && (
                            <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-extrabold text-[10px] border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 w-max">
                              <CheckCircle2 size={10} />
                              <span>VERIFIED ON BALLOT</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-extrabold text-[10px] border border-amber-300 dark:border-amber-700 flex items-center gap-1 w-max">
                              <Clock size={10} />
                              <span>PENDING VETTING</span>
                            </span>
                          )}
                          {isDisqualified && (
                            <div className="space-y-0.5">
                              <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-extrabold text-[10px] border border-red-300 dark:border-red-700 flex items-center gap-1 w-max">
                                <X size={10} />
                                <span>DISQUALIFIED</span>
                              </span>
                              {cand.disqualification_reason && (
                                <p className="text-[10px] text-red-600 dark:text-red-400 italic max-w-xs truncate">
                                  Reason: {cand.disqualification_reason}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isVerified && (
                              <button
                                type="button"
                                disabled={!isCurrentElectionInScope || !hasPermission('VERIFY_CANDIDATES')}
                                onClick={() => handleVerifyCandidate(cand.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[11px] cursor-pointer transition-colors shadow-2xs"
                                title={!isCurrentElectionInScope ? 'Action Disabled: Outside Assigned Jurisdiction Scope' : 'Approve candidate for ballot appearance'}
                              >
                                Verify
                              </button>
                            )}

                            {!isDisqualified && (
                              <button
                                type="button"
                                disabled={!isCurrentElectionInScope || !hasPermission('DISQUALIFY_CANDIDATES')}
                                onClick={() => openDisqualifyModal(cand)}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[11px] cursor-pointer transition-colors shadow-2xs"
                                title={!isCurrentElectionInScope ? 'Action Disabled: Outside Assigned Jurisdiction Scope' : 'Strike candidate from official ballot'}
                              >
                                Disqualify
                              </button>
                            )}

                            {isDisqualified && (
                              <button
                                type="button"
                                disabled={!isCurrentElectionInScope || !hasPermission('DISQUALIFY_CANDIDATES')}
                                onClick={() => handleReinstateCandidate(cand.id)}
                                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[11px] cursor-pointer transition-colors shadow-2xs"
                                title={!isCurrentElectionInScope ? 'Action Disabled: Outside Assigned Jurisdiction Scope' : 'Reinstate candidate after appeal clearance'}
                              >
                                Reinstate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Candidate Form Accordion */}
          <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                Enroll Candidate onto Official Roster
              </h3>
              {!isCurrentElectionInScope && (
                <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                  <Lock size={12} />
                  <span>Locked (Outside assigned {ecAdminProfile.assignedJurisdiction.tier} scope)</span>
                </span>
              )}
            </div>

            <form onSubmit={handleAddCandidate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isCurrentElectionInScope}
                  placeholder="e.g. Kwame Antwi Boateng"
                  value={newCandidate.full_name}
                  onChange={(e) => setNewCandidate((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Student Index / ID
                </label>
                <input
                  type="text"
                  disabled={!isCurrentElectionInScope}
                  placeholder="e.g. 20894512"
                  value={newCandidate.student_id}
                  onChange={(e) => setNewCandidate((prev) => ({ ...prev, student_id: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Contesting Portfolio *
                </label>
                <select
                  required
                  disabled={!isCurrentElectionInScope}
                  value={newCandidate.position}
                  onChange={(e) => setNewCandidate((prev) => ({ ...prev, position: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
                >
                  <option value="">Select Portfolio...</option>
                  {availablePositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Affiliation / Slate
                </label>
                <input
                  type="text"
                  disabled={!isCurrentElectionInScope}
                  placeholder="e.g. The Vanguard Movement / Independent"
                  value={newCandidate.slate}
                  onChange={(e) => setNewCandidate((prev) => ({ ...prev, slate: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Photo URL
                </label>
                <input
                  type="url"
                  disabled={!isCurrentElectionInScope}
                  placeholder="https://..."
                  value={newCandidate.photo_url}
                  onChange={(e) => setNewCandidate((prev) => ({ ...prev, photo_url: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Vetting Certification
                </label>
                <select
                  disabled={!isCurrentElectionInScope}
                  value={newCandidate.status}
                  onChange={(e) => setNewCandidate((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
                >
                  <option value="VERIFIED">Verified &amp; Certified</option>
                  <option value="PENDING_REVIEW">Pending Committee Vetting</option>
                  <option value="DISQUALIFIED">Disqualified</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Manifesto Summary &amp; Policy Promises
                </label>
                <textarea
                  rows={2}
                  disabled={!isCurrentElectionInScope}
                  placeholder="Summary of campaign promises displayed on student ballot..."
                  value={newCandidate.manifesto}
                  onChange={(e) => setNewCandidate((prev) => ({ ...prev, manifesto: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={!isCurrentElectionInScope}
                  className="px-6 py-2.5 bg-[#007A4D] hover:bg-[#075C42] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  + Enroll Candidate onto Ballot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: BALLOT CREATION CONTROLS & WIZARD
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ballot-creator' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                Ballot Creation Controls &amp; Rule Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure election parameters, secret ballot encryption constraints, and eligibility prerequisites
              </p>
            </div>

            {ballotSuccessMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between">
                <span>{ballotSuccessMessage}</span>
                <button onClick={() => setBallotSuccessMessage(null)} className="text-emerald-600 font-bold cursor-pointer">
                  ×
                </button>
              </div>
            )}

            <form onSubmit={handleCreateBallot} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Election / Ballot Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026/2027 College of Science Executive Elections"
                    value={ballotForm.title}
                    onChange={(e) => setBallotForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Electoral Tier *
                  </label>
                  <select
                    value={ballotForm.tier}
                    onChange={(e) => setBallotForm((prev) => ({ ...prev, tier: e.target.value }))}
                    className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D]"
                  >
                    <option
                      value="SRC"
                      disabled={!ecAdminProfile.allowedTiers.includes('SRC')}
                    >
                      SRC Executive Council (Campus-wide) {!ecAdminProfile.allowedTiers.includes('SRC') ? '🔒 (Restricted)' : ''}
                    </option>
                    <option
                      value="DEPARTMENT"
                      disabled={!ecAdminProfile.allowedTiers.includes('DEPARTMENT')}
                    >
                      Departmental Executive {!ecAdminProfile.allowedTiers.includes('DEPARTMENT') ? '🔒 (Restricted)' : ''}
                    </option>
                    <option
                      value="COLLEGE"
                      disabled={!ecAdminProfile.allowedTiers.includes('COLLEGE')}
                    >
                      College Executive {!ecAdminProfile.allowedTiers.includes('COLLEGE') ? '🔒 (Restricted)' : ''}
                    </option>
                    <option
                      value="HALL"
                      disabled={!ecAdminProfile.allowedTiers.includes('HALL')}
                    >
                      Hall of Residence (First-Year Level 100 Rule) {!ecAdminProfile.allowedTiers.includes('HALL') ? '🔒 (Restricted)' : ''}
                    </option>
                    <option
                      value="CONSTITUENCY"
                      disabled={!ecAdminProfile.allowedTiers.includes('CONSTITUENCY')}
                    >
                      Constituency Parliamentary (Off-Campus) {!ecAdminProfile.allowedTiers.includes('CONSTITUENCY') ? '🔒 (Restricted)' : ''}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Poll Opening Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={ballotForm.start_time}
                    onChange={(e) => setBallotForm((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Poll Concluding Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={ballotForm.end_time}
                    onChange={(e) => setBallotForm((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Expected Voter Roll Size (Quorum Target)
                  </label>
                  <input
                    type="number"
                    value={ballotForm.expected_voters}
                    onChange={(e) => setBallotForm((prev) => ({ ...prev, expected_voters: e.target.value }))}
                    className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Constituency / Target Demographic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. All Registered CoE Students"
                    value={ballotForm.jurisdiction_name}
                    onChange={(e) => setBallotForm((prev) => ({ ...prev, jurisdiction_name: e.target.value }))}
                    className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D]"
                  />
                </div>
              </div>

              {/* Advanced Security & Ballot Policy Toggles */}
              <div className="pt-4 border-t border-[#DDE5E1] dark:border-slate-700 space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wide text-[#66716C] dark:text-slate-400">
                  Cryptographic Integrity &amp; Ballot Rules
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ballotForm.require_all_positions}
                      onChange={(e) => setBallotForm((prev) => ({ ...prev, require_all_positions: e.target.checked }))}
                      className="mt-0.5 text-[#007A4D] rounded"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#202522] dark:text-slate-100">
                        Enforce Complete Ballot Submissions
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Requires selection in all portfolios before ballot submission is enabled
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ballotForm.randomize_candidates}
                      onChange={(e) => setBallotForm((prev) => ({ ...prev, randomize_candidates: e.target.checked }))}
                      className="mt-0.5 text-[#007A4D] rounded"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#202522] dark:text-slate-100">
                        Randomize Candidate Card Order
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Prevents ballot position bias by shuffling candidate cards per session
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ballotForm.hall_first_year_only}
                      onChange={(e) => setBallotForm((prev) => ({ ...prev, hall_first_year_only: e.target.checked }))}
                      className="mt-0.5 text-[#007A4D] rounded"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#202522] dark:text-slate-100">
                        Enforce Level 100 Hall Residency Rule
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Restricts voting strictly to first-year resident students (Hall Tier)
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 cursor-pointer">
                    <input type="checkbox" checked={true} disabled className="mt-0.5 text-[#007A4D] rounded" />
                    <div>
                      <div className="text-xs font-bold text-[#202522] dark:text-slate-100 flex items-center gap-1.5">
                        <span>Zero-Knowledge SHA-256 Envelope</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold px-1.5 rounded">
                          MANDATORY
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Decouples voter student IDs from encrypted ballot payload receipts
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions & Preview Button */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowBallotPreview(!showBallotPreview)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  {showBallotPreview ? 'Hide Ballot Preview' : '👁️ Preview Student Ballot Layout'}
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#007A4D] hover:bg-[#075C42] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  Create &amp; Deploy Ballot
                </button>
              </div>
            </form>

            {/* Live Ballot Preview Card */}
            {showBallotPreview && (
              <div className="p-5 bg-slate-50 dark:bg-slate-900/60 border border-dashed border-[#007A4D] rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#007A4D] dark:text-emerald-400 uppercase tracking-wider">
                    Student Voter Interface Preview
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">Mock rendering</span>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#DDE5E1] dark:border-slate-700 space-y-3">
                  <h4 className="font-extrabold text-sm text-[#202522] dark:text-slate-100">
                    {ballotForm.title || 'Official Executive Ballot'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Target: {ballotForm.jurisdiction_name || 'All Registered Voters'} · Tier: {ballotForm.tier}
                  </p>
                  <div className="p-3 bg-[#EAF6F0] dark:bg-slate-900 rounded-lg text-xs text-[#075C42] dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Lock size={12} />
                    <span>Zero-Knowledge Cryptographic Envelope active. Each ballot receipt generated with SHA-256 hash stamp.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation Tab Content: Real-Time Status Overrides ── */}
      {activeTab === 'status-overrides' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                Real-Time Polling Status &amp; Emergency Overrides
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Instant Electoral Commission administrative control to open, pause, extend, or close polling
              </p>
            </div>

            {statusMessage && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between">
                <span>{statusMessage}</span>
                <button onClick={() => setStatusMessage(null)} className="text-emerald-600 font-bold cursor-pointer">
                  ×
                </button>
              </div>
            )}

            {/* Current Active Election Status Banner */}
            <div className="p-5 rounded-2xl bg-[#F3FAF6] dark:bg-slate-900/80 border border-[#DDE5E1] dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Target Election Room</div>
                <div className="text-lg font-black text-[#202522] dark:text-slate-100">{selectedElection?.title}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Start: <strong>{selectedElection?.startTime ? new Date(selectedElection.startTime).toLocaleString() : 'Live'}</strong> · End: <strong>{selectedElection?.endTime ? new Date(selectedElection.endTime).toLocaleString() : 'Concluded'}</strong>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`px-4 py-2 rounded-xl font-extrabold text-xs inline-flex items-center gap-1.5 shadow-xs ${
                    currentElectionStatus === 'ACTIVE'
                      ? 'bg-emerald-600 text-white'
                      : currentElectionStatus === 'PAUSED'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-white'
                  }`}
                >
                  {currentElectionStatus === 'ACTIVE' ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>LIVE POLLS OPEN</span>
                    </span>
                  ) : currentElectionStatus === 'PAUSED' ? (
                    <span className="flex items-center gap-1.5">
                      <Pause size={12} />
                      <span>POLLS PAUSED</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Lock size={12} />
                      <span>POLLS CLOSED</span>
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Optional Reason / Directive input */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Reason / Administrative Directive (Logged in Public Audit Ledger)
              </label>
              <input
                type="text"
                disabled={!isCurrentElectionInScope}
                placeholder={isCurrentElectionInScope ? "e.g. Scheduled voting extension due to network latency in Bomso constituency..." : "Locked: Action outside assigned jurisdiction"}
                value={statusOverrideReason}
                onChange={(e) => setStatusOverrideReason(e.target.value)}
                className="w-full bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#007A4D] disabled:opacity-50"
              />
            </div>

            {/* Override Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading || currentElectionStatus === 'ACTIVE' || !isCurrentElectionInScope || !hasPermission('OVERRIDE_POLLS')}
                onClick={() => handleStatusOverride('OPEN_POLLS')}
                className="p-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs flex flex-col items-center gap-2 cursor-pointer transition-all shadow-xs"
              >
                {isCurrentElectionInScope ? <Play size={18} /> : <Lock size={18} />}
                <span>{isCurrentElectionInScope ? 'OPEN / RESUME POLLS' : 'LOCKED (Outside Scope)'}</span>
                <span className="text-[10px] font-normal opacity-80">Enable voting across all stations</span>
              </button>

              <button
                type="button"
                disabled={actionLoading || currentElectionStatus === 'PAUSED' || currentElectionStatus === 'CLOSED' || !isCurrentElectionInScope || !hasPermission('OVERRIDE_POLLS')}
                onClick={() => handleStatusOverride('PAUSE_POLLS')}
                className="p-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs flex flex-col items-center gap-2 cursor-pointer transition-all shadow-xs"
              >
                {isCurrentElectionInScope ? <Pause size={18} /> : <Lock size={18} />}
                <span>{isCurrentElectionInScope ? 'PAUSE POLLS' : 'LOCKED (Outside Scope)'}</span>
                <span className="text-[10px] font-normal opacity-80">Temporary hold / sync freeze</span>
              </button>

              <button
                type="button"
                disabled={actionLoading || !isCurrentElectionInScope || !hasPermission('OVERRIDE_POLLS')}
                onClick={() => handleStatusOverride('EXTEND_1H')}
                className="p-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs flex flex-col items-center gap-2 cursor-pointer transition-all shadow-xs"
              >
                {isCurrentElectionInScope ? <Clock size={18} /> : <Lock size={18} />}
                <span>{isCurrentElectionInScope ? 'EXTEND TIME (+1 HOUR)' : 'LOCKED (Outside Scope)'}</span>
                <span className="text-[10px] font-normal opacity-80">Push back deadline with audit stamp</span>
              </button>

              <button
                type="button"
                disabled={actionLoading || currentElectionStatus === 'CLOSED' || !isCurrentElectionInScope || !hasPermission('OVERRIDE_POLLS')}
                onClick={() => handleStatusOverride('CLOSE_POLLS')}
                className="p-4 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs flex flex-col items-center gap-2 cursor-pointer transition-all shadow-xs"
              >
                {isCurrentElectionInScope ? <Lock size={18} /> : <Lock size={18} />}
                <span>{isCurrentElectionInScope ? 'CONCLUDE & CLOSE POLLS' : 'LOCKED (Outside Scope)'}</span>
                <span className="text-[10px] font-normal opacity-80">Lock voting ledger for decryption</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 5: LIVE VOTE COUNTING CHARTS (ANONYMITY PRESERVED)
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'live-tally' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Zero-Knowledge Anonymity Guarantee Banner */}
          <div className="p-4 rounded-2xl bg-[#EAF6F0] dark:bg-slate-900 border border-[#007A4D]/30 flex items-start gap-3.5">
            <ShieldCheck size={20} className="text-emerald-700 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-black text-xs uppercase tracking-wide text-[#075C42] dark:text-emerald-400">
                Zero-Knowledge Voter Anonymity Protocol Enforced
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Individual student IDs and demographic records are strictly decoupled from ballot vote envelopes via irreversible SHA-256 hash digests. The Electoral Commission tally chamber tallies cumulative candidate sums without exposing voter identities.
              </p>
            </div>
          </div>

          {/* Decryption & Tally Trigger Control */}
          <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                  Aggregated Vote Tally Visualizer
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Portfolio-by-portfolio candidate vote shares and leading thresholds
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTallyAndDecrypt}
                  className="px-4 py-2 bg-[#007A4D] hover:bg-[#075C42] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Unlock size={12} />
                  <span>Tally &amp; Decrypt Ledger</span>
                </button>
              </div>
            </div>

            {/* Position by Position Vote Tally Bars */}
            <div className="space-y-6 pt-2">
              {availablePositions.map((pos) => {
                const posCandidates = candidates.filter(
                  (c) => c.position === pos && c.status !== 'DISQUALIFIED' && (!selectedElection || c.election_id === selectedElection.id)
                );
                const totalVotesForPos = posCandidates.reduce((sum, c) => sum + (c.votes || 0), 0) || 1;
                const sortedCandidates = [...posCandidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
                const leader = sortedCandidates[0];

                return (
                  <div key={pos} className="p-4 rounded-xl bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-[#075C42] dark:text-emerald-400">
                          {pos.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ({totalVotesForPos.toLocaleString()} total cast)
                        </span>
                      </div>

                      {leader && (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
                          Leader: {leader.full_name} ({(((leader.votes || 0) / totalVotesForPos) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {sortedCandidates.map((c) => {
                        const pct = (((c.votes || 0) / totalVotesForPos) * 100).toFixed(1);
                        const isLeading = leader && leader.id === c.id;

                        return (
                          <div key={c.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-[#202522] dark:text-slate-100 flex items-center gap-1.5">
                                {c.full_name} <span className="text-slate-400 font-normal">({c.slate})</span>
                              </span>
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                {c.votes?.toLocaleString() || 0} votes ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isLeading ? 'bg-[#007A4D]' : 'bg-slate-400 dark:bg-slate-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Official Tally Results Modal / Publication Card */}
            {tallyDecrypted && tallyResults && (
              <div className="mt-6 p-5 rounded-2xl knust-glass-card border-2 border-[#007A4D] shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#DDE5E1] dark:border-slate-700">
                  <div>
                    <h4 className="font-black text-base text-[#007A4D] dark:text-emerald-400">
                      Official Cryptographic Decryption Certificate
                    </h4>
                    <p className="text-xs text-slate-500">
                      Decrypted At: {new Date(tallyResults.decryptedAt).toLocaleString()} by {tallyResults.officer}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-mono text-xs font-bold rounded-lg">
                    VERIFIED &amp; UNLOCKED
                  </span>
                </div>

                <div className="text-xs font-mono text-slate-600 dark:text-slate-300 break-all bg-slate-100 dark:bg-slate-900 p-3 rounded-xl">
                  <strong>SHA-256 Ledger Digest:</strong> {tallyResults.ledgerHash}
                </div>

                {/* Publish to Student AIM */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#DDE5E1] dark:border-slate-700">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {publishFeedback || 'Ready to broadcast certified results to student body via AIM.'}
                  </div>

                  <button
                    type="button"
                    disabled={!isCurrentElectionInScope}
                    onClick={handlePublishResults}
                    className="px-5 py-2.5 bg-[#007A4D] hover:bg-[#075C42] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                  >
                    {isCurrentElectionInScope ? 'Broadcast Results to Student AIM' : 'Broadcast Restricted (Outside Scope)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation Tab Content: System Health & Audit Logs ── */}
      {activeTab === 'health-logs' && (
        <div className="space-y-6 animate-fadeIn">
          {/* System Health Telemetry Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Database Engine</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-lg font-black text-[#202522] dark:text-slate-100 mt-2">
                PostgreSQL + Supabase
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">Status: OK (Ping 16ms)</div>
            </div>

            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Ledger Integrity</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-lg font-black text-[#202522] dark:text-slate-100 mt-2">
                SHA-256 Hash Chain
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">0 Tampering Detected</div>
            </div>

            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>WebSocket Stream</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-lg font-black text-[#202522] dark:text-slate-100 mt-2">
                Real-Time Node
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">0% Packet Loss</div>
            </div>

            <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Anonymity Shield</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-lg font-black text-[#202522] dark:text-slate-100 mt-2">
                Decoupled Envelopes
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">Zero-Knowledge Active</div>
            </div>
          </div>

          {/* Tamper-Evident Audit Logs Table */}
          <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#DDE5E1] dark:border-slate-700">
              <div>
                <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                  Tamper-Evident Institutional Audit Ledger ({filteredLogs.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Immutable chronological records of all EC administrative actions and encrypted vote transactions
                </p>
              </div>

              {/* Log Search & Export Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Search logs or hash..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-[#202522] dark:text-slate-100 focus:outline-none"
                />

                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="bg-[#F3FAF6] dark:bg-slate-900 border border-[#DDE5E1] dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-[#202522] dark:text-slate-100 focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="STATUS_OVERRIDE">Status Overrides</option>
                  <option value="CANDIDATE_VETTING">Candidate Vetting</option>
                  <option value="BALLOT_CONFIG">Ballot Config</option>
                  <option value="ENCRYPTED_VOTE">Vote Submissions</option>
                  <option value="SYSTEM">System &amp; Ledger Checks</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleExportAuditLogs('json')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => handleExportAuditLogs('csv')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-[#DDE5E1] dark:border-slate-700 text-[#66716C] dark:text-slate-400 font-extrabold uppercase text-[10px] tracking-wider font-sans">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Event Type</th>
                    <th className="py-3 px-3">Severity</th>
                    <th className="py-3 px-3">Tier</th>
                    <th className="py-3 px-3">Actor / Officer</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3 text-right">Ledger Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5E1] dark:divide-slate-700/60 font-mono text-[11px]">
                  {filteredLogs.map((log) => {
                    const isSecurity = log.severity === 'SECURITY';
                    const isWarning = log.severity === 'WARNING';

                    return (
                      <tr key={log.id} className="hover:bg-[#F3FAF6] dark:hover:bg-slate-700/30">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#007A4D] dark:text-emerald-400 font-sans text-xs">
                          {log.event_type}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                              isSecurity
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : isWarning
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold font-sans text-[11px]">
                          <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded">
                            {log.tier || 'ALL'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans text-xs max-w-xs truncate">
                          {log.actor}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-sans text-xs">
                          {log.description}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sky-600 dark:text-sky-400 select-all" title={log.hash}>
                          {log.hash.slice(0, 12)}...
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 7: OBSERVER ROOMS (CANDIDATE AGENTS)
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rooms' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="knust-glass-card border border-[#DDE5E1] dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#202522] dark:text-slate-100">
                  Created Polling Station Observer Rooms ({createdRooms.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Accredited candidate agents and EC independent observers for live auditing
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRoomModalOpen(true)}
                className="px-4 py-2 bg-[#007A4D] hover:bg-[#075C42] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                + Create Observer Room
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#DDE5E1] dark:border-slate-700 text-[#66716C] dark:text-slate-400 font-extrabold uppercase text-[10px]">
                    <th className="py-3 px-3">Room Name</th>
                    <th className="py-3 px-3">Room Code</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5E1] dark:divide-slate-700/60 font-medium">
                  {createdRooms.map((room) => (
                    <tr key={room.id} className="hover:bg-[#F3FAF6] dark:hover:bg-slate-700/30">
                      <td className="py-3 px-3 font-bold text-[#202522] dark:text-slate-100">
                        {room.room_name}
                      </td>
                      <td className="py-3 px-3">
                        <code className="bg-[#F3FAF6] dark:bg-slate-900 px-2 py-0.5 rounded font-mono text-[11px]">
                          {room.room_code}
                        </code>
                      </td>
                      <td className="py-3 px-3">
                        {room.is_locked ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 font-extrabold rounded text-[10px] inline-flex items-center gap-1 border border-red-300">
                            <Lock size={10} />
                            <span>LOCKED</span>
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold rounded text-[10px] inline-flex items-center gap-1 border border-emerald-300">
                            <Unlock size={10} />
                            <span>OPEN</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(room.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const nextLocked = !room.is_locked;
                              setCreatedRooms((prev) =>
                                prev.map((r) => (r.id === room.id ? { ...r, is_locked: nextLocked } : r))
                              );
                              if (selectedRoom?.id === room.id) {
                                setSelectedRoom((prev) => (prev ? { ...prev, is_locked: nextLocked } : null));
                              }
                              try {
                                await supabase.from('election_rooms').update({ is_locked: nextLocked }).eq('id', room.id);
                              } catch (e) {
                                console.warn('Room lock DB sync', e);
                              }
                              recordAuditLog('ROOM_LOCK_TOGGLED', `Observer room "${room.room_name}" set to ${nextLocked ? 'LOCKED' : 'UNLOCKED'}`, nextLocked ? 'WARNING' : 'INFO', 'SYSTEM');
                            }}
                            className={`px-2.5 py-1 font-bold text-[11px] rounded-lg cursor-pointer transition-colors ${
                              room.is_locked
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {room.is_locked ? 'Unlock' : 'Lock'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedRoom(selectedRoom?.id === room.id ? null : room)}
                            className="px-3 py-1 bg-[#007A4D] hover:bg-[#075C42] text-white font-bold text-[11px] rounded-lg cursor-pointer transition-colors"
                          >
                            {selectedRoom?.id === room.id ? 'Close Panel' : 'Manage Accredited Agents'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedRoom && (
            <div className="space-y-4">
              {/* Observer Room Page Direct Link Banner */}
              <div className="bg-slate-900 text-white border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🗳️</span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      Observer Room Accreditation Panel
                    </h4>
                    <p className="text-xs text-slate-300 font-medium">
                      Selected Room: <strong className="text-amber-300">{selectedRoom.room_name}</strong> [{selectedRoom.room_code}]
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate && navigate('/candidate-agent')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  👁️ Open Dedicated Observer Room Page ➔
                </button>
              </div>

              <RoomMembersPanel
                room={selectedRoom}
                election={selectedElection}
                candidates={candidates}
                isHeadOnly={true}
                context={context}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Disqualification Modal ── */}
      {disqualifyModal.isOpen && disqualifyModal.candidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                <span>⚠️</span> Disqualify Candidate
              </h3>
              <button
                onClick={() => setDisqualifyModal({ isOpen: false, candidate: null, reason: '', notes: '' })}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300">
              You are about to disqualify <strong>{disqualifyModal.candidate.full_name}</strong> from contesting for <strong>{disqualifyModal.candidate.position}</strong>. This will strike them from voter ballots and record an entry into the official public audit log.
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Statutory Grounds for Disqualification *
                </label>
                <select
                  value={disqualifyModal.reason}
                  onChange={(e) => setDisqualifyModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-800 border border-[#DDE5E1] dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                >
                  <option value="Academic Standing (CWA < 60.0)">Academic Standing (Cumulative CWA &lt; 60.0)</option>
                  <option value="Disciplinary Committee Sanction">Disciplinary Standing &amp; Conduct Sanction</option>
                  <option value="Nomination Filing Irregularity">Nomination Paper &amp; Endorsement Irregularity</option>
                  <option value="Code of Conduct Violation">Campaign Code of Conduct Infraction</option>
                  <option value="Electoral Commission Vetting Rejection">Official EC Vetting Committee Recommendation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Specific Finding / Audit Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide specific details or reference resolution number..."
                  value={disqualifyModal.notes}
                  onChange={(e) => setDisqualifyModal((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-[#F3FAF6] dark:bg-slate-800 border border-[#DDE5E1] dark:border-slate-700 rounded-xl p-2.5 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDisqualifyModal({ isOpen: false, candidate: null, reason: '', notes: '' })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisqualify}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer"
              >
                Confirm Disqualification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Room Creation Modal ── */}
      <RoomCreationModal
        election={selectedElection || elections[0] || { id: 'src', title: 'SRC Executive Council Election', tier: 'SRC' }}
        candidates={candidates}
        isOpen={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onCreateRoom={(newRoom) => {
          setCreatedRooms((prev) => [newRoom, ...prev]);
          recordAuditLog('ROOM_CREATED', `Observer room created: "${newRoom.room_name}" [Code: ${newRoom.room_code}]`, 'INFO', 'SYSTEM');
        }}
        isHeadOnly={true}
      />
    </div>
  );
}
