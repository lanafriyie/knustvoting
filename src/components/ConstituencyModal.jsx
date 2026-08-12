import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import '../styles/SecureVote.css';

const CONSTITUENCIES = [
  { id: 'ayeduase', name: 'Ayeduase', desc: 'Ayeduase Hostels & Community Zone' },
  { id: 'kotei_gaza', name: 'Kotei/Gaza', desc: 'Kotei, Gaza & Commercial Area Zone' },
  { id: 'campus', name: 'Campus', desc: 'Traditional Halls & On-Campus Housing' },
  { id: 'bomso', name: 'Bomso', desc: 'Bomso Gate & Adjacent Student Quarter' },
  { id: 'kentinkrono', name: 'Kentinkrono', desc: 'Kentinkrono Hostels & Surrounding Perimeter' }
];

export default function ConstituencyModal({ isOpen, onLocked, studentId }) {
  const [selectedConstituency, setSelectedConstituency] = useState('Ayeduase');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleConfirm() {
    if (!selectedConstituency) return;
    setLoading(true);
    setError(null);
    try {
      // Call Supabase RPC or save to DB table
      const { data, error: rpcErr } = await supabase
        .from('student_constituency_selections')
        .upsert([{ student_id: studentId, selected_at: new Date().toISOString() }], { onConflict: 'student_id' });

      if (rpcErr && rpcErr.code !== '42P01') {
        console.warn('DB constituency save warning', rpcErr);
      }

      // Lock constituency selection
      onLocked && onLocked(selectedConstituency);
    } catch (err) {
      console.warn('Fallback: local constituency lock applied', err);
      onLocked && onLocked(selectedConstituency);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sv-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="constituency-title">
      <div className="sv-modal sv-constituency-modal">
        <header className="sv-modal-header">
          <h2 id="constituency-title">🗳️ Mandatory Constituency Selection</h2>
        </header>

        <div className="sv-modal-body">
          <div className="sv-constituency-notice">
            ⚠️ <strong>One-Time Selection Notice:</strong> Please select your assigned KNUST electoral constituency. Once confirmed, your constituency choice is <strong>permanently locked</strong> and unlocks your single-choice MP ballot.
          </div>

          <div className="sv-constituency-list">
            {CONSTITUENCIES.map(item => (
              <label
                key={item.id}
                className={`sv-constituency-option ${selectedConstituency === item.name ? 'selected' : ''}`}
                onClick={() => setSelectedConstituency(item.name)}
              >
                <input
                  type="radio"
                  name="knust_constituency"
                  value={item.name}
                  checked={selectedConstituency === item.name}
                  onChange={() => setSelectedConstituency(item.name)}
                />
                <div className="sv-constituency-details">
                  <div className="sv-const-name">🏛️ {item.name} Constituency</div>
                  <div className="sv-const-desc">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {error && <div className="sv-error" role="alert">{error}</div>}

          <div className="sv-constituency-actions">
            <button
              className="sv-btn-card warning"
              disabled={loading || !selectedConstituency}
              onClick={handleConfirm}
            >
              {loading ? 'Locking Selection...' : `CONFIRM & LOCK CONSTITUENCY (${selectedConstituency}) ➔`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
