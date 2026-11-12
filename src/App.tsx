// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { SiteHeader } from '@/components/layout/site-header';
import { OrderingCounter } from '@/components/ordering-counter';
import { EmployeeDashboard } from '@/components/employee-dashboard';
import { CartProvider } from '@/lib/cart';
import { AccountSettingsDialog } from '@/components/store/account-settings-dialog';
import { supabase } from '@/lib/supabase';
import { FeedbackPage } from '@/components/feedback-page';
import { FloatingSupportButton } from '@/components/floating-support-button';
import { ExtrasPage } from '@/components/extras-page';
import { LoginPage, ResetPasswordDialog } from '@/components/login-page';

export function App() {
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Authentication & Current User State
  const [authMode, setAuthMode] = useState<'select' | 'regular' | 'guest' | 'employee' | 'forgot'>('select');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Recovery states
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  // Validation & Error States
  const [loginError, setLoginError] = useState('');

  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExtras, setShowExtras] = useState(false);

  // Account Settings dialog: open flag + which section it should start on.
  // All of its forms, handlers and state live in store/account-settings-dialog.tsx.
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [accountSettingsTab, setAccountSettingsTab] = useState<'nickname' | 'update' | 'password' | null>(null);

  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [resetTrigger, setResetTrigger] = useState(0);
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
        setIsResetPasswordOpen(true);
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
        if (event === 'PASSWORD_RECOVERY') {
          setAccountSettingsTab('password');
          setShowAccountSettings(true);
        }
      }, 0);
    });
    try {
      if (localStorage.getItem('veyns_auth_mode') === 'guest') {
        const savedGuest = localStorage.getItem('veyns_current_user');
        if (savedGuest) setCurrentUser(JSON.parse(savedGuest));
        setAuthMode('guest');
        const sessionOrders = sessionStorage.getItem('veyns_guest_order_history');
        if (sessionOrders) setOrderHistory(JSON.parse(sessionOrders));
      }
    } catch (e) { console.error(e); }
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  // Openers for the Account Settings dialog. The header only calls these;
  // the dialog itself owns every form and handler.
  const handleOpenLoyalty = () => {
    if (!currentUser || currentUser.type === 'guest') {
      alert('Guests cannot access account settings or loyalty stamps. Please create an account to unlock loyalty rewards!');
      return;
    }
    loadUserStampsAndPenalties(currentUser);
    setAccountSettingsTab(null);
    setShowAccountSettings(true);
  };

  const handleOpenAccountSettings = (tab?: 'update' | 'password' | 'nickname') => {
    if (!currentUser || currentUser.type === 'guest') {
      alert('Guests cannot access account settings. Please create an account to unlock this feature!');
      return;
    }
    loadUserStampsAndPenalties(currentUser);
    setAccountSettingsTab(tab ?? null);
    setShowAccountSettings(true);
  };

  const handleGuestLogin = () => {
    const guestData = { name: 'Guest Diner', identifier: 'guest_trial', type: 'guest' };
    setCurrentUser(guestData);
    setAuthMode('guest');
    localStorage.setItem('veyns_current_user', JSON.stringify(guestData));
    localStorage.setItem('veyns_auth_mode', 'guest');
    setStamps([]);
    setFairPlayPenalty(null);
    setOrderHistory([]);
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
    setOrderHistory([]);
    localStorage.removeItem('veyns_current_user');
    localStorage.removeItem('veyns_auth_mode');
    sessionStorage.removeItem('veyns_guest_order_history');
  };

  const handleResetMenu = () => {
    setShowMyOrders(false);
    setShowAccountSettings(false);
    setResetTrigger((prev) => prev + 1);
  };

  const recordOrderForLoyalty = async () => {
    if (currentUser && currentUser.type !== 'guest') await loadUserStampsAndPenalties(currentUser);
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

  // Main Store Interface
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#071F19] text-white flex flex-col">
        <SiteHeader
          onOpenOrders={() => setShowMyOrders(true)}
          onResetMenu={handleResetMenu}
          currentUser={currentUser}
          onOpenLoyalty={handleOpenLoyalty}
          onLogout={handleLogout}
          onOpenAccountSettings={handleOpenAccountSettings}
          onOpenSignUp={() => {
            setCurrentUser(null);
            setAuthMode('regular');
            setIsSignUp(true);
            setLoginError('');
          }}
          onExitGuest={handleLogout}
          onOpenFeedback={() => setShowFeedback(true)}
          onOpenExtras={() => setShowExtras(true)}
        />
        <main className="flex-1">
          <OrderingCounter
            onOpenExtras={() => setShowExtras(true)}
            showMyOrders={showMyOrders}
            setShowMyOrders={setShowMyOrders}
            orderHistory={orderHistory}
            setOrderHistory={(newHistory) => {
              setOrderHistory(newHistory);
              if (currentUser && currentUser.type === 'guest') {
                sessionStorage.setItem('veyns_guest_order_history', JSON.stringify(newHistory));
              } else if (currentUser && currentUser.type === 'regular') {
                localStorage.setItem('veyns_order_history', JSON.stringify(newHistory));
              }
            }}
            resetKey={resetTrigger}
            currentUser={currentUser}
            onOrderPlacedSuccess={recordOrderForLoyalty}
            onOpenRegister={() => {
              setCurrentUser(null);
              setAuthMode('regular');
              setIsSignUp(true);
              setLoginError('');
            }}
          />
        </main>
        {showFeedback && <FeedbackPage onBack={() => setShowFeedback(false)} currentUser={currentUser} />}
        {showExtras && <ExtrasPage onBack={() => setShowExtras(false)} onReviewOrder={() => { setShowExtras(false); setShowMyOrders(true); }} />}
        <FloatingSupportButton />
        <AccountSettingsDialog
          open={showAccountSettings}
          onClose={() => setShowAccountSettings(false)}
          currentUser={currentUser}
          initialTab={accountSettingsTab}
          onNicknameSaved={(name) => setCurrentUser((prev: any) => (prev ? { ...prev, name } : prev))}
        />
        {isResetPasswordOpen && <ResetPasswordDialog onFinished={() => setIsResetPasswordOpen(false)} />}
      </div>
    </CartProvider>
  );
}

export default App;