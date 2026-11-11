// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SiteHeader } from '@/components/site-header';
import { OrderingCounter } from '@/components/ordering-counter';
import { EmployeeDashboard } from '@/components/employee-dashboard';
import { CartProvider } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { User, ShieldAlert, Award, ShoppingBag, Sparkles, LogOut, CheckCircle2, XCircle, KeyRound, Tag, AlertTriangle, Clock, Settings, Edit3, Facebook, Instagram, Eye, EyeOff, ChevronDown, Mail, RefreshCw } from 'lucide-react';
import veynsSymbol from '@/assets/VEYNS SYMBOL.png';
import { supabase } from '@/lib/supabase';
import { FeedbackPage } from '@/components/feedback-page';
import { FloatingSupportButton } from '@/components/floating-support-button';
import { ExtrasPage } from '@/components/extras-page';
import { LoginPage, ResetPasswordDialog, validateEmail, validatePasswordStrength } from '@/components/login-page';

export function App() {
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Authentication & Current User State
  const [authMode, setAuthMode] = useState<'select' | 'regular' | 'guest' | 'employee' | 'forgot'>('select');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Recovery states
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  
  // Email authentication inputs
  
  // Forgot password state
  
  // Validation & Error States
  const [loginError, setLoginError] = useState('');
  
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showAccountSettingsPanel, setShowAccountSettingsPanel] = useState(false);
  const [isUpdatingIdentifier, setIsUpdatingIdentifier] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // Account settings update state
  const [newEmailInput, setNewEmailInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordSettingInput, setNewPasswordSettingInput] = useState('');
  const [accountUpdateSuccess, setAccountUpdateSuccess] = useState(false);

  // Edit Nickname (Settings -> My Account). Separate from the sign-up form's nicknameError above.
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameFormError, setNicknameFormError] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  
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
          setShowLoyaltyModal(true); 
          setShowAccountSettingsPanel(true); 
          setIsResettingPassword(true); 
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

  const handleUpdateIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.type === 'guest') return;
    const email = newEmailInput.trim().toLowerCase();
    if (!validateEmail(email)) { alert('Enter a valid email address.'); return; }
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: window.location.origin });
    if (error) { alert(error.message); return; }
    alert('A verification email was sent to your new email address. Please verify it to update your account.');
    setIsUpdatingIdentifier(false);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.type === 'guest') return;
    if (!validatePasswordStrength(newPasswordSettingInput)) { 
      alert('Use at least 8 characters, including a number and a symbol.'); 
      return; 
    }
    const { error } = await supabase.auth.updateUser({ password: newPasswordSettingInput });
    if (error) { alert(error.message); return; }
    setAccountUpdateSuccess(true);
    setTimeout(() => { 
      setAccountUpdateSuccess(false); 
      setIsResettingPassword(false); 
      setCurrentPasswordInput(''); 
      setNewPasswordSettingInput(''); 
    }, 2000);
  };

  // ---- Edit Nickname -------------------------------------------------------------------------------
  // The nickname is profiles.name. Rules match the rest of the app: trimmed and not blank (sign-up and the
  // staff editor), at most 80 characters (staff account creation). The write goes through the
  // update_my_nickname() database function, which can only change the signed-in customer's own profiles.name.
  // It never touches the email, password or any other column.
  const NICKNAME_MAX = 80;
  const normalizeNickname = (raw: string) => raw.replace(/\s+/g, ' ').trim();

  const openNicknameEditor = () => {
    const current = String(currentUser?.name || '').trim();
    // Invited customers start with their email as nickname: leave the box empty so they simply type a new one.
    setNicknameInput(current.includes('@') || current === 'Valued Customer' ? '' : current);
    setNicknameFormError('');
    setIsEditingNickname(true);
    setIsUpdatingIdentifier(false);
    setIsResettingPassword(false);
  };

  const closeNicknameEditor = () => {
    setIsEditingNickname(false);
    setNicknameInput('');
    setNicknameFormError('');
  };

  const handleSaveNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingNickname) return;
    if (!currentUser || currentUser.type === 'guest') return;
    const value = normalizeNickname(nicknameInput);
    if (!value) { setNicknameFormError('Nickname cannot be blank.'); return; }
    if (value.length > NICKNAME_MAX) { setNicknameFormError(`Nickname must be ${NICKNAME_MAX} characters or fewer.`); return; }
    if (/[\u0000-\u001f\u007f]/.test(value)) { setNicknameFormError('Nickname contains characters that are not allowed.'); return; }
    if (value === String(currentUser.name || '').trim()) { setNicknameFormError('That is already your nickname.'); return; }

    setNicknameFormError('');
    setIsSavingNickname(true);
    try {
      const { data, error } = await supabase.rpc('update_my_nickname', { p_name: value });
      if (error) {
        console.error('Nickname update failed:', error.code, error.message);
        const msg = String(error.message || '');
        if (error.code === '23505') setNicknameFormError('That nickname is already taken. Please choose another one.');
        else if (/invalid_nickname/i.test(msg)) setNicknameFormError(`Enter a nickname of 1 to ${NICKNAME_MAX} characters.`);
        else if (/profile_not_found|not_authenticated/i.test(msg)) setNicknameFormError('We could not find your account profile. Please log out and sign in again.');
        else if (error.code === 'PGRST202' || /could not find the function/i.test(msg)) setNicknameFormError('Nickname saving is not available right now. Please try again later.');
        else setNicknameFormError(msg || 'Could not save your nickname. Please try again.');
        return;
      }
      const saved = typeof data === 'string' && data ? data : value;
      // Header greeting, feedback dialog and order forms all read currentUser.name, so they update immediately.
      setCurrentUser((prev: any) => (prev ? { ...prev, name: saved } : prev));
      setAccountUpdateSuccess(true);
      setTimeout(() => {
        setAccountUpdateSuccess(false);
        closeNicknameEditor();
      }, 2000);
      // Keep the auth profile's display name in step so a later session restore shows the same nickname.
      // This only merges { name } into user_metadata; the email and password are not touched.
      const { error: metaError } = await supabase.auth.updateUser({ data: { name: saved } });
      if (metaError) console.error('Nickname saved, but the auth metadata copy was not updated:', metaError.message);
    } finally {
      setIsSavingNickname(false);
    }
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
    setShowLoyaltyModal(false);
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
          onOpenLoyalty={() => {
            if (!currentUser || currentUser.type === 'guest') {
              alert('Guests cannot access account settings or loyalty stamps. Please create an account to unlock loyalty rewards!');
              return;
            }
            loadUserStampsAndPenalties(currentUser);
            setShowLoyaltyModal(true);
            setShowAccountSettingsPanel(true);
            setIsUpdatingIdentifier(false);
            setIsResettingPassword(false);
            setIsEditingNickname(false);
          }}
          onLogout={handleLogout}
          onOpenAccountSettings={(tab) => {
            if (!currentUser || currentUser.type === 'guest') {
              alert('Guests cannot access account settings. Please create an account to unlock this feature!');
              return;
            }
            loadUserStampsAndPenalties(currentUser);
            setShowLoyaltyModal(true);
            setShowAccountSettingsPanel(true);
            if (tab === 'nickname') {
              openNicknameEditor();
            } else if (tab === 'update') {
              setIsEditingNickname(false);
              setIsUpdatingIdentifier(true);
              setIsResettingPassword(false);
              setNewEmailInput('');
            } else if (tab === 'password') {
              setIsEditingNickname(false);
              setIsResettingPassword(true);
              setIsUpdatingIdentifier(false);
            }
          }}
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
        {showFeedback && <FeedbackPage onBack={() => setShowFeedback(false)} currentUser={currentUser} /> } 
        {showExtras && <ExtrasPage onBack={() => setShowExtras(false)} onReviewOrder={() => { setShowExtras(false); setShowMyOrders(true); }} />}
        <FloatingSupportButton />  
        <Dialog open={showLoyaltyModal} onOpenChange={setShowLoyaltyModal}>
          <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="space-y-1 text-left border-b border-emerald-900/60 pb-3">
              <DialogTitle className="font-display text-xl font-extrabold text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-lime-400" /> Account Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-300/80">
                Manage your account details and security credentials.
              </DialogDescription>
            </div>
            <div className="my-4 space-y-4">
              {currentUser && currentUser.type === 'regular' && (
                <div className="space-y-3">
                  <div className="bg-[#051813] border border-emerald-800 rounded-2xl p-4 space-y-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold">Your Registered Email</span>
                      <p className="text-xs font-mono font-bold text-white bg-[#041913] p-2.5 rounded-xl border border-emerald-800/80">
                        {currentUser?.identifier || currentUser?.email || currentUser?.userEmail || 'Connected via Supabase'}
                      </p>
                    </div>
                    {accountUpdateSuccess && (
                      <div className="bg-[#061d16] border border-lime-400/60 rounded-xl p-3 text-center space-y-1">
                        <CheckCircle2 className="h-5 w-5 text-lime-400 mx-auto" />
                        <p className="font-bold text-lime-400 text-[11px]">Successfully updated!</p>
                      </div>
                    )}
                    {!isUpdatingIdentifier && !isResettingPassword && !isEditingNickname && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          type="button"
                          onClick={openNicknameEditor}
                          className="col-span-2 bg-[#04261d] hover:bg-emerald-900 text-lime-400 border border-emerald-700 font-bold py-2.5 rounded-xl text-[11px] cursor-pointer flex items-center justify-center gap-1"
                        >
                          <User className="h-3.5 w-3.5" /> Edit Nickname
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setIsUpdatingIdentifier(true);
                            setIsResettingPassword(false);
                            setNewEmailInput('');
                          }}
                          className="bg-[#04261d] hover:bg-emerald-900 text-lime-400 border border-emerald-700 font-bold py-2.5 rounded-xl text-[11px] cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Update Email
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setIsResettingPassword(true);
                            setIsUpdatingIdentifier(false);
                          }}
                          className="bg-[#04261d] hover:bg-emerald-900 text-amber-400 border border-emerald-700 font-bold py-2.5 rounded-xl text-[11px] cursor-pointer flex items-center justify-center gap-1"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Reset Password
                        </Button>
                      </div>
                    )}
                    {isUpdatingIdentifier && (
                      <form onSubmit={handleUpdateIdentifierSubmit} className="space-y-3 pt-2">
                        <div className="space-y-2">
                          <label className="font-bold text-lime-400 uppercase tracking-wider block text-[10px]">
                            New Email Address
                          </label>
                          <input
                            type="email"
                            required
                            value={newEmailInput}
                            onChange={(e) => setNewEmailInput(e.target.value)}
                            className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400 text-xs"
                            placeholder="Enter new email address"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            type="button"
                            onClick={() => setIsUpdatingIdentifier(false)}
                            className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2 rounded-xl text-[11px] cursor-pointer"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2 rounded-xl text-[11px] cursor-pointer shadow"
                          >
                            Save New Email
                          </Button>
                        </div>
                      </form>
                    )}
                    {isEditingNickname && !isUpdatingIdentifier && !isResettingPassword && (
                      <form onSubmit={handleSaveNicknameSubmit} className="space-y-3 pt-2 border-t border-emerald-900/60">
                        <div className="space-y-1">
                          <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold">Current Nickname</span>
                          <p className="text-xs font-bold text-white bg-[#041913] p-2.5 rounded-xl border border-emerald-800/80 break-all">
                            {currentUser?.name || 'Not set'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="edit-nickname-input" className="font-bold text-lime-400 uppercase tracking-wider block text-[10px]">
                            New Nickname
                          </label>
                          <p className="text-[10px] text-emerald-300/80 mb-1">
                            This is the name shown across the site. Your email and password stay the same.
                          </p>
                          <input
                            id="edit-nickname-input"
                            type="text"
                            autoFocus
                            autoComplete="nickname"
                            maxLength={NICKNAME_MAX}
                            value={nicknameInput}
                            onChange={(e) => {
                              setNicknameInput(e.target.value);
                              if (nicknameFormError) setNicknameFormError('');
                            }}
                            className={`w-full bg-[#041913] border rounded-xl p-2.5 text-white focus:outline-none text-xs ${
                              nicknameFormError ? 'border-red-500 focus:border-red-500' : 'border-emerald-800 focus:border-lime-400'
                            }`}
                            placeholder="Enter your preferred nickname"
                          />
                          {nicknameFormError && <p className="text-[10px] text-red-400 mt-1 font-semibold">{nicknameFormError}</p>}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            onClick={closeNicknameEditor}
                            disabled={isSavingNickname}
                            className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2 rounded-xl text-[11px] cursor-pointer"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={isSavingNickname}
                            className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2 rounded-xl text-[11px] cursor-pointer shadow disabled:opacity-60"
                          >
                            {isSavingNickname ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </form>
                    )}
                    {isResettingPassword && (
                      <form onSubmit={handleResetPasswordSubmit} className="space-y-3 pt-2 border-t border-emerald-900/60">
                        <div className="space-y-1">
                          <label className="font-bold text-lime-400 uppercase tracking-wider block text-[10px]">New Password</label>
                          <p className="text-[10px] text-emerald-300/80 mb-1">Minimum 8 characters, including numbers and symbols.</p>
                          <input
                            type="password"
                            required
                            value={newPasswordSettingInput}
                            onChange={(e) => setNewPasswordSettingInput(e.target.value)}
                            className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                            placeholder="Create a strong password"
                          />
                        </div>
                        <div className="bg-[#03120d] border border-emerald-800/80 rounded-xl p-2.5 text-[11px] text-emerald-300 space-y-1.5">
                          <p className="font-semibold">Forgot your current password?</p>
                          <p className="text-[10px] text-emerald-400/80">Please contact us through our social media pages below:</p>
                          <div className="flex gap-2 pt-0.5">
                            <a
                              href="https://www.facebook.com/veyns.ubec"
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 bg-[#061d16] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 px-2 py-1 rounded-lg font-bold text-[10px] transition-all"
                            >
                              <Facebook className="size-3" /> Facebook
                            </a>
                            <a
                              href="https://www.instagram.com/veyns.ubec"
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 bg-[#061d16] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 px-2 py-1 rounded-lg font-bold text-[10px] transition-all"
                            >
                              <Instagram className="size-3" /> Instagram
                            </a>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            onClick={() => { 
                              setIsResettingPassword(false); 
                              setCurrentPasswordInput(''); 
                              setNewPasswordSettingInput(''); 
                            }}
                            className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2 rounded-xl text-[11px] cursor-pointer"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2 rounded-xl text-[11px] cursor-pointer shadow"
                          >
                            Confirm Password
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={() => setShowLoyaltyModal(false)}
              className="w-full bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-extrabold py-3 rounded-xl text-xs transition-all shadow mt-4"
            >
              Close
            </Button>
          </DialogContent>
        </Dialog>


        {isResetPasswordOpen && <ResetPasswordDialog onFinished={() => setIsResetPasswordOpen(false)} />}
      </div>
    </CartProvider>
  );
}

export default App;
