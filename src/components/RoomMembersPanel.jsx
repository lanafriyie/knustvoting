import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ROLES = ['HEAD', 'DEPUTY', 'PRO', 'ORGANIZER', 'SECRETARY', 'CANDIDATE_AGENT'];

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

  // Load existing room members
  useEffect(() => {
    if (!room || !room.id) return;

    async function loadMembers() {
      try {
        const { data, error: queryError } = await supabase
          .from('election_room_members')
          .select('id, student_id, role_in_room, candidate_id, assigned_at, candidates(full_name)')
          .eq('room_id', room.id)
          .order('assigned_at', { ascending: false });

        if (!queryError && Array.isArray(data)) {
          setMembers(data);
        }
      } catch (err) {
        console.warn('Failed to load room members', err);
      }
    }

    loadMembers();
  }, [room, room?.id]);

  // Search for users to add
  const handleSearch = async (query) => {
    setSearchQuery(query);
    setError(null);

    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search by student_id (if looks like a UUID) or by auth user email/metadata
      const searchTerm = query.toLowerCase();
      
      // Since we need to search in auth.users or a students table, we'll do a broad search
      // For now, simulate with empty results - in production this would query a students table
      // or use a search function
      const { data, error: searchError } = await supabase
        .from('auth.users')
        .select('id, email', { count: 'exact', head: false })
        .ilike('email', `%${searchTerm}%`)
        .limit(10);

      if (!searchError && Array.isArray(data)) {
        setSearchResults(
          data.map((user) => ({
            id: user.id,
            email: user.email,
            displayName: user.email.split('@')[0],
          }))
        );
      }
    } catch (err) {
      console.warn('Search failed', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery(user.displayName || user.email);
    setSearchResults([]);
  };

  const handleAddMember = async () => {
    if (!selectedUser) {
      setError('Please select a user to add');
      return;
    }

    if (selectedRole === 'CANDIDATE_AGENT' && !selectedCandidate) {
      setError('Please select a candidate for the Candidate Agent role');
      return;
    }

    if (!isHeadOnly) {
      setError('Only EC Head can add members to the room');
      return;
    }

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const memberPayload = {
        student_id: selectedUser.id,
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

      if (insertError) {
        console.warn('Member insertion failed', insertError);
        setError(insertError.message || 'Failed to add member. They may already be assigned to this room.');
        setIsAdding(false);
        return;
      }

      setMembers((prev) => [data, ...prev]);
      setSelectedUser(null);
      setSearchQuery('');
      setSelectedRole('CANDIDATE_AGENT');
      setSelectedCandidate('');
      setSuccess(`${selectedUser.displayName} added successfully as ${selectedRole}`);
      setIsAdding(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.warn('Add member failed', err);
      setError('An error occurred while adding the member');
      setIsAdding(false);
    }
  };

  const handleRevokeMember = async (memberId, studentId) => {
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

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
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

    try {
      const { data, error: toggleError } = await supabase.rpc(
        'set_room_locked_status',
        {
          p_student_id: context?.student_id,
          p_room_id: room.id,
          p_is_locked: !roomIsLocked,
        }
      );

      if (toggleError) {
        console.warn('Lock toggle failed', toggleError);
        setLockError(toggleError.message || 'Failed to change room lock status');
        setIsToggling(false);
        return;
      }

      setRoomIsLocked(!roomIsLocked);
      setSuccess(`Room ${!roomIsLocked ? 'LOCKED' : 'UNLOCKED'} successfully`);
      setIsToggling(false);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.warn('Toggle room lock failed', err);
      setLockError('An error occurred while changing lock status');
      setIsToggling(false);
    }
  };

  const isAddDisabled = !selectedUser || (selectedRole === 'CANDIDATE_AGENT' && !selectedCandidate) || isAdding || !isHeadOnly;

  return (
    <div className="ec-panel ec-card" style={{ padding: 20 }}>
      <h2>Election Room Members & Candidate Agents</h2>
      <p style={{ color: '#666', marginTop: 8 }}>Invite and assign EC officers and candidate observers to this election room.</p>

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
            <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
              {roomIsLocked
                ? 'Election room is LOCKED. No new votes can be submitted.'
                : 'Election room is OPEN. Voters can submit ballots.'}
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

        {/* Role Selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Assign Role</label>
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setSelectedCandidate('');
            }}
            disabled={!isHeadOnly}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14,
              opacity: isHeadOnly ? 1 : 0.6,
            }}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* Candidate Selection (only for CANDIDATE_AGENT role) */}
        {selectedRole === 'CANDIDATE_AGENT' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Represented Candidate <span style={{ color: '#d32f2f' }}>*</span>
            </label>
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
              {candidates && Array.isArray(candidates) && candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.full_name} ({candidate.position})
                </option>
              ))}
            </select>
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
                {members.map((member) => (
                  <tr key={member.id}>
                    <td style={{ fontSize: 13 }}>{member.student_id}</td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: member.role_in_room === 'CANDIDATE_AGENT' ? '#e3f2fd' : '#f3e5f5',
                        color: member.role_in_room === 'CANDIDATE_AGENT' ? '#1976d2' : '#6a1b9a',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {member.role_in_room}
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
                        disabled={!isHeadOnly || isRevoking === member.id}
                        style={{
                          padding: '6px 12px',
                          background: isHeadOnly ? '#dc2626' : '#ccc',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: isHeadOnly && isRevoking !== member.id ? 'pointer' : 'not-allowed',
                          fontSize: 12,
                          fontWeight: 500,
                          opacity: isRevoking === member.id ? 0.6 : 1,
                        }}
                      >
                        {isRevoking === member.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
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
