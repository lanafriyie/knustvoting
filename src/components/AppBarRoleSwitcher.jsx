import React, { useState } from 'react';

/**
 * AppBarRoleSwitcher Component
 * Displays in top navigation bar when user has dual identity (EC member + voter)
 * Allows switching between "Student View" and "EC Admin Console"
 */
export default function AppBarRoleSwitcher({ 
  hasECAccess, 
  ecRole, 
  ecJurisdictionName, 
  currentView,  // 'student' or 'ec-admin'
  onViewChange  // callback: (view: 'student' | 'ec-admin') => void
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!hasECAccess) {
    // Regular voter - no role switcher
    return null;
  }

return (
    <div className="sv-role-switcher-wrap" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8,
      position: 'relative'
    }}>
      {/* Current View Badge */}
      <div style={{
        padding: '6px 12px',
        background: currentView === 'ec-admin' ? '#1976d2' : '#757575',
        color: '#fff',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap'
      }}>
        {currentView === 'ec-admin' ? '🔐 EC Admin' : '👤 Student View'}
      </div>

      {/* Role Switcher Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            padding: '8px 12px',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          aria-label="Switch view"
        >
          {currentView === 'student' ? '👤' : '🔐'} Switch
          <span style={{ fontSize: 10 }}>▼</span>
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 4,
            marginTop: 4,
            minWidth: 200,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
          }}>
            {/* Student View Option */}
            <button
              onClick={() => {
                onViewChange('student');
                setIsDropdownOpen(false);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                background: currentView === 'student' ? '#e8f5e9' : '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                borderBottom: '1px solid #f0f0f0',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (currentView !== 'student') e.target.style.background = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = currentView === 'student' ? '#e8f5e9' : '#fff';
              }}
            >
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                👤 Student View
                {currentView === 'student' && <span style={{ marginLeft: 'auto' }}>✓</span>}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                Cast votes and view eligible elections
              </div>
            </button>

            {/* EC Admin Option */}
            <button
              onClick={() => {
                onViewChange('ec-admin');
                setIsDropdownOpen(false);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                background: currentView === 'ec-admin' ? '#e3f2fd' : '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (currentView !== 'ec-admin') e.target.style.background = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = currentView === 'ec-admin' ? '#e3f2fd' : '#fff';
              }}
            >
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                🔐 EC Admin Console
                {currentView === 'ec-admin' && <span style={{ marginLeft: 'auto' }}>✓</span>}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                Manage polls, monitor turnout ({ecRole} • {ecJurisdictionName})
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
