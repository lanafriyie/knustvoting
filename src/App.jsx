import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SecureVoteModule from './components/SecureVoteModule';
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

  // Listen for Supabase auth state changes & persist session state to localStorage
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userObj = {
          student_id: session.user.id,
          full_name: session.user.user_metadata?.full_name || 'Kwame Nkrumah',
          email: session.user.email,
          department_code: 'COE',
          college_code: 'COE',
          hall_code: 'UNITY',
          year_of_study: 1,
          level: 100,
          biometrics_completed_current_semester: true,
        };
        localStorage.setItem('knust_user_session', JSON.stringify(userObj));
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

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
      <div className="app-root flex flex-row h-screen overflow-hidden bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors duration-200">
        <Sidebar navigate={navigate} />
        <main className="flex-1 p-6 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 overflow-y-auto">
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <p className="text-gray-600 dark:text-slate-400">Loading your portal...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-root flex flex-row h-screen overflow-hidden bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar
        navigate={navigate}
        hasECAccess={hasECAccess}
        ecRole={ecRole}
        ecJurisdictionName={ecJurisdictionName}
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      <main className="app-main-content flex-1 p-6 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 overflow-y-auto transition-colors duration-200">
        {isBallot ? (
          <Ballot electionId={ballotId} onBack={() => navigate('/secure-vote')} />
        ) : currentView === 'ec-admin' && route === '/ec-admin' ? (
          <ECAdmin navigate={navigate} />
        ) : route === '/secure-vote' || route === '/governance/secure-vote' || (hasECAccess && currentView === 'student') ? (
          <SecureVoteModule navigate={navigate} />
        ) : route === '/candidate-agent' ? (
          <CandidateAgentRoom navigate={navigate} />
        ) : route === '/candidate-agent/unauthorized' ? (
          <Unauthorized onBack={() => navigate('/')} />
        ) : route === '/ec-admin/unauthorized' ? (
          <Unauthorized onBack={() => navigate('/')} />
        ) : (
          <Dashboard navigate={navigate} />
        )}
      </main>
    </div>
  );
}
