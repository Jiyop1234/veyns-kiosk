// @ts-nocheck
// AuthGate — the auth gate (Step 6 of the store split: moved from src/App.tsx, no behavior change).
// It restores the session, shows the login screens or the staff dashboard,
// and hands everything the customer store shows to <StorePage />.
import React, { useState, useEffect } from 'react';
import { EmployeeDashboard } from '@/components/employee-dashboard';
import { supabase } from '@/lib/supabase';
import { LoginPage } from '@/components/login-page';
import { StorePage } from '@/components/store/store-page';

export function AuthGate() {
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Authentication & Current User State
  const [authMode, setAuthMode] = useState<'select' | 'regular' | 'guest' | 'employee' | 'forgot'>('select');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Password-recovery link opened: StorePage shows the reset dialog + password form when this goes above 0.
  const [passwordRecoveryTick, setPasswordRecoveryTick] = useState(0);

  // Validation & Error States
  const [loginError, setLoginError] = useState('');

  const [stamps, setStamps] = useState<any[]>([]);
  const [fairPlayPenalty, setFairPlayPenalty] = useState<any>(null);

  // Listen for recovery links & link expiry
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('error_code=otp_expired')) {
      alert('The password reset link has expired or was already used. Please request a new one.');
      window.history.replaceState(null, '', window.location.pathname);
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryTick((t) => t + 1);
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load loyalty data only from the authenticated profile row.
  const loadUserStampsAndPenalties = async (userObj: any) => {
    if (!userObj || userObj.type === 'guest' || !userObj.authUserId) {
      setStamps([]);
      setFairPlayPenalty(null);
      return;
    }
    const { data: profile, error } = await supabase.from('profiles')
      .select('stamps_data,penalty_data').eq('auth_user_id', userObj.authUserId).single();
    if (error || !profile) {
      setStamps(Array.from({ length: 12 }, () => ({ status: 'empty', date: '' })));
      setFairPlayPenalty(null);
      return;
    }
    const normalized = Array.from({ length: 12 }).map((_, idx) => profile.stamps_data?.[idx] || { status: 'empty', date: '' });
    setStamps(normalized);
    setFairPlayPenalty(profile.penalty_data || null);
    const key = (userObj.identifier || '').toLowerCase().trim();
    if (key) {
      localStorage.setItem('veyns_detailed_stamps_' + key, JSON.stringify(normalized));
      if (profile.penalty_data) localStorage.setItem('veyns_fair_play_penalty_' + key, JSON.stringify(profile.penalty_data));
      else localStorage.removeItem('veyns_fair_play_penalty_' + key);
    }
  };

  // Restore session and handle verification email redirects.
  useEffect(() => {
    let alive = true;
    const restoreAuthUser = async (session: any) => {
      if (!session?.user) return;
      if (!session.user.email_confirmed_at) {
        setLoginError('Your email address is not verified yet. Please check your inbox and confirm your account.');
        await supabase.auth.signOut();
        return;
      }
      const { data, error } = await supabase.rpc('claim_veyns_profile');
      if (!alive || error) {
        if (error) console.error('Unable to load profile:', error.message);
        const fallbackUser = {
          id: session.user.id,
          authUserId: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Valued Customer',
          identifier: session.user.email,
          email: session.user.email,
          role: 'regular',
          type: 'regular'
        };
        setCurrentUser(fallbackUser);
        setAuthMode('regular');
        return;
      }
      const profile = data;
      if (!profile) return;
      const userObj = {
        id: profile.id,
        authUserId: session.user.id,
        name: profile.name || session.user.user_metadata?.name || 'Valued Customer',
        identifier: profile.identifier || session.user.email,
        email: session.user.email,
        role: profile.role,
        type: 'regular'
      };
      setCurrentUser(userObj);
      setAuthMode(['employee', 'admin'].includes(profile.role) ? 'employee' : 'regular');
      setIsAdminDashboardOpen(['employee', 'admin'].includes(profile.role));
      loadUserStampsAndPenalties(userObj);
    };
    void supabase.auth.getSession().then(({ data }) => restoreAuthUser(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setTimeout(() => {
        void restoreAuthUser(session);
      }, 0);
    });
    try {
      if (localStorage.getItem('veyns_auth_mode') === 'guest') {
        const savedGuest = localStorage.getItem('veyns_current_user');
        if (savedGuest) setCurrentUser(JSON.parse(savedGuest));
        setAuthMode('guest');
        // The guest's saved order history is restored inside StorePage.
      }
    } catch (e) { console.error(e); }
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const handleGuestLogin = () => {
    const guestData = { name: 'Guest Diner', identifier: 'guest_trial', type: 'guest' };
    setCurrentUser(guestData);
    setAuthMode('guest');
    localStorage.setItem('veyns_current_user', JSON.stringify(guestData));
    localStorage.setItem('veyns_auth_mode', 'guest');
    setStamps([]);
    setFairPlayPenalty(null);
    sessionStorage.removeItem('veyns_guest_order_history');
  };

  const handleLogout = () => {
    void supabase.auth.signOut();
    setCurrentUser(null);
    setAuthMode('select');
    setIsAdminDashboardOpen(false);
    setLoginError('');
    setStamps([]);
    setFairPlayPenalty(null);
    localStorage.removeItem('veyns_current_user');
    localStorage.removeItem('veyns_auth_mode');
    sessionStorage.removeItem('veyns_guest_order_history');
  };

  const handleOpenSignUp = () => {
    setCurrentUser(null);
    setAuthMode('regular');
    setIsSignUp(true);
    setLoginError('');
  };

  // Login screens (front door, customer login/sign-up, forgot password, staff door)
  if (authMode === 'select' || (authMode === 'regular' && !currentUser) || authMode === 'forgot' || (authMode === 'employee' && !isAdminDashboardOpen)) {
    return (
      <LoginPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        setCurrentUser={setCurrentUser}
        setIsAdminDashboardOpen={setIsAdminDashboardOpen}
        isSignUp={isSignUp}
        setIsSignUp={setIsSignUp}
        loginError={loginError}
        setLoginError={setLoginError}
        loadUserStampsAndPenalties={loadUserStampsAndPenalties}
        onContinueAsGuest={handleGuestLogin}
      />
    );
  }

  // Staff dashboard
  if (authMode === 'employee') {
    return (
      <EmployeeDashboard
        onBackToStore={() => {
          setIsAdminDashboardOpen(false);
          setAuthMode('select');
          if (currentUser && currentUser.type !== 'guest') {
            loadUserStampsAndPenalties(currentUser);
          }
        }}
      />
    );
  }

  // Customer store
  return (
    <StorePage
      currentUser={currentUser}
      onLogout={handleLogout}
      onOpenSignUp={handleOpenSignUp}
      onNicknameSaved={(name) => setCurrentUser((prev: any) => (prev ? { ...prev, name } : prev))}
      loadUserStampsAndPenalties={loadUserStampsAndPenalties}
      passwordRecoveryTick={passwordRecoveryTick}
      onPasswordRecoveryHandled={() => setPasswordRecoveryTick(0)}
    />
  );
}

export default AuthGate;
