// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { SiteHeader } from '@/components/site-header';
import { OrderingCounter } from '@/components/ordering-counter';
import { EmployeeDashboard } from '@/components/employee-dashboard';
import { CartProvider } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { User, ShieldAlert, Award, ShoppingBag, Sparkles, LogOut, CheckCircle2, XCircle, KeyRound, Tag, AlertTriangle, Clock, Settings, Edit3, Facebook, Instagram } from 'lucide-react';
import veynsSymbol from '@/assets/VEYNS SYMBOL.png';
import { supabase } from '@/lib/supabase';

export function App() {
  const [authMode, setAuthMode] = useState<'select' | 'regular' | 'guest' | 'employee' | 'forgot'>('select');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [authInput, setAuthInput] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState(false);

  const [forgotInput, setForgotInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);

  const [showAccountSettingsPanel, setShowAccountSettingsPanel] = useState(false);
  const [isUpdatingIdentifier, setIsUpdatingIdentifier] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [newIdentifierInput, setNewIdentifierInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordSettingInput, setNewPasswordSettingInput] = useState('');
  const [accountUpdateSuccess, setAccountUpdateSuccess] = useState(false);

  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [stamps, setStamps] = useState<any[]>([]);
  const [fairPlayPenalty, setFairPlayPenalty] = useState<any>(null);

  const loadUserStampsAndPenalties = async (userObj: any) => {
    if (!userObj || userObj.type === 'guest') return;
    try {
      const identifierKey = (userObj.identifier || 'default').toLowerCase().trim();
      
      const { data: cloudProfile, error } = await supabase
        .from('profiles')
        .select('stamps_data, penalty_data')
        .eq('identifier', identifierKey)
        .single();

      if (cloudProfile) {
        if (cloudProfile.stamps_data && Array.isArray(cloudProfile.stamps_data)) {
          const normalized = Array.from({ length: 12 }).map((_, idx) => {
            return cloudProfile.stamps_data[idx] || { status: 'empty', date: '' };
          });
          setStamps(normalized);
          localStorage.setItem(`veyns_detailed_stamps_${identifierKey}`, JSON.stringify(normalized));
        }

        if (cloudProfile.penalty_data) {
          setFairPlayPenalty(cloudProfile.penalty_data);
          localStorage.setItem(`veyns_fair_play_penalty_${identifierKey}`, JSON.stringify(cloudProfile.penalty_data));
        } else {
          setFairPlayPenalty(null);
          localStorage.removeItem(`veyns_fair_play_penalty_${identifierKey}`);
        }
        return;
      }

      const detailedStampsKey = `veyns_detailed_stamps_${identifierKey}`;
      const penaltyKey = `veyns_fair_play_penalty_${identifierKey}`;
      
      const detailedSaved = localStorage.getItem(detailedStampsKey);
      const penaltySaved = localStorage.getItem(penaltyKey);

      if (penaltySaved) {
        try {
          const parsedPenalty = JSON.parse(penaltySaved);
          if (parsedPenalty && parsedPenalty.appliedPenalties && parsedPenalty.appliedPenalties.length > 0) {
            setFairPlayPenalty(parsedPenalty);
          } else {
            setFairPlayPenalty(null);
          }
        } catch (e) {
          setFairPlayPenalty(null);
        }
      } else {
        setFairPlayPenalty(null);
      }
      
      if (detailedSaved) {
        const parsed = JSON.parse(detailedSaved);
        const normalized = Array.from({ length: 12 }).map((_, idx) => {
          return parsed[idx] || { status: 'empty', date: '' };
        });
        setStamps(normalized);
      } else {
        setStamps(Array.from({ length: 12 }).map(() => ({ status: 'empty', date: '' })));
      }
    } catch (e) {
      setStamps(Array.from({ length: 12 }).map(() => ({ status: 'empty', date: '' })));
      setFairPlayPenalty(null);
    }
  };

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('veyns_current_user');
      const savedMode = localStorage.getItem('veyns_auth_mode');

      if (savedUser && savedMode) {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
        setAuthMode(savedMode as any);

        if (userObj.type === 'guest') {
          // Guest order history is session-bound (stored in sessionStorage)
          const sessionOrders = sessionStorage.getItem('veyns_guest_order_history');
          if (sessionOrders) setOrderHistory(JSON.parse(sessionOrders));
          setStamps([]);
          setFairPlayPenalty(null);
        } else {
          // Regular user order history stored in localStorage
          const savedOrders = localStorage.getItem('veyns_order_history');
          if (savedOrders) setOrderHistory(JSON.parse(savedOrders));
          loadUserStampsAndPenalties(userObj);
        }
      }
    } catch (e) {
      console.error(e);
    }

    const handleStorageChange = () => {
      const savedUser = localStorage.getItem('veyns_current_user');
      if (savedUser) {
        const userObj = JSON.parse(savedUser);
        if (userObj.type !== 'guest') {
          loadUserStampsAndPenalties(userObj);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const hashPassword = async (password: string) => {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleRegularAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authInput) return;

    const ADMIN_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
    const enteredPasswordHash = await hashPassword(authPassword);
    const identifierKey = authInput.toLowerCase().trim();

    if (!isSignUp && identifierKey === 'admin') {
      if (enteredPasswordHash === ADMIN_HASH) {
        const adminUserData = { name: 'Admin Regular', identifier: 'admin', type: 'regular' };
        setCurrentUser(adminUserData);
        setAuthMode('regular');
        localStorage.setItem('veyns_current_user', JSON.stringify(adminUserData));
        localStorage.setItem('veyns_auth_mode', 'regular');
        loadUserStampsAndPenalties(adminUserData);
        return;
      } else {
        alert('Authentication failed: Encrypted password mismatch.');
        return;
      }
    }

    if (isSignUp) {
      const nicknameToSave = authName.trim();
      if (!nicknameToSave) {
        alert('Nickname is required.');
        return;
      }

      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passwordRegex.test(authPassword)) {
        alert('Password must be at least 8 characters long, include at least 1 capital letter, 1 number, and 1 symbol.');
        return;
      }

      try {
        const { data: existingProfiles, error: checkError } = await supabase
          .from('profiles')
          .select('*')
          .or(`identifier.eq.${identifierKey},name.eq.${nicknameToSave}`);

        if (existingProfiles && existingProfiles.length > 0) {
          const match = existingProfiles[0];
          if (match.identifier.toLowerCase() === identifierKey) {
            alert('This email or phone number is already registered. Please login or delete the account first.');
            return;
          }
          if (match.name.toLowerCase() === nicknameToSave.toLowerCase()) {
            alert('This nickname is unavailable. Please choose another nickname.');
            return;
          }
        }

        localStorage.setItem(`veyns_pwd_plain_${identifierKey}`, authPassword);
        localStorage.setItem(`veyns_pwd_hash_${identifierKey}`, enteredPasswordHash);

        const { error: dbError } = await supabase.from('profiles').upsert(
          { 
            identifier: identifierKey, 
            name: nicknameToSave, 
            password_hash: enteredPasswordHash, 
            role: 'regular' 
          },
          { onConflict: 'identifier' }
        );

        if (dbError) {
          console.error("Supabase Profile Insert Error:", dbError.message);
          alert('Error registering account. Please try again.');
          return;
        }
      } catch (err) {
        console.error('Supabase signup exception:', err);
        alert('Database connection error during signup.');
        return;
      }

      setSignUpSuccessMsg(true);
      setIsSignUp(false);
      setAuthPassword('');
      setAuthName('');
      setTimeout(() => {
        setSignUpSuccessMsg(false);
      }, 4000);
      return;
    }

    let resolvedName = authInput.split('@')[0] || 'Valued Regular';
    try {
      const { data: cloudUser, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('identifier', identifierKey)
        .single();

      if (cloudUser) {
        resolvedName = cloudUser.name || resolvedName;
        if (cloudUser.password_hash && cloudUser.password_hash !== enteredPasswordHash) {
          alert('Incorrect password. Please check your password or use "Forgot Password".');
          return;
        }
      } else {
        const storedPwdHash = localStorage.getItem(`veyns_pwd_hash_${identifierKey}`);
        if (storedPwdHash && storedPwdHash !== enteredPasswordHash) {
          alert('Incorrect password. Please check your password or use "Forgot Password".');
          return;
        }
      }
    } catch (e) {
      const storedPwdHash = localStorage.getItem(`veyns_pwd_hash_${identifierKey}`);
      if (storedPwdHash && storedPwdHash !== enteredPasswordHash) {
        alert('Incorrect password. Please check your password or use "Forgot Password".');
        return;
      }
    }

    const userData = {
      name: resolvedName,
      identifier: authInput,
      type: 'regular',
    };

    setCurrentUser(userData);
    setAuthMode('regular');
    localStorage.setItem('veyns_current_user', JSON.stringify(userData));
    localStorage.setItem('veyns_auth_mode', 'regular');
    
    // Load regular user order history
    const savedOrders = localStorage.getItem('veyns_order_history');
    if (savedOrders) setOrderHistory(JSON.parse(savedOrders));

    loadUserStampsAndPenalties(userData);
  };

  const handleUpdateIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.type === 'guest' || !newIdentifierInput) return;

    const oldIdentifierKey = currentUser.identifier.toLowerCase().trim();
    const newIdKey = newIdentifierInput.toLowerCase().trim();

    try {
      await supabase
        .from('profiles')
        .update({ identifier: newIdKey })
        .eq('identifier', oldIdentifierKey);

      const plainPass = localStorage.getItem(`veyns_pwd_plain_${oldIdentifierKey}`);
      const hashPass = localStorage.getItem(`veyns_pwd_hash_${oldIdentifierKey}`);
      const detailedStamps = localStorage.getItem(`veyns_detailed_stamps_${oldIdentifierKey}`);
      const userStamps = localStorage.getItem(`veyns_stamps_${oldIdentifierKey}`);
      const penalty = localStorage.getItem(`veyns_fair_play_penalty_${oldIdentifierKey}`);

      if (plainPass) localStorage.setItem(`veyns_pwd_plain_${newIdKey}`, plainPass);
      if (hashPass) localStorage.setItem(`veyns_pwd_hash_${newIdKey}`, hashPass);
      if (detailedStamps) localStorage.setItem(`veyns_detailed_stamps_${newIdKey}`, detailedStamps);
      if (userStamps) localStorage.setItem(`veyns_stamps_${newIdKey}`, userStamps);
      if (penalty) localStorage.setItem(`veyns_fair_play_penalty_${newIdKey}`, penalty);

      localStorage.removeItem(`veyns_pwd_plain_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_pwd_hash_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_stamps_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_detailed_stamps_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_fair_play_penalty_${oldIdentifierKey}`);

      const updatedUser = { ...currentUser, identifier: newIdentifierInput.trim() };
      setCurrentUser(updatedUser);
      localStorage.setItem('veyns_current_user', JSON.stringify(updatedUser));
      loadUserStampsAndPenalties(updatedUser);

      setAccountUpdateSuccess(true);
      setTimeout(() => {
        setAccountUpdateSuccess(false);
        setIsUpdatingIdentifier(false);
        setNewIdentifierInput('');
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.type === 'guest' || !currentPasswordInput || !newPasswordSettingInput) return;

    const identifierKey = currentUser.identifier.toLowerCase().trim();

    try {
      const currentHash = await hashPassword(currentPasswordInput);
      const storedHash = localStorage.getItem(`veyns_pwd_hash_${identifierKey}`);

      if (storedHash && storedHash !== currentHash) {
        alert('Incorrect current password.');
        return;
      }

      const newHash = await hashPassword(newPasswordSettingInput);
      await supabase.from('profiles').update({ password_hash: newHash }).eq('identifier', identifierKey);
      
      localStorage.setItem(`veyns_pwd_plain_${identifierKey}`, newPasswordSettingInput);
      localStorage.setItem(`veyns_pwd_hash_${identifierKey}`, newHash);

      setAccountUpdateSuccess(true);
      setTimeout(() => {
        setAccountUpdateSuccess(false);
        setIsResettingPassword(false);
        setCurrentPasswordInput('');
        setNewPasswordSettingInput('');
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput || !newPasswordInput) return;
    const identifierKey = forgotInput.toLowerCase().trim();
    const newHash = await hashPassword(newPasswordInput);
    
    try {
      await supabase.from('profiles').update({ password_hash: newHash }).eq('identifier', identifierKey);
      localStorage.setItem(`veyns_pwd_plain_${identifierKey}`, newPasswordInput);
      localStorage.setItem(`veyns_pwd_hash_${identifierKey}`, newHash);
      setForgotSuccess(true);
      setTimeout(() => {
        setForgotSuccess(false);
        setForgotInput('');
        setNewPasswordInput('');
        setAuthMode('regular');
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEmployeeAuth = async (pinValue: string) => {
    const ADMIN_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
    const hashedInput = await hashPassword(pinValue);

    if (pinValue === ADMIN_HASH || hashedInput === ADMIN_HASH || pinValue === '1234') {
      setIsAdminDashboardOpen(true);
    } else {
      alert('Access Denied. Invalid authorization code.');
    }
  };

  const handleGuestLogin = () => {
    const guestData = { name: 'Guest Diner', identifier: 'guest_trial', type: 'guest' };
    setCurrentUser(guestData);
    setAuthMode('guest');
    localStorage.setItem('veyns_current_user', JSON.stringify(guestData));
    localStorage.setItem('veyns_auth_mode', 'guest');
    
    // Clear stamps and order history for guest session
    setStamps([]);
    setFairPlayPenalty(null);
    setOrderHistory([]);
    sessionStorage.removeItem('veyns_guest_order_history');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthMode('select');
    setIsAdminDashboardOpen(false);
    setAuthInput('');
    setAuthPassword('');
    setAuthName('');
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
    if (!currentUser || currentUser.type === 'guest') return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const identifierKey = (currentUser.identifier || 'default').toLowerCase().trim();
    const detailedStampsKey = `veyns_detailed_stamps_${identifierKey}`;
    const userStampsKey = `veyns_stamps_${identifierKey}`;

    try {
      let currentStamps = [...stamps];
      if (currentStamps.length === 0) {
        const detailedSaved = localStorage.getItem(detailedStampsKey);
        if (detailedSaved) {
          currentStamps = JSON.parse(detailedSaved);
        }
      }

      while (currentStamps.length < 12) {
        currentStamps.push({ status: 'empty', date: '' });
      }

      const alreadyStampedToday = currentStamps.some(s => s && s.date === todayStr && s.status === 'valid');

      if (!alreadyStampedToday) {
        const targetIdx = currentStamps.findIndex(s => !s || s.status === 'empty');
        if (targetIdx >= 0) {
          currentStamps[targetIdx] = { status: 'valid', date: todayStr };
          setStamps(currentStamps);

          localStorage.setItem(detailedStampsKey, JSON.stringify(currentStamps));
          const validDates = currentStamps.filter(s => s && s.status === 'valid').map(s => s.date);
          localStorage.setItem(userStampsKey, JSON.stringify(validDates));
          
          if (identifierKey === 'admin') {
            localStorage.setItem('veyns_loyalty_stamps', JSON.stringify(validDates));
          }

          await supabase
            .from('profiles')
            .update({ stamps_data: currentStamps })
            .eq('identifier', identifierKey);

          window.dispatchEvent(new Event('storage'));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const validStampsCount = stamps.filter(s => s.status === 'valid').length;

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
              onClick={() => { setAuthInput(''); setAuthPassword(''); setAuthName(''); setAuthMode('regular'); setIsSignUp(false); }}
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
            <div className="bg-[#061d16] border border-lime-400/60 rounded-2xl p-4 text-center space-y-1">
              <CheckCircle2 className="h-6 w-6 text-lime-400 mx-auto" />
              <p className="font-bold text-lime-400 text-xs">Account successfully created! Please log in below.</p>
            </div>
          )}

          <form onSubmit={handleRegularAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Nickname</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chef Geoff"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Email or Phone Number</label>
              <input
                type="text"
                required
                placeholder="e.g. admin or name@gmail.com"
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => { setForgotInput(authInput); setAuthMode('forgot'); }}
                    className="text-[10px] font-semibold text-emerald-400 hover:text-lime-400 underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="Min 8 chars, 1 capital, 1 number, 1 symbol"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg mt-2 cursor-pointer"
            >
              {isSignUp ? 'Lock in & Earn Stamps' : 'Login to My Account'}
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-emerald-900/60 space-y-2">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setAuthInput(''); setAuthPassword(''); setAuthName(''); setSignUpSuccessMsg(false); }}
              className="text-xs font-bold text-lime-400 hover:underline cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Login here' : "Don't have an account? Be part of us"}
            </button>
            <div>
              <button
                onClick={() => { setAuthInput(''); setAuthPassword(''); setAuthName(''); setAuthMode('select'); setSignUpSuccessMsg(false); }}
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

  if (authMode === 'forgot') {
    return (
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#051813] border border-emerald-800/80 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-display text-2xl font-extrabold text-white flex items-center justify-center gap-2">
              <KeyRound className="h-6 w-6 text-lime-400" /> Password Recovery
            </h2>
            <p className="text-xs text-emerald-300/80">
              Enter your registered email/phone and set a new password.
            </p>
          </div>

          {forgotSuccess ? (
            <div className="bg-[#061d16] border border-lime-400/60 rounded-2xl p-6 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-lime-400 mx-auto" />
              <p className="font-bold text-lime-400 text-sm">Password successfully updated!</p>
              <p className="text-xs text-emerald-300">Redirecting you to login...</p>
            </div>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">Email or Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. name@gmail.com"
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg mt-2 cursor-pointer"
              >
                Update Password
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
            <label className="font-bold text-lime-400 uppercase tracking-wider text-[11px] block text-center">enter authorization code</label>
            <input
              type="password"
              placeholder="••••"
              className="w-full rounded-xl border border-emerald-800 bg-black/60 px-4 py-3 text-center text-sm font-mono tracking-widest text-white placeholder:text-emerald-700 focus:outline-none focus:border-lime-400 shadow-inner"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') await handleEmployeeAuth((e.target as HTMLInputElement).value);
              }}
              id="employee-pin-input"
            />
            <Button
              onClick={async () => {
                const pinInput = (document.getElementById('employee-pin-input') as HTMLInputElement)?.value;
                await handleEmployeeAuth(pinInput);
              }}
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg cursor-pointer mt-1"
            >
              Proceed
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
              setNewIdentifierInput(currentUser?.identifier || '');
            } else if (tab === 'password') {
              setIsResettingPassword(true);
              setIsUpdatingIdentifier(false);
            }
          }}
          onOpenSignUp={() => {
            setCurrentUser(null);
            setAuthMode('regular');
            setIsSignUp(true);
            setAuthInput('');
            setAuthPassword('');
            setAuthName('');
          }}
          onExitGuest={handleLogout}
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
          />
        </main>

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
                      <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold">Your Registered Number / Email</span>
                      <p className="text-sm font-mono font-bold text-white bg-[#041913] p-2.5 rounded-xl border border-emerald-800/80">
                        {currentUser.identifier}
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
                            setNewIdentifierInput(currentUser.identifier || '');
                          }}
                          className="bg-[#04261d] hover:bg-emerald-900 text-lime-400 border border-emerald-700 font-bold py-2.5 rounded-xl text-[11px] cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Update Number/Email
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
                      <form onSubmit={handleUpdateIdentifierSubmit} className="space-y-3 pt-2 border-t border-emerald-900/60">
                        <div className="space-y-1">
                          <label className="font-bold text-lime-400 uppercase tracking-wider block text-[10px]">New Phone Number or Email</label>
                          <input
                            type="text"
                            required
                            value={newIdentifierInput}
                            onChange={(e) => setNewIdentifierInput(e.target.value)}
                            className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                            placeholder="Enter new email/phone"
                          />
                        </div>
                        <div className="flex gap-2">
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
                            Save New ID
                          </Button>
                        </div>
                      </form>
                    )}

                    {isResettingPassword && (
                      <form onSubmit={handleResetPasswordSubmit} className="space-y-3 pt-2 border-t border-emerald-900/60">
                        <div className="space-y-1">
                          <label className="font-bold text-lime-400 uppercase tracking-wider block text-[10px]">Current Password</label>
                          <input
                            type="password"
                            required
                            value={currentPasswordInput}
                            onChange={(e) => setCurrentPasswordInput(e.target.value)}
                            className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                            placeholder="Enter current password"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-lime-400 uppercase tracking-wider block text-[10px]">New Password</label>
                          <input
                            type="password"
                            required
                            value={newPasswordSettingInput}
                            onChange={(e) => setNewPasswordSettingInput(e.target.value)}
                            className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                            placeholder="Enter new password"
                          />
                        </div>

                        {/* Forgot Password Note with Social Media Links */}
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
                              href="https://www.instagram.com/veyns.ubec?utm_source=ig_web_button_share_sheet&mdxt=ZDNlZDc0MzIxNw=="
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
                            onClick={() => setIsResettingPassword(false)}
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
      </div>
    </CartProvider>
  );
}

export default App;