import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import Sidebar from './components/Sidebar';
import SecureVote from './components/SecureVote';
import Ballot from './components/Ballot';
import ECAdmin from './components/ECAdmin';
import CandidateAgentRoom from './components/CandidateAgentRoom';
import Unauthorized from './components/Unauthorized';
import AppBarRoleSwitcher from './components/AppBarRoleSwitcher';
import useECAuthorization from './hooks/useECAuthorization';
import './styles/SecureVote.css';

export default function App() {
  const [route, setRoute] = useState(window.location.pathname || '/');
  const [isCandidateAgent, setIsCandidateAgent] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [currentView, setCurrentView] = useState('student');  // 'student' or 'ec-admin'
  
  // Use EC authorization hook for dual-identity detection
  const { hasECAccess, ecRole, ecJurisdictionName, checkVoteStatus, voteStatus, currentElectionId } = useECAuthorization();

  // Check if user is a candidate agent on app load
  useEffect(() => {
    async function checkUserRole() {
      setCheckingRole(true);
      try {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError || !userData?.user) {
          setCheckingRole(false);
          return;
        }

        // Check if user has CANDIDATE_AGENT role
        const { data, error } = await supabase
          .from('election_room_members')
          .select('role_in_room')
          .eq('student_id', userData.user.id)
          .eq('role_in_room', 'CANDIDATE_AGENT')
          .limit(1)
          .maybeSingle();

        if (!error && data && data.role_in_room === 'CANDIDATE_AGENT') {
          setIsCandidateAgent(true);
          // Auto-redirect to candidate agent room if not already there
          if (route !== '/candidate-agent' && !route.startsWith('/candidate-agent')) {
            navigate('/candidate-agent');
          }
        } else {
          setIsCandidateAgent(false);
        }
      } catch (err) {
        console.warn('Error checking user role', err);
      } finally {
        setCheckingRole(false);
      }
    }

    checkUserRole();
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(to) {
    if (to === route) return;
    window.history.pushState({}, '', to);
    setRoute(to);
  }

  // Handle dual-view route logic
  const handleViewChange = (newView) => {
    setCurrentView(newView);
    if (newView === 'ec-admin' && hasECAccess) {
      navigate('/ec-admin');
    } else if (newView === 'student') {
      navigate('/secure-vote');
    }
  };

  // Update vote status when election changes
  useEffect(() => {
    if (currentView === 'ec-admin' && currentElectionId) {
      checkVoteStatus(currentElectionId);
    }
  }, [currentElectionId, currentView, checkVoteStatus]);

  // parse route for ballot
  const isBallot = route.startsWith('/ballot/');
  const ballotId = isBallot ? route.replace('/ballot/', '') : null;

  // If checking role or is candidate agent and not on candidate-agent route, show loading
  if (checkingRole) {
    return (
      <div className="app-root" style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar navigate={navigate} />
        <main style={{ flex: 1, padding: 24, background: '#F4F6F8' }}>
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <p>Loading your portal...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top App Bar */}
      <div style={{
        background: '#004D25',
        color: '#fff',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid #003a1a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🗳️</span>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>KNUST Elections</h1>
        </div>

        {/* Role Switcher - only visible if user has EC access */}
        <AppBarRoleSwitcher
          hasECAccess={hasECAccess}
          ecRole={ecRole}
          ecJurisdictionName={ecJurisdictionName}
          currentView={currentView}
          onViewChange={handleViewChange}
        />
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar navigate={navigate} />

        <main style={{ flex: 1, padding: 24, background: '#F4F6F8', overflowY: 'auto' }}>
          {isBallot ? (
            <Ballot electionId={ballotId} onBack={() => navigate('/secure-vote')} />
          ) : currentView === 'ec-admin' && route === '/ec-admin' ? (
            <ECAdmin navigate={navigate} />
          ) : route === '/secure-vote' || (hasECAccess && currentView === 'student') ? (
            <SecureVote navigate={navigate} />
          ) : route === '/candidate-agent' ? (
            <CandidateAgentRoom navigate={navigate} />
          ) : route === '/candidate-agent/unauthorized' ? (
            <Unauthorized onBack={() => navigate('/')} />
          ) : route === '/ec-admin/unauthorized' ? (
            <Unauthorized onBack={() => navigate('/')} />
          ) : (
            <div>
              <h1>Welcome to the Student Portal</h1>
              <p>This is the main content area. Use the navigation on the left to open modules.</p>
              <section>
                <h2>Secure Vote</h2>
                <p>Click Governance → Secure Vote in the sidebar to trigger step-up authentication and access the module.</p>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
