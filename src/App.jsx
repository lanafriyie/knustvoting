import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SecureVoteModule from './components/SecureVoteModule';
import Ballot from './components/Ballot';
import ECAdmin from './components/ECAdmin';
import ECAdminAuthGuard from './components/ECAdminAuthGuard';
import StudentResultsPortal from './components/StudentResultsPortal';
import CandidateAgentRoom from './components/CandidateAgentRoom';
import Unauthorized from './components/Unauthorized';
import AppBarRoleSwitcher from './components/AppBarRoleSwitcher';
import ThemeToggle from './components/ThemeToggle';
import { Menu } from 'lucide-react';
import ToastContainer from './components/ToastContainer';
import useECAuthorization from './hooks/useECAuthorization';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { mockElections, mergeWithMockElections, getElectionStatus, checkElectionEligibility, formatUnlockDate } from './lib/eligibility';
import { getStoredStudentProfile } from './lib/demoProfiles';
import './styles/SecureVote.css';

function BallotGuard({ ballotId, navigate }) {
  useEffect(() => {
    // Background sync user session attributes
    try {
      let activeUser = null;
      const stored = localStorage.getItem('knust_user_session');
      if (stored) activeUser = JSON.parse(stored);
      if (!activeUser) activeUser = getStoredStudentProfile();
      if (activeUser && !activeUser.constituency_locked) {
        activeUser.constituency_locked = activeUser.constituency || 'Ayeduase';
        localStorage.setItem('knust_user_session', JSON.stringify(activeUser));
      }
    } catch (e) {}
  }, [ballotId]);

  return <Ballot electionId={ballotId} onBack={() => navigate('/secure-vote')} />;
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname || '/');
  const [isCandidateAgent, setIsCandidateAgent] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [currentView, setCurrentView] = useState('student');  // 'student' or 'ec-admin'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      try {
        const getUserPromise = supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: { user: null } }), 300));
        const res = await Promise.race([getUserPromise, timeoutPromise]);
        const userData = res?.data;

        if (userData?.user) {
          const fetchRolePromise = supabase
            .from('election_room_members')
            .select('role_in_room')
            .eq('student_id', userData.user.id)
            .eq('role_in_room', 'CANDIDATE_AGENT')
            .limit(1)
            .maybeSingle()
            .catch(() => ({ data: null }));

          const roleRes = await Promise.race([fetchRolePromise, timeoutPromise]);
          const data = roleRes?.data;

          if (data && data.role_in_room === 'CANDIDATE_AGENT') {
            setIsCandidateAgent(true);
            if (route !== '/candidate-agent' && !route.startsWith('/candidate-agent')) {
              navigate('/candidate-agent');
            }
          }
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
      <div className="app-root flex flex-col md:flex-row h-screen overflow-hidden bg-[#F5F7F8] dark:bg-slate-900 text-[#202522] dark:text-slate-100 transition-colors duration-200 relative">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-[#DDE5E1] dark:border-slate-800 z-30 w-full flex-shrink-0">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors border-none bg-transparent cursor-pointer"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-black text-[#007A4D] dark:text-slate-100 text-xs tracking-wider uppercase">KNUST AIM Portal</span>
          <ThemeToggle />
        </div>

        {isMobileMenuOpen && (
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden animate-fadeIn"
          />
        )}

        <Sidebar 
          navigate={navigate} 
          isMobileOpen={isMobileMenuOpen}
          onNavigate={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 p-4 md:p-6 bg-[#F5F7F8] dark:bg-slate-900 text-[#202522] dark:text-slate-100 overflow-y-auto">
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <p className="text-slate-600 dark:text-slate-400">Loading your portal...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <AdminAuthProvider>
      <div className="app-root flex flex-col md:flex-row h-screen overflow-hidden bg-[#F5F7F8] dark:bg-slate-900 text-[#202522] dark:text-slate-100 transition-colors duration-200 relative animate-fadeIn">
        {/* Mobile Header Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-[#DDE5E1] dark:border-slate-800 z-30 w-full flex-shrink-0 shadow-2xs">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors border-none bg-transparent cursor-pointer"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-black text-[#007A4D] dark:text-slate-100 text-xs tracking-wider uppercase">KNUST AIM Portal</span>
          <ThemeToggle />
        </div>

        {/* Mobile Backdrop Menu Overlay */}
        {isMobileMenuOpen && (
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden animate-fadeIn"
          />
        )}

        <ToastContainer />

        <Sidebar
          navigate={navigate}
          hasECAccess={hasECAccess}
          ecRole={ecRole}
          ecJurisdictionName={ecJurisdictionName}
          currentView={currentView}
          onViewChange={handleViewChange}
          isMobileOpen={isMobileMenuOpen}
          onNavigate={() => setIsMobileMenuOpen(false)}
        />

        <main className="app-main-content flex-1 p-4 md:p-6 bg-[#F5F7F8] dark:bg-slate-900 text-[#202522] dark:text-slate-100 overflow-y-auto transition-colors duration-200">
          {isBallot ? (
            <BallotGuard ballotId={ballotId} navigate={navigate} />
          ) : route === '/ec-admin' ? (
            <ECAdminAuthGuard navigate={navigate} />
          ) : route === '/secure-vote' || route === '/governance/secure-vote' ? (
            <SecureVoteModule navigate={navigate} />
          ) : route === '/candidate-agent' ? (
            <CandidateAgentRoom navigate={navigate} />
          ) : route === '/candidate-agent/unauthorized' ? (
            <Unauthorized onBack={() => navigate('/')} />
          ) : route === '/results' || route === '/public-results' ? (
            <StudentResultsPortal onBack={() => navigate('/')} />
          ) : (
            <Dashboard navigate={navigate} />
          )}
        </main>
      </div>
    </AdminAuthProvider>
  );
}

