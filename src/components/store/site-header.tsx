// @ts-nocheck
// SiteHeader — Step 8C redesign.
// No logo and no greeting. Home / Menu / Feedback in the center; cart, order history and profile icons on the right.
// On phones the three links move into a menu button on the left. Same color as the page (#03120d).
// Step 8F: the header is fixed to the top of the window (a spacer keeps its place in the page) and has no border.
// Step 8G: after the page scrolls, a soft fade (no hard line) blends the header into the content under it.
import React, { useState, useRef, useEffect } from 'react';
import { LogOut, ShoppingCart, History, User, UserPlus, Settings, Edit3, KeyRound, ChevronDown, Menu as MenuIcon, X } from 'lucide-react';
import { useCart } from '@/lib/cart';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollBehavior = () => (reducedMotion() ? 'auto' : 'smooth');

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400';
const LINK = `rounded-full px-4 py-2 text-sm font-semibold text-emerald-100/80 transition-colors hover:text-lime-400 cursor-pointer ${FOCUS}`;
const ICON_BTN = `relative flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-[#0d2e26] hover:text-lime-400 cursor-pointer ${FOCUS}`;
const ITEM = 'w-full text-left px-3 py-2 rounded-xl text-white hover:bg-[#082d22] hover:text-lime-400 transition-colors flex items-center gap-2 font-semibold cursor-pointer';

