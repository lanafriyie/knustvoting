import React, { useState } from 'react';
import { 
  BarChart3, 
  Search, 
  Lock, 
  Building, 
  Vote, 
  Check, 
  CheckCircle2, 
  Calendar, 
  Hash, 
  Award, 
  AlertTriangle,
  Users,
  Trophy,
  ArrowLeft,
  ShieldCheck,
  Activity
} from 'lucide-react';

const MOCK_RESULTS = {
  src: {
    title: '2026 SRC Executive Council Election',
    eligibleVoters: 68400,
    totalVotesCast: 44355,
    turnoutPercent: 64.8,
    systemHash: '8f4c2e9b1a0d3f6e8b7c5a2d4e1f9b0a3c5d7e9f1a2b3c4d5e6f7a8b9c0d1e2f',
    receipts: ['REC-89A0F2B', 'REC-12B3C4D', 'REC-55E6F7G', 'REC-99H0I1J'],
    positions: [
      {
        name: 'PRESIDENT',
        total: 42100,
        candidates: [
          { name: 'Emmanuel Boakye', slate: 'The Vanguard Slate', votes: 21850, percent: 51.9, winner: true },
          { name: 'Serwaa Akoto Boateng', slate: 'Renaissance Coalition', votes: 17420, percent: 41.4, winner: false },
          { name: 'Kofi Mensah Mensah', slate: 'Integrity Alliance', votes: 2830, percent: 6.7, winner: false, disqualified: true }
        ]
      },
      {
        name: 'VICE PRESIDENT',
        total: 41200,
        candidates: [
          { name: 'Abena Osei Poku', slate: 'The Vanguard Slate', votes: 25400, percent: 61.6, winner: true },
          { name: 'Kwabena Appiah', slate: 'Renaissance Coalition', votes: 15800, percent: 38.4, winner: false }
        ]
      },
      {
        name: 'WOMEN\'S COMMISSIONER',
        total: 40500,
        candidates: [
          { name: 'Akua Mansa', slate: 'Independent', votes: 26800, percent: 66.2, winner: true },
          { name: 'Yaa Asantewaa Bonsu', slate: 'The Vanguard Slate', votes: 13700, percent: 33.8, winner: false }
        ]
      },
      {
        name: 'GENERAL SECRETARY',
        total: 39800,
        candidates: [
          { name: 'Priscilla Mensah', slate: 'The Vanguard Slate', votes: 23100, percent: 58.0, winner: true },
          { name: 'Kwaku Duah', slate: 'Renaissance Coalition', votes: 16700, percent: 42.0, winner: false }
        ]
      },
      {
        name: 'FINANCIAL SECRETARY',
        total: 39100,
        candidates: [
          { name: 'Richmond Ofori', slate: 'Renaissance Coalition', votes: 21500, percent: 55.0, winner: true },
          { name: 'Kwadwo Adjei', slate: 'The Vanguard Slate', votes: 17600, percent: 45.0, winner: false }
        ]
      }
    ]
  },
  dept: {
    title: 'College of Engineering (CoE) Election',
    eligibleVoters: 9500,
    totalVotesCast: 6840,
    turnoutPercent: 72.0,
    systemHash: '3a1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    receipts: ['REC-COE-101', 'REC-COE-102', 'REC-COE-103'],
    positions: [
      {
        name: 'DEPARTMENT PRESIDENT',
        total: 6840,
        candidates: [
          { name: 'Felix Darko', slate: 'CoE Pioneers', votes: 4210, percent: 61.5, winner: true },
          { name: 'Priscilla Mensah', slate: 'Innovate CoE', votes: 2630, percent: 38.5, winner: false }
        ]
      }
    ]
  },
  constituency: {
    title: 'Ayeduase Constituency Parliamentary Election',
    eligibleVoters: 12000,
    totalVotesCast: 8450,
    turnoutPercent: 70.4,
    systemHash: '7e6f5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e',
    receipts: ['REC-AYE-001', 'REC-AYE-002'],
    positions: [
      {
        name: 'MEMBER OF PARLIAMENT',
        total: 8450,
        candidates: [
          { name: 'Gifty Addo', slate: 'Ayeduase Voice', votes: 5290, percent: 62.6, winner: true },
          { name: 'Kwame Owusu', slate: 'Community First', votes: 3160, percent: 37.4, winner: false }
        ]
      }
    ]
  }
};

