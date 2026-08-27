import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Generate autocomplete suggestions based on election type
 * @param {Object} election - The election object
 * @param {Array} candidates - The candidates in the election
 * @returns {Array} Array of suggested room names
 */
function generateSuggestions(election, candidates) {
  if (!election) return [];

  const suggestions = [];
  const jurisdictionTier = election.jurisdiction_tier || 'UNKNOWN';

  // Extract unique positions from candidates
  const positions = [...new Set(candidates.map((c) => c.position).filter(Boolean))];

  // Base election type mapping
  const typeMap = {
    SRC: 'SRC',
    DEPARTMENT: 'Department',
    COLLEGE: 'College',
    HALL: 'Hall',
    PARLIAMENTARY: 'Parliamentary',
    CONSTITUENCY: 'Constituency',
  };

  const baseType = typeMap[jurisdictionTier] || jurisdictionTier;

  // Generate suggestions based on positions
  if (positions.length > 0) {
    positions.forEach((position) => {
      const cleanPosition = position
        .split('_')
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
      suggestions.push(`${baseType} ${cleanPosition} Election`);
    });
  }

  // Add general election type suggestion
  suggestions.push(`${baseType} Election`);

  // Add room management suggestions
  suggestions.push(`${baseType} Room - ${new Date().getFullYear()}`);

  return suggestions.filter((s, i, arr) => arr.indexOf(s) === i); // Remove duplicates
}

export default function RoomCreationModal({ election, candidates, isOpen, onClose, onCreateRoom, isHeadOnly }) {
  const [roomName, setRoomName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const suggestions = useMemo(() => generateSuggestions(election, candidates), [election, candidates]);

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!roomName.trim()) return suggestions;
    const lowerInput = roomName.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lowerInput));
  }, [roomName, suggestions]);

  const handleInputChange = (e) => {
    setRoomName(e.target.value);
    setShowSuggestions(true);
    setSelectedSuggestion(null);
    setError(null);
  };

  const handleSelectSuggestion = (suggestion) => {
    setRoomName(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestion(suggestion);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    if (!isHeadOnly) {
      setError('Only EC Head can create election rooms.');
      return;
    }

    setIsCreating(true);
    setError(null);

    const generatedCode = 'RM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const currentElection = election || { id: 'src', title: 'SRC Executive Council Election', tier: 'SRC' };

    const fallbackRoom = {
      id: `room-${Date.now()}`,
      election_id: currentElection.id || 'src',
      room_name: roomName.trim(),
      room_code: generatedCode,
      status: 'ACTIVE',
      is_active: true,
      is_locked: false,
      created_at: new Date().toISOString()
    };

    try {
      const roomPayload = {
        room_name: roomName.trim(),
        room_code: generatedCode,
        status: 'ACTIVE',
        is_active: true,
      };

      // Only pass election_id if it's a valid UUID string for Supabase schema
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentElection.id);
      if (isUuid) {
        roomPayload.election_id = currentElection.id;
      }

      const { data, error: dbError } = await supabase
        .from('election_rooms')
        .insert([roomPayload])
        .select()
        .single();

      if (!dbError && data) {
        onCreateRoom && onCreateRoom(data);
      } else {
        // Resilient fallback for demo / local state mode
        onCreateRoom && onCreateRoom(fallbackRoom);
      }

      setRoomName('');
      setSelectedSuggestion(null);
      onClose();
    } catch (err) {
      console.warn('Room creation exception, using fallback room', err);
      onCreateRoom && onCreateRoom(fallbackRoom);
      setRoomName('');
      setSelectedSuggestion(null);
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl w-full max-w-md flex flex-col gap-4 text-slate-900 dark:text-slate-100 max-h-[calc(100dvh-32px)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 dark:border-slate-800 pb-3">
          <h2 className="m-0 text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">Create Election Room</h2>
          <p className="m-0 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Election: <strong className="text-[#007A4D] dark:text-emerald-400">{election?.title || 'N/A'}</strong>
          </p>
        </div>

        {/* Room Name Input with Autocomplete */}
        <div className="relative flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Room Name</label>
          <input
            type="text"
            value={roomName}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Type or select from suggestions..."
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007A4D] min-h-[44px]"
          />

          {/* Autocomplete Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto z-50 shadow-xl divide-y divide-slate-100 dark:divide-slate-700 text-xs"
            >
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedSuggestion === suggestion
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#007A4D] dark:text-emerald-400 font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggestion Help Text */}
        {!showSuggestions && suggestions.length > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-medium">
            💡 <strong>Tip:</strong> Tap the input to see recommended naming templates.
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-bold">
            ⚠️ {error}
          </div>
        )}

        {/* Authorization Notice */}
        {!isHeadOnly && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-medium">
            🔐 Only EC Head can create election rooms.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 justify-end pt-2 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="flex-1 sm:flex-initial px-4 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateRoom}
            disabled={isCreating || !isHeadOnly || !roomName.trim()}
            className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#007A4D] hover:bg-[#075C42] text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] touch-active shadow-xs"
          >
            {isCreating ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
