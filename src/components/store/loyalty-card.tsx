// @ts-nocheck
// LoyaltyCard — the Milestone Loyalty Card dialog (Silver / Platinum / Diamond) + Rewards Wallet.
// Moved out of ordering-counter.tsx (Step 2). Look and behavior are unchanged.
// ordering-counter.tsx still loads the loyalty data and runs the claim handlers;
// this file only draws the dialog and owns its two display-only states (card flip, Platinum target).
import React, { useState, useEffect } from 'react';
import { CreditCard, Star, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function LoyaltyCard({
  open,
  onOpenChange,
  loyaltyStatus,
  loyaltyLoading,
  stamps,
  nowTimestamp,
  onClaimReward,
  onClaimPlatinumDiscount
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loyaltyStatus: any;
  loyaltyLoading: boolean;
  stamps: any[];
  nowTimestamp: number;
  onClaimReward: (rewardId: string) => void | Promise<void>;
  onClaimPlatinumDiscount: (target?: 'subtotal' | 'delivery') => void | Promise<void>;
}) {
  const [platinumTarget, setPlatinumTarget] = useState<'subtotal' | 'delivery'>('subtotal');
  const [loyaltyCardFlipped, setLoyaltyCardFlipped] = useState(false);
  useEffect(() => { if (!open) setLoyaltyCardFlipped(false); }, [open]);

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="loyalty-dialog max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
        {loyaltyLoading && !loyaltyStatus ? (
          <p className="text-xs text-emerald-300 text-center py-10">Loading your loyalty card…</p>
        ) : !loyaltyStatus ? (
          <p className="text-xs text-emerald-300 text-center py-10">Loyalty data unavailable. Please log in as a registered customer.</p>
        ) : (() => {
          const tier = loyaltyStatus.tier || 'SILVER';
          const block = Math.min(loyaltyStatus.block || 1, 4);
          const blockSizes = [5, 10, 15, 5];
          const size = blockSizes[block - 1] || 5;
          const pos = loyaltyStatus.position_in_block || 0;
          const cum = loyaltyStatus.cumulative_stamps || 0;
          const isDiamond = tier === 'DIAMOND';
          const isPlatinum = tier === 'PLATINUM';
          const cardSkin = isDiamond
            ? 'bg-[#050505] border-2 border-sky-400/80 shadow-[0_0_28px_rgba(56,189,248,0.45)]'
            : isPlatinum
            ? 'bg-[#0a0a0c] border-2 border-slate-300/80 shadow-[0_0_28px_rgba(226,232,240,0.4)]'
            : 'bg-[#061d16] border-2 border-emerald-500/80 shadow-[0_0_22px_rgba(16,185,129,0.35)]';
          const milestoneRewards: Record<number, Record<number, string>> = {
            1: { 1: 'WELCOME', 5: '10% OFF' },
            2: { 5: '10% OFF', 10: '25% OFF' },
            3: { 5: '10% OFF', 10: '25% OFF', 15: '50% OFF' },
            4: { 5: 'FREE MEAL' }
          };
          const nextEntry = Object.entries(milestoneRewards[block] || {}).find(([p]) => Number(p) > pos);
          const wallet: any[] = loyaltyStatus.rewards || [];
          const activeVouchers = wallet.filter((w: any) => w.status === 'claimed' && w.promo_code);
          const weekly = loyaltyStatus.weekly;
          const platExp = loyaltyStatus.platinum_expires_at ? new Date(loyaltyStatus.platinum_expires_at) : null;

          // ---- Platinum: weekly progress ring, free-meal circle, 10% voucher slots + cooldown ----
          const ordersThisWeek = Math.min(weekly?.qualifying_orders || 0, 3);
          const fmState: string = weekly?.free_meal_state || 'locked';
          const ringR = 34;
          const ringC = 2 * Math.PI * ringR;
          const resetAt = weekly?.next_reset_at ? new Date(weekly.next_reset_at).getTime() : null;
          const msLeft = resetAt ? Math.max(0, resetAt - nowTimestamp) : 0;
          const cdD = Math.floor(msLeft / 86400000);
          const cdH = Math.floor((msLeft % 86400000) / 3600000);
          const cdM = Math.floor((msLeft % 3600000) / 60000);
          const cdS = Math.floor((msLeft % 60000) / 1000);
          const countdown = `${cdD}d ${String(cdH).padStart(2, '0')}h ${String(cdM).padStart(2, '0')}m ${String(cdS).padStart(2, '0')}s`;
          const voucherSlots: any[] = [
            ...((weekly?.slots || []).map((sl: any, i: number) => ({ ...sl, kind: sl.used ? 'used' : 'code', key: 's' + i }))),
            ...Array.from({ length: Math.max(0, weekly?.claims_remaining || 0) }).map((_, i) => ({ kind: 'available', key: 'a' + i }))
          ];
          const voucherPanel = weekly ? (
            <div className="bg-black/30 border border-white/10 rounded-2xl p-3 space-y-2.5 text-left">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-100">10% OFF Vouchers · 2 per week</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-300 font-semibold">Use on:</span>
                <button type="button" onClick={() => setPlatinumTarget('subtotal')}
                  className={`px-3 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer ${platinumTarget === 'subtotal' ? 'bg-slate-100 text-black border-white' : 'bg-transparent text-slate-300 border-slate-500'}`}>Food</button>
                <button type="button" onClick={() => setPlatinumTarget('delivery')}
                  className={`px-3 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer ${platinumTarget === 'delivery' ? 'bg-slate-100 text-black border-white' : 'bg-transparent text-slate-300 border-slate-500'}`}>Delivery Fee</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {voucherSlots.map((sl: any) => sl.kind === 'available' ? (
                  <div key={sl.key} className="rounded-xl border border-lime-400/60 bg-lime-400/10 p-2.5 text-center space-y-1.5">
                    <p className="text-sm font-black text-lime-300 leading-none">10% OFF</p>
                    <p className="text-[9px] text-slate-200">Ready to claim</p>
                    <button type="button" onClick={() => onClaimPlatinumDiscount(platinumTarget)}
                      className="w-full bg-slate-100 hover:bg-white text-black font-extrabold py-1.5 rounded-lg text-[10px] cursor-pointer">Claim code</button>
                  </div>
                ) : sl.kind === 'code' ? (
                  <div key={sl.key} className="rounded-xl border border-sky-400/60 bg-sky-400/10 p-2.5 text-center space-y-1">
                    <p className="text-[9px] uppercase font-bold text-sky-200">{sl.target === 'delivery' ? 'Delivery Fee' : 'Food'} · 10% OFF</p>
                    <p className="font-mono text-[13px] font-black text-white tracking-wider">{sl.promo_code}</p>
                    <p className="text-[9px] text-slate-300">Type at checkout · single-use</p>
                  </div>
                ) : (
                  <div key={sl.key} className="rounded-xl border border-slate-600 bg-black/40 p-2.5 text-center space-y-1 opacity-80">
                    <p className="text-[9px] uppercase font-bold text-slate-400">{sl.target === 'delivery' ? 'Delivery Fee' : 'Food'} · 10% OFF</p>
                    <p className="text-sm font-black text-slate-300">USED ✓</p>
                    <p className="text-[9px] text-slate-400">Renews Monday</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 border border-sky-400/30">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-200">⏱ Renews in</span>
                <span className="font-mono text-[13px] font-black text-sky-300">{countdown}</span>
              </div>
              <p className="text-[9px] text-slate-300 leading-snug">Resets every Monday 12:00 AM (Manila). Unused vouchers don't stack — you always get 2 per week, never 3. Each code works once.</p>
            </div>
          ) : null;

          const frontFace = (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="text-left">
                  <p className="font-display text-2xl font-black text-white uppercase tracking-wide">{isPlatinum ? 'Platinum Card' : isDiamond ? 'Diamond Card' : 'Loyalty Card'}</p>
                  <p className="text-[10px] text-emerald-200/80">Enjoy your rewards!</p>
                </div>
                <button type="button" onClick={() => setLoyaltyCardFlipped(true)}
                  className="size-8 rounded-full bg-black/30 border border-white/30 text-white hover:bg-lime-400 hover:text-black transition-all cursor-pointer flex items-center justify-center text-sm font-black shrink-0" title="Flip card">⟳</button>
              </div>

              {isDiamond ? (
                <div className="space-y-2 text-center py-2">
                  <p className="text-xs text-sky-200 italic leading-relaxed">"Thank you for being a founder of our story. This card is our handshake — no quotas, no counters, just our gratitude."</p>
                  <div className="text-[10px] text-sky-300/90 space-y-0.5 font-semibold">
                    <p>• Priority kitchen queue, custom packaging, handwritten notes</p>
                    <p>• Annual co-created weekend special • Monthly complimentary staple</p>
                    <p>• Direct line for party trays & catering</p>
                  </div>
                </div>
              ) : isPlatinum ? (
                <div className="space-y-3">
                  <div className="text-center">
                    {platExp && <p className="text-[10px] text-slate-200 font-semibold">2-week trial active until {platExp.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila time)</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 justify-items-center">
                    {/* CIRCLE 1 — the circle IS the progress bar: orders this week (x / 3) */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="relative size-24">
                        <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
                          <circle cx="40" cy="40" r={ringR} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
                          <circle cx="40" cy="40" r={ringR} fill="none" stroke={ordersThisWeek >= 3 ? '#a3e635' : '#e2e8f0'} strokeWidth="7" strokeLinecap="round"
                            strokeDasharray={ringC} strokeDashoffset={ringC * (1 - ordersThisWeek / 3)} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black text-white leading-none">{ordersThisWeek}</span>
                          <span className="text-[8px] uppercase tracking-wider text-slate-300 font-bold">orders</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-200 font-semibold text-center leading-tight">Total orders</p>
                    </div>

                    {/* CIRCLE 2 — FREE MEAL: locked / unlocked (claim) / claimed */}
                    <div className="flex flex-col items-center gap-1.5">
                      <button type="button"
                        disabled={fmState !== 'unlocked'}
                        onClick={() => weekly?.free_meal_reward_id && onClaimReward(weekly.free_meal_reward_id)}
                        className={`size-24 rounded-full flex flex-col items-center justify-center border-4 text-center transition-all ${
                          fmState === 'unlocked'
                            ? 'border-lime-400 bg-lime-400/15 text-lime-300 cursor-pointer shadow-[0_0_18px_rgba(163,230,53,0.5)] animate-pulse'
                            : fmState === 'claimed'
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 cursor-default'
                            : 'border-slate-600 bg-black/40 text-slate-400 cursor-not-allowed'}`}>
                        {fmState === 'unlocked' ? (<><span className="text-2xl leading-none">🎁</span><span className="text-[9px] font-black uppercase mt-1">Free Meal</span></>)
                          : fmState === 'claimed' ? (<><span className="text-2xl leading-none">✓</span><span className="text-[10px] font-black uppercase mt-0.5">Claimed</span></>)
                          : (<><span className="text-2xl leading-none">🔒</span><span className="text-[9px] font-black uppercase mt-1">Free Meal</span></>)}
                      </button>
                      <p className="text-[10px] font-semibold text-center leading-tight text-slate-200 max-w-[130px]">
                        {fmState === 'unlocked' ? <span className="text-lime-300 font-extrabold">Claim your reward!</span>
                          : fmState === 'claimed' ? (weekly?.free_meal_used ? 'Voucher used' : (weekly?.free_meal_code ? `Code: ${weekly.free_meal_code}` : 'Reward claimed'))
                          : <>Order 3× in one week<br /><span className="text-slate-400 font-normal">to unlock · one-time</span></>}
                      </p>
                    </div>
                  </div>
                  {voucherPanel}
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 text-center">Milestone Block {block} · {size} stamps</p>
                  <div className="grid grid-cols-5 gap-x-3 gap-y-3 justify-items-center">
                    {Array.from({ length: size }).map((_, idx) => {
                      const cellNum = idx + 1;
                      const isStamped = cellNum <= pos;
                      const label = (milestoneRewards[block] || {})[cellNum];
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1 w-full">
                          <div className={`size-10 rounded-full flex items-center justify-center border-2 ${isStamped ? 'bg-lime-400 border-lime-300 text-black shadow-md' : 'bg-transparent border-white/70 text-lime-300'}`}>
                            {isStamped ? <Star className="size-4 fill-black" /> : <span className="text-[10px] font-bold">{cellNum}</span>}
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-wider whitespace-nowrap min-h-[10px] ${label ? 'text-lime-400' : 'text-transparent'}`}>{label || '-'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-emerald-100 text-center font-semibold">
                    {nextEntry
                      ? Number(nextEntry[0]) === size
                        ? `Enjoy ${nextEntry[1]} at the last stamp`
                        : `Enjoy ${nextEntry[1]} at stamp ${nextEntry[0]} of this block`
                      : 'Milestone complete — advancing to the next block!'}
                  </p>
                </>
              )}
            </div>
          );

          const backFace = (
            <div className="space-y-3">
              <div className="relative">
                <p className="font-display text-lg font-black text-white uppercase tracking-wide text-center">Thank You!</p>
                <button type="button" onClick={() => setLoyaltyCardFlipped(false)}
                  className="absolute top-0 right-0 size-8 rounded-full bg-black/30 border border-white/30 text-white hover:bg-lime-400 hover:text-black transition-all cursor-pointer flex items-center justify-center text-sm font-black" title="Flip back">⟳</button>
              </div>
              <p className="text-[12px] text-white italic leading-relaxed text-center px-2">
                "Thank you for supporting VEYNS. Every stamp on this card is a meal you shared with us — we're grateful for every single one."
              </p>
              <div className="bg-black/40 rounded-2xl p-3 space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-lime-300">
                  {isDiamond ? 'Diamond Benefits' : isPlatinum ? 'Platinum Benefits' : `Milestone Block ${block} Benefits`}
                </p>
                {isDiamond ? (
                  <div className="text-[11px] text-white space-y-1.5 leading-snug">
                    <p>• Priority kitchen queue, custom packaging, handwritten notes</p>
                    <p>• Annual co-created weekend special</p>
                    <p>• Monthly complimentary staple</p>
                    <p>• Direct line for party trays & catering</p>
                  </div>
                ) : isPlatinum ? (
                  <div className="text-[11px] text-white space-y-1.5 leading-snug">
                    <p>• 2-week Platinum trial. When it ends you return to Block 2 — and you can climb back to Platinum anytime.</p>
                    <p>• 2× single-use 10% OFF codes every week — use each on <strong>food</strong> or <strong>delivery fee</strong>, your choice.</p>
                    <p>• Vouchers renew every Monday 12:00 AM (Manila). Unused ones don't stack — max 2.</p>
                    <p>• FREE MEAL: place 3 orders within a week to unlock a one-time voucher.</p>
                    <p>• 💎 Diamond is by invitation only.</p>
                  </div>
                ) : (
                  <div className="text-[11px] text-white space-y-1.5 leading-snug">
                    {Object.entries(milestoneRewards[block] || {}).map(([posLabel, reward]) => (
                      <p key={posLabel}>• Stamp {posLabel}: <strong className="text-lime-300">{reward === 'WELCOME' ? 'Welcome stamp 🎉' : reward}</strong></p>
                    ))}
                    <p className="text-slate-300 pt-1">• Finish Block 4 to unlock Platinum. 💎 Diamond is by invitation only.</p>
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <div className="space-y-4 loyalty-layout">
              <style>{`@keyframes veynsFlipIn{from{opacity:0;transform:perspective(900px) rotateY(85deg)}to{opacity:1;transform:perspective(900px) rotateY(0deg)}}`}</style>
              <div className="space-y-4">
              <div className={`rounded-3xl p-5 ${cardSkin}`}>
                {/* Only ONE face is rendered at a time (no 3D-transformed layers left behind) so text stays razor sharp */}
                <div key={loyaltyCardFlipped ? 'back' : 'front'} style={{ animation: 'veynsFlipIn 0.35s ease-out' }}>
                  {loyaltyCardFlipped ? backFace : frontFace}
                </div>
              </div>

              {/* Card footer (member since + lifetime stamps) */}
              <div className="flex items-center justify-between px-2 text-[10px] text-emerald-200/90">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-lime-400" />
                  {loyaltyStatus.member_since
                    ? `Member since ${new Date(loyaltyStatus.member_since).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}`
                    : 'VEYNS. member'}
                </span>
                {!isPlatinum && !isDiamond && <span className="font-extrabold text-lime-400">{cum} / 35 stamps</span>}
              </div>

              {isDiamond && voucherPanel && (
                <div className="bg-[#0a0a0c] border border-slate-500/50 rounded-2xl p-3">{voucherPanel}</div>
              )}
              </div>

              <div className="space-y-4">
              <div className="bg-[#051813] border border-emerald-800 rounded-2xl p-4 space-y-2 text-xs">
                <div className="text-[10px] space-y-1 text-emerald-200/90 border-t border-white/10 pt-2">
                  <p className="font-extrabold uppercase tracking-wider text-lime-400">How it works</p>
                  {isPlatinum ? (
                    <>
                      <p>• 2-week Platinum trial — afterwards you return to Block 2 and can climb back to Platinum anytime.</p>
                      <p>• 2× single-use 10% OFF codes per week (food or delivery fee). They renew every Monday 12:00 AM Manila time and never stack.</p>
                      <p>• FREE MEAL: order 3 times within a week to unlock a one-time voucher, then tap the gift circle to claim it.</p>
                    </>
                  ) : (
                    <>
                      <p>• 1 stamp per completed order per day (Manila time). Reach stamp 35 to unlock Platinum.</p>
                      <p>• Percentage rewards apply automatically to the order that completes them — nothing to claim.</p>
                      <p>• FREE MEAL rewards arrive as single-use vouchers with a 1-week expiry — type the code at checkout. FREE MEAL covers 1 item entirely (e.g., use it on Pork Sugba for ₱99 or Buldak Loaded for ₱179 — both become free).</p>
                    </>
                  )}
                </div>
                {activeVouchers.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-emerald-900/60">
                    <p className="font-extrabold text-lime-400 uppercase tracking-wider text-[10px]">Your Active Vouchers</p>
                    {activeVouchers.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between bg-[#061d16] border border-lime-400/40 rounded-xl p-2.5">
                        <div>
                          <p className="font-bold text-lime-400 text-[11px] font-mono">{v.promo_code}</p>
                          <p className="text-[9px] text-emerald-300">{String(v.reward_type).replace(/_/g, ' ')} • single-use • type at checkout</p>
                        </div>
                        <Ticket className="size-4 text-lime-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => onOpenChange(false)}
                className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg">
                Close Loyalty Card
              </Button>
              </div>
            </div>
          );
        })()}
      </DialogContent>
      </Dialog>

  );
}
