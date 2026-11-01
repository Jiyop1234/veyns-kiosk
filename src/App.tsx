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

export function App() {
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Authentication & Current User State
  const [authMode, setAuthMode] = useState<'select' | 'regular' | 'guest' | 'employee' | 'forgot'>('select');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Recovery states
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  
  // Email authentication inputs
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  // Forgot password state
  const [forgotEmailInput, setForgotEmailInput] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  
  // Validation & Error States
  const [nicknameError, setNicknameError] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showAccountSettingsPanel, setShowAccountSettingsPanel] = useState(false);
  const [isUpdatingIdentifier, setIsUpdatingIdentifier] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // Account settings update state
  const [newEmailInput, setNewEmailInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordSettingInput, setNewPasswordSettingInput] = useState('');
  const [accountUpdateSuccess, setAccountUpdateSuccess] = useState(false);
  
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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters long.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setResetError(error.message);
    } else {
      setResetSuccess(true);
      setTimeout(() => {
        setIsResetPasswordOpen(false);
        setResetSuccess(false);
        setNewPassword('');
      }, 2000);
    }
  };

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
        const userObj = {
          id: profile?.id,
          authUserId: data.user.id,
          email: data.user.email,
          identifier: profile?.identifier || data.user.email,
          role: userRole,
          type: 'regular',
          name: profile?.name || authName || data.user.email?.split('@')[0] || 'Valued Customer'
        };
        setAuthMode('guest');
        const sessionOrders = sessionStorage.getItem('veyns_guest_order_history');
        if (sessionOrders) setOrderHistory(JSON.parse(sessionOrders));
      }
    } catch (e) { console.error(e); }
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  const validatePasswordStrength = (pass: string) => pass.length >= 8 && /\d/.test(pass) && /[\W_]/.test(pass);

  const handleResendVerification = async () => {
    const email = (registeredEmail || authEmailInput).trim().toLowerCase();
    if (!email) return;
    setIsResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: { emailRedirectTo: window.location.origin }
    });
    setIsResending(false);
    if (error) {
      alert('Failed to resend email: ' + error.message);
    } else {
      alert(`A fresh verification link has been sent to ${email}.`);
    }
  };

  const handleRegularAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setNicknameError('');
    setIdentifierError('');
    setPasswordError('');
    setLoginError('');
    const email = authEmailInput.trim().toLowerCase();
    if (!email || !validateEmail(email)) {
      setIdentifierError('Enter a valid email address.');
      return;
    }
    if (!authPassword || (isSignUp && !validatePasswordStrength(authPassword))) {
      setPasswordError('Use at least 8 characters, including a number and a symbol.');
      return;
    }
    if (isSignUp) {
      const nickname = authName.trim();
      if (!nickname) {
        setNicknameError('Choose a nickname.');
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password: authPassword,
        options: {
          data: { name: nickname },
          emailRedirectTo: window.location.origin
        }
      });
      if (error) {
        setIdentifierError(error.message);
        return;
      }
      if (!data.session) {
        setRegisteredEmail(email);
        setSignUpSuccessMsg(true);
        setIsSignUp(false);
        setAuthPassword('');
        setAuthName('');
        return;
      }
      const { data: profileData, error: profileError } = await supabase.rpc('claim_veyns_profile');
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      if (profileError || !profile) {
        setIdentifierError(profileError?.message || 'Unable to load profile.');
        return;
      }
      const userObj = {
        id: profile.id,
        authUserId: data.user.id,
        name: profile.name || nickname,
        identifier: profile.identifier || data.user.email,
        email: data.user.email,
        role: profile.role,
        type: 'regular'
      };
      setCurrentUser(userObj);
      const isStaff = ['employee', 'admin'].includes(profile.role);
      setAuthMode(isStaff ? 'employee' : 'regular');
      setIsAdminDashboardOpen(isStaff);
      loadUserStampsAndPenalties(userObj);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmailInput,
      password: authPassword,
    });
    if (error) {
      setLoginError(error.message);
      return;
    }
    if (data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();
      const userRole = profile?.role || 'regular';
      // Build a COMPLETE user object so the header renders the correct nickname immediately
      // without waiting for restoreAuthUser to fire from the auth state listener.
      const userObj = {
        id: profile?.id,
        userId: data.user.id,
        authUserId: data.user.id,
        email: data.user.email,
        identifier: profile?.identifier || data.user.email,
        role: userRole,
        type: 'regular',
        name: profile?.name || data.user.user_metadata?.name || authName || data.user.email?.split('@')[0] || 'Valued Customer'
      };
      setCurrentUser(userObj);
      if (userRole === 'admin' || userRole === 'employee') {
        setAuthMode('employee');
        setIsAdminDashboardOpen(true);
      } else {
        setAuthMode('regular');
      }
      // Load loyalty data immediately so the stamp card is ready
      loadUserStampsAndPenalties(userObj);
    }
  };

  const handleUpdateIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.type === 'guest') return;
    const email = newEmailInput.trim().toLowerCase();
    if (!validateEmail(email)) { alert('Enter a valid email address.'); return; }
    const { error } = await supabase.auth.updateUser({ email });
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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEmailInput.trim().toLowerCase();
    if (!validateEmail(email)) { alert('Enter a valid email address.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) { alert(error.message); return; }
    setForgotSuccess(true);
  };

  const handleEmployeeAuth = async () => {
    const email = authEmailInput.trim().toLowerCase();
    if (!email || !authPassword) { setLoginError('Enter your staff email and password.'); return; }
    const credentials = { email, password: authPassword };
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error || !data.user) { setLoginError('Staff sign-in failed. Check your credentials.'); return; }
    const { data: profileData, error: profileError } = await supabase.rpc('claim_veyns_profile');
    const profile = Array.isArray(profileData) ? profileData[0] : profileData;
    if (profileError || !profile || !['employee', 'admin'].includes(profile.role)) {
      await supabase.auth.signOut(); 
      setLoginError('This account does not have staff access.'); 
      return;
    }

    const userObj = {
      id: profile?.id,
      authUserId: data.user.id,
      email: data.user.email,
      identifier: profile?.identifier || data.user.email,
      role: userRole,
      type: 'regular',
      name: profile?.name || authName || data.user.email?.split('@')[0] || 'Valued Customer'
    };
    setAuthMode('employee'); 
    setIsAdminDashboardOpen(true);
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
    setAuthEmailInput('');
    setAuthPassword('');
    setAuthName('');
    setNicknameError('');
    setIdentifierError('');
    setPasswordError('');
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

  // Entry Role Selection Screen
  if (authMode === 'select') {
    return (
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#051813] border border-emerald-800/80 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="space-y-3 relative">
            <div className="flex justify-center -mb-4 -mt-6">
              <img src={veynsSymbol} alt="VEYNS. Symbol" className="h-64 w-64 object-contain scale-125 transform" />
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white pt-2">
              WELCOME TO <span className="text-lime-400">VEYNS.</span>
            </h1>
            <p className="text-xs text-emerald-300/80">Please select how you would like to enter our store:</p>
          </div>
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => { 
                setAuthEmailInput(''); 
                setAuthPassword(''); 
                setAuthName(''); 
                setNicknameError(''); 
                setIdentifierError(''); 
                setPasswordError(''); 
                setLoginError(''); 
                setAuthMode('regular'); 
                setIsSignUp(false); 
              }}
              className="w-full bg-[#082d22] hover:bg-lime-400 hover:text-black text-white border border-emerald-700/80 py-4 px-3 h-auto rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer text-center"
            >
              <User className="size-4 text-lime-400 shrink-0" />
              <span className="leading-tight">Login as Regular <span className="block sm:inline font-normal opacity-90">(Earn Stamps & History)</span></span>
            </Button>
            <Button
              onClick={handleGuestLogin}
              className="w-full bg-[#061d16] hover:bg-[#0a3629] text-emerald-200 border border-emerald-800/60 py-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Sparkles className="size-4 text-lime-400" /> Continue as Guest (Trial Mode)
            </Button>
            <Button
              onClick={() => setAuthMode('employee')}
              className="w-full bg-transparent hover:bg-emerald-950/40 text-emerald-400/80 border border-emerald-900/60 py-3 rounded-2xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ShieldAlert className="size-3.5" /> Login as Employee / Admin
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Regular Customer Login & Signup Form
  if (authMode === 'regular' && !currentUser) {
    return (
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#051813] border border-emerald-800/80 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-display text-2xl font-extrabold text-white">
              {isSignUp ? 'Be part of us!' : "Look who's back."}
            </h2>
            <p className="text-xs text-emerald-300/80">
              {isSignUp ? 'Sign up with email to unlock Loyalty Stamps' : 'Access your order history and loyalty rewards'}
            </p>
          </div>
          {signUpSuccessMsg && (
            <div className="bg-[#061d16] border border-lime-400/60 rounded-2xl p-4 text-center space-y-3">
              <CheckCircle2 className="h-6 w-6 text-lime-400 mx-auto" />
              <p className="font-bold text-lime-400 text-xs">Account successfully created!</p>
              <p className="text-xs text-emerald-200 leading-relaxed">
                We sent a confirmation email to <span className="font-bold text-white">{registeredEmail || authEmailInput.trim()}</span>. Please check your inbox and verify your email before logging in.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSignUpSuccessMsg(false);
                    setIsSignUp(false);
                    setAuthPassword('');
                  }}
                  className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs transition-all shadow cursor-pointer uppercase tracking-wider"
                >
                  Proceed to Login
                </button>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-lime-400 hover:underline cursor-pointer disabled:opacity-50 mx-auto"
                >
                  <RefreshCw className={`size-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  {isResending ? 'Sending email...' : "Didn't receive verification link? Resend"}
                </button>
              </div>
            </div>
          )}
          {loginError && !isSignUp && (
            <div className="bg-red-950/80 border border-red-500 rounded-xl p-3 text-center space-y-2">
              <p className="text-xs font-bold text-red-400">{loginError}</p>
              {loginError.toLowerCase().includes('verified') && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="text-[11px] text-lime-400 hover:underline font-extrabold cursor-pointer block mx-auto"
                >
                  Click here to resend verification email
                </button>
              )}
            </div>
          )}
          <form onSubmit={handleRegularAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Nickname</label>
                <input
                  type="text"
                  required
                  placeholder="Choose your unique nickname"
                  value={authName}
                  onChange={(e) => {
                    setAuthName(e.target.value);
                    if (nicknameError) setNicknameError('');
                  }}
                  className={`w-full rounded-xl border bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none ${
                    nicknameError ? 'border-red-500 focus:border-red-500' : 'border-emerald-800/80 focus:border-lime-400'
                  }`}
                />
                {nicknameError && <p className="text-[10px] text-red-400 mt-1 font-semibold">{nicknameError}</p>}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                required
                placeholder="Enter your email address"
                value={authEmailInput}
                onChange={(e) => {
                  setAuthEmailInput(e.target.value);
                  if (identifierError) setIdentifierError('');
                  if (loginError) setLoginError('');
                }}
                className={`w-full rounded-xl border bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none ${
                  identifierError || (loginError && !isSignUp) ? 'border-red-500 focus:border-red-500' : 'border-emerald-800/80 focus:border-lime-400'
                }`}
              />
              {identifierError && <p className="text-[10px] text-red-400 mt-1 font-semibold">{identifierError}</p>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); }}
                    className="text-[10px] font-semibold text-emerald-400 hover:text-lime-400 underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              {isSignUp && (
                <p className="text-[10px] text-emerald-300/80 mb-1">Minimum 8 characters, including numbers and symbols.</p>
              )}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={isSignUp ? "Create a strong password" : "Enter your password"}
                  value={authPassword}
                  onChange={(e) => {
                    setAuthPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                    if (loginError) setLoginError('');
                  }}
                  className={`w-full rounded-xl border bg-[#041913] px-3.5 py-2.5 pr-10 text-xs text-white placeholder:text-emerald-600 focus:outline-none ${
                    passwordError || (loginError && !isSignUp) ? 'border-red-500 focus:border-red-500' : 'border-emerald-800/80 focus:border-lime-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-lime-400 transition-colors cursor-pointer focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && <p className="text-[10px] text-red-400 mt-1 font-semibold">{passwordError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-xs py-3 rounded-xl uppercase tracking-wider transition cursor-pointer"
            >
              {isSignUp ? 'Create an Account' : 'Login to My Account'}
            </button>
          </form>
          <div className="text-center pt-2 border-t border-emerald-900/60 space-y-2">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthEmailInput('');
                setAuthPassword('');
                setAuthName('');
                setSignUpSuccessMsg(false);
                setNicknameError('');
                setIdentifierError('');
                setPasswordError('');
                setLoginError('');
              }}
              className="text-xs font-bold text-lime-400 hover:underline cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Login here' : "Don't have an account? Be part of us"}
            </button>
            <div>
              <button
                onClick={() => { 
                  setAuthEmailInput(''); 
                  setAuthPassword(''); 
                  setAuthName(''); 
                  setAuthMode('select'); 
                  setSignUpSuccessMsg(false); 
                  setNicknameError(''); 
                  setPasswordError(''); 
                  setLoginError(''); 
                }}
                className="text-[11px] text-emerald-400/60 hover:text-white cursor-pointer"
              >
                ← Back to role selection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Forgot Password Screen
  if (authMode === 'forgot') {
    return (
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#051813] border border-emerald-800/80 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-display text-2xl font-extrabold text-white flex items-center justify-center gap-2">
              <KeyRound className="h-6 w-6 text-lime-400" /> Password Recovery
            </h2>
            <p className="text-xs text-emerald-300/80">
              Enter your account email. Supabase will send a recovery link.
            </p>
          </div>
          {forgotSuccess ? (
            <div className="bg-[#061d16] border border-lime-400/60 rounded-2xl p-6 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-lime-400 mx-auto" />
              <p className="font-bold text-lime-400 text-sm">Check your email for the recovery link.</p>
              <p className="text-xs text-emerald-300">Use that link to choose a new password securely.</p>
            </div>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Account email</label>
                <input 
                  type="email" 
                  required 
                  placeholder="Enter your email address" 
                  value={forgotEmailInput}
                  onChange={(e) => setForgotEmailInput(e.target.value)}
                  className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400" 
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg mt-2 cursor-pointer"
              >
                Send Recovery Link
              </Button>
              <button
                type="button"
                onClick={() => setAuthMode('regular')}
                className="w-full text-center text-xs font-semibold text-emerald-400 hover:text-white pt-2 cursor-pointer"
              >
                ← Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Employee Login Screen
  if (authMode === 'employee') {
    if (isAdminDashboardOpen) {
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
    return (
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#051813] border border-red-900/40 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="space-y-3 flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-red-950/40 border border-red-800/60 flex items-center justify-center text-red-500 shadow-lg">
              <ShieldAlert className="size-6" />
            </div>
            <div className="space-y-2 text-center w-full">
              <div className="inline-block bg-red-950/60 border border-red-900/60 px-6 py-2 rounded-xl shadow-inner">
                <h2 className="font-display text-lg md:text-xl font-black tracking-wider text-red-500 uppercase leading-tight">AUTHORIZED</h2>
                <h2 className="font-display text-lg md:text-xl font-black tracking-wider text-red-500 uppercase leading-tight">PERSONEL ONLY</h2>
              </div>
              <p className="font-display text-sm font-bold text-white uppercase tracking-wide pt-2">security clearance required</p>
              <div className="text-xs text-emerald-300/80 italic max-w-xs mx-auto pt-1 leading-relaxed text-center space-y-0.5">
                <p>"Every action is logged. Every mistake leaves a trace."</p>
                <p>You have been warned.</p>
              </div>
            </div>
          </div>
          <div className="bg-[#041913] border border-emerald-800/60 rounded-2xl p-5 text-xs text-emerald-200 space-y-3">
            <label className="font-bold text-lime-400 uppercase tracking-wider text-[11px] block text-center">staff Supabase Auth sign-in</label>
            <input 
              type="email" 
              autoComplete="username" 
              value={authEmailInput} 
              onChange={(e) => setAuthEmailInput(e.target.value)} 
              placeholder="Staff email" 
              className="w-full rounded-xl border border-emerald-800 bg-black/60 px-4 py-3 text-white" 
            />
            <input 
              type="password" 
              autoComplete="current-password" 
              value={authPassword} 
              onChange={(e) => setAuthPassword(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') void handleEmployeeAuth(); }} 
              placeholder="Password" 
              className="w-full rounded-xl border border-emerald-800 bg-black/60 px-4 py-3 text-white" 
            />
            {loginError && <p className="text-red-400">{loginError}</p>}
            <Button 
              onClick={() => void handleEmployeeAuth()} 
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg cursor-pointer mt-1"
            >
              Sign in
            </Button>
          </div>
          <button
            onClick={() => setAuthMode('select')}
            className="text-xs font-bold text-emerald-400/80 hover:text-white transition-colors cursor-pointer block mx-auto"
          >
            back to the front
          </button>
        </div>
      </div>
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
            if (tab === 'update') {
              setIsUpdatingIdentifier(true);
              setIsResettingPassword(false);
              setNewEmailInput('');
            } else if (tab === 'password') {
              setIsResettingPassword(true);
              setIsUpdatingIdentifier(false);
            }
          }}
          onOpenSignUp={() => {
            setCurrentUser(null);
            setAuthMode('regular');
            setIsSignUp(true);
            setAuthEmailInput('');
            setAuthPassword('');
            setAuthName('');
            setNicknameError('');
            setIdentifierError('');
            setPasswordError('');
            setLoginError('');
          }}
          onExitGuest={handleLogout}
          onOpenFeedback={() => setShowFeedback(true)}
        />
        <main className="flex-1">
          <OrderingCounter
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
              setAuthEmailInput('');
              setAuthPassword('');
              setAuthName('');
              setNicknameError('');
              setIdentifierError('');
              setPasswordError('');
              setLoginError('');
            }}
          />
        </main>
        {showFeedback && <FeedbackPage onBack={() => setShowFeedback(false)} currentUser={currentUser} /> } 
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
                    {!isUpdatingIdentifier && !isResettingPassword && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
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


        {isResetPasswordOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#051813] border border-emerald-800/80 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <h3 className="font-display text-xl font-extrabold text-white text-center uppercase tracking-wide">
                Set New Password
              </h3>
              <p className="text-xs text-emerald-300 text-center">
                Enter your new password below to regain access to your VEYNS account.
              </p>
              {resetSuccess ? (
                <div className="bg-lime-950/60 border border-lime-500/40 rounded-xl p-3 text-center text-xs text-lime-400 font-bold">
                  Password updated successfully! Redirecting...
                </div>
              ) : (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-lime-400 font-bold"
                    />
                  </div>
                  {resetError && (
                    <p className="text-[11px] font-bold text-red-400 text-center">{resetError}</p>
                  )}
                  <button
                    type="submit"
                    className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-xs py-3 rounded-xl uppercase tracking-wider transition cursor-pointer"
                  >
                    Update Password
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </CartProvider>
  );
}

export default App;