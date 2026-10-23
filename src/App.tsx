// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { SiteHeader } from '@/components/site-header';
import { OrderingCounter } from '@/components/ordering-counter';
import { EmployeeDashboard } from '@/components/employee-dashboard';
import { CartProvider } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { User, ShieldAlert, Award, ShoppingBag, Sparkles, LogOut, CheckCircle2, XCircle, KeyRound, Tag, AlertTriangle, Clock, Settings, Edit3, Facebook, Instagram, Eye, EyeOff, ChevronDown, Mail, Phone } from 'lucide-react';
import veynsSymbol from '@/assets/VEYNS SYMBOL.png';
import { supabase } from '@/lib/supabase';

  // SECTION 1: App state for authentication, account settings, orders, and loyalty.
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
  const [newPasswordInput, setNewPasswordInput] = useState('');
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

  // Account settings update selector state
  const [updateInputType, setUpdateInputType] = useState<'email' | 'phone'>('email');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordSettingInput, setNewPasswordSettingInput] = useState('');
  const [accountUpdateSuccess, setAccountUpdateSuccess] = useState(false);

  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [stamps, setStamps] = useState<any[]>([]);
  const [fairPlayPenalty, setFairPlayPenalty] = useState<any>(null);

  // SECTION 2: Load the signed-in customer's loyalty stamps and penalties.
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

  // SECTION 3: Restore locally cached session data and listen for storage changes.
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('veyns_current_user');
      const savedMode = localStorage.getItem('veyns_auth_mode');
      if (savedUser && savedMode) {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
        setAuthMode(savedMode as any);
        if (userObj.type === 'guest') {
          const sessionOrders = sessionStorage.getItem('veyns_guest_order_history');
          if (sessionOrders) setOrderHistory(JSON.parse(sessionOrders));
          setStamps([]);
          setFairPlayPenalty(null);
        } else {
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

  // SECTION 4: Password hashing and input normalization/validation helpers.
  const hashPassword = async (password: string) => {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  // Validation helpers
  const validateIdentifier = (val: string, type: 'email' | 'phone') => {
    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(val);
    } else {
      const phPhoneRegex = /^9\d{9}$/;
      return phPhoneRegex.test(val);
    }
  };

  const validatePasswordStrength = (pass: string) => {
    const minLength = pass.length >= 8;
    const hasNumber = /\d/.test(pass);
    const hasSymbol = /[\W_]/.test(pass);
    return minLength && hasNumber && hasSymbol;
  };

  // Canonical normalization for phone numbers: +639494685430
  const getCanonicalIdentifier = (type: 'email' | 'phone', emailVal: string, phoneVal: string) => {
    if (type === 'email') {
      return emailVal.trim().toLowerCase();
    } else {
      const cleanDigits = phoneVal.replace(/\D/g, '');
      return `+63${cleanDigits}`;
    }
  };

  // SECTION 5: Handle regular customer sign-up and login.
  const handleRegularAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setNicknameError('');
    setIdentifierError('');
    setPasswordError('');
    setLoginError('');

    const rawIdentifier = authInputType === 'email' ? authEmailInput : authPhoneInput;

    if (!rawIdentifier.trim()) {
      if (isSignUp) {
        setIdentifierError(authInputType === 'email' ? 'Please enter a valid email address.' : 'Please enter a valid Philippine mobile number.');
      } else {
        setLoginError('Incorrect email or phone number or password.');
      }
      return;
    }

    if (!authPassword) {
      if (isSignUp) {
        setPasswordError('Password must be at least 8 characters long and include at least one number and one symbol.');
      } else {
        setLoginError('Incorrect email or phone number or password.');
      }
      return;
    }

    const ADMIN_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
    const enteredPasswordHash = await hashPassword(authPassword);
    const canonicalKey = getCanonicalIdentifier(authInputType, authEmailInput, authPhoneInput);

    if (!isSignUp && canonicalKey === 'admin') {
      if (enteredPasswordHash === ADMIN_HASH) {
        const adminUserData = { name: 'Admin Regular', identifier: 'admin', type: 'regular' };
        setCurrentUser(adminUserData);
        setAuthMode('regular');
        localStorage.setItem('veyns_current_user', JSON.stringify(adminUserData));
        localStorage.setItem('veyns_auth_mode', 'regular');
        loadUserStampsAndPenalties(adminUserData);
        return;
      } else {
        setLoginError('Incorrect email or phone number or password.');
        return;
      }
    }

    if (isSignUp) {
      const nicknameToSave = authName.trim();
      if (!nicknameToSave) {
        setNicknameError('Please choose your unique nickname.');
        return;
      }
      if (!validateIdentifier(rawIdentifier, authInputType)) {
        setIdentifierError(authInputType === 'email' ? 'Please enter a valid email address.' : 'Please enter a valid Philippine mobile number.');
        return;
      }
      if (!validatePasswordStrength(authPassword)) {
        setPasswordError('Password must be at least 8 characters long and include at least one number and one symbol.');
        return;
      }

      try {
        const { data: existingProfiles, error: checkError } = await supabase
          .from('profiles')
          .select('*')
          .or(`identifier.eq.${canonicalKey},name.eq.${nicknameToSave}`);

        if (existingProfiles && existingProfiles.length > 0) {
          let hasConflict = false;
          existingProfiles.forEach((match: any) => {
            if (match.identifier.toLowerCase() === canonicalKey) {
              setIdentifierError(authInputType === 'email' ? 'This email address is already registered.' : 'Please enter a valid Philippine mobile number.');
              hasConflict = true;
            }
            if (match.name.toLowerCase() === nicknameToSave.toLowerCase()) {
              setNicknameError('This nickname is already taken. Please choose another.');
              hasConflict = true;
            }
          });
          if (hasConflict) return;
        }

        // SECURITY FIX: Do NOT store plaintext password in localStorage
        const { error: dbError } = await supabase.from('profiles').upsert(
          { 
            identifier: canonicalKey, 
            name: nicknameToSave, 
            password_hash: enteredPasswordHash, 
            role: 'regular' 
          },
          { onConflict: 'identifier' }
        );

        if (dbError) {
          console.error("Supabase Profile Insert Error:", dbError.message);
          setIdentifierError('Error registering account. Please try again.');
          return;
        }
      } catch (err) {
        console.error('Supabase signup exception:', err);
        setIdentifierError('Database connection error during signup.');
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

    // Login flow
    try {
      const { data: cloudUser, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('identifier', canonicalKey)
        .single();

      if (cloudUser) {
        if (cloudUser.password_hash && cloudUser.password_hash !== enteredPasswordHash) {
          setLoginError('Incorrect email or phone number or password.');
          return;
        }
        const userData = {
          name: cloudUser.name || 'Valued Regular',
          identifier: canonicalKey,
          type: 'regular',
        };
        setCurrentUser(userData);
        setAuthMode('regular');
        localStorage.setItem('veyns_current_user', JSON.stringify(userData));
        localStorage.setItem('veyns_auth_mode', 'regular');
        const savedOrders = localStorage.getItem('veyns_order_history');
        if (savedOrders) setOrderHistory(JSON.parse(savedOrders));
        loadUserStampsAndPenalties(userData);
        return;
      } else {
        // Fallback for legacy local-only accounts (still hash-verified)
        const storedPwdHash = localStorage.getItem(`veyns_pwd_hash_${canonicalKey}`);
        if (!storedPwdHash || storedPwdHash !== enteredPasswordHash) {
          setLoginError('Incorrect email or phone number or password.');
          return;
        }
        const userData = {
          name: rawIdentifier.split('@')[0] || 'Valued Regular',
          identifier: canonicalKey,
          type: 'regular',
        };
        setCurrentUser(userData);
        setAuthMode('regular');
        localStorage.setItem('veyns_current_user', JSON.stringify(userData));
        localStorage.setItem('veyns_auth_mode', 'regular');
        const savedOrders = localStorage.getItem('veyns_order_history');
        if (savedOrders) setOrderHistory(JSON.parse(savedOrders));
        loadUserStampsAndPenalties(userData);
        return;
      }
    } catch (e) {
      setLoginError('Incorrect email or phone number or password.');
      return;
    }
  };

  // SECTION 6: Update a customer email/phone identifier and related local state.
  const handleUpdateIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.type === 'guest') return;

    const rawNewId = updateInputType === 'email' ? newEmailInput : newPhoneInput;
    if (!rawNewId) return;
    if (!validateIdentifier(rawNewId, updateInputType)) {
      alert(updateInputType === 'email' ? 'Please enter a valid email address.' : 'Please enter a valid Philippine mobile number.');
      return;
    }

    const oldIdentifierKey = currentUser.identifier.toLowerCase().trim();
    const newCanonicalKey = getCanonicalIdentifier(updateInputType, newEmailInput, newPhoneInput);

    try {
      await supabase
        .from('profiles')
        .update({ identifier: newCanonicalKey })
        .eq('identifier', oldIdentifierKey);

      // SECURITY FIX: Migrate hash only, do not touch plaintext
      const hashPass = localStorage.getItem(`veyns_pwd_hash_${oldIdentifierKey}`);
      const detailedStamps = localStorage.getItem(`veyns_detailed_stamps_${oldIdentifierKey}`);
      const userStamps = localStorage.getItem(`veyns_stamps_${oldIdentifierKey}`);
      const penalty = localStorage.getItem(`veyns_fair_play_penalty_${oldIdentifierKey}`);

      if (hashPass) localStorage.setItem(`veyns_pwd_hash_${newCanonicalKey}`, hashPass);
      if (detailedStamps) localStorage.setItem(`veyns_detailed_stamps_${newCanonicalKey}`, detailedStamps);
      if (userStamps) localStorage.setItem(`veyns_stamps_${newCanonicalKey}`, userStamps);
      if (penalty) localStorage.setItem(`veyns_fair_play_penalty_${newCanonicalKey}`, penalty);

      localStorage.removeItem(`veyns_pwd_hash_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_stamps_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_detailed_stamps_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_fair_play_penalty_${oldIdentifierKey}`);

      const updatedUser = { ...currentUser, identifier: newCanonicalKey };
      setCurrentUser(updatedUser);
      localStorage.setItem('veyns_current_user', JSON.stringify(updatedUser));
      loadUserStampsAndPenalties(updatedUser);
      setAccountUpdateSuccess(true);
      setTimeout(() => {
        setAccountUpdateSuccess(false);
        setIsUpdatingIdentifier(false);
        setNewEmailInput('');
        setNewPhoneInput('');
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // SECTION 7: Handle password changes from account settings.
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.type === 'guest' || !currentPasswordInput || !newPasswordSettingInput) return;
    if (!validatePasswordStrength(newPasswordSettingInput)) {
      alert('Password must be at least 8 characters long and include at least one number and one symbol.');
      return;
    }

    const identifierKey = currentUser.identifier.toLowerCase().trim();
    try {
      const currentHash = await hashPassword(currentPasswordInput);
      const storedHash = localStorage.getItem(`veyns_pwd_hash_${identifierKey}`);
      
      // Note: For legacy accounts that might not have a local hash but exist in DB, 
      // we rely on the DB check. For this UI flow, we check local hash if available.
      if (storedHash && storedHash !== currentHash) {
        alert('Incorrect current password.');
        return;
      }

      const newHash = await hashPassword(newPasswordSettingInput);
      await supabase.from('profiles').update({ password_hash: newHash }).eq('identifier', identifierKey);
      
      // SECURITY FIX: Store hash only
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

  // SECTION 8: Handle the forgot-password form submission.
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawForgot = forgotInputType === 'email' ? forgotEmailInput : forgotPhoneInput;
    if (!rawForgot || !newPasswordInput) return;
    if (!validatePasswordStrength(newPasswordInput)) {
      alert('Password must be at least 8 characters long and include at least one number and one symbol.');
      return;
    }

    const canonicalKey = getCanonicalIdentifier(forgotInputType, forgotEmailInput, forgotPhoneInput);
    const newHash = await hashPassword(newPasswordInput);

    try {
      await supabase.from('profiles').update({ password_hash: newHash }).eq('identifier', canonicalKey);
      // SECURITY FIX: Store hash only
      localStorage.setItem(`veyns_pwd_hash_${canonicalKey}`, newHash);
      setForgotSuccess(true);
      setTimeout(() => {
        setForgotSuccess(false);
        setForgotEmailInput('');
        setForgotPhoneInput('');
        setNewPasswordInput('');
        setAuthMode('regular');
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // SECTION 9: Verify the employee access code and open the dashboard view.
  const handleEmployeeAuth = async (pinValue: string) => {
    if (!pinValue) {
      alert('Please enter an authorization code.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'employee_auth_code')
        .single();

      if (error || !data) {
        alert('Error verifying security clearance with database.');
        return;
      }
      if (pinValue.trim() === data.value.trim()) {
        setIsAdminDashboardOpen(true);
      } else {
        alert('Access Denied. Invalid authorization code.');
      }
    } catch (err) {
      console.error('Auth error:', err);
      alert('Database connection error during authorization.');
    }
  };

  // SECTION 10: Start a guest session and clear guest-only order history.
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

  // SECTION 11: Clear the current user view, form state, and cached session keys.
  const handleLogout = () => {
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
    setStamps([]);
    setFairPlayPenalty(null);
    setOrderHistory([]);
    localStorage.removeItem('veyns_current_user');
    localStorage.removeItem('veyns_auth_mode');
    sessionStorage.removeItem('veyns_guest_order_history');
  };

  // SECTION 12: Reset menu-related overlays and refresh the ordering view.
  const handleResetMenu = () => {
    setShowMyOrders(false);
    setShowLoyaltyModal(false);
    setResetTrigger((prev) => prev + 1);
  };

  // SECTION 13: Record the daily loyalty stamp after an order callback.
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

  // SECTION 14: Render the entry screen for customer, guest, or employee access.
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

  // SECTION 15: Render the regular customer login and sign-up screens.
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">
                  {authInputType === 'email' ? 'Email Address' : 'Phone Number'}
                </label>
                <div className="relative">
                  <select
                    value={authInputType}
                    onChange={(e) => {
                      setAuthInputType(e.target.value as 'email' | 'phone');
                      setAuthEmailInput('');
                      setAuthPhoneInput('');
                      setIdentifierError('');
                      setLoginError('');
                    }}
                    className="bg-[#041913] text-lime-400 border border-emerald-800/80 rounded-xl px-3 py-1 text-[11px] font-bold focus:outline-none focus:border-lime-400 cursor-pointer appearance-none pr-7 shadow-sm"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone Number</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-lime-400 pointer-events-none" />
                </div>
              </div>
              {authInputType === 'email' ? (
                <div>
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
                </div>
              ) : (
                <div className={`flex items-center w-full rounded-xl border bg-[#041913] px-3.5 py-2.5 ${
                  identifierError || (loginError && !isSignUp) ? 'border-red-500' : 'border-emerald-800/80 focus-within:border-lime-400'
                }`}>
                  <span className="text-xs font-mono font-bold text-lime-400 mr-1 select-none cursor-default">+63</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="Enter your mobile number"
                    value={authPhoneInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setAuthPhoneInput(val);
                      if (identifierError) setIdentifierError('');
                      if (loginError) setLoginError('');
                    }}
                    className="w-full bg-transparent text-xs text-white placeholder:text-emerald-700 font-mono focus:outline-none"
                  />
                </div>
              )}
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
            <Button
              type="submit"
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg mt-2 cursor-pointer"
            >
              {isSignUp ? 'Lock in & Earn Stamps' : 'Login to My Account'}
            </Button>
          </form>
          <div className="text-center pt-2 border-t border-emerald-900/60 space-y-2">
            <button
              onClick={() => { 
                setIsSignUp(!isSignUp); 
                setAuthEmailInput('');
                setAuthPhoneInput('');
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
                onClick={() => { setAuthEmailInput(''); setAuthPhoneInput(''); setAuthPassword(''); setAuthName(''); setAuthMode('select'); setSignUpSuccessMsg(false); setNicknameError(''); setPasswordError(''); setLoginError(''); }}
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

  // SECTION 16: Render the forgot-password screen.
  if (authMode === 'forgot') {
    return (
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#051813] border border-emerald-800/80 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-display text-2xl font-extrabold text-white flex items-center justify-center gap-2">
              <KeyRound className="h-6 w-6 text-lime-400" /> Password Recovery
            </h2>
            <p className="text-xs text-emerald-300/80">
              Enter your registered email or phone and set a new password.
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">
                    {forgotInputType === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  <div className="relative">
                    <select
                      value={forgotInputType}
                      onChange={(e) => {
                        setForgotInputType(e.target.value as 'email' | 'phone');
                        setForgotEmailInput('');
                        setForgotPhoneInput('');
                      }}
                      className="bg-[#041913] text-lime-400 border border-emerald-800/80 rounded-xl px-3 py-1 text-[11px] font-bold focus:outline-none focus:border-lime-400 cursor-pointer appearance-none pr-7 shadow-sm"
                    >
                      <option value="email">Email</option>
                      <option value="phone">Phone Number</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-lime-400 pointer-events-none" />
                  </div>
                </div>
                {forgotInputType === 'email' ? (
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={forgotEmailInput}
                    onChange={(e) => setForgotEmailInput(e.target.value)}
                    className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                  />
                ) : (
                  <div className="flex items-center w-full rounded-xl border border-emerald-800/80 bg-[#041913] px-3.5 py-2.5 focus-within:border-lime-400">
                    <span className="text-xs font-mono font-bold text-lime-400 mr-1 select-none cursor-default">+63</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="Enter your mobile number"
                      value={forgotPhoneInput}
                      onChange={(e) => setForgotPhoneInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-transparent text-xs text-white placeholder:text-emerald-700 font-mono focus:outline-none"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">New Password</label>
                <p className="text-[10px] text-emerald-300/80 mb-1">Minimum 8 characters, including numbers and symbols.</p>
                <input
                  type="password"
                  required
                  placeholder="Create a strong password"
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

  // SECTION 17: Render employee code entry or the employee dashboard.
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

  // SECTION 18: Render the main store, order counter, and account settings.
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
              const isEmail = currentUser?.identifier?.includes('@');
              setUpdateInputType(isEmail ? 'email' : 'phone');
              setNewEmailInput(isEmail ? currentUser.identifier : '');
              setNewPhoneInput(!isEmail && currentUser?.identifier?.startsWith('+63') ? currentUser.identifier.replace('+63', '') : '');
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
            setAuthPhoneInput('');
            setAuthPassword('');
            setAuthName('');
            setNicknameError('');
            setIdentifierError('');
            setPasswordError('');
            setLoginError('');
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
            onOpenRegister={() => {
              setCurrentUser(null);
              setAuthMode('regular');
              setIsSignUp(true);
              setAuthEmailInput('');
              setAuthPhoneInput('');
              setAuthPassword('');
              setAuthName('');
              setNicknameError('');
              setIdentifierError('');
              setPasswordError('');
              setLoginError('');
            }}
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
                            const isEmail = currentUser.identifier?.includes('@');
                            setUpdateInputType(isEmail ? 'email' : 'phone');
                            setNewEmailInput(isEmail ? currentUser.identifier : '');
                            setNewPhoneInput(!isEmail && currentUser.identifier?.startsWith('+63') ? currentUser.identifier.replace('+63', '') : '');
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
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-lime-400 uppercase tracking-wider block text-[10px]">
                              {updateInputType === 'email' ? 'Email Address' : 'Phone Number'}
                            </label>
                            <div className="relative">
                              <select
                                value={updateInputType}
                                onChange={(e) => {
                                  setUpdateInputType(e.target.value as 'email' | 'phone');
                                  setNewEmailInput('');
                                  setNewPhoneInput('');
                                }}
                                className="bg-[#041913] text-lime-400 border border-emerald-800 rounded-xl px-2.5 py-1 text-[10px] font-bold focus:outline-none focus:border-lime-400 cursor-pointer appearance-none pr-6 shadow-sm"
                              >
                                <option value="email">Email</option>
                                <option value="phone">Phone Number</option>
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-lime-400 pointer-events-none" />
                            </div>
                          </div>
                          {updateInputType === 'email' ? (
                            <input
                              type="email"
                              required
                              value={newEmailInput}
                              onChange={(e) => setNewEmailInput(e.target.value)}
                              className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                              placeholder="Enter new email address"
                            />
                          ) : (
                            <div className="flex items-center w-full rounded-xl border border-emerald-800 bg-[#041913] px-3 py-2.5 focus-within:border-lime-400">
                              <span className="text-xs font-mono font-bold text-lime-400 mr-1 select-none cursor-default">+63</span>
                              <input
                                type="tel"
                                required
                                maxLength={10}
                                placeholder="Enter your mobile number"
                                value={newPhoneInput}
                                onChange={(e) => setNewPhoneInput(e.target.value.replace(/\D/g, ''))}
                                className="w-full bg-transparent text-xs text-white placeholder:text-emerald-700 font-mono focus:outline-none"
                              />
                            </div>
                          )}
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
