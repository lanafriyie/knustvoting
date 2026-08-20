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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="constituency-title"
    >
      {/* ── Modal card ── */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl my-auto max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Maroon header bar ── */}
        <header className="bg-[#6b1d2f] text-white px-5 sm:px-6 py-4 flex items-center gap-3 shrink-0 border-b border-[#521624]">
          <span className="text-xl shrink-0" aria-hidden="true">🗳️</span>
          <h2
            id="constituency-title"
            className="m-0 text-base font-bold tracking-tight text-white leading-snug"
          >
            Mandatory Constituency Selection
          </h2>
        </header>

        {/* ── Scrollable Body ── */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 overflow-y-auto min-h-0 flex-1">

          {/* One-time notice box */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed shrink-0">
            <span className="text-base mt-px shrink-0" aria-hidden="true">⚠️</span>
            <p className="m-0 text-xs sm:text-sm">
              <strong className="font-bold">One-Time Selection Notice:</strong> Please select your
              assigned KNUST electoral constituency. Once confirmed, your constituency choice is{' '}
              <strong className="font-bold">permanently locked</strong> and unlocks your
              single-choice MP ballot.
            </p>
          </div>

          {/* ── Selectable card list (scrollable container) ── */}
          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[280px] sm:max-h-[340px] pr-1.5 focus:outline-none" role="radiogroup" aria-labelledby="constituency-title">
            {CONSTITUENCIES.map(item => {
              const isSelected = selectedConstituency === item.name;
              return (
                <label
                  key={item.id}
                  className={[
                    // Base card shell
                    'group flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer',
                    'transition-all duration-150 select-none shrink-0',
                    // Selected state  — maroon border + light maroon tint
                    isSelected
                      ? 'border-[#6b1d2f] dark:border-amber-500 bg-[#6b1d2f]/[0.05] dark:bg-slate-800/90 shadow-2xs'
                      // Unselected state — subtle gray with hover lift
                      : 'border-gray-200 dark:border-slate-700/80 bg-gray-50/60 dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-800/60 hover:border-gray-300 dark:hover:border-slate-600',
                  ].join(' ')}
                  onClick={() => setSelectedConstituency(item.name)}
                >
                  {/* Hidden native radio — keeps semantics/keyboard/screen-reader intact */}
                  <input
                    type="radio"
                    name="knust_constituency"
                    value={item.name}
                    checked={isSelected}
                    onChange={() => setSelectedConstituency(item.name)}
                    className="sr-only"
                  />

                  {/* Custom circular indicator */}
                  <span
                    aria-hidden="true"
                    className={[
                      'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150',
                      isSelected
                        ? 'border-[#6b1d2f] dark:border-amber-500 bg-[#6b1d2f] dark:bg-amber-500'
                        : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-gray-400 dark:group-hover:border-slate-500',
                    ].join(' ')}
                  >
                    {/* Inner dot — only visible when selected */}
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-white dark:bg-slate-900 block" />
                    )}
                  </span>

                  {/* Text content */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {/* Constituency name — dark, semibold, high contrast */}
                    <span className={[
                      'text-sm font-semibold leading-snug',
                      isSelected
                        ? 'text-[#6b1d2f] dark:text-amber-400'
                        : 'text-gray-900 dark:text-slate-100',
                    ].join(' ')}>
                      🏛️ {item.name} Constituency
                    </span>
                    {/* Zone description — muted, readable */}
                    <span className="text-xs text-gray-500 dark:text-slate-400 leading-snug">
                      {item.desc}
                    </span>
                  </div>

                  {/* Selected check badge — right-aligned */}
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="ml-auto shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-[#6b1d2f] dark:bg-amber-500 text-white dark:text-slate-900"
                    >
                      ✓
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Error state */}
          {error && (
            <div
              className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 shrink-0"
              role="alert"
            >
              {error}
            </div>
          )}

        </div>

        {/* ── Fixed Footer Action Area ── */}
        <div className="shrink-0 bg-gray-50/80 dark:bg-slate-900/90 border-t border-gray-100 dark:border-slate-800 px-5 sm:px-6 py-3.5 backdrop-blur-xs">
          {/* ── Confirm button ── */}
          <button
            className={[
              'w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-150 cursor-pointer',
              loading || !selectedConstituency
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                : 'bg-[#6b1d2f] hover:bg-[#521624] active:bg-[#3f111e] text-white shadow-md hover:shadow-lg active:scale-[0.98]',
            ].join(' ')}
            disabled={loading || !selectedConstituency}
            onClick={handleConfirm}
          >
            {loading
              ? '⏳ Locking Selection…'
              : `CONFIRM & LOCK CONSTITUENCY (${selectedConstituency}) ➔`}
          </button>
        </div>

      </div>
    </div>
  );
}
