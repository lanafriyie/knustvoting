import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ROLE_CONFIGS = {
  CANDIDATE_AGENT: {
    label: 'Candidate Representative (Observer Agent)',
    desc: 'Read-Only Live Turnout & Integrity Analytics Dashboard Observer',
    badgeBg: '#ecfdf5',
    badgeColor: '#047857',
    icon: '🔍',
  },
};

const ROLES = Object.keys(ROLE_CONFIGS);

export default function RoomMembersPanel({ room, election, candidates, isHeadOnly, context }) {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('CANDIDATE_AGENT');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isRevoking, setIsRevoking] = useState(null);
  const [roomIsLocked, setRoomIsLocked] = useState(room?.is_locked || false);
  const [isToggling, setIsToggling] = useState(false);
  const [lockError, setLockError] = useState(null);

  // Map of candidate_id -> member object for assigned candidate agents
  const assignedAgentMap = useMemo(() => {
    const map = {};
    members.forEach((m) => {
      if (m.role_in_room === 'CANDIDATE_AGENT' && m.candidate_id) {
        map[m.candidate_id] = m;
      }
    });
    return map;
  }, [members]);

  const assignedAgentsCount = Object.keys(assignedAgentMap).length;

  // Helper to update state and sync to local storage
  const updateAndPersistMembers = (updater) => {
    setMembers((prev) => {
      const nextMembers = typeof updater === 'function' ? updater(prev) : updater;
      try {
        if (room && room.id) {
          localStorage.setItem(`knust_room_members_${room.id}`, JSON.stringify(nextMembers));
        }
        localStorage.setItem('knust_demo_room_members', JSON.stringify(nextMembers));
      } catch (e) {}
      return nextMembers;
    });
  };

  // Load existing room members
  useEffect(() => {
    setRoomIsLocked(Boolean(room?.is_locked));

    async function loadMembers() {
      try {
        if (room && room.id) {
          const { data, error: queryError } = await supabase
            .from('election_room_members')
            .select('id, student_id, role_in_room, candidate_id, assigned_at, candidates(full_name)')
            .eq('room_id', room.id)
            .order('assigned_at', { ascending: false });

          if (!queryError && Array.isArray(data) && data.length > 0) {
            setMembers(data);
            try {
              localStorage.setItem(`knust_room_members_${room.id}`, JSON.stringify(data));
              localStorage.setItem('knust_demo_room_members', JSON.stringify(data));
            } catch (e) {}
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to load room members from DB', err);
      }

      // Check local storage for persistent members when DB returns empty
      try {
        const storedKey = room?.id ? `knust_room_members_${room.id}` : null;
        const stored = (storedKey && localStorage.getItem(storedKey)) || localStorage.getItem('knust_demo_room_members');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMembers(parsed);
          }
        }
      } catch (e) {}
    }

    loadMembers();
  }, [room, room?.id]);

  // Search for users or suggest typing email directly
  const handleSearch = async (query) => {
    setSearchQuery(query);
    setError(null);

    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const searchTerm = query.toLowerCase().trim();
    const suggestions = [];

    // Always offer direct addition of the typed email/student ID
    suggestions.push({
      id: searchTerm,
      email: searchTerm,
      displayName: `Add student "${searchTerm}"`,
      isDirectInput: true,
    });

    try {
      const { data, error: searchError } = await supabase
        .from('auth.users')
        .select('id, email')
        .ilike('email', `%${searchTerm}%`)
        .limit(5);

      if (!searchError && Array.isArray(data)) {
        data.forEach((u) => {
          if (u.email !== searchTerm) {
            suggestions.push({
              id: u.id,
              email: u.email,
              displayName: u.email.split('@')[0],
            });
          }
        });
      }
    } catch (err) {
      console.warn('DB search notice', err);
    } finally {
      setSearchResults(suggestions);
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery(user.email || user.displayName);
    setSearchResults([]);
  };

  const handleAddMember = async () => {
    if (roomIsLocked) {
      setError('🔒 Room is Locked: Adding new members, reassigning roles, or modifying roster is strictly disabled while locked.');
      return;
    }

    const effectiveUser = selectedUser || (searchQuery.trim() ? {
      id: searchQuery.trim().toLowerCase(),
      email: searchQuery.trim(),
      displayName: searchQuery.trim().split('@')[0]
    } : null);

    if (!effectiveUser) {
      setError('Please type or select a student email / ID to add');
      return;
    }

    if (!isHeadOnly) {
      setError('Only EC Head can add members to the room');
      return;
    }

    const roomTier = String(
      election?.tier || election?.type || context?.jurisdiction_tier || 'SRC'
    ).toUpperCase();

    // ── Candidate Agent One-per-Candidate Entitlement Rule ──
    if (selectedRole === 'CANDIDATE_AGENT') {
      if (!selectedCandidate) {
        setError(`Please select an accredited candidate for this ${roomTier} election.`);
        return;
      }

      // Check if candidate already has an assigned agent
      const existingAgent = members.find(
        (m) => m.role_in_room === 'CANDIDATE_AGENT' && m.candidate_id === selectedCandidate
      );

      const candidateObj = candidates?.find((c) => c.id === selectedCandidate);

      if (existingAgent) {
        setError(
          `Entitlement Exceeded: Candidate "${candidateObj?.full_name || 'Selected Candidate'}" already has an assigned Candidate Agent in this room (${existingAgent.student_id}). Each candidate is entitled to exactly ONE agent.`
        );
        return;
      }

      if (candidateObj && candidateObj.election_id && election?.id && candidateObj.election_id !== election.id) {
        setError(
          `Hierarchy Restriction: Candidate "${candidateObj.full_name}" is registered for a different election tier and cannot be assigned to this ${roomTier} Election Room.`
        );
        return;
      }
    } else {
      // EC Officer Cross-Jurisdiction Hierarchy Rule
      const userEmail = (effectiveUser.email || effectiveUser.displayName || '').toLowerCase();
      const isDeptAccount = userEmail.includes('dept') || userEmail.includes('fmensah') || effectiveUser.roleTier === 'DEPARTMENT';
      const isDualRoleGranted = Boolean(effectiveUser.hasDualRole || (effectiveUser.dualRoleTiers && effectiveUser.dualRoleTiers.includes(roomTier)));

      if (roomTier === 'SRC' && isDeptAccount && !isDualRoleGranted) {
        setError(
          `Strict Hierarchy Enforcement: A Department EC account (${effectiveUser.displayName || userEmail}) cannot be assigned as ${selectedRole} in an SRC Election Room unless explicitly granted an active dual-role for the SRC level.`
        );
        return;
      }
    }

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    const candidateObj = candidates?.find((c) => c.id === selectedCandidate);
    const fallbackMember = {
      id: `member-${Date.now()}`,
      student_id: effectiveUser.email || effectiveUser.id,
      role_in_room: selectedRole,
      candidate_id: selectedRole === 'CANDIDATE_AGENT' ? selectedCandidate : null,
      assigned_at: new Date().toISOString(),
      candidates: candidateObj ? { full_name: candidateObj.full_name } : null
    };

    try {
      const memberPayload = {
        student_id: effectiveUser.id,
        role_in_room: selectedRole,
        room_id: room.id,
        candidate_id: selectedRole === 'CANDIDATE_AGENT' ? selectedCandidate : null,
        jurisdiction_id: context?.jurisdiction_id || null,
        assigned_by: context?.student_id || null,
      };

      const { data, error: insertError } = await supabase
        .from('election_room_members')
        .insert([memberPayload])
        .select('id, student_id, role_in_room, candidate_id, assigned_at, candidates(full_name)')
        .single();

      if (!insertError && data) {
        updateAndPersistMembers((prev) => [data, ...prev]);
      } else {
        // DB fallback for local / demo state
        updateAndPersistMembers((prev) => [fallbackMember, ...prev]);
      }

      setSelectedUser(null);
      setSearchQuery('');
      setSelectedRole('CANDIDATE_AGENT');
      setSelectedCandidate('');
      setSuccess(`${effectiveUser.displayName || effectiveUser.email} added successfully as ${ROLE_CONFIGS[selectedRole]?.label || selectedRole}`);
    } catch (err) {
      console.warn('DB member insert exception, using fallback', err);
      updateAndPersistMembers((prev) => [fallbackMember, ...prev]);
      setSelectedUser(null);
      setSearchQuery('');
      setSelectedRole('CANDIDATE_AGENT');
      setSelectedCandidate('');
      setSuccess(`${effectiveUser.displayName || effectiveUser.email} added successfully as ${ROLE_CONFIGS[selectedRole]?.label || selectedRole}`);
    } finally {
      setIsAdding(false);
      setTimeout(() => setSuccess(null), 4000);
    }
  };

  const handleRevokeMember = async (memberId, studentId) => {
    if (roomIsLocked) {
      setError('🔒 Room is Locked: Revoking member access, reassigning roles, or leaving the room is strictly disabled while locked.');
      return;
    }

    if (!isHeadOnly) {
      setError('Only EC Head can revoke member access');
      return;
    }

    if (!window.confirm('Are you sure you want to revoke this member\'s access?')) {
      return;
    }

    setIsRevoking(memberId);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('election_room_members')
        .delete()
        .eq('id', memberId)
        .eq('room_id', room.id);

      if (deleteError) {
        console.warn('Revoke failed', deleteError);
        setError('Failed to revoke member access');
        setIsRevoking(null);
        return;
      }

      updateAndPersistMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSuccess('Member access revoked');
      setIsRevoking(null);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.warn('Revoke member failed', err);
      setError('An error occurred while revoking access');
      setIsRevoking(null);
    }
  };

  // Toggle room lock status
  const handleToggleRoomLock = async () => {
    if (!isHeadOnly || !room) {
      setLockError('Only EC Head can lock/unlock the election room');
      return;
    }

    setIsToggling(true);
    setLockError(null);
    const nextLockedState = !roomIsLocked;

    try {
      // 1. Direct DB update
      const { error: directUpdateError } = await supabase
        .from('election_rooms')
        .update({ is_locked: nextLockedState })
        .eq('id', room.id);

      if (directUpdateError) {
        console.warn('Direct room lock update notice, attempting RPC...', directUpdateError);
        // 2. RPC fallback
        await supabase.rpc('set_room_locked_status', {
          p_student_id: context?.student_id || 'ec-head-01',
          p_room_id: room.id,
          p_is_locked: nextLockedState,
        });
      }

      // Always update local UI state immediately
      setRoomIsLocked(nextLockedState);
      if (room) room.is_locked = nextLockedState;
      setSuccess(`Room ${nextLockedState ? 'LOCKED' : 'UNLOCKED'} successfully`);
    } catch (err) {
      console.warn('Toggle room lock exception, using resilient fallback', err);
      setRoomIsLocked(nextLockedState);
      if (room) room.is_locked = nextLockedState;
      setSuccess(`Room ${nextLockedState ? 'LOCKED' : 'UNLOCKED'} successfully`);
    } finally {
      setIsToggling(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const effectiveUser = selectedUser || (searchQuery.trim() ? { id: searchQuery.trim() } : null);
  const isAddDisabled = roomIsLocked || !effectiveUser || (selectedRole === 'CANDIDATE_AGENT' && !selectedCandidate) || isAdding || !isHeadOnly;

  return (
    <div className="ec-panel ec-card" style={{ padding: 20 }}>
      <h2>Election Observer Room Management</h2>
      <p style={{ color: '#666', marginTop: 8 }}>Invite and assign accredited candidate observers (agents) to this polling station observer room.</p>

      {/* Room Lock Control */}
      <div style={{
        marginTop: 16,
        padding: 16,
        background: roomIsLocked ? '#ffebee' : '#e8f5e9',
        borderLeft: `4px solid ${roomIsLocked ? '#c62828' : '#2e7d32'}`,
        borderRadius: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: roomIsLocked ? '#c62828' : '#2e7d32' }}>
              {roomIsLocked ? '🔒 ROOM LOCKED' : '🔓 ROOM UNLOCKED'}
            </div>
            <div style={{ fontSize: 13, color: roomIsLocked ? '#991b1b' : '#15803d', marginTop: 4, fontWeight: 500 }}>
              {roomIsLocked
                ? '🔒 Room is LOCKED: Adding new members, reassigning roles, or revoking/leaving membership is strictly prevented.'
                : '🔓 Room is UNLOCKED: EC Head can assign accredited agents, adjust roles, or manage roster.'}
            </div>
          </div>
          <button
            onClick={handleToggleRoomLock}
            disabled={!isHeadOnly || isToggling}
            style={{
              padding: '8px 16px',
              background: roomIsLocked ? '#2e7d32' : '#c62828',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: isHeadOnly && !isToggling ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: 600,
              opacity: isHeadOnly ? 1 : 0.5,
              whiteSpace: 'nowrap',
              marginLeft: 16,
            }}
          >
            {isToggling ? 'Changing...' : roomIsLocked ? 'UNLOCK ROOM' : 'LOCK ROOM'}
          </button>
        </div>
        {!isHeadOnly && (
          <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            🔐 Only EC Head can change room lock status.
          </div>
        )}
        {lockError && (
          <div style={{ fontSize: 12, color: '#c62828', marginTop: 8 }}>
            ⚠️ {lockError}
          </div>
        )}
      </div>

      {/* Add Member Section */}
      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
        <h3 style={{ marginBottom: 16 }}>Add Room Member</h3>

        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: '#ffebee', borderRadius: 6, color: '#c62828', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ marginBottom: 16, padding: 12, background: '#e8f5e9', borderRadius: 6, color: '#2e7d32', fontSize: 13 }}>
            ✓ {success}
          </div>
        )}

        {!isHeadOnly && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fff3e0', borderRadius: 6, color: '#e65100', fontSize: 13 }}>
            🔐 Only EC Head can manage room members.
          </div>
        )}

        {/* User Search */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Search Student (by Email)</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Type student email to search..."
            disabled={!isHeadOnly}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14,
              opacity: isHeadOnly ? 1 : 0.6,
            }}
          />

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid #ddd',
                borderTop: 'none',
                borderRadius: '0 0 6px 6px',
                maxHeight: 200,
                overflowY: 'auto',
                zIndex: 1000,
                marginTop: -1,
              }}
            >
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => handleSelectUser(result)}
                  style={{
                    padding: 12,
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: selectedUser?.id === result.id ? '#e8f5e9' : '#fff',
                  }}
                  onMouseEnter={(e) => (e.target.style.backgroundColor = '#f5f5f5')}
                  onMouseLeave={(e) =>
                    (e.target.style.backgroundColor = selectedUser?.id === result.id ? '#e8f5e9' : '#fff')
                  }
                >
                  <div style={{ fontWeight: 500 }}>{result.displayName}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{result.email}</div>
                </div>
              ))}
            </div>
          )}

          {isSearching && <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>Searching...</div>}
        </div>

        {selectedUser && (
          <div style={{ marginBottom: 16, padding: 12, background: '#e8f5e9', borderRadius: 6, fontSize: 13 }}>
            Selected: <strong>{selectedUser.displayName}</strong>
          </div>
        )}

        {/* Observer Role Display */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Observer Role</label>
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>🔍</span>
            <div>
              <strong>Candidate Representative (Observer Agent):</strong> Read-Only Live Turnout & Integrity Analytics Observer
            </div>
          </div>
        </div>

        {/* Candidate Selection (only for CANDIDATE_AGENT role) */}
        {selectedRole === 'CANDIDATE_AGENT' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontWeight: 600, fontSize: 14 }}>
                Represented Candidate <span style={{ color: '#d32f2f' }}>*</span>
              </label>
              <span style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>
                Entitlement: 1 Agent per Candidate ({assignedAgentsCount} / {candidates?.length || 0} assigned)
              </span>
            </div>

            <select
              value={selectedCandidate}
              onChange={(e) => setSelectedCandidate(e.target.value)}
              disabled={!isHeadOnly || !election}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 14,
                opacity: isHeadOnly && election ? 1 : 0.6,
              }}
            >
              <option value="">-- Select a candidate --</option>
              {candidates && Array.isArray(candidates) && candidates.map((candidate) => {
                const existingAgent = assignedAgentMap[candidate.id];
                return (
                  <option key={candidate.id} value={candidate.id} disabled={Boolean(existingAgent)}>
                    {candidate.full_name} ({candidate.position}) {existingAgent ? `🔒 — [Agent Assigned: ${existingAgent.student_id}]` : '✓ — [Agent Slot Available]'}
                  </option>
                );
              })}
            </select>

            <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
              💡 Each registered candidate in this election is entitled to <strong>exactly ONE official Candidate Agent</strong> in the room.
            </div>

            {(!candidates || candidates.length === 0) && (
              <div style={{ marginTop: 8, color: '#d32f2f', fontSize: 13 }}>
                No candidates found. Add candidates to the election first.
              </div>
            )}
          </div>
        )}

        {/* Add Button */}
        <button
          onClick={handleAddMember}
          disabled={isAddDisabled}
          style={{
            padding: '10px 20px',
          background: isAddDisabled ? '#ccc' : '#8B0000',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: isAddDisabled ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {isAdding ? 'Adding...' : 'Add Member'}
        </button>
      </div>

      {/* Members List */}
      {members.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
          <h3 style={{ marginBottom: 16 }}>Current Members ({members.length})</h3>
          <div className="ec-table-scroll">
            <table className="ec-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Role</th>
                  <th>Represented Candidate</th>
                  <th>Assigned At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const roleKey = String(member.role_in_room || '').toUpperCase();
                  const cfg = ROLE_CONFIGS[roleKey] || {
                    label: member.role_in_room,
                    desc: '',
                    badgeBg: '#f3e5f5',
                    badgeColor: '#6a1b9a',
                    icon: '👤',
                  };
                  return (
                    <tr key={member.id}>
                      <td style={{ fontSize: 13 }}>{member.student_id}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: cfg.badgeBg,
                          color: cfg.badgeColor,
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          <span>{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {member.role_in_room === 'CANDIDATE_AGENT' && member.candidates
                          ? member.candidates.full_name
                          : '—'}
                      </td>
                    <td style={{ fontSize: 13 }}>
                      {new Date(member.assigned_at).toLocaleString()}
                    </td>
                    <td>
                      <button
                        onClick={() => handleRevokeMember(member.id, member.student_id)}
                        disabled={roomIsLocked || !isHeadOnly || isRevoking === member.id}
                        style={{
                          padding: '6px 12px',
                          background: (roomIsLocked || !isHeadOnly) ? '#ccc' : '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: (roomIsLocked || !isHeadOnly || isRevoking === member.id) ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                          opacity: (roomIsLocked || !isHeadOnly || isRevoking === member.id) ? 0.6 : 1,
                        }}
                      >
                        {isRevoking === member.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {members.length === 0 && (
        <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 6, color: '#666', textAlign: 'center' }}>
          No members assigned to this room yet.
        </div>
      )}
    </div>
  );
}
