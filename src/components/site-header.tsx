// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { Lock, LogOut, ShoppingBag, UtensilsCrossed, Settings, UserPlus, Edit3, KeyRound, ChevronDown, Facebook, Instagram } from 'lucide-react';
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export function SiteHeader({ 
  onOpenOrders, 
  onResetMenu, 
  currentUser, 
  onOpenLoyalty, 
  onLogout,
  onOpenAccountSettings,
  onOpenSignUp,
  onExitGuest
}: { 
  onOpenOrders?: () => void; 
  onResetMenu?: () => void; 
  currentUser?: any; 
  onOpenLoyalty?: () => void; 
  onLogout?: () => void;
  onOpenAccountSettings?: (tab?: 'update' | 'password') => void;
  onOpenSignUp?: () => void;
  onExitGuest?: () => void;
}) {
  const cart = useCart() || {};
  const count = cart.count || 0;
  
  const isGuest = !currentUser || currentUser?.type === 'guest';
  const nickname = currentUser?.name && currentUser.name !== 'Valued Customer' 
    ? currentUser.name.split(' ')[0] 
    : (currentUser?.email ? currentUser.email.split('@')[0].toUpperCase() : 'USER');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountSubmenuOpen, setAccountSubmenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
        setAccountSubmenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/60 bg-[#03120d]">
      <div className="mx-auto flex h-auto min-h-[5rem] max-w-[1440px] items-center justify-between px-3 py-3 sm:px-8">
        <a href="/" onClick={(e) => { e.preventDefault(); if (onResetMenu) onResetMenu(); }} className="flex items-center gap-2 cursor-pointer shrink-0">
          <span className="flex size-9 items-center justify-center rounded-lg bg-lime-400 text-black">
            <UtensilsCrossed className="size-4" />
          </span>
          <span className="font-display text-xl sm:text-2xl font-extrabold text-white">VEYNS<span className="text-lime-400">.</span></span>
        </a>

        <nav className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-medium flex-wrap justify-end relative">
          
          {/* Non-clickable Greeting for Guest or Regular Customer */}
          {isGuest ? (
            <span 
              className="text-lime-400 font-extrabold text-xs sm:text-sm tracking-wide select-none"
            >
              Hi, GUEST!
            </span>
          ) : currentUser ? (
            <span 
              className="text-lime-400 font-extrabold text-xs sm:text-sm tracking-wide select-none"
            >
              Hi, {nickname}
            </span>
          ) : null}

          {/* Oval My Order / Shopping Bag Button */}
          <Button 
            variant="outline"
            onClick={onOpenOrders}
            className="relative flex items-center gap-1.5 bg-[#061d16] border-emerald-700/80 text-white hover:border-lime-400 hover:bg-[#082a20] cursor-pointer px-3 sm:px-4 py-1.5 h-9 text-xs rounded-full"
            title="My order"
          >
            <ShoppingBag className="size-4 text-lime-400 shrink-0" />
            <span className="hidden sm:inline">My order</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 sm:size-5 items-center justify-center rounded-full bg-lime-400 text-[10px] sm:text-xs font-bold text-black">
                {count}
              </span>
            )}
          </Button>

          {/* Settings Dropdown Button */}
          <div className="relative" ref={dropdownRef}>
            <Button 
              variant="ghost" 
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setAccountSubmenuOpen(false);
              }}
              className="text-white hover:text-lime-400 hover:bg-[#061d16] rounded-full px-2.5 sm:px-3 py-1.5 cursor-pointer transition-colors text-xs sm:text-sm h-9 flex items-center gap-1.5"
              title="Settings"
            >
              <Settings className="size-4 text-lime-400 shrink-0" />
              <span className="hidden sm:inline">Settings</span>
              <ChevronDown className={`size-3 transition-transform hidden sm:inline ${settingsOpen ? 'rotate-180' : ''}`} />
            </Button>

            {settingsOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#051813] border border-emerald-800/80 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1">
                {/* Menu Option */}
                <button
                  onClick={() => {
                    if (onResetMenu) onResetMenu();
                    setSettingsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-white hover:bg-[#082d22] hover:text-lime-400 transition-colors flex items-center gap-2 font-semibold cursor-pointer"
                >
                  <UtensilsCrossed className="size-3.5 text-lime-400" /> Menu
                </button>

                {isGuest ? (
                  <>
                    <button
                      onClick={() => {
                        setSettingsOpen(false);
                        if (onOpenSignUp) onOpenSignUp();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-white hover:bg-[#082d22] hover:text-lime-400 transition-colors flex items-center gap-2 font-semibold cursor-pointer"
                    >
                      <UserPlus className="size-3.5 text-lime-400" /> Create an Account
                    </button>
                    <button
                      onClick={() => {
                        setSettingsOpen(false);
                        if (onExitGuest) onExitGuest();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 transition-colors flex items-center gap-2 font-semibold cursor-pointer border-t border-emerald-900/60 mt-1 pt-2"
                    >
                      <LogOut className="size-3.5" /> Exit
                    </button>
                  </>
                ) : (
                  <>
                    {/* My Account Submenu / Toggle */}
                    <div className="border-t border-emerald-900/60 pt-1 mt-1">
                      <button
                        onClick={() => setAccountSubmenuOpen(!accountSubmenuOpen)}
                        className="w-full text-left px-3 py-2 rounded-xl text-white hover:bg-[#082d22] hover:text-lime-400 transition-colors flex items-center justify-between font-semibold cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="size-3.5 text-lime-400" /> My Account
                        </span>
                        <ChevronDown className={`size-3 transition-transform ${accountSubmenuOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {accountSubmenuOpen && (
                        <div className="pl-4 py-1 space-y-1 border-l border-emerald-800/60 ml-3 my-1">
                          <button
                            onClick={() => {
                              setSettingsOpen(false);
                              setAccountSubmenuOpen(false);
                              if (onOpenAccountSettings) onOpenAccountSettings('update');
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-200 hover:bg-[#082d22] hover:text-lime-400 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Edit3 className="size-3 text-lime-400" /> Update Email
                          </button>
                          <button
                            onClick={() => {
                              setSettingsOpen(false);
                              setAccountSubmenuOpen(false);
                              if (onOpenAccountSettings) onOpenAccountSettings('password');
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-200 hover:bg-[#082d22] hover:text-amber-400 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <KeyRound className="size-3 text-amber-400" /> Reset Password
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Log Out button */}
                    <button
                      onClick={() => {
                        setSettingsOpen(false);
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
        </nav>
      </div>
    </header>
  );
}