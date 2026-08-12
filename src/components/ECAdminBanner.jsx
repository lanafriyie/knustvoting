import React from 'react';

/**
 * ECAdminBanner Component
 * Displayed at top of EC Admin Console when an EC member is viewing administrative features
 * Shows their personal vote status with clear labeling of dual-identity
 */
export default function ECAdminBanner({ 
  ecRole, 
  ecJurisdictionName, 
  currentElectionId,
  currentElectionTitle,
  voteStatus,
  loading
}) {
  if (!ecRole || !currentElectionTitle) {
    return null;
  }

  const hasVoted = voteStatus?.has_voted || false;
  const votedAtTime = voteStatus?.voted_at 
    ? new Date(voteStatus.voted_at).toLocaleString()
    : null;

  return (
    <div style={{
      background: '#fff3e0',
      border: '2px solid #ff9800',
      borderRadius: 8,
      padding: 16,
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          color: '#e65100',
          marginBottom: 8 
        }}>
          ⚠️ Dual-Identity Notice
        </div>
        
        <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
          <strong>You are viewing the EC Admin Console as an EC Commissioner.</strong>
          <br />
          <span style={{ color: '#666' }}>
            Role: <strong>{ecRole}</strong> • Jurisdiction: <strong>{ecJurisdictionName}</strong>
          </span>
          <br />
          <strong>Your personal voter status in "{currentElectionTitle}":</strong>
        </div>

        {/* Vote Status Badge */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: hasVoted ? '#c8e6c9' : '#ffccbc',
            color: hasVoted ? '#2e7d32' : '#d84315',
            fontWeight: 600,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}>
            {hasVoted ? '✓ VOTED' : '⊘ NOT VOTED'}
          </div>

          {votedAtTime && (
            <div style={{ fontSize: 12, color: '#666' }}>
              Voted at: {votedAtTime}
            </div>
          )}

          {loading && (
            <div style={{ fontSize: 12, color: '#999' }}>
              Checking vote status...
            </div>
          )}
        </div>
      </div>

      {/* Informational Icon */}
      <div style={{
        fontSize: 40,
        opacity: 0.3,
      }}>
        ℹ️
      </div>
    </div>
  );
}