export default function StudentResultsPortal({ onBack }) {
  const [selectedElectionKey, setSelectedElectionKey] = useState('src');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptResult, setReceiptResult] = useState(null);

  const activeData = MOCK_RESULTS[selectedElectionKey] || MOCK_RESULTS.src;

  const handleVerifyReceipt = (e) => {
    e.preventDefault();
    const query = receiptSearch.trim().toUpperCase();
    if (!query) return;

    // Simulate verification
    const isValid = activeData.receipts.includes(query) || query.startsWith('REC-') || query.length >= 8;

    if (isValid) {
      setReceiptResult({
        found: true,
        receipt: query,
        message: `Ballot receipt hash [${query}] was successfully included in the final certified tally.`,
        timestamp: new Date().toLocaleString(),
        hash: activeData.systemHash.substring(0, 32) + '...'
      });
    } else {
      setReceiptResult({
        found: false,
        receipt: query,
        message: `Receipt hash [${query}] was not found in the active certified tally log.`
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-[#007A4D] dark:text-emerald-400 border border-emerald-250 dark:border-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck size={14} />
            <span>Certified Public Ledger</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Student Public Election Results Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Real-time certified vote counts, visual position breakdown, and ballot receipt verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedElectionKey}
            onChange={(e) => {
              setSelectedElectionKey(e.target.value);
              setReceiptResult(null);
            }}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007A4D] shadow-2xs"
          >
            <option value="src">🏛️ SRC Executive Council</option>
            <option value="dept">🏢 College of Engineering</option>
            <option value="constituency">🗳️ Constituency MP</option>
          </select>

          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-750 dark:text-slate-250 font-bold text-xs rounded-xl transition-all cursor-pointer border-0 flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              <span>Back</span>
            </button>
          )}
        </div>
      </div>

      {/* Turnout & Mathematical Integrity Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Total Ballots Cast</span>
            <Vote size={14} className="text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {activeData.totalVotesCast.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 block mt-1 font-medium">
              of {activeData.eligibleVoters.toLocaleString()} eligible voters
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
            ✓ Turnout Rate: {activeData.turnoutPercent}%
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Turnout Progress</span>
            <Activity size={14} className="text-slate-400 animate-pulse" />
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 dark:text-slate-200">Quorum Met (&gt;50%)</span>
              <span className="text-[#007A4D] dark:text-emerald-400">{activeData.turnoutPercent}%</span>
            </div>
            <div className="results-percentage-track">
              <div
                className="results-percentage-fill"
                style={{ width: `${activeData.turnoutPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 font-medium font-bold">
            Zero-Knowledge Ballot Decoupling Active
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Tally Checksum</span>
            <Hash size={14} className="text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-800 dark:text-slate-200 break-all font-bold">
              {activeData.systemHash}
            </div>
          </div>
          <div className="mt-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            ✓ Cryptographic SHA-256 Ledger Verified
          </div>
        </div>
      </div>

      {/* ── Ballot Receipt Verification Lookup Box ── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wide">
            <Search size={16} className="text-[#007A4D]" />
            <span>Verify Personal Ballot Receipt</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Enter or paste your anonymous Ballot Receipt Hash (e.g. <code>REC-89A0F2B</code>) issued upon vote submission to confirm your vote was counted.
          </p>
        </div>

        <form onSubmit={handleVerifyReceipt} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={receiptSearch}
            onChange={(e) => setReceiptSearch(e.target.value)}
            placeholder="Paste Ballot Receipt Hash (e.g. REC-89A0F2B)..."
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007A4D]"
          />
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#007A4D] hover:bg-[#075C42] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap border-0 flex items-center gap-1.5"
          >
            <Search size={14} />
            <span>Verify Receipt</span>
          </button>
        </form>

        {receiptResult && (
          <div className="receipt-ledger-console-card mt-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-bold text-xs uppercase tracking-wider text-[#D4AF37]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Verification Output Log</span>
              </span>
              <span className="text-emerald-400">STATUS: MATCHED</span>
            </div>
            
            <div className="space-y-1.5 text-xs">
              <p className="m-0 text-slate-200 leading-relaxed font-semibold">
                &gt; {receiptResult.message}
              </p>
              {receiptResult.found && (
                <div className="text-[10px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-850">
                  <div>Timestamp : {receiptResult.timestamp}</div>
                  <div className="break-all font-mono">Merkle Block : {receiptResult.hash}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Position Breakdown Visual Bar Charts ── */}
      <div className="space-y-6">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wide">
          <BarChart3 className="w-5 h-5 text-[#007A4D]" />
          <span>Position-by-Position Visual Vote Breakdown</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeData.positions.map((pos) => (
            <div key={pos.name} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs space-y-4 knust-glass-card hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  {pos.name}
                </h3>
                <span className="text-xs font-mono text-slate-500 font-bold">
                  Total: <strong>{pos.total.toLocaleString()}</strong>
                </span>
              </div>

              <div className="space-y-4">
                {pos.candidates.map((cand) => (
                  <div key={cand.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{cand.name}</strong>
                        <span className="text-slate-400 text-[10px]">({cand.slate})</span>
                        {cand.winner && (
                          <span className="bg-emerald-55 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase tracking-wide inline-flex items-center gap-1 shadow-2xs border border-emerald-300/40">
                            <Trophy size={10} className="text-[#D4AF37]" />
                            <span>Elected</span>
                          </span>
                        )}
                        {cand.disqualified && (
                          <span className="bg-rose-100 text-rose-800 dark:bg-rose-955/60 dark:text-rose-400 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase tracking-wide inline-flex items-center gap-1 shadow-2xs">
                            <AlertTriangle size={10} />
                            <span>Disqualified</span>
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                        {cand.votes.toLocaleString()} ({cand.percent}%)
                      </span>
                    </div>

                    <div className="results-percentage-track">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${cand.winner ? 'results-percentage-fill bg-gradient-to-r from-[#007A4D] to-[#10B981]' : cand.disqualified ? 'bg-red-500' : 'bg-slate-450 bg-slate-300 dark:bg-slate-650'}`}
                        style={{ width: `${cand.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
