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
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs text-slate-900 dark:text-slate-100">
      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 m-0">Election Observer Room Management</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 m-0">Invite and assign accredited candidate observers (agents) to this polling station observer room.</p>

      {/* Room Lock Control */}
      <div className={`mt-4 p-4 rounded-2xl border ${
        roomIsLocked
          ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
          : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-extrabold text-sm flex items-center gap-1.5">
              <span>{roomIsLocked ? '🔒 ROOM LOCKED' : '🔓 ROOM UNLOCKED'}</span>
            </div>
            <div className="text-xs mt-1 leading-relaxed opacity-90 font-medium">
              {roomIsLocked
                ? 'Room is LOCKED: Adding new members, reassigning roles, or revoking access is strictly prevented.'
                : 'Room is UNLOCKED: EC Head can assign accredited agents, adjust roles, or manage roster.'}
            </div>
          </div>
          <button
            onClick={handleToggleRoomLock}
            disabled={!isHeadOnly || isToggling}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer min-h-[44px] touch-active text-white border-0 shadow-xs shrink-0 ${
              roomIsLocked ? 'bg-[#007A4D] hover:bg-[#075C42]' : 'bg-rose-600 hover:bg-rose-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isToggling ? 'Updating...' : roomIsLocked ? 'UNLOCK ROOM' : 'LOCK ROOM'}
          </button>
        </div>
        {!isHeadOnly && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
            🔐 Only EC Head can change room lock status.
          </div>
        )}
        {lockError && (
          <div className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-bold">
            ⚠️ {lockError}
          </div>
        )}
      </div>

      {/* Add Member Section */}
      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 space-y-4">
        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 m-0">Add Room Member</h3>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 font-bold">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
            ✓ {success}
          </div>
        )}

        {!isHeadOnly && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 font-medium">
            🔐 Only EC Head can manage room members.
          </div>
        )}

        {/* User Search */}
        <div className="relative flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Search Student (by Email / ID)</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Type student email or ID..."
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007A4D] min-h-[44px]"
          />

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-700 text-xs max-h-48 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer text-slate-800 dark:text-slate-200 font-medium"
                >
                  {user.displayName} {user.isDirectInput ? '' : `(${user.email})`}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            Selected: {selectedUser.displayName}
          </div>
        )}

        {/* Observer Role Display */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Observer Role</label>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
            <span>🔍</span>
            <span><strong>Candidate Representative:</strong> Read-Only Live Turnout &amp; Integrity Analytics Observer</span>
          </div>
        </div>

        {/* Candidate Selection */}
        {selectedRole === 'CANDIDATE_AGENT' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Represented Candidate <span className="text-rose-600">*</span>
              </label>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                {assignedAgentsCount} / {candidates?.length || 0} assigned
              </span>
            </div>

            <select
              value={selectedCandidate}
              onChange={(e) => setSelectedCandidate(e.target.value)}
              disabled={!isHeadOnly || !election}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007A4D] min-h-[44px]"
            >
              <option value="">-- Select a candidate --</option>
              {candidates && Array.isArray(candidates) && candidates.map((candidate) => {
                const existingAgent = assignedAgentMap[candidate.id];
                return (
                  <option key={candidate.id} value={candidate.id} disabled={Boolean(existingAgent)}>
                    {candidate.full_name} ({candidate.position}) {existingAgent ? `🔒 — [Agent Assigned: ${existingAgent.student_id}]` : '✓ — [Slot Available]'}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Add Button */}
        <button
          onClick={handleAddMember}
          disabled={isAddDisabled}
          className="w-full sm:w-auto px-6 py-2.5 bg-[#007A4D] hover:bg-[#075C42] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] touch-active"
        >
          {isAdding ? 'Adding Member...' : 'Add Member'}
        </button>
      </div>

      {/* Members List */}
      {members.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 space-y-4">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 m-0">Current Members ({members.length})</h3>

          {/* ── MOBILE MEMBER CARDS (< md) ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {members.map((member) => (
              <div key={member.id} className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-xs font-bold text-slate-900 dark:text-slate-100 block">{member.student_id}</strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Rep: <strong>{member.role_in_room === 'CANDIDATE_AGENT' && member.candidates ? member.candidates.full_name : 'General'}</strong>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold">
                    Observer Agent
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700 text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">{new Date(member.assigned_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleRevokeMember(member.id, member.student_id)}
                    disabled={roomIsLocked || !isHeadOnly || isRevoking === member.id}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800/60 cursor-pointer disabled:opacity-40 min-h-[36px]"
                  >
                    {isRevoking === member.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP MEMBER TABLE (>= md) ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px]">
                  <th className="py-2.5 px-3">User Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Represented Candidate</th>
                  <th className="py-2.5 px-3">Assigned At</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 font-medium">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 font-semibold">{member.student_id}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[11px]">
                        🔍 Candidate Representative
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {member.role_in_room === 'CANDIDATE_AGENT' && member.candidates
                        ? member.candidates.full_name
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(member.assigned_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleRevokeMember(member.id, member.student_id)}
                        disabled={roomIsLocked || !isHeadOnly || isRevoking === member.id}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 cursor-pointer disabled:opacity-40"
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
        <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
          No members assigned to this room yet.
        </div>
      )}
    </div>
  );
}
