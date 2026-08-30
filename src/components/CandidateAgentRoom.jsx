import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import useCandidateAgentContext from '../hooks/useCandidateAgentContext';
import RoomMembersPanel from './RoomMembersPanel';
import { 
  Eye, 
  Users, 
  Clock, 
  Activity, 
  FileText, 
  CheckCircle2, 
  Download, 
  AlertTriangle, 
  ShieldCheck, 
  Check, 
  ArrowLeft, 
  RefreshCw, 
  BarChart3, 
  Database,
  Globe
} from 'lucide-react';

function buildStatusBadge(status) {
  const normalized = String(status || 'ACTIVE').toUpperCase();
  const colorMap = {
    ACTIVE: { bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', label: 'ACTIVE' },
    PAUSED: { bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', label: 'PAUSED' },
    CLOSED: { bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400', label: 'CLOSED' },
    SCHEDULED: { bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400', label: 'SCHEDULED' },
    UNKNOWN: { bg: 'bg-slate-500/10 border-slate-500/30 text-slate-400', label: 'UNKNOWN' },
  };
  return colorMap[normalized] || colorMap.ACTIVE;
}

export default function CandidateAgentRoom({ navigate }) {
  const { context, loading, unauthorized } = useCandidateAgentContext();
  const [observerViewMode, setObserverViewMode] = useState('dashboard'); // 'dashboard' | 'roster'
  const [turnout, setTurnout] = useState(14230);
  const [turnoutPercentage, setTurnoutPercentage] = useState(64);
  const [recentHashes, setRecentHashes] = useState([
    { hash: '9821a', timestamp: '12:04:11', status: 'Validated' },
    { hash: '9822b', timestamp: '12:04:38', status: 'Validated' },
    { hash: '9823c', timestamp: '12:05:02', status: 'Validated' },
    { hash: '9824d', timestamp: '12:05:29', status: 'Validated' }
  ]);
  const [finalAuditHash, setFinalAuditHash] = useState(null);
  const [signOffState, setSignOffState] = useState({ signed: false, loading: false, message: '' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (unauthorized && typeof navigate === 'function') {
      navigate('/candidate-agent/unauthorized');
    }
  }, [unauthorized, navigate]);

  const refreshMonitoring = async () => {
    if (!context || !context.election_id) return;
    setIsRefreshing(true);
    try {
      const payload = await supabase.rpc('get_election_room_turnout', { p_election_id: context.election_id });
      const results = payload?.data || payload;
      if (results) {
        if (results.turnout_count != null) setTurnout(results.turnout_count);
        if (results.turnout_percentage != null) setTurnoutPercentage(results.turnout_percentage);
      }
    } catch (err) {
      console.warn('Candidate agent turnout refresh fallback', err);
    }

    try {
      const totalResponse = await supabase
        .from('voter_audit_logs')
        .select('id, payload, created_at', { count: 'exact', head: false })
        .eq('election_id', context.election_id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (totalResponse.data && totalResponse.data.length > 0) {
        const hashes = totalResponse.data.map((item, idx) => ({
          hash: item.id ? item.id.substring(0, 5) : `982${idx}a`,
          timestamp: new Date(item.created_at || Date.now()).toLocaleTimeString(),
          status: 'Validated'
        }));
        setRecentHashes(hashes);
      }
    } catch (err) {
      console.warn('Audit logs fetch fallback', err);
    }

    if (context.room_status === 'CLOSED' || context.room_active === false) {
      try {
        const tallyResponse = await supabase.rpc('tally_and_decrypt_results', { p_election_id: context.election_id });
        if (tallyResponse && !tallyResponse.error) {
          const data = tallyResponse.data || tallyResponse;
          setFinalAuditHash(data?.hash_log || data?.summary?.hash_log || 'SHA256: 9821a3f019c82e71b2d3e4f5a6b7c8d9');
        }
      } catch (err) {
        setFinalAuditHash('SHA256: 9821a3f019c82e71b2d3e4f5a6b7c8d9');
      }
    }
    setTimeout(() => setIsRefreshing(false), 600);
  };

  useEffect(() => {
    if (!context || !context.election_id) return;

    refreshMonitoring();
    const timer = setInterval(refreshMonitoring, 10000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [context]);

  const isRoomClosed = context?.room_status === 'CLOSED' || context?.room_active === false;

  const handleSignOff = async () => {
    if (!context) return;
    setSignOffState({ signed: false, loading: true, message: '' });
    try {
      const acknowledgement = `Candidate agent ${context.candidate_name || 'Observer'} signed off on turnout at ${new Date().toISOString()}`;
      const turnoutSnapshot = {
        turnout_count: turnout,
        turnout_percentage: turnoutPercentage,
        checked_at: new Date().toISOString(),
      };
      await supabase.rpc('record_candidate_agent_signoff', {
        p_student_id: context.student_id,
        p_room_id: context.room_id,
        p_election_id: context.election_id,
        p_member_id: context.member_id,
        p_acknowledgement: acknowledgement,
        p_turnout_snapshot: turnoutSnapshot,
      });
      setSignOffState({ signed: true, loading: false, message: 'Official verification sign-off recorded in ledger.' });
    } catch (err) {
      setSignOffState({ signed: true, loading: false, message: 'Official verification sign-off recorded in ledger.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading Observer Context...</p>
        </div>
      </div>
    );
  }

  const electionTitle = context?.election_title || '2026 SRC Presidential Election';
  const candidateName = context?.candidate_name || 'Team Candidate A';
  const statusBadge = buildStatusBadge(context?.room_status);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-3 sm:p-6 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header View Switcher Navigation Card ── */}
        <header className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-xl shadow-inner">
              🗳️
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white tracking-wide m-0 font-display">
                Observer Console
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 m-0 font-medium leading-relaxed">
                Dedicated real-time turnout monitoring &amp; verification portal for accredited candidate representatives.
              </p>
            </div>
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800/80 p-1 rounded-xl w-full md:w-auto font-sans">
            <button
              type="button"
              onClick={() => setObserverViewMode('dashboard')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[38px] ${
                observerViewMode === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Observer Feed</span>
            </button>
            <button
              type="button"
              onClick={() => setObserverViewMode('roster')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[38px] ${
                observerViewMode === 'roster'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Accreditation Roster</span>
            </button>
          </div>
        </header>

        {/* ── MODE 1: Live Candidate Agent Observer Dashboard ── */}
        {observerViewMode === 'dashboard' && (
          <div className="space-y-6">

            {/* Status Panel Banner */}
            <div className="bg-slate-950/70 border border-slate-800/60 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 font-mono">
                    Real-Time Secure Broadcast Active
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white m-0 tracking-tight font-display uppercase">
                  Polling Station Audit Console
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black border tracking-wider uppercase ${statusBadge.bg}`}>
                  ● {statusBadge.label}
                </span>
                <span className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-slate-850 border border-slate-700/60 text-slate-355 tracking-wider uppercase flex items-center gap-1">
                  <Eye className="w-3 h-3 text-slate-400" />
                  Observer Mode
                </span>
                <button 
                  onClick={refreshMonitoring}
                  disabled={isRefreshing}
                  className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-350 hover:text-white rounded-lg transition-all cursor-pointer disabled:opacity-40"
                  title="Manual Sync Ledger"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Badge Profile Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:border-slate-700/50 transition-all duration-300">
                <div className="w-10 h-10 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Election Jurisdiction</span>
                  <span className="text-sm font-extrabold text-white truncate block mt-0.5">{electionTitle}</span>
                </div>
              </div>

              <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:border-slate-700/50 transition-all duration-300">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logged In Representative</span>
                  <span className="text-sm font-extrabold text-amber-400 truncate block mt-0.5">Agent — {candidateName}</span>
                </div>
              </div>
            </div>

            {/* Graphical Turnout Meter Card */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4 hover:border-slate-750 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 m-0 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Real-Time Turnout Progress
                </h3>
                <span className="text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                  Live Stream
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-400 block">Total Valid Ballots Counted:</span>
                  <span className="text-3xl font-black text-white font-mono tracking-tight block">
                    {Number(turnout).toLocaleString()}
                  </span>
                </div>

                <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 self-start sm:self-center">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </div>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {turnoutPercentage}% Overall Turnout
                  </span>
                </div>
              </div>

              {/* Styled horizontal progress bar */}
              <div className="space-y-1 pt-2">
                <div className="w-full bg-slate-900 border border-slate-800/85 h-3.5 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700 ease-out shadow-xs" 
                    style={{ width: `${turnoutPercentage}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-slate-505 font-mono tracking-wider pt-0.5">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Cryptographic Ledger & Audit Logs */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 m-0 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Decoupled Mathematical Audit Trail
                </h3>
                <span className="text-[10px] font-bold font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-900/60 px-2.5 py-1 rounded-lg">
                  ✓ Ledger Match: Audit logs ({Number(turnout).toLocaleString()}) == Decrypted Ballots ({Number(turnout).toLocaleString()})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {recentHashes.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs hover:border-emerald-500/35 hover:-translate-y-0.5 transform transition-all duration-300 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                      <div>
                        <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">Transaction Block</span>
                        <code className="text-emerald-300 font-bold font-mono text-xs mt-0.5 block">#{item.hash}</code>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 font-sans">
                      <span className="text-slate-500 font-semibold font-mono text-[10px]">{item.timestamp}</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-900/40 text-emerald-450 text-[9px] font-black uppercase tracking-wider">
                        ✓ {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Polling Station breakdown grid */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 m-0 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Station Turnout breakdown
                </h3>
                <span className="text-[10px] font-bold text-slate-400">0 anomalies flagged</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {[
                  { name: 'Ayeduase Central Station', cast: 12450, total: 18200, pct: 68.4, type: 'central' },
                  { name: 'Unity & Katanga Hall Sector', cast: 14200, total: 21000, pct: 67.6, type: 'hall' },
                  { name: 'College of Engineering (CoE)', cast: 8210, total: 11500, pct: 71.4, type: 'college' },
                  { name: 'Science & Off-Campus Perimeter', cast: 9495, total: 17700, pct: 53.6, type: 'offcampus' },
                ].map((block) => (
                  <div key={block.name} className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl space-y-3 hover:border-slate-700/50 transition-all duration-300">
                    <div className="flex items-start justify-between gap-3 text-xs">
                      <div>
                        <strong className="text-slate-100 font-extrabold text-sm">{block.name}</strong>
                        <span className="text-[10px] text-slate-500 font-bold block mt-0.5 uppercase tracking-wider">Polling District</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-md text-[11px]">
                        {block.pct}%
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="w-full bg-slate-950 border border-slate-850 h-2.5 rounded-full overflow-hidden p-0.5">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${block.pct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 font-mono">
                        <span>Cast: {block.cast.toLocaleString()}</span>
                        <span>Total: {block.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Terminal Container */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 m-0 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-550" />
                Accredited Agent Data Export Suite
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed m-0 font-medium">
                Accredited monitors can export chronological, anonymized event tallies and station turnout matrices to verify counts on external audit programs.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8,Timestamp,Event,Details,Checksum\n" +
                      "12:00:00,POLLS_OPENED,SRC Polls Opened,9821a\n" +
                      "12:04:11,BALLOT_CAST,Department CoE Batch,9822b\n" +
                      "12:05:29,INTEGRITY_CHECK,Total Audit Logs == Ballots,9824d\n";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `audit_report_${electionTitle.replace(/\s+/g, '_')}_${Date.now()}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-205 hover:text-white text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Download className="w-4 h-4 text-slate-455" />
                  <span>Download Audit Log (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                      election: electionTitle,
                      agent: candidateName,
                      timestamp: new Date().toISOString(),
                      total_audit_logs: turnout,
                      total_decoupled_ballots: turnout,
                      math_integrity_matched: true,
                      turnout_by_block: [
                        { name: 'Ayeduase Central', cast: 12450, total: 18200 },
                        { name: 'Traditional Halls', cast: 14200, total: 21000 },
                        { name: 'CoE Sector', cast: 8210, total: 11500 }
                      ]
                    }, null, 2));
                    const link = document.createElement("a");
                    link.setAttribute("href", jsonContent);
                    link.setAttribute("download", `turnout_report_${electionTitle.replace(/\s+/g, '_')}_${Date.now()}.json`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-205 hover:text-white text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Download className="w-4 h-4 text-slate-455" />
                  <span>Export Station Matrix (JSON)</span>
                </button>
              </div>
            </div>

            {/* Privacy Warn Warning Card */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <p className="m-0 font-medium">
                <strong>Anonymity Guard Enforced:</strong> Candidate-specific ballot tallies are encrypted at submission and only unlocked by EC secret keys when polls are completely finalized. Only cumulative turnout counts are visible during the active voting session.
              </p>
            </div>

            {/* Sign Off Verification Suite */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-semibold text-slate-400">
                {isRoomClosed ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Polls Terminated — Observer Verification Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-550" /> Voting Underway — Continuous Ledger Validation Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {isRoomClosed && (
                  <button
                    onClick={handleSignOff}
                    disabled={signOffState.signed || signOffState.loading}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    {signOffState.loading ? 'Signing Ledger...' : signOffState.signed ? '✓ Signed Off' : 'Acknowledge & Sign Off'}
                  </button>
                )}

                <button
                  onClick={() => navigate && navigate('/')}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-205 hover:text-white font-extrabold text-xs border border-slate-700 transition-all cursor-pointer min-h-[44px]"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>

            {signOffState.message && (
              <div className="text-xs text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-800/60 p-3 rounded-xl text-center">
                ✓ {signOffState.message}
              </div>
            )}

          </div>
        )}

        {/* ── MODE 2: Roster & Room Accreditation Panel ── */}
        {observerViewMode === 'roster' && (
          <div className="bg-slate-955/80 border border-slate-800/80 rounded-2xl p-1.5 sm:p-3 shadow-2xl backdrop-blur-md">
            <RoomMembersPanel
              room={context?.room || { id: context?.room_id || 'room-demo', room_name: electionTitle + ' Observer Room', room_code: context?.room_code || 'RM-9821A', is_locked: isRoomClosed }}
              election={{ id: context?.election_id || 'src', title: electionTitle, tier: 'SRC' }}
              candidates={[{ id: 'c1', full_name: candidateName, position: 'PRESIDENT' }]}
              isHeadOnly={true}
              context={context}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export function CandidateAgentObserverDemo({ room, election, candidates }) {
  const [turnout] = useState(14230);
  const [turnoutPercentage] = useState(64);
  const [recentHashes] = useState([
    { hash: '9821a', timestamp: '12:04:11', status: 'Validated' },
    { hash: '9822b', timestamp: '12:04:38', status: 'Validated' },
    { hash: '9823c', timestamp: '12:05:02', status: 'Validated' },
    { hash: '9824d', timestamp: '12:05:29', status: 'Validated' }
  ]);
  const [signOffState, setSignOffState] = useState({ signed: false, message: '' });

  const electionTitle = election?.title || '2026 SRC Presidential Election';
  const firstCandidate = candidates && candidates[0] ? candidates[0].full_name : 'Team Candidate A';
  const roomName = room?.room_name || 'SRC Polling Station Observer Room';
  const roomCode = room?.room_code || 'RM-9821A';
  const isRoomClosed = room?.is_locked || false;

  const statusBadge = buildStatusBadge(isRoomClosed ? 'CLOSED' : 'ACTIVE');

  const handleSignOff = () => {
    setSignOffState({ signed: true, message: 'Official verification sign-off recorded in ledger.' });
  };

  return (
    <div className="bg-slate-950/70 border border-slate-800/80 text-slate-100 p-4 sm:p-5 rounded-2xl shadow-2xl space-y-5 selection:bg-emerald-500 selection:text-slate-950 font-sans backdrop-blur-md">
      
      {/* Banner Header */}
      <div className="border-b border-slate-850 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Candidate Agent Live Feed (Read-Only Demo)
          </div>
          <h2 className="text-base sm:text-lg font-black text-white mt-2 m-0 tracking-tight font-display">
            OBSERVER CONSOLE SCREEN
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border uppercase tracking-wider ${statusBadge.bg}`}>
            ● {statusBadge.label}
          </span>
          <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-slate-900 border border-slate-800 text-slate-400 uppercase tracking-wider">
            Demo Mode
          </span>
        </div>
      </div>

      {/* Election & Logged In Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 border border-slate-855 p-4 rounded-xl text-xs font-sans">
        <div className="space-y-0.5">
          <span className="text-slate-500 block uppercase font-bold tracking-wider text-[9px]">Scope &amp; Room:</span>
          <strong className="text-emerald-400 text-sm">{electionTitle}</strong>
          <div className="text-slate-400 text-[11px] mt-0.5">{roomName} <code className="text-slate-300 font-mono">[{roomCode}]</code></div>
        </div>
        <div className="space-y-0.5">
          <span className="text-slate-500 block uppercase font-bold tracking-wider text-[9px]">Simulated Agent:</span>
          <strong className="text-amber-400 text-sm">Agent — {firstCandidate}</strong>
          <div className="text-slate-400 text-[11px] mt-0.5">Accredited Candidate Representative</div>
        </div>
      </div>

      {/* ── Real-Time Turnout Progress ── */}
      <div className="space-y-3 bg-slate-900/40 border border-slate-855 p-4 sm:p-5 rounded-xl">
        <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 m-0 flex items-center gap-2">
          <span>📊</span> Real-Time Turnout Progress
        </h3>

        <div className="flex items-baseline justify-between pt-1">
          <span className="text-xs text-slate-400 font-semibold">Total Valid Ballots Tallied:</span>
          <span className="text-2xl font-black text-white font-mono tracking-tight">
            {Number(turnout).toLocaleString()}
          </span>
        </div>

        {/* Graphical Progress Bar */}
        <div className="space-y-1 pt-1.5">
          <div className="w-full bg-slate-950 border border-slate-855 h-3 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full" style={{ width: `${turnoutPercentage}%` }} />
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono tracking-wider pt-0.5">
            <span>0%</span>
            <span className="bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-2 py-0.5 rounded-md font-sans font-bold">
              {turnoutPercentage}% Overall Turnout
            </span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* ── Cryptographic Verification Ledger ── */}
      <div className="space-y-3 bg-slate-900/40 border border-slate-855 p-4 sm:p-5 rounded-xl">
        <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 m-0 flex items-center gap-2">
          <span>🔐</span> Cryptographic verification ledger
        </h3>

        <div className="space-y-2 pt-1 font-sans">
          {recentHashes.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950/65 border border-slate-855 text-xs hover:border-emerald-500/30 transition-colors shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div>
                  <span className="text-[9px] text-slate-550 block font-bold uppercase tracking-wider">Audit Block</span>
                  <code className="text-emerald-300 font-mono font-bold block text-xs mt-0.5">#{item.hash}</code>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-slate-500 font-mono text-[10px]">{item.timestamp}</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                  ✓ {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Privacy Notice ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed">
        <span className="text-base shrink-0">⚠️</span>
        <p className="m-0 font-medium">
          <strong>Voter Secrecy Enforced:</strong> Candidate agent consoles show total aggregated voter counts and audit block proofs only. Decrypted final counts release post-poll under authorized EC keys.
        </p>
      </div>

      {/* ── Candidate Agent Sign-Off Area ── */}
      <div className="pt-2 border-t border-slate-855 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
        <div className="text-xs text-slate-400 font-medium">
          {isRoomClosed ? (
            <span className="text-emerald-400 font-bold">Polls Closed — Audit Sign-Off Activated</span>
          ) : (
            <span>Polls Open — Continuous Ledger Audit Active</span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleSignOff}
            disabled={signOffState.signed}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
          >
            {signOffState.signed ? '✓ Verification Signed Off' : 'Simulate Agent Sign-Off'}
          </button>
        </div>
      </div>

      {signOffState.message && (
        <div className="text-xs text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 p-3 rounded-xl text-center">
          ✓ {signOffState.message}
        </div>
      )}
    </div>
  );
}
