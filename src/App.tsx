// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { SiteHeader } from '@/components/site-header';
import { OrderingCounter } from '@/components/ordering-counter';
import { EmployeeDashboard } from '@/components/employee-dashboard';
import { CartProvider } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { 
  User, ShieldAlert, Award, ShoppingBag, Sparkles, LogOut, CheckCircle2, 
  XCircle, KeyRound, Tag, AlertTriangle, Clock, Settings, Edit3, Facebook, 
  Instagram, Eye, EyeOff, ChevronDown, Mail, Phone 
} from 'lucide-react';
import veynsSymbol from '@/assets/VEYNS SYMBOL.png';
import { supabase } from '@/lib/supabase';

export function App() {
  const [authMode, setAuthMode] = useState<'select' | 'regular' | 'guest' | 'employee' | 'forgot'>('select');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Selector State ('email' | 'phone')
  const [authInputType, setAuthInputType] = useState<'email' | 'phone'>('email');
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password selector state
  const [forgotInputType, setForgotInputType] = useState<'email' | 'phone'>('email');
  const [forgotEmailInput, setForgotEmailInput] = useState('');
  const [forgotPhoneInput, setForgotPhoneInput] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Validation & Error States
  const [nicknameError, setNicknameError] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');

  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showAccountSettingsPanel, setShowAccountSettingsPanel] = useState(false);
  const [isUpdatingIdentifier, setIsUpdatingIdentifier] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Account settings update state
  const [updateInputType, setUpdateInputType] = useState<'email' | 'phone'>('email');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordSettingInput, setNewPasswordSettingInput] = useState('');
  const [accountUpdateSuccess, setAccountUpdateSuccess] = useState(false);

  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Restore session on launch and listen for Supabase auth state changes
  useEffect(() => {
    let alive = true;
    const restoreAuthUser = async (session: any) => {
      if (!session?.user) return;
      const { data, error } = await supabase.rpc('claim_veyns_profile');
      if (!alive || error) { 
        if (error) console.error('Unable to load profile:', error.message); 
        return; 
      }
      const profile = Array.isArray(data) ? data[0] : data;
      if (!profile) return;

      const userObj = { 
        id: profile.id, 
        authUserId: session.user.id, 
        name: profile.name || 'Valued Customer', 
        identifier: profile.identifier, 
        role: profile.role, 
        type: 'regular' 
      };
      
      setCurrentUser(userObj);
      const isStaff = ['employee', 'admin'].includes(profile.role);
      setAuthMode(isStaff ? 'employee' : 'regular');
      setIsAdminDashboardOpen(isStaff);
    };

    void supabase.auth.getSession().then(({ data }) => restoreAuthUser(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setTimeout(() => {
          void restoreAuthUser(session);
          if (event === 'PASSWORD_RECOVERY') { 
            setShowLoyaltyModal(true); 
            setShowAccountSettingsPanel(true); 
            setIsResettingPassword(true); 
          }
        }, 0);
      }
    });

    try {
      if (localStorage.getItem('veyns_auth_mode') === 'guest') {
        setCurrentUser({ name: 'Guest Diner', identifier: 'guest_trial', role: 'guest', type: 'guest' });
        setAuthMode('guest');
        const sessionOrders = sessionStorage.getItem('veyns_guest_order_history');
        if (sessionOrders) setOrderHistory(JSON.parse(sessionOrders));
      }
    } catch (e) { 
      console.error(e); 
    }

    return () => { 
      alive = false; 
      listener.subscription.unsubscribe(); 
    };
  }, []);

  // Validation helpers
  const validateIdentifier = (val: string, type: 'email' | 'phone') => 
    type === 'email'
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
      : /^9\d{9}$/.test(val.replace(/\D/g, ''));

  const validatePasswordStrength = (pass: string) => 
    pass.length >= 8 && /\d/.test(pass) && /[\W_]/.test(pass);

  const getCanonicalIdentifier = (type: 'email' | 'phone', emailVal: string, phoneVal: string) => 
    type === 'email'
      ? emailVal.trim().toLowerCase()
      : '+63' + phoneVal.replace(/\D/g, '');

  // Handle Sign up & Login
  const handleRegularAuth = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setNicknameError(''); 
    setIdentifierError(''); 
    setPasswordError(''); 
    setLoginError('');

    const rawIdentifier = authInputType === 'email' ? authEmailInput : authPhoneInput;
    const canonicalKey = getCanonicalIdentifier(authInputType, authEmailInput, authPhoneInput);

    if (!rawIdentifier.trim() || (isSignUp && !validateIdentifier(rawIdentifier, authInputType))) {
      setIdentifierError(authInputType === 'email' ? 'Enter a valid email address.' : 'Enter a valid Philippine mobile number.'); 
      return;
    }
    if (!authPassword || (isSignUp && !validatePasswordStrength(authPassword))) {
      setPasswordError('Use at least 8 characters, including a number and a symbol.'); 
      return;
    }

    const credentials = authInputType === 'email' ? { email: canonicalKey, password: authPassword } : { phone: canonicalKey, password: authPassword };

    if (isSignUp) {
      const nickname = authName.trim();
      if (!nickname) { setNicknameError('Choose a nickname.'); return; }

      const { data, error } = await supabase.auth.signUp({ 
        ...credentials, 
        options: { 
          data: { name: nickname }, 
          ...(authInputType === 'phone' ? { channel: 'sms' as const } : {}) 
        } 
      });

      if (error) { setIdentifierError(error.message); return; }

      if (!data.session) {
        setSignUpSuccessMsg(true); 
        setIsSignUp(false); 
        setAuthPassword(''); 
        setAuthName('');
        return;
      }

      const { data: profileData, error: profileError } = await supabase.rpc('claim_veyns_profile');
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;

      if (profileError || !profile) { 
        setIdentifierError(profileError?.message || 'Verify your contact method, then sign in.'); 
        return; 
      }

      const userObj = { id: profile.id, authUserId: data.user.id, name: profile.name || nickname, identifier: profile.identifier, role: profile.role, type: 'regular' };
      setCurrentUser(userObj);

      const isStaff = ['employee', 'admin'].includes(profile.role);
      setAuthMode(isStaff ? 'employee' : 'regular'); 
      setIsAdminDashboardOpen(isStaff);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error || !data.user) { 
      setLoginError('Incorrect email or phone number or password.'); 
      return; 
    }

    const { data: profileData, error: profileError } = await supabase.rpc('claim_veyns_profile');
    const profile = Array.isArray(profileData) ? profileData[0] : profileData;

    if (profileError || !profile) { 
      await supabase.auth.signOut(); 
      setLoginError(profileError?.message || 'Unable to load your account.'); 
      return; 
    }

    const userObj = { id: profile.id, authUserId: data.user.id, name: profile.name || 'Valued Customer', identifier: profile.identifier, role: profile.role, type: 'regular' };
    setCurrentUser(userObj);

    const isStaff = ['employee', 'admin'].includes(profile.role);
    setAuthMode(isStaff ? 'employee' : 'regular');
    setIsAdminDashboardOpen(isStaff);
  };

  const handleUpdateIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.type === 'guest') return;

    const raw = updateInputType === 'email' ? newEmailInput : newPhoneInput;
    if (!validateIdentifier(raw, updateInputType)) { 
      alert('Enter a valid email address or Philippine mobile number.'); 
      return; 
    }

    const identifier = getCanonicalIdentifier(updateInputType, newEmailInput, newPhoneInput);
    const { error } = updateInputType === 'email'
      ? await supabase.auth.updateUser({ email: identifier })
      : await supabase.auth.updateUser({ phone: identifier });

    if (error) { alert(error.message); return; }
    alert('A verification request was sent to your new contact method.');
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

    if (!validateIdentifier(email, 'email')) { 
      alert('Enter a valid email address.'); 
      return; 
    }

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

    setCurrentUser({ id: profile.id, authUserId: data.user.id, name: profile.name, identifier: profile.identifier, role: profile.role, type: 'regular' });
    setAuthMode('employee'); 
    setIsAdminDashboardOpen(true);
  };

  const handleGuestLogin = () => {
    const guestData = { name: 'Guest Diner', identifier: 'guest_trial', type: 'guest' };
    setCurrentUser(guestData);
    setAuthMode('guest');
    localStorage.setItem('veyns_auth_mode', 'guest');
    setOrderHistory([]);
    sessionStorage.removeItem('veyns_guest_order_history');
  };

  const handleLogout = () => {
    void supabase.auth.signOut();
    setCurrentUser(null);
    setAuthMode('select');
    setIsAdminDashboardOpen(false);
    setAuthEmailInput('');
    setAuthPhoneInput('');
    setAuthPassword('');
    setAuthName('');
    setNicknameError('');
    setIdentifierError('');
    setPasswordError('');
    setLoginError('');
    setOrderHistory([]);
    localStorage.removeItem('veyns_auth_mode');
    sessionStorage.removeItem('veyns_guest_order_history');
  };

  const handleResetMenu = () => {
    setShowMyOrders(false);
    setShowLoyaltyModal(false);
    setResetTrigger((prev) => prev + 1);
  };

  // Auth Select View
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
              onClick={() => { setAuthEmailInput(''); setAuthPhoneInput(''); setAuthPassword(''); setAuthName(''); setNicknameError(''); setIdentifierError(''); setPasswordError(''); setLoginError(''); setAuthMode('regular'); setIsSignUp(false); }}
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

  // Customer Login/Signup View
  if (authMode === 'regular' && !currentUser) {
    return (
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#051813] border border-emerald-800/80 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-display text-2xl font-extrabold text-white">
              {isSignUp ? 'Be part of us!' : "Look who's back."}
            </h2>
            <p className="text-xs text-emerald-300/80">
              {isSignUp ? 'Sign up with email or phone to unlock Loyalty Stamps' : 'Access your order history and loyalty rewards'}
            </p>
          </div>

          {signUpSuccessMsg && (
            <div className="bg-[#061d16] border border-lime-400/60 rounded-2xl p-4 text-center space-y-2">
              <CheckCircle2 className="h-6 w-6 text-lime-400 mx-auto" />
              <p className="font-bold text-lime-400 text-xs">Account successfully created.</p>
              <p className="text-xs text-emerald-200">
                {authInputType === 'email'
                  ? `Verification sent to ${authEmailInput.trim()}. Please verify before logging in.`
                  : 'Verification code sent to your phone.'}
              </p>
            </div>
          )}

          {loginError && !isSignUp && (
            <div className="bg-red-950/80 border border-red-500 rounded-xl p-3 text-center">
              <p className="text-xs font-bold text-red-400">{loginError}</p>
            </div>
          )}

          <form onSubmit={handleRegularAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Nickname</label>
                <input
                  type="text"
                  required
                  placeholder="Choose your nickname"
                  value={authName}
                  onChange={(e) => {
                    setAuthName(e.target.value);
                    if (nicknameError) setNicknameError('');
                  }}
                  className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">
                  {authInputType === 'email' ? 'Email Address' : 'Phone Number'}
                </label>
                <select
                  value={authInputType}
                  onChange={(e) => setAuthInputType(e.target.value as 'email' | 'phone')}
                  className="bg-[#041913] text-lime-400 border border-emerald-800 rounded-xl px-3 py-1 text-[11px] font-bold focus:outline-none"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone Number</option>
                </select>
              </div>

              {authInputType === 'email' ? (
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                />
              ) : (
                <div className="flex items-center w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5">
                  <span className="text-xs font-mono font-bold text-lime-400 mr-1">+63</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="Enter mobile number"
                    value={authPhoneInput}
                    onChange={(e) => setAuthPhoneInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-transparent text-xs text-white placeholder:text-emerald-700 font-mono focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    className="text-[10px] font-semibold text-emerald-400 hover:text-lime-400 underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg mt-2 cursor-pointer"
            >
              {isSignUp ? 'Create Account & Earn Stamps' : 'Login'}
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-emerald-900/60 space-y-2">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-bold text-lime-400 hover:underline cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Login here' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Employee Dashboard View
  if (authMode === 'employee') {
    if (isAdminDashboardOpen) {
      return (
        <EmployeeDashboard
          onBackToStore={() => {
            setIsAdminDashboardOpen(false);
            setAuthMode('select');
          }}
        />
      );
    }

    return (
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#051813] border border-red-900/40 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="space-y-3 flex flex-col items-center">
            <ShieldAlert className="size-12 text-red-500" />
            <h2 className="font-display text-lg font-black tracking-wider text-red-500 uppercase">AUTHORIZED PERSONNEL ONLY</h2>
          </div>

          <div className="bg-[#041913] border border-emerald-800/60 rounded-2xl p-5 text-xs text-emerald-200 space-y-3">
            <input type="email" value={authEmailInput} onChange={(e) => setAuthEmailInput(e.target.value)} placeholder="Staff Email" className="w-full rounded-xl border border-emerald-800 bg-black/60 px-4 py-3 text-white" />
            <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border border-emerald-800 bg-black/60 px-4 py-3 text-white" />
            {loginError && <p className="text-red-400">{loginError}</p>}
            <Button onClick={() => void handleEmployeeAuth()} className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs">Sign in</Button>
          </div>
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
          onOpenLoyalty={() => setShowLoyaltyModal(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1">
          <OrderingCounter
            showMyOrders={showMyOrders}
            setShowMyOrders={setShowMyOrders}
            orderHistory={orderHistory}
            setOrderHistory={setOrderHistory}
            resetKey={resetTrigger}
            currentUser={currentUser}
          />
        </main>
      </div>
    </CartProvider>
  );
}

export default App;