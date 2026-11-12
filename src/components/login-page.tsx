// @ts-nocheck
// Login page: everything about getting in (front door, one Login form for customers and staff, sign-up,
// forgot password, and the 'set new password' box that opens from the recovery email link).
// This file was split out of App.tsx without changing behavior. // @ts-nocheck is kept on purpose,
// because App.tsx had it; remove it later once the code is typed.
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { User, Sparkles, CheckCircle2, KeyRound, Eye, EyeOff, RefreshCw } from 'lucide-react';
import veynsSymbol from '@/assets/VEYNS SYMBOL.png';
import { supabase } from '@/lib/supabase';

export const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
export const validatePasswordStrength = (pass: string) => pass.length >= 8 && /\d/.test(pass) && /[\W_]/.test(pass);

export function LoginPage({
  authMode, setAuthMode,
  setCurrentUser, setIsAdminDashboardOpen,
  isSignUp, setIsSignUp,
  loginError, setLoginError,
  loadUserStampsAndPenalties,
  onContinueAsGuest,
}) {
  const handleGuestLogin = onContinueAsGuest;

  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [forgotEmailInput, setForgotEmailInput] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const [nicknameError, setNicknameError] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  // which customer login field(s) to outline in red: set only by the credential check below
  const [loginFieldError, setLoginFieldError] = useState({ email: false, password: false });
  useEffect(() => {
    if (!loginError) setLoginFieldError({ email: false, password: false }); // any reset of the message also resets the borders
  }, [loginError]);

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

  // Editing a login field removes that field's red border; the message goes once no border is left.
  // Double-submit lock, plus a short wait after a failed login (slows down password guessing).
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const clearLoginFeedback = (field: 'email' | 'password') => {
    if (loginFieldError.email || loginFieldError.password) {
      const next = { ...loginFieldError, [field]: false };
      setLoginFieldError(next);
      if (!next.email && !next.password) setLoginError('');
    } else if (loginError) {
      setLoginError('');
    }
  };

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setNicknameError('');
    setIdentifierError('');
    setPasswordError('');
    setLoginError('');
    setLoginFieldError({ email: false, password: false });
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
        const rateLimited = (error as any)?.status === 429 || /rate limit/i.test(error.message || '');
        setIdentifierError(rateLimited ? 'Too many attempts. Please wait a minute and try again.' : 'Something went wrong. Please try again.');
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
        setIdentifierError('Something went wrong. Please try again.');
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
      email,
      password: authPassword,
    });
    if (error) {
      const wrongCredentials = (error as any)?.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message || '');
      if (!wrongCredentials) {
        const notConfirmed = (error as any)?.code === 'email_not_confirmed' || /not confirmed/i.test(error.message || '');
        const rateLimited = (error as any)?.status === 429 || /rate limit/i.test(error.message || '');
        setLoginError(notConfirmed ? error.message : rateLimited ? 'Too many attempts. Please wait a minute and try again.' : 'Something went wrong. Please try again.');
        return;
      }
      // Same message for an unknown email and a wrong password, so nobody can tell which emails exist.
      setLoginFieldError({ email: true, password: true });
      setLoginError('Invalid email or password.');
      setCooldown(5);
      return;
    }
    if (data?.user) {
      // Use the secure RPC (not a direct table read) so login never hits a 403 on public.profiles.
      const { data: profile } = await supabase.rpc('claim_veyns_profile');
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

  const handleRegularAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || cooldown > 0) return;
    setIsSubmitting(true);
    try {
      await submitAuth(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEmailInput.trim().toLowerCase();
    if (!validateEmail(email)) { alert('Enter a valid email address.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) { alert(error.message); return; }
    setForgotSuccess(true);
  };

  // Entry screen
  if (authMode === 'select' || authMode === 'employee') {
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
              <span className="leading-tight">Login</span>
            </Button>
            <Button
              onClick={handleGuestLogin}
              className="w-full bg-[#061d16] hover:bg-[#0a3629] text-emerald-200 border border-emerald-800/60 py-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Sparkles className="size-4 text-lime-400" /> Continue as Guest (Trial Mode)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Customer login & sign-up
  if (authMode === 'regular') {
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
                  clearLoginFeedback('email');
                }}
                className={`w-full rounded-xl border bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none ${
                  identifierError || loginFieldError.email || (loginError && !isSignUp && !loginFieldError.email && !loginFieldError.password) ? 'border-red-500 focus:border-red-500' : 'border-emerald-800/80 focus:border-lime-400'
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
                    clearLoginFeedback('password');
                  }}
                  className={`w-full rounded-xl border bg-[#041913] px-3.5 py-2.5 pr-10 text-xs text-white placeholder:text-emerald-600 focus:outline-none ${
                    passwordError || loginFieldError.password || (loginError && !isSignUp && !loginFieldError.email && !loginFieldError.password) ? 'border-red-500 focus:border-red-500' : 'border-emerald-800/80 focus:border-lime-400'
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
              disabled={isSubmitting || cooldown > 0}
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-xs py-3 rounded-xl uppercase tracking-wider transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Please wait...' : cooldown > 0 ? `Try again in ${cooldown}s` : (isSignUp ? 'Create an Account' : 'Login to My Account')}
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
                ← Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password
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

  return null;
}

export function ResetPasswordDialog({ onFinished }) {
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

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
        onFinished();
        setResetSuccess(false);
        setNewPassword('');
      }, 2000);
    }
  };

  return (
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
  );
}
