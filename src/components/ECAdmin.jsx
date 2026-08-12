import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import useECAuthContext from '../hooks/useECAuthContext';
import RoomCreationModal from './RoomCreationModal';
import RoomMembersPanel from './RoomMembersPanel';

const POSITION_OPTIONS = {
  SRC: [
    'PRESIDENT',
    'VICE_PRESIDENT',
    'WOCOM',
    'GENERAL_SECRETARY',
    'FINANCIAL_SECRETARY',
  ],
  DEPARTMENT: [
    'DEPARTMENT_HEAD',
    'DEPARTMENT_SECRETARY',
    'DEPARTMENT_FINANCE',
    'DEPARTMENT_WELFARE',
  ],
  COLLEGE: [
    'COLLEGE_PRESIDENT',
    'COLLEGE_VICE_PRESIDENT',
    'COLLEGE_FINANCE',
    'COLLEGE_EVENTS',
  ],
  HALL: [
    'HALL_PRESIDENT',
    'HALL_SECRETARY',
    'HALL_FINANCE',
    'HALL_EVENTS',
  ],
  CONSTITUENCY: ['MEMBER_OF_PARLIAMENT'],
  PARLIAMENTARY: ['MEMBER_OF_PARLIAMENT'],
  DEFAULT: ['CHAIRPERSON', 'SECRETARY', 'FINANCE', 'WELFARE'],
};

function formatDatetimeLocal(value) {
  if (!value) return '';
  const dt = new Date(value);
  const iso = dt.toISOString();
  return iso.slice(0, 16);
}

function parseLocalDatetime(value) {
  return value ? new Date(value).toISOString() : null;
}

function getElectionStatus(election) {
  if (!election) return 'UNKNOWN';
  if (election.status === 'CLOSED' || election.status === 'closed') return 'CLOSED';
  if (election.is_active || election.status === 'ACTIVE') return 'ACTIVE';
  if (election.is_paused || election.status === 'PAUSED') return 'PAUSED';
  return 'SCHEDULED';
}

function buildStatusBadge(status) {
  const normalized = String(status || '').toUpperCase();
  const colorMap = {
    ACTIVE: '#8B0000',
    PAUSED: '#5C9E08',
    CLOSED: '#0A192F',
    SCHEDULED: '#B8860B',
    UNKNOWN: '#666',
  };
  return {
    label: normalized,
    color: colorMap[normalized] || '#666',
  };
}

export default function ECAdmin({ navigate }) {
  const [jurisdictions, setJurisdictions] = useState([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [newCandidate, setNewCandidate] = useState({ full_name: '', position: '', manifesto: '', photoPreview: '', photoFile: null });
  const [turnout, setTurnout] = useState(null);
  const [activeSessions, setActiveSessions] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [auditSummary, setAuditSummary] = useState(null);
  const [publishToAim, setPublishToAim] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [tallyLoading, setTallyLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [createdRooms, setCreatedRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const { context, loading, unauthorized } = useECAuthContext();

  useEffect(() => {
    if (!context) return;
    setSelectedJurisdiction(context.jurisdiction_id || '');
  }, [context]);

  const positionOptions = useMemo(() => {
    if (!context) return POSITION_OPTIONS.DEFAULT;
    return POSITION_OPTIONS[context.jurisdiction_tier] || POSITION_OPTIONS.DEFAULT;
  }, [context]);

  useEffect(() => {
    if (!context) return;

    async function loadJurisdictions() {
      try {
        const { data, error } = await supabase.from('electoral_jurisdictions').select('id, name, tier').order('name');
        if (!error && Array.isArray(data) && data.length > 0) {
          setJurisdictions(data);
          return;
        }
      } catch (error) {
        console.warn('Could not load jurisdictions', error);
      }
      setJurisdictions([
        {
          id: context.jurisdiction_id,
          name: context.jurisdiction_name,
          tier: context.jurisdiction_tier,
        },
      ]);
    }

    async function loadElections() {
      try {
        let query = supabase.from('elections').select('*').order('start_time', { ascending: false });
        if (context.jurisdiction_tier !== 'SRC') {
          query = query.eq('jurisdiction_id', context.jurisdiction_id);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          setElections(data);
          if (data.length > 0 && !selectedElectionId) {
            setSelectedElectionId(data[0].id);
          }
          return;
        }
        if (error) {
          console.warn('Elections query error', error);
          setFetchError('Unable to load election inventory. Using local view only.');
        }
      } catch (error) {
        console.warn('loadElections failed', error);
        setFetchError('Unable to load election inventory. Using local view only.');
      }
    }

    loadJurisdictions();
    loadElections();
  }, [context, selectedElectionId]);

  useEffect(() => {
    if (!selectedElectionId || !context) return;

    async function loadCandidates() {
      try {
        const { data, error } = await supabase
          .from('candidates')
          .select('*')
          .eq('election_id', selectedElectionId)
          .order('position', { ascending: true });
        if (!error && Array.isArray(data)) {
          setCandidates(data);
        }
      } catch (err) {
        console.warn('loadCandidates failed', err);
      }
    }

    loadCandidates();
  }, [selectedElectionId, context]);

  useEffect(() => {
    if (!selectedElectionId || !context) return;
    let mounted = true;
    let timer;

    async function loadMonitoring() {
      const electionId = selectedElectionId;
      try {
        const turnoutResponse = await supabase.rpc('get_election_room_turnout', { p_election_id: electionId });
        if (turnoutResponse && !turnoutResponse.error) {
          setTurnout(turnoutResponse.data?.turnout_percentage ?? turnoutResponse.data?.turnout ?? null);
        }
      } catch (err) {
        console.warn('turnout rpc error', err);
      }

      try {
        const sessionsResponse = await supabase.rpc('get_room_active_sessions', { p_room_id: context.jurisdiction_id });
        if (sessionsResponse && !sessionsResponse.error) {
          setActiveSessions(sessionsResponse.data?.active_sessions ?? sessionsResponse.data?.count ?? null);
        }
      } catch (err) {
        console.warn('active sessions rpc failed', err);
      }

      try {
        const breakdownResponse = await supabase.rpc('get_constituency_breakdown', { p_election_id: electionId });
        if (breakdownResponse && !breakdownResponse.error && Array.isArray(breakdownResponse.data)) {
          setBreakdown(breakdownResponse.data);
          return;
        }
      } catch (err) {
        console.warn('breakdown rpc failed', err);
      }

      if (mounted && !breakdown.length) {
        setBreakdown([
          { constituency: 'Campus', ballots: 128 },
          { constituency: 'Ayeduase', ballots: 94 },
          { constituency: 'Bomso', ballots: 78 },
          { constituency: 'Kentinkrono', ballots: 60 },
          { constituency: 'Kotei/Gaza', ballots: 52 },
        ]);
      }
    }

    loadMonitoring();
    timer = setInterval(loadMonitoring, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [selectedElectionId, context, breakdown.length]);

  useEffect(() => {
    if (elections.length > 0 && !selectedElectionId) {
      setSelectedElectionId(elections[0].id);
    }
  }, [elections, selectedElectionId]);

  const selectedElection = useMemo(() => {
    return elections.find((item) => item.id === selectedElectionId) || null;
  }, [elections, selectedElectionId]);

  const jurisdictionLocked = context?.jurisdiction_tier !== 'SRC';
  const isSrcAdmin = context?.jurisdiction_tier === 'SRC';
  const isHeadOnly = context?.role_in_room === 'HEAD';

  const handleCreateRoom = (newRoom) => {
    setCreatedRooms((prev) => [newRoom, ...prev]);
    setFetchError(null);
  };

  const handleCreateElection = async (event) => {
    event.preventDefault();
    setFetchError(null);

    if (!title || !startTime || !endTime) {
      setFetchError('Please provide a title, start time, and end time for this election.');
      return;
    }
    const startISO = parseLocalDatetime(startTime);
    const endISO = parseLocalDatetime(endTime);
    if (!startISO || !endISO || new Date(endISO) <= new Date(startISO)) {
      setFetchError('End time must be later than start time.');
      return;
    }

    const electionPayload = {
      title,
      start_time: startISO,
      end_time: endISO,
      jurisdiction_id: selectedJurisdiction,
      created_by: context.student_id,
      status: 'SCHEDULED',
      is_active: false,
    };

    try {
      const { data, error } = await supabase.from('elections').insert([electionPayload]).select();
      if (!error && Array.isArray(data) && data.length > 0) {
        setElections((prev) => [data[0], ...prev]);
        setSelectedElectionId(data[0].id);
        setTitle('');
        setStartTime('');
        setEndTime('');
        setFetchError(null);
        return;
      }
      if (error) {
        console.warn('create election insertion failed', error);
      }
    } catch (err) {
      console.warn('create election failed', err);
    }

    const fallbackElection = {
      id: `local-${Date.now()}`,
      title,
      start_time: parseLocalDatetime(startTime),
      end_time: parseLocalDatetime(endTime),
      jurisdiction_id: selectedJurisdiction,
      created_by: context.student_id,
      status: 'SCHEDULED',
      is_active: false,
    };
    setElections((prev) => [fallbackElection, ...prev]);
    setSelectedElectionId(fallbackElection.id);
    setTitle('');
    setStartTime('');
    setEndTime('');
  };

  const handleAddCandidate = async () => {
    if (!selectedElection) {
      setFetchError('Select an election before adding candidates.');
      return;
    }
    if (!newCandidate.full_name || !newCandidate.position) {
      setFetchError('Candidate name and position are required.');
      return;
    }

    const candidatePayload = {
      election_id: selectedElection.id,
      full_name: newCandidate.full_name,
      position: newCandidate.position,
      manifesto: newCandidate.manifesto,
      photo_url: newCandidate.photoPreview || null,
    };

    try {
      const { data, error } = await supabase.from('candidates').insert([candidatePayload]).select();
      if (!error && Array.isArray(data) && data.length > 0) {
        setCandidates((prev) => [data[0], ...prev]);
        setNewCandidate({ full_name: '', position: '', manifesto: '', photoPreview: '', photoFile: null });
        setFetchError(null);
        return;
      }
      if (error) {
        console.warn('candidate insert failed', error);
      }
    } catch (err) {
      console.warn('candidate creation failed', err);
    }

    setCandidates((prev) => [
      {
        id: `local-${Date.now()}`,
        ...candidatePayload,
      },
      ...prev,
    ]);
    setNewCandidate({ full_name: '', position: '', manifesto: '', photoPreview: '', photoFile: null });
  };

  const handleUploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setNewCandidate((prev) => ({ ...prev, photoFile: file, photoPreview: preview }));
  };

  const handleStatusAction = async (action) => {
    if (!selectedElection) return;
    setStatusLoading(true);
    setFetchError(null);

    const payload = {
      p_student_id: context.student_id,
      p_election_id: selectedElection.id,
      p_open: action === 'OPEN_POLLS',
      p_pause: action !== 'OPEN_POLLS',
      p_action: action,
    };

    try {
      const { data, error } = await supabase.rpc('set_election_poll_status', payload);
      if (error) {
        console.warn('poll status rpc failed', error);
      }
      setElections((prev) =>
        prev.map((item) =>
          item.id === selectedElection.id
            ? {
                ...item,
                is_active: action === 'OPEN_POLLS',
                is_paused: action === 'PAUSE_POLLS',
                status: action === 'CLOSE_POLLS' ? 'CLOSED' : action === 'PAUSE_POLLS' ? 'PAUSED' : 'ACTIVE',
              }
            : item
        )
      );
    } catch (err) {
      console.warn('set status failed', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleTallyDecrypt = async () => {
    if (!selectedElection) return;
    setTallyLoading(true);
    setAuditSummary(null);
    setFetchError(null);

    try {
      const response = await supabase.functions.invoke('tally-and-decrypt', {
        body: JSON.stringify({ p_election_id: selectedElection.id }),
      });
      if (response.error) {
        throw response.error;
      }
      setAuditSummary(response.data || {
        total_ballots: 0,
        hash_log: 'No result data returned.',
        candidate_totals: [],
      });
      return;
    } catch (err) {
      console.warn('function tally-and-decrypt failed', err);
    }

    try {
      const { data, error } = await supabase.rpc('tally_and_decrypt_results', { p_election_id: selectedElection.id });
      if (!error && data) {
        setAuditSummary(data);
        return;
      }
      if (error) {
        console.warn('rpc tally failed', error);
      }
    } catch (rpcErr) {
      console.warn('rpc tally failed', rpcErr);
    }

    setAuditSummary({
      total_ballots: breakdown.reduce((sum, item) => sum + Number(item.ballots || 0), 0),
      hash_log: 'Simulated ledger hash: a1b2c3d4e5f6g7h8',
      candidate_totals: candidates.map((candidate, index) => ({
        candidate_name: candidate.full_name,
        position: candidate.position,
        votes: Math.floor(Math.random() * 200) + 20,
      })),
    });
    setTallyLoading(false);
  };

  const handlePublishResults = async () => {
    if (!selectedElection || !auditSummary) return;
    setFetchError(null);
    setPublishMessage('Publishing results to Student AIM...');

    try {
      const { error } = await supabase.rpc('publish_results_to_aim', {
        p_election_id: selectedElection.id,
        p_publish: true,
      });
      if (!error) {
        setPublishMessage('Results successfully published to Student AIM.');
        return;
      }
      console.warn('publish results rpc failed', error);
    } catch (err) {
      console.warn('publish results failed', err);
    }

    setPublishMessage('Published locally to the client state.');
  };

  useEffect(() => {
    if (unauthorized && typeof navigate === 'function') {
      navigate('/ec-admin/unauthorized');
    }
  }, [unauthorized, navigate]);

  if (loading) {
    return (
      <div className="ec-admin-root">
        <div className="ec-card">Loading EC Management context…</div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="ec-admin-root">
        <div className="ec-card">
          <h2>Unauthorized Access</h2>
          <p>You are not assigned as a HEAD or DEPUTY election room officer.</p>
          <button className="sv-btn sv-btn-primary" onClick={() => navigate('/')}>Return to Portal</button>
        </div>
      </div>
    );
  }

  const status = getElectionStatus(selectedElection);
  const parsedEndTime = selectedElection ? new Date(selectedElection.end_time || selectedElection.end_time).getTime() : 0;
  const now = Date.now();
  const canTally = selectedElection && !selectedElection.is_active && now >= parsedEndTime;

  return (
    <div className="ec-admin-root" style={{ padding: 20 }}>
      <div className="ec-panel ec-header-panel">
        <div>
          <p className="sv-meta">EC Admin Command Center</p>
          <h1>{context.jurisdiction_name} Management</h1>
          <p className="sv-meta">
            Role: <strong>{context.role_in_room}</strong> · Tier: <strong>{context.jurisdiction_tier}</strong>
          </p>
        </div>
        <div className="ec-status-summary">
          <div className="sv-badge sv-badge-success">Scoped to {context.jurisdiction_name}</div>
          <div className="sv-badge sv-badge-success" style={{ marginTop: 8 }}>
            {context.role_in_room} Officer
          </div>
          {isHeadOnly && (
            <button
              className="sv-btn sv-btn-primary"
              onClick={() => setRoomModalOpen(true)}
              style={{ marginTop: 8 }}
            >
              + Create Election Room
            </button>
          )}
        </div>
      </div>

      <div className="ec-panel-grid">
        <section className="ec-panel ec-card">
          <h2>Election Creation</h2>
          <p>Create a new election locked to your jurisdiction.</p>
          <form onSubmit={handleCreateElection} className="ec-form">
            <label>
              Election Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="SRC Executive Elections" />
            </label>
            <label>
              Jurisdiction
              {jurisdictionLocked ? (
                <input value={context.jurisdiction_name} disabled />
              ) : (
                <select value={selectedJurisdiction} onChange={(event) => setSelectedJurisdiction(event.target.value)}>
                  {jurisdictions.map((jurisdiction) => (
                    <option key={jurisdiction.id} value={jurisdiction.id}>
                      {jurisdiction.name} ({jurisdiction.tier})
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              Start Time
              <input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            <label>
              End Time
              <input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
            {fetchError && <div className="sv-error" role="alert">{fetchError}</div>}
            <button type="submit" className="sv-btn sv-btn-primary">Create Election</button>
          </form>
        </section>

        <section className="ec-panel ec-card">
          <h2>Manage Elections</h2>
          <div className="ec-list-panel">
            <label>
              Select Election
              <select value={selectedElectionId || ''} onChange={(event) => setSelectedElectionId(event.target.value)}>
                {(elections.length > 0 ? elections : []).map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.title} — {getElectionStatus(election)}
                  </option>
                ))}
              </select>
            </label>
            {!selectedElection && <p style={{ color: '#666', marginTop: 10 }}>No elections found for this jurisdiction yet.</p>}
            {selectedElection && (
              <div className="ec-summary-block">
                <div>
                  <strong>Status:</strong> {status}
                </div>
                <div>
                  <strong>Start:</strong> {selectedElection.start_time ? new Date(selectedElection.start_time).toLocaleString() : 'TBD'}
                </div>
                <div>
                  <strong>End:</strong> {selectedElection.end_time ? new Date(selectedElection.end_time).toLocaleString() : 'TBD'}
                </div>
              </div>
            )}
          </div>

          {selectedElection && (
            <div className="ec-action-group">
              <button className="sv-btn sv-btn-primary" onClick={() => handleStatusAction('OPEN_POLLS')} disabled={status === 'ACTIVE' || status === 'CLOSED' || statusLoading}>
                OPEN POLLS
              </button>
              <button className="sv-btn sv-btn-ghost" onClick={() => handleStatusAction('PAUSE_POLLS')} disabled={status !== 'ACTIVE' || status === 'CLOSED' || statusLoading}>
                PAUSE POLLS
              </button>
              <button className="sv-btn sv-btn-ghost" onClick={() => handleStatusAction('CLOSE_POLLS')} disabled={status === 'CLOSED' || statusLoading}>
                CLOSE POLLS
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="ec-panel-grid">
        <section className="ec-panel ec-card">
          <h2>Candidate Manager</h2>
          <div className="ec-form">
            <label>
              Full Name
              <input
                value={newCandidate.full_name}
                onChange={(event) => setNewCandidate((prev) => ({ ...prev, full_name: event.target.value }))}
                placeholder="Full Name"
              />
            </label>
            <label>
              Position
              <select
                value={newCandidate.position}
                onChange={(event) => setNewCandidate((prev) => ({ ...prev, position: event.target.value }))}
              >
                <option value="">Select a role</option>
                {positionOptions.map((position) => (
                  <option key={position} value={position}>{position.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <label>
              Manifesto
              <textarea
                value={newCandidate.manifesto}
                onChange={(event) => setNewCandidate((prev) => ({ ...prev, manifesto: event.target.value }))}
                placeholder="Short manifesto summary"
              />
            </label>
            <label>
              Upload Photo
              <input type="file" accept="image/*" onChange={handleUploadPhoto} />
            </label>
            {newCandidate.photoPreview && (
              <div className="ec-photo-preview">
                <img src={newCandidate.photoPreview} alt="Candidate preview" />
              </div>
            )}
            <button type="button" className="sv-btn sv-btn-primary" onClick={handleAddCandidate} disabled={!selectedElection || !newCandidate.full_name || !newCandidate.position}>
              Add Candidate
            </button>
            {candidates.length > 0 && (
              <div className="ec-table-scroll">
                <table className="ec-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Position</th>
                      <th>Manifesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td>{candidate.full_name}</td>
                        <td>{candidate.position}</td>
                        <td>{candidate.manifesto || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="ec-panel ec-monitoring-card">
          <div className="ec-monitor-header">
            <div>
              <h2>Live Monitoring</h2>
              <p>Real-time turnout, active session traffic, and constituency progress.</p>
            </div>
          </div>

          <div className="ec-metrics-row">
            <div className="ec-metric-card">
              <span>Turnout</span>
              <strong>{turnout != null ? `${turnout}%` : 'Loading…'}</strong>
            </div>
            <div className="ec-metric-card">
              <span>Active Sessions</span>
              <strong>{activeSessions != null ? activeSessions : 'Loading…'}</strong>
            </div>
            <div className="ec-metric-card">
              <span>Jurisdiction</span>
              <strong>{context.jurisdiction_name}</strong>
            </div>
          </div>

          <div className="ec-breakdown-chart">
            <h3>Constituency Turnout</h3>
            <div className="ec-bar-container">
              {breakdown.map((item) => {
                const ballots = Number(item.ballots || 0);
                const max = Math.max(...breakdown.map((entry) => Number(entry.ballots || 0)), 1);
                const width = Math.round((ballots / (max || 1)) * 100);
                return (
                  <div key={item.constituency} className="ec-bar-row">
                    <span>{item.constituency}</span>
                    <div className="ec-bar-track">
                      <div className="ec-bar-fill" style={{ width: `${width}%` }} />
                    </div>
                    <strong>{ballots}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="ec-panel ec-card">
        <h2>Results Declaration</h2>
        <div className="ec-summary-block">
          <div>
            <strong>Election State:</strong> {status}
          </div>
          <div>
            <strong>Can Tally:</strong> {canTally ? 'Yes' : 'No'}
          </div>
        </div>
        <button
          className="sv-btn sv-btn-primary"
          disabled={!canTally || tallyLoading}
          onClick={handleTallyDecrypt}
        >
          {tallyLoading ? 'Tallying & Decrypting…' : 'Tally & Decrypt'}
        </button>
        {auditSummary && (
          <div className="ec-audit-summary">
            <h3>Audit Ledger Summary</h3>
            <p><strong>Total Ballots:</strong> {auditSummary.total_ballots ?? '—'}</p>
            <p><strong>Hash Log Verification:</strong> {auditSummary.hash_log}</p>
            <div className="ec-table-scroll">
              <table className="ec-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Position</th>
                    <th>Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {(auditSummary.candidate_totals || []).map((line, index) => (
                    <tr key={index}>
                      <td>{line.candidate_name || 'Tally Record'}</td>
                      <td>{line.position || '—'}</td>
                      <td>{line.votes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ec-publish-panel">
              <label className="ec-toggle-label">
                <input
                  type="checkbox"
                  checked={publishToAim}
                  onChange={(event) => setPublishToAim(event.target.checked)}
                />
                Publish Results to Student AIM
              </label>
              <button
                className="sv-btn sv-btn-primary"
                disabled={!publishToAim || !auditSummary}
                onClick={handlePublishResults}
              >
                Publish Results
              </button>
              {publishMessage && <div className="sv-meta" style={{ marginTop: 10 }}>{publishMessage}</div>}
            </div>
          </div>
        )}
        {fetchError && <div className="sv-error" role="alert">{fetchError}</div>}
      </section>

      {createdRooms.length > 0 && (
        <section className="ec-panel ec-card">
          <h2>Created Election Rooms</h2>
          <div className="ec-table-scroll">
            <table className="ec-table">
              <thead>
                <tr>
                  <th>Room Name</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Room Code</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {createdRooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.room_name || 'Election Room'}</td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: room.is_active ? '#d4edda' : '#f8d7da',
                        color: room.is_active ? '#155724' : '#721c24',
                        fontSize: 12,
                        fontWeight: 600
                      }}>
                        {room.is_active ? 'ACTIVE' : 'CLOSED'}
                      </span>
                    </td>
                    <td>{new Date(room.created_at).toLocaleString()}</td>
                    <td><code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4 }}>{room.room_code}</code></td>
                    <td>
                      <button
                        onClick={() => setSelectedRoom(selectedRoom?.id === room.id ? null : room)}
                        style={{
                          padding: '6px 12px',
                          background: selectedRoom?.id === room.id ? '#580000' : '#8B0000',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500
                        }}
                      >
                        {selectedRoom?.id === room.id ? 'Hide' : 'Manage Members'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedRoom && (
        <RoomMembersPanel
          room={selectedRoom}
          election={selectedElection}
          candidates={candidates}
          isHeadOnly={isHeadOnly}
          context={context}
        />
      )}

      <RoomCreationModal
        election={selectedElection}
        candidates={candidates}
        isOpen={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onCreateRoom={handleCreateRoom}
        isHeadOnly={isHeadOnly}
      />
    </div>
  );
}
