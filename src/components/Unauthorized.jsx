import React from 'react';

export default function Unauthorized({ onBack, title = 'Access Denied', message, buttonText = 'Return to Dashboard' }) {
  return (
    <div className="ec-unauthorized" style={{ padding: 24 }}>
      <div className="ec-card" style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <h1>{title}</h1>
        <p style={{ color: '#444', margin: '16px 0 0' }}>
          {message || 'You do not have the required role to access this page. Please return to the main portal.'}
        </p>
        <div style={{ marginTop: 24 }}>
          <button className="sv-btn sv-btn-primary" onClick={onBack}>{buttonText}</button>
        </div>
      </div>
    </div>
  )










  
}
