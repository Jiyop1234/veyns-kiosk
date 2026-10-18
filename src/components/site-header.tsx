// @ts-nocheck
import { Award, Lock, LogOut, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export function SiteHeader({ 
  onOpenOrders, 
  onResetMenu, 
  currentUser, 
  onOpenLoyalty, 
  onLogout 
}: { 
  onOpenOrders?: () => void; 
  onResetMenu?: () => void; 
  currentUser?: any; 
  onOpenLoyalty?: () => void; 
  onLogout?: () => void; 
}) {
  const cart = useCart() || {};
  const count = cart.count || 0;
  
  const isGuest = currentUser?.type === 'guest';
  const nickname = currentUser?.name ? currentUser.name.split(' ')[0] : 'Account';

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/60 bg-[#03120d]">
      <div className="mx-auto flex h-auto min-h-[5rem] max-w-[1440px] items-center justify-between px-3 py-3 sm:px-8">
        <a href="/" onClick={(e) => { e.preventDefault(); if (onResetMenu) onResetMenu(); }} className="flex items-center gap-2 cursor-pointer shrink-0">
          <span className="flex size-9 items-center justify-center rounded-lg bg-lime-400 text-black">
            <UtensilsCrossed className="size-4" />
          </span>
          <span className="font-display text-xl sm:text-2xl font-extrabold text-white">VEYNS<span className="text-lime-400">.</span></span>
        </a>

        <nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium flex-wrap justify-end">
          <Button 
            variant="ghost" 
            onClick={onResetMenu}
            className="text-white hover:text-lime-400 hover:bg-[#061d16] rounded-full px-2.5 sm:px-3 py-1.5 cursor-pointer transition-colors text-xs sm:text-sm h-9"
          >
            Menu
          </Button>

          {/* Guest vs Regular Loyalty Header Button */}
          {isGuest ? (
            <Button 
              variant="outline"
              onClick={onLogout}
              className="flex items-center gap-1.5 bg-[#061d16] border-emerald-700/85 text-emerald-300 hover:border-lime-400 hover:text-lime-400 hover:bg-[#082a20] cursor-pointer rounded-full px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs h-9"
              title="Login to unlock loyalty stamps"
            >
              <Lock className="size-3 text-lime-400 shrink-0" />
              <span className="font-bold truncate max-w-[90px] sm:max-w-none">Login</span>
            </Button>
          ) : currentUser ? (
            <Button 
              variant="outline"
              onClick={onOpenLoyalty}
              className="flex items-center gap-1.5 bg-[#061d16] border-emerald-700/80 text-lime-400 hover:border-lime-400 hover:bg-[#082a20] cursor-pointer rounded-full px-2.5 sm:px-3.5 py-1.5 text-xs h-9"
              title="View Loyalty Stamp Card"
            >
              <Award className="size-3.5 text-lime-400 shrink-0" />
              <span className="font-extrabold truncate max-w-[80px] sm:max-w-none">{nickname}</span>
            </Button>
          ) : null}

          {/* My Order / Shopping Bag Button */}
          <Button 
            variant="outline"
            onClick={onOpenOrders}
            className="relative flex items-center gap-1.5 bg-[#061d16] border-emerald-700/80 text-white hover:border-lime-400 hover:bg-[#082a20] cursor-pointer px-2.5 sm:px-3.5 py-1.5 h-9 text-xs"
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

          {/* Logout Button */}
          {currentUser && (
            <Button
              variant="ghost"
              onClick={onLogout}
              className="text-emerald-400 hover:text-red-400 hover:bg-red-950/20 p-2 rounded-full cursor-pointer h-9 w-9 flex items-center justify-center shrink-0"
              title="Logout"
            >
              <LogOut className="size-3.5 sm:size-4" />
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}