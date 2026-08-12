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

    try {
      const roomPayload = {
        election_id: election.id,
        room_name: roomName.trim(),
        status: 'ACTIVE',
        is_active: true,
      };

      const { data, error: dbError } = await supabase
        .from('election_rooms')
        .insert([roomPayload])
        .select()
        .single();

      if (dbError) {
        console.warn('Room creation failed', dbError);
        setError(dbError.message || 'Failed to create room. Please try again.');
        setIsCreating(false);
        return;
      }

      if (onCreateRoom && typeof onCreateRoom === 'function') {
        onCreateRoom(data);
      }

      setRoomName('');
      setSelectedSuggestion(null);
      onClose();
    } catch (err) {
      console.warn('Room creation exception', err);
      setError('An error occurred while creating the room.');
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 28,
          maxWidth: 500,
          width: '90%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 600 }}>Create Election Room</h2>
        <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: 14 }}>
          Election: <strong>{election?.title || 'N/A'}</strong>
        </p>

        {/* Room Name Input with Autocomplete */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Room Name</label>
          <input
            type="text"
            value={roomName}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Type or select from suggestions below..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />

          {/* Autocomplete Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
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
                zIndex: 10000,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  style={{
                    padding: '12px',
                    cursor: 'pointer',
                    background: selectedSuggestion === suggestion ? '#e8f5e9' : '#fff',
                    borderBottom: index < filteredSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.target.style.background = '#f5f5f5')}
                  onMouseLeave={(e) =>
                    (e.target.style.background = selectedSuggestion === suggestion ? '#e8f5e9' : '#fff')
                  }
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggestion Help Text */}
        {!showSuggestions && suggestions.length > 0 && (
          <div style={{ marginBottom: 20, padding: 12, background: '#f0f7ff', borderRadius: 6, fontSize: 13, color: '#0066cc' }}>
            💡 <strong>Tip:</strong> Click the input field to see suggested room names
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{ marginBottom: 20, padding: 12, background: '#ffebee', borderRadius: 6, fontSize: 13, color: '#c62828' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Authorization Notice */}
        {!isHeadOnly && (
          <div style={{ marginBottom: 20, padding: 12, background: '#fff3e0', borderRadius: 6, fontSize: 13, color: '#e65100' }}>
            🔐 Only EC Head can create election rooms. Your current role cannot perform this action.
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              padding: '10px 16px',
              border: '1px solid #ddd',
              background: '#fff',
              borderRadius: 6,
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              opacity: isCreating ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateRoom}
            disabled={isCreating || !isHeadOnly || !roomName.trim()}
            style={{
              padding: '10px 20px',
          background: isHeadOnly && !isCreating ? '#8B0000' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: isHeadOnly && !isCreating && roomName.trim() ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 600,
              opacity: isCreating ? 0.7 : 1,
            }}
          >
            {isCreating ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
