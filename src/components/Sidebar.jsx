import React, { useState } from 'react';
import StepUpAuthModal from './StepUpAuthModal';
import AppBarRoleSwitcher from './AppBarRoleSwitcher';
import '../styles/SecureVote.css';

export default function Sidebar({
  navigate,
  hasECAccess,
  ecRole,
  ecJurisdictionName,
  currentView,
  onViewChange,
  onNavigate  // auto-close mobile drawer after clicking a link
}) {
  const [isStepUpOpen, setStepUpOpen] = useState(false);

function handleSecureVoteClick(e) {
    e.preventDefault();
    setStepUpOpen(true);
    closeDrawer();
  }

  function go(e, path) {
    e.preventDefault();
    if (typeof navigate === 'function') navigate(path);
    if (typeof onNavigate === 'function') onNavigate();
  }

  function closeDrawer() {
    if (typeof onNavigate === 'function') onNavigate();
  }

  return (
    <nav className="app-sidebar" aria-label="Main navigation">
      {/* Brand / Portal Title */}
      <div className="sidebar-brand">
        <span>🎓</span>
        <span>KNUST AIM Portal</span>
      </div>

      {/* Role Switcher - only visible if user has EC access */}
      <AppBarRoleSwitcher
        hasECAccess={hasECAccess}
        ecRole={ecRole}
        ecJurisdictionName={ecJurisdictionName}
        currentView={currentView}
        onViewChange={onViewChange}
      />

      {/* Pill-shaped search bar */}
      <div className="sv-search" role="search">
        <span aria-hidden="true">🔍</span>
        <input type="search" placeholder="Search modules…" aria-label="Search modules" />
      </div>

      <ul className="sidebar-list">


        {/* ── Dashboard ── */}
        <li className="sidebar-section">Overview</li>
        <li className="sidebar-item">
          <a href="#dashboard" onClick={e => go(e, '/')}>
            <span>📊</span>
            <span>Dashboard</span>
          </a>
        </li>

        {/* ── Academics ── */}
        <li className="sidebar-section">Academics</li>
        <li className="sidebar-subitem">
          <a href="#course-reg" onClick={e => e.preventDefault()}>Course Registration</a>
        </li>
        <li className="sidebar-subitem">
          <a href="#reg-slip" onClick={e => e.preventDefault()}>Registration Slip</a>
        </li>
        <li className="sidebar-subitem">
          <a href="#results" onClick={e => e.preventDefault()}>Check Results</a>
        </li>

        {/* ── Finance ── */}
        <li className="sidebar-section">Finance</li>
        <li className="sidebar-subitem">
          <a href="#bills" onClick={e => e.preventDefault()}>Bill &amp; Payment</a>
        </li>
        <li className="sidebar-subitem">
          <a href="#fees" onClick={e => e.preventDefault()}>Fees Status</a>
        </li>

        {/* ── Governance ── */}
        <li className="sidebar-section">Governance</li>

        {/* Secure Vote — Gold-highlighted entry */}
        <li className="secure-vote-item">
          <a
            href="#secure-vote"
            id="sidebar-secure-vote-btn"
            onClick={handleSecureVoteClick}
            aria-haspopup="dialog"
          >
            <span>🗳️</span>
            <span>Secure Vote</span>
            <span className="sv-badge-new">New</span>
          </a>
        </li>

        {/* EC Admin — internal tool, shown as a sub-item */}
        <li className="sidebar-subitem">
          <a href="#ec-admin" onClick={e => go(e, '/ec-admin')}>EC Admin</a>
        </li>
        <li className="sidebar-subitem">
          <a href="#candidate-agent" onClick={e => go(e, '/candidate-agent')}>Observer Room</a>
        </li>

        {/* ── Utilities ── */}
        <li className="sidebar-section">Utilities</li>
        <li className="sidebar-subitem">
          <a href="#status" onClick={e => e.preventDefault()}>Status Checker</a>
        </li>
        <li className="sidebar-subitem">
          <a href="#lecturers" onClick={e => e.preventDefault()}>Select Lecturers</a>
        </li>
        <li className="sidebar-subitem">
          <a href="#admission" onClick={e => e.preventDefault()}>Admission Letter</a>
        </li>

      </ul>

      {/* Logout — outline action button */}
      <div className="sidebar-logout">
        <button
          type="button"
          className="logout-btn"
          onClick={() => {
            // Placeholder: wire up your auth logout here
            console.log('Logout clicked');
          }}
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>

      {/* Step-Up Auth Modal — triggered by Secure Vote click */}
      <StepUpAuthModal
        isOpen={isStepUpOpen}
        onClose={() => setStepUpOpen(false)}
onSuccess={() => {
          setStepUpOpen(false);
          closeDrawer();
          if (typeof navigate === 'function') {
            navigate('/secure-vote');
          } else {
            window.history.pushState({}, '', '/secure-vote');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }}
      />
    </nav>
  );
}