export function SiteHeader({
  onOpenOrders,
  onResetMenu,
  currentUser,
  onLogout,
  onOpenAccountSettings,
  onOpenSignUp,
  onExitGuest,
  onOpenFeedback,
  onOpenCart,
  onCloseOverlays
}: {
  onOpenOrders?: () => void;
  onResetMenu?: () => void;
  currentUser?: any;
  onLogout?: () => void;
  onOpenAccountSettings?: (tab?: 'update' | 'password' | 'nickname') => void;
  onOpenSignUp?: () => void;
  onExitGuest?: () => void;
  onOpenFeedback?: () => void;
  onOpenCart?: () => void;
  onCloseOverlays?: () => void;
  // Still passed by store-page but no longer used by the header (the old header did not use them either).
  onOpenLoyalty?: () => void;
  onOpenExtras?: () => void;
}) {
  const cart = useCart() || {};
  const count = cart.count || 0;
  const isGuest = !currentUser || currentUser?.type === 'guest';

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountSubmenuOpen, setAccountSubmenuOpen] = useState(false);
  const [cartHint, setCartHint] = useState(false);

  const mobileRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<number | undefined>(undefined);

  // A thin line appears under the header only once the page has scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close any open dropdown on an outside click or Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (mobileRef.current && !mobileRef.current.contains(t)) setMobileOpen(false);
      if (profileRef.current && !profileRef.current.contains(t)) {
        setProfileOpen(false);
        setAccountSubmenuOpen(false);
      }
      if (cartRef.current && !cartRef.current.contains(t)) setCartHint(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setProfileOpen(false);
        setAccountSubmenuOpen(false);
        setCartHint(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  const closeAll = () => {
    setMobileOpen(false);
    setProfileOpen(false);
    setAccountSubmenuOpen(false);
    setCartHint(false);
  };

  // Home: close overlays and dialogs, reset the menu (what the old logo did), then scroll to the top.
  const goHome = () => {
    closeAll();
    if (onCloseOverlays) onCloseOverlays();
    if (onResetMenu) onResetMenu();
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };

  // Menu: same target as the hero's "Explore menu" button.
  const goMenu = () => {
    closeAll();
    if (onCloseOverlays) onCloseOverlays();
    document.getElementById('menu')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  };

  const openFeedback = () => {
    closeAll();
    if (onOpenFeedback) onOpenFeedback();
  };

  // Cart: opens checkout when there is something in it, otherwise shows a short "empty" note.
  const handleCart = () => {
    setMobileOpen(false);
    setProfileOpen(false);
    if (count > 0) {
      setCartHint(false);
      if (onOpenCart) onOpenCart();
      return;
    }
    setCartHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setCartHint(false), 3000);
  };

  const handleHistory = () => {
    closeAll();
    if (onOpenOrders) onOpenOrders();
  };

  return (
    <>
    <div aria-hidden="true" className="h-16 sm:h-20" />
    <header className="fixed inset-x-0 top-0 z-40 bg-[#03120d]">
      <div className="relative mx-auto grid h-16 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-3 sm:h-20 sm:px-8">
        {/* Left: menu button on phones only (holds Home, Menu, Feedback). */}
        <div className="col-start-1 flex items-center justify-start" ref={mobileRef}>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(!mobileOpen);
              setProfileOpen(false);
              setCartHint(false);
            }}
            className={`${ICON_BTN} md:hidden`}
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            title="Menu"
          >
            {mobileOpen ? <X className="size-5" /> : <MenuIcon className="size-5" />}
          </button>

          {mobileOpen && (
            <div className="absolute left-3 top-full mt-1 w-52 rounded-2xl border border-emerald-800/80 bg-[#051813] p-2 text-sm shadow-2xl z-50 md:hidden">
              <button type="button" onClick={goHome} className={ITEM}>Home</button>
              <button type="button" onClick={goMenu} className={ITEM}>Menu</button>
              <button type="button" onClick={openFeedback} className={ITEM}>Feedback</button>
            </div>
          )}
        </div>

        {/* Center: main links (tablet and desktop). */}
        <nav aria-label="Main" className="col-start-2 hidden items-center gap-1 md:flex">
          <button type="button" onClick={goHome} className={LINK}>Home</button>
          <button type="button" onClick={goMenu} className={LINK}>Menu</button>
          <button type="button" onClick={openFeedback} className={LINK}>Feedback</button>
        </nav>

        {/* Right: cart, order history, profile. */}
        <div className="col-start-3 flex items-center justify-end gap-1 sm:gap-2">
          <div className="relative" ref={cartRef}>
            <button
              type="button"
              onClick={handleCart}
              className={ICON_BTN}
              aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
              title="Cart"
            >
              <ShoppingCart className="size-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-lime-400 text-[11px] font-bold text-black">
                  {count}
                </span>
              )}
            </button>

            {cartHint && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-emerald-800/80 bg-[#051813] p-3 text-xs shadow-2xl z-50" role="status">
                <p className="font-semibold text-white">Your cart is empty.</p>
                <button type="button" onClick={goMenu} className="mt-2 font-semibold text-lime-400 hover:underline cursor-pointer">
                  Browse the menu
                </button>
              </div>
            )}
          </div>

          <button type="button" onClick={handleHistory} className={ICON_BTN} aria-label="Order history" title="Order history">
            <History className="size-5" />
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(!profileOpen);
                setAccountSubmenuOpen(false);
                setMobileOpen(false);
                setCartHint(false);
              }}
              className={ICON_BTN}
              aria-label="Profile"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              title="Profile"
            >
              <User className="size-5" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 space-y-1 rounded-2xl border border-emerald-800/80 bg-[#051813] p-2 text-xs shadow-2xl z-50" role="menu">
                {isGuest ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        closeAll();
                        if (onOpenSignUp) onOpenSignUp();
                      }}
                      className={ITEM}
                    >
                      <UserPlus className="size-3.5 text-lime-400" /> Create an Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeAll();
                        if (onExitGuest) onExitGuest();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 transition-colors flex items-center gap-2 font-semibold cursor-pointer border-t border-emerald-900/60 mt-1 pt-2"
                    >
                      <LogOut className="size-3.5" /> Exit
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <button
                        type="button"
                        onClick={() => setAccountSubmenuOpen(!accountSubmenuOpen)}
                        className="w-full text-left px-3 py-2 rounded-xl text-white hover:bg-[#082d22] hover:text-lime-400 transition-colors flex items-center justify-between font-semibold cursor-pointer"
                        aria-expanded={accountSubmenuOpen}
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="size-3.5 text-lime-400" /> My Account
                        </span>
                        <ChevronDown className={`size-3 transition-transform ${accountSubmenuOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {accountSubmenuOpen && (
                        <div className="pl-4 py-1 space-y-1 border-l border-emerald-800/60 ml-3 my-1">
                          <button
                            type="button"
                            onClick={() => {
                              closeAll();
                              if (onOpenAccountSettings) onOpenAccountSettings('nickname');
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-200 hover:bg-[#082d22] hover:text-lime-400 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <User className="size-3 text-lime-400" /> Edit Nickname
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeAll();
                              if (onOpenAccountSettings) onOpenAccountSettings('update');
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-200 hover:bg-[#082d22] hover:text-lime-400 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Edit3 className="size-3 text-lime-400" /> Update Email
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeAll();
                              if (onOpenAccountSettings) onOpenAccountSettings('password');
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-200 hover:bg-[#082d22] hover:text-amber-400 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <KeyRound className="size-3 text-amber-400" /> Reset Password
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        closeAll();
                        if (onLogout) onLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 transition-colors flex items-center gap-2 font-semibold cursor-pointer border-t border-emerald-900/60 mt-1 pt-2"
                    >
                      <LogOut className="size-3.5" /> Log Out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Soft fade under the header, shown only after the page has scrolled (no hard line). */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-full h-8 transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(to bottom, #03120d, rgba(3, 18, 13, 0))' }}
      />
    </header>
    </>
  );
}
