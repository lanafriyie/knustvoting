import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import useCandidateAgentContext from '../hooks/useCandidateAgentContext';

function buildStatusBadge(status) {
  const normalized = String(status || '').toUpperCase();
  const colorMap = {
    ACTIVE: '#8B0000',
    PAUSED: '#5C9E08',
    CLOSED: '#0A192F',
    SCHEDULED: '#B8860B',
    UNKNOWN: '#666',
  };
  return {
    label: normalized,
    color: colorMap[normalized] || '#666',
  };
}

export default function CandidateAgentRoom({ navigate }) {
  const { context, loading, unauthorized } = useCandidateAgentContext();
  const [turnout, setTurnout] = useState(null);
  const [totalBallots, setTotalBallots] = useState(null);
  const [turnoutPercentage, setTurnoutPercentage] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthMessage, setHealthMessage] = useState('Checking database integrity…');
  const [finalAuditHash, setFinalAuditHash] = useState(null);
  const [signOffState, setSignOffState] = useState({ signed: false, loading: false, message: '' });
  const [monitorError, setMonitorError] = useState(null);

  useEffect(() => {
    if (unauthorized && typeof navigate === 'function') {
      navigate('/candidate-agent/unauthorized');
    }
  }, [unauthorized, navigate]);

  useEffect(() => {
    if (!context || !context.election_id) return;

    let mounted = true;
    let timer = null;

    async function refreshMonitoring() {
      try {
        const payload = await supabase.rpc('get_election_room_turnout', { p_election_id: context.election_id });
        const results = payload?.data || payload;
        if (mounted) {
          setTurnout(results?.turnout_count ?? results?.turnout_percentage ?? results?.turnout ?? null);
          setTurnoutPercentage(results?.turnout_percentage ?? results?.turnout_percentage ?? null);
          setTotalBallots(results?.turnout_count ?? null);
        }
      } catch (err) {
        console.warn('Candidate agent turnout refresh failed', err);
      }

      try {
        const totalResponse = await supabase
          .from('voter_audit_logs')
          .select('id', { count: 'exact', head: false })
          .eq('election_id', context.election_id)
          .eq('event_type', 'vote_cast');
        const distinctResponse = await supabase
          .from('voter_audit_logs')
          .select('student_id', { count: 'exact', head: false, distinct: 'student_id' })
          .eq('election_id', context.election_id)
          .eq('event_type', 'vote_cast');

        const totalCount = totalResponse.count || 0;
        const distinctCount = distinctResponse.count || 0;
        const healthOk = totalCount === distinctCount;
        if (mounted) {
          setSystemHealth(healthOk ? 'healthy' : 'warning');
          setHealthMessage(
            healthOk
              ? 'Live integrity healthy: no duplicate vote records detected.'
              : 'Warning: duplicate vote activity detected. Escalate to EC support immediately.'
          );
        }
      } catch (err) {
        console.warn('Candidate agent integrity check failed', err);
        if (mounted) {
          setSystemHealth('unknown');
          setHealthMessage('Unable to verify integrity status at this time.');
        }
      }

      if (context.room_status === 'CLOSED' || context.room_active === false) {
        try {
          const tallyResponse = await supabase.rpc('tally_and_decrypt_results', { p_election_id: context.election_id });
          if (tallyResponse && !tallyResponse.error) {
            const data = tallyResponse.data || tallyResponse;
            if (mounted) setFinalAuditHash(data?.hash_log || data?.summary?.hash_log || 'N/A');
          }
        } catch (err) {
          console.warn('Candidate agent audit hash fetch failed', err);
          if (mounted) setFinalAuditHash('Unable to retrieve final audit hash at this time.');
        }
      }
    }

    refreshMonitoring();
    timer = setInterval(refreshMonitoring, 15000);

    const subscription = supabase
      .from(`voter_audit_logs:election_id=eq.${context.election_id}`)
      .on('INSERT', () => refreshMonitoring())
      .subscribe();

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [context]);

  const isRoomClosed = context?.room_status === 'CLOSED' || context?.room_active === false;

  const handleSignOff = async () => {
    if (!context) return;
    setSignOffState({ signed: false, loading: true, message: '' });
    try {
      const acknowledgement = `Candidate agent ${context.candidate_name} signed off on turnout at ${new Date().toISOString()}`;
      const turnoutSnapshot = {
        turnout_count: totalBallots,
        turnout_percentage: turnoutPercentage,
        checked_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.rpc('record_candidate_agent_signoff', {
        p_student_id: context.student_id,
        p_room_id: context.room_id,
        p_election_id: context.election_id,
        p_member_id: context.member_id,
        p_acknowledgement: acknowledgement,
        p_turnout_snapshot: turnoutSnapshot,
      });
      if (error) {
        console.warn('Sign-off RPC failed', error);
        setSignOffState({ signed: false, loading: false, message: 'Unable to record sign-off. Please try again.' });
        return;
      }
      setSignOffState({ signed: true, loading: false, message: 'Sign-off recorded successfully.' });
    } catch (err) {
      console.warn('Sign-off failed', err);
      setSignOffState({ signed: false, loading: false, message: 'Sign-off failed due to a network error.' });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>Loading observer room…</div>
    );
  }

  if (!context) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Candidate Agent Access</h1>
        <p>Unable to load your assigned room. Please ensure you are signed in as the assigned Candidate Agent.</p>
      </div>
    );
  }

  const statusBadge = buildStatusBadge(context.room_status);

  return (
    <div className="ec-admin-root" style={{ padding: 20, minHeight: '100vh' }}>
      <div className="ec-panel ec-header-panel" style={{ marginBottom: 24 }}>
        <div>
          <p className="sv-meta">Observer Mode</p>
          <h1>Election Room — Candidate Agent</h1>
          <p className="sv-meta">Representing: <strong>{context.candidate_name}</strong></p>
          <p className="sv-meta">Election: <strong>{context.election_title}</strong></p>
          <p className="sv-meta">Room Code: <strong>{context.room_code}</strong></p>
        </div>
        <div style={{ display: 'grid', gap: 10, textAlign: 'right' }}>
          <div className="sv-badge sv-badge-success" style={{ background: statusBadge.color, color: '#fff' }}>{statusBadge.label}</div>
          <div className="sv-badge" style={{ background: '#eef7f0', color: '#0b3b16' }}>Candidate Agent</div>
        </div>
      </div>

      <div className="ec-panel-grid" style={{ gap: 18, marginBottom: 18 }}>
        <section className="ec-panel" style={{ padding: 20 }}>
          <h2>Live Turnout & Integrity Feed</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#0f3d2a' }}>{turnout ?? '--'}</div>
            <div style={{ color: '#444' }}>Total ballots recorded in this election room</div>
            {turnoutPercentage != null && (
              <div style={{ fontSize: 14, color: '#4b5563' }}>Turnout percentage: <strong>{turnoutPercentage}%</strong></div>
            )}
            <div style={{ padding: 14, borderRadius: 12, background: '#f7fdf6', border: '1px solid #d4ecd5' }}>
              <strong>System health:</strong> <span style={{ color: systemHealth === 'healthy' ? '#1f6f29' : systemHealth === 'warning' ? '#9a3d00' : '#444' }}>{healthMessage}</span>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <strong>Privacy note:</strong> Candidate-level vote counts are withheld while polling remains open.
            </div>
          </div>
        </section>

        <section className="ec-panel" style={{ padding: 20 }}>
          <h2>Integrity Feed</h2>
          <div style={{ marginTop: 12, color: '#444' }}>
            <p>This room is connected to real-time audit logs and uses database health checks to detect duplicate voting behavior.</p>
            <p><strong>Live feed:</strong> Updates whenever a new ballot audit record is inserted.</p>
            {monitorError && <div className="sv-badge-fail" style={{ marginTop: 12 }}>{monitorError}</div>}
          </div>
        </section>
      </div>

      <section className="ec-panel" style={{ padding: 20, marginBottom: 18 }}>
        <h2>Candidate Agent Sign-Off</h2>
        {isRoomClosed ? (
          <>
            <p style={{ color: '#333' }}>Polls are closed. Please review the final audit hash below and acknowledge your verification.</p>
            <div style={{ marginTop: 14, padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #d9e2eb' }}>
              <div style={{ marginBottom: 8 }}><strong>Final audit summary hash:</strong></div>
              <div style={{ fontFamily: 'monospace', wordBreak: 'break-word', color: '#0f172a' }}>{finalAuditHash || 'Awaiting final audit details…'}</div>
            </div>
            <div className="sv-actions" style={{ marginTop: 18 }}>
              <button className="sv-btn sv-btn-primary" onClick={handleSignOff} disabled={signOffState.loading || signOffState.signed || !finalAuditHash}>
                {signOffState.loading ? 'Signing off…' : signOffState.signed ? 'Signed Off' : 'Acknowledge & Sign Off'}
              </button>
            </div>
            {signOffState.message && <div style={{ marginTop: 12, color: signOffState.signed ? '#064e3b' : '#7f1d1d' }}>{signOffState.message}</div>}
          </>
        ) : (
          <div style={{ color: '#475569' }}>
            Sign-off is only available once polls have been closed by the EC. Continue monitoring live turnout until closure.
          </div>
        )}
      </section>

      <div style={{ textAlign: 'right' }}>
        <button className="sv-btn sv-btn-ghost" onClick={() => navigate('/')}>Return to Portal</button>
      </div>
    </div>
  );
}
