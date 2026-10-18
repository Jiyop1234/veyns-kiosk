// @ts-nocheck
import { Award, Lock, LogOut, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  
  const isGuest = currentUser?.type === 'guest';
  const nickname = currentUser?.name ? currentUser.name.split(' ')[0] : 'Account';

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/60 bg-[#03120d]">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 md:px-8 lg:px-12">
        <a href="/" onClick={(e) => { e.preventDefault(); if (onResetMenu) onResetMenu(); }} className="flex items-center gap-2 cursor-pointer">
          <span className="flex size-10 items-center justify-center rounded-lg bg-lime-400 text-black">
            <UtensilsCrossed className="size-5" />
          </span>
          <span className="font-display text-2xl font-extrabold text-white">VEYNS<span className="text-lime-400">.</span></span>
        </a>

        <nav className="flex items-center gap-2 text-sm font-medium">
          <Button 
            variant="ghost" 
            onClick={onResetMenu}
            className="text-white hover:text-lime-400 hover:bg-[#061d16] rounded-full px-3 py-2 cursor-pointer transition-colors"
          >
            Menu
          </Button>

          {/* Guest vs Regular Loyalty Header Button */}
          {isGuest ? (
            <Button 
              variant="outline"
              onClick={onLogout}
              className="flex items-center gap-2 bg-[#061d16] border-emerald-700/85 text-emerald-300 hover:border-lime-400 hover:text-lime-400 hover:bg-[#082a20] cursor-pointer rounded-full px-3.5 py-2 text-xs"
              title="Login to unlock loyalty stamps"
            >
              <Lock className="size-3.5 text-lime-400" />
              <span className="font-bold">Login to unlock</span>
            </Button>
          ) : currentUser ? (
            <Button 
              variant="outline"
              onClick={onOpenLoyalty}
              className="flex items-center gap-2 bg-[#061d16] border-emerald-700/80 text-lime-400 hover:border-lime-400 hover:bg-[#082a20] cursor-pointer rounded-full px-3.5 py-2"
              title="View Loyalty Stamp Card"
            >
              <Award className="size-4 text-lime-400" />
              <span className="font-extrabold">{nickname}</span>
            </Button>
          ) : null}

          {/* My Order / Shopping Bag Button (Icon-only on mobile, text on desktop) */}
          <Button 
            variant="outline"
            onClick={onOpenOrders}
            className="relative flex items-center gap-2 bg-[#061d16] border-emerald-700/80 text-white hover:border-lime-400 hover:bg-[#082a20] cursor-pointer"
            title="My order"
          >
            <ShoppingBag className="size-4 text-lime-400" />
            {!isMobile && <span>My order</span>}
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-lime-400 text-xs font-bold text-black">
                {count}
              </span>
            )}
          </Button>

          {/* Logout Button */}
          {currentUser && (
            <Button
              variant="ghost"
              onClick={onLogout}
              className="text-emerald-400 hover:text-red-400 hover:bg-red-950/20 p-2 rounded-full cursor-pointer"
              title="Logout"
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}