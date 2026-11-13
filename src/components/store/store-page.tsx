// @ts-nocheck
// StorePage — the storefront shell (Step 3).
// Owns everything the store shows: header, menu (StoreData, formerly OrderingCounter),
// feedback/extras overlays, account settings, order history and the recovery dialog.
// App.tsx is only the auth gate and passes the auth-bridge props below.
import React, { useState, useEffect } from 'react';
import { SiteHeader } from '@/components/store/site-header';
import { StoreData } from '@/components/store/store-data';
import { HomePage } from '@/components/store/home-page';
import { CartProvider } from '@/lib/cart';
import { AccountSettingsDialog } from '@/components/store/account-settings-dialog';
import { FeedbackPage } from '@/components/store/feedback-page';
import { FloatingSupportButton } from '@/components/floating-support-button';
import { ExtrasPage } from '@/components/extras-page';
import { ProfilePage } from '@/components/store/profile-page';
import { ResetPasswordDialog } from '@/components/login-page';

export function StorePage({
  currentUser,
  onLogout,
  onOpenSignUp,
  onNicknameSaved,
  loadUserStampsAndPenalties,
  passwordRecoveryTick = 0,
  onPasswordRecoveryHandled
}: {
  currentUser?: any;
  onLogout: () => void;
  onOpenSignUp: () => void;
  onNicknameSaved: (name: string) => void;
  loadUserStampsAndPenalties: (userObj: any) => Promise<void>;
  passwordRecoveryTick?: number;
  onPasswordRecoveryHandled?: () => void;
}) {
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  // The header's cart icon bumps this; StoreData opens checkout when it changes.
  const [openCheckoutTick, setOpenCheckoutTick] = useState(0);

  // Account Settings dialog: open flag + which section it should start on.
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [accountSettingsTab, setAccountSettingsTab] = useState<'nickname' | 'update' | 'password' | null>(null);

  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  // Guest order history lives in sessionStorage; restore it when the store opens.
  useEffect(() => {
    if (currentUser?.type !== 'guest') return;
    try {
      const sessionOrders = sessionStorage.getItem('veyns_guest_order_history');
      if (sessionOrders) setOrderHistory(JSON.parse(sessionOrders));
    } catch (e) { console.error(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A password-recovery link was opened: show the reset dialog and the password form,
  // then tell App it was handled so it does not reopen after a later logout/login.
  useEffect(() => {
    if (passwordRecoveryTick > 0) {
      setIsResetPasswordOpen(true);
      setAccountSettingsTab('password');
      setShowAccountSettings(true);
      if (onPasswordRecoveryHandled) onPasswordRecoveryHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordRecoveryTick]);

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

  const handleResetMenu = () => {
    setShowMyOrders(false);
    setShowAccountSettings(false);
    setResetTrigger((prev) => prev + 1);
  };

  // Home and Menu in the header close the Feedback and Extras pages first.
  const closeOverlays = () => {
    setShowFeedback(false);
    setShowExtras(false);
  };

  const recordOrderForLoyalty = async () => {
    if (currentUser && currentUser.type !== 'guest') await loadUserStampsAndPenalties(currentUser);
  };

  // One place that updates the order list and mirrors it to storage (used by checkout and My Order History).
  const updateOrderHistory = (newHistory: any[]) => {
    setOrderHistory(newHistory);
    if (currentUser && currentUser.type === 'guest') {
      sessionStorage.setItem('veyns_guest_order_history', JSON.stringify(newHistory));
    } else if (currentUser && currentUser.type === 'regular') {
      localStorage.setItem('veyns_order_history', JSON.stringify(newHistory));
    }
  };

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#03120d] text-white flex flex-col">
        <SiteHeader
          onOpenOrders={() => setShowMyOrders(true)}
          onResetMenu={handleResetMenu}
          currentUser={currentUser}
          onOpenLoyalty={handleOpenLoyalty}
          onLogout={onLogout}
          onOpenAccountSettings={handleOpenAccountSettings}
          onOpenSignUp={onOpenSignUp}
          onExitGuest={onLogout}
          onOpenFeedback={() => setShowFeedback(true)}
          onOpenExtras={() => setShowExtras(true)}
          onOpenCart={() => setOpenCheckoutTick((t) => t + 1)}
          onCloseOverlays={closeOverlays}
        />
        <main className="flex-1">
          <HomePage currentUser={currentUser} />
          {/* Scroll target for the hero's "Explore menu" button. Zero height, no layout change. */}
          <div id="menu" className="scroll-mt-20" />
          <StoreData
            onOpenExtras={() => setShowExtras(true)}
            orderHistory={orderHistory}
            setOrderHistory={updateOrderHistory}
            resetKey={resetTrigger}
            currentUser={currentUser}
            onOrderPlacedSuccess={recordOrderForLoyalty}
            onOpenRegister={onOpenSignUp}
            openCheckoutTick={openCheckoutTick}
          />
        </main>
        {showFeedback && <FeedbackPage onBack={() => setShowFeedback(false)} currentUser={currentUser} />}
        {showExtras && <ExtrasPage onBack={() => setShowExtras(false)} onReviewOrder={() => { setShowExtras(false); setShowMyOrders(true); }} />}
        <ProfilePage
          open={showMyOrders}
          onOpenChange={setShowMyOrders}
          currentUser={currentUser}
          orderHistory={orderHistory}
          setOrderHistory={updateOrderHistory}
        />
        <FloatingSupportButton />
        <AccountSettingsDialog
          open={showAccountSettings}
          onClose={() => setShowAccountSettings(false)}
          currentUser={currentUser}
          initialTab={accountSettingsTab}
          onNicknameSaved={onNicknameSaved}
        />
        {isResetPasswordOpen && <ResetPasswordDialog onFinished={() => setIsResetPasswordOpen(false)} />}
      </div>
    </CartProvider>
  );
}
