// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Star, Gift, Check, X, RefreshCw, ShieldAlert, Sparkles, Crown, Gem, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

const BLOCKS = [
  { n: 1, size: 4,  start: 1  },
  { n: 2, size: 10, start: 5  },
  { n: 3, size: 15, start: 15 },
  { n: 4, size: 20, start: 30 },
  { n: 5, size: 10, start: 50 },
];
const TOTAL = 59;
const REWARDS = {
  4:{label:'10% OFF',kind:'pct'}, 9:{label:'10% OFF',kind:'pct'}, 14:{label:'15% OFF',kind:'pct'},
  19:{label:'10% OFF',kind:'pct'},24:{label:'15% OFF',kind:'pct'},29:{label:'20% OFF',kind:'pct'},
  34:{label:'10% OFF',kind:'pct'},39:{label:'15% OFF',kind:'pct'},44:{label:'25% OFF',kind:'pct'},
  49:{label:'50% OFF',kind:'pct'},54:{label:'50% OFF',kind:'pct'},59:{label:'FREE MEAL',kind:'meal'},
};
const WELCOME = 1;

function blockFor(lifetime) {
  if (lifetime >= TOTAL) return { ...BLOCKS[4], done: true };
  return BLOCKS.find(b => lifetime <= b.start + b.size - 1) || BLOCKS[0];
}
function nextRewardAfter(lifetime) {
  const pos = Object.keys(REWARDS).map(Number).filter(p => p > lifetime).sort((a,b)=>a-b)[0];
  return pos ? { pos, ...REWARDS[pos] } : null;
}

export default function LoyaltyCard({ open, onOpenChange, userId, isGuest, onSignIn }) {
  const [loyalty, setLoyalty] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [back, setBack] = useState(false);
  const [busyPos, setBusyPos] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setErr('');
    const { data, error } = await supabase.from('profiles')
      .select('name, loyalty_data').eq('auth_user_id', userId).single();
    if (error) setErr(error.message);
    else { setName(data?.name || 'Valued Customer'); setLoyalty(data?.loyalty_data || null); }
    setLoading(false);
  }, [userId]);

  useEffect(() => { if (open && userId) { setBack(false); load(); } }, [open, userId, load]);

  const claim = async (pos) => {
    setBusyPos(pos); setErr('');
    const { data, error } = await supabase.rpc('claim_veyns_loyalty_reward', { p_pos: pos });
    if (error) setErr(error.message); else await load();
    setBusyPos(null);
  };

  const tier = loyalty?.tier || 'silver';
  const freeze = !!loyalty?.freeze;
  const lifetime = Math.min(Math.max(parseInt(loyalty?.lifetime || 0, 10) || 0, 0), TOTAL);
  const cycle = parseInt(loyalty?.cycle || 1, 10) || 1;
  const rewards = Array.isArray(loyalty?.rewards) ? loyalty.rewards : [];
  const entryFor = (pos) => rewards.find(r => Number(r.pos) === pos && Number(r.cycle || 1) === cycle);

  const skin =
    tier === 'diamond' ? 'from-[#05070d] to-[#0a1430] border-cyan-400/70 shadow-[0_0_40px_-8px_rgba(34,211,238,0.7)]'
    : tier === 'platinum' ? 'from-[#0a0a0c] to-[#16161c] border-slate-300/70 shadow-[0_0_40px_-10px_rgba(226,232,240,0.6)]'
    : 'from-[#041913] to-[#06281d] border-emerald-400/60 shadow-[0_0_40px_-10px_rgba(52,211,153,0.6)]';
  const accent = tier === 'diamond' ? 'text-cyan-300' : tier === 'platinum' ? 'text-slate-200' : 'text-lime-400';

  const b = blockFor(lifetime);
  const filledInBlock = Math.min(Math.max(lifetime - b.start + 1, 0), b.size);
  const nr = nextRewardAfter(lifetime);

  const earnedRewardPositions = Object.keys(REWARDS).map(Number).filter(p => p <= lifetime).sort((a,c)=>a-c);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-transparent">
        <div className={`relative rounded-3xl bg-gradient-to-br ${skin} border p-5 text-white`}>
          {freeze && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 bg-red-600/90 py-2 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4" /> Card suspended — stamps paused
            </div>
          )}
          <div className="flex items-center justify-between pb-3">
            <div>
              <DialogTitle className={`text-sm font-black uppercase tracking-widest ${accent}`}>
                {tier === 'diamond' ? <Gem className="mr-1 inline h-4 w-4"/> : tier === 'platinum' ? <Crown className="mr-1 inline h-4 w-4"/> : <Sparkles className="mr-1 inline h-4 w-4"/>}
                VEYNS {tier === 'silver' ? 'Journey' : tier}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-white/60">Hi {name}</DialogDescription>
            </div>
            <Button size="sm" variant="ghost" className="text-white/80 hover:text-white" onClick={() => setBack(v => !v)}>
              <RefreshCw className="mr-1 h-4 w-4"/> {back ? 'Front' : 'Rewards'}
            </Button>
          </div>

          {!userId || isGuest ? (
            <div className="py-10 text-center">
              <p className="mb-3 text-sm text-white/70">Sign in to start your 59‑stamp journey.</p>
              <Button className={accent} onClick={onSignIn}>Sign in / Register</Button>
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-white/60">Loading card…</div>
          ) : !back ? (
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/70">
                  {b.done ? 'Journey complete' : `Block ${b.n} of 5`}
                </span>
                <span className="text-xs text-white/60">{lifetime}/{TOTAL} stamps</span>
              </div>
              {b.done ? (
                <div className="rounded-2xl border border-white/15 bg-black/30 p-6 text-center">
                  <Crown className="mx-auto mb-2 h-8 w-8 text-amber-300"/>
                  <p className="font-black uppercase tracking-widest text-amber-300">Platinum unlocked</p>
                  <p className="mt-1 text-xs text-white/60">Your VIP loop begins now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {Array.from({ length: b.size }).map((_, i) => {
                    const cum = b.start + i;
                    const filled = cum <= lifetime;
                    const isWel = cum === WELCOME;
                    const rw = REWARDS[cum];
                    return (
                      <div key={cum} className="flex flex-col items-center gap-1">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-black transition
                          ${filled ? (isWel ? 'border-amber-300 bg-amber-300/20 text-amber-200'
                                : rw ? `border ${accent} bg-white/10`
                                : 'border-emerald-400 bg-emerald-400/20 text-emerald-200')
                                : 'border-white/15 bg-white/5 text-white/30'}`}>
                          {filled ? (isWel ? <Star className="h-4 w-4"/> : rw ? <Gift className="h-4 w-4"/> : <Check className="h-4 w-4"/>) : cum - b.start + 1}
                        </div>
                        {rw && <span className={`text-[8px] font-bold uppercase ${filled ? accent : 'text-white/30'}`}>{rw.label}</span>}
                        {isWel && <span className="text-[8px] font-bold uppercase text-amber-300">Welcome</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {nr && !b.done && (
                <p className="mt-3 text-center text-[11px] text-white/50">
                  {nr.pos - lifetime} more stamp{nr.pos - lifetime === 1 ? '' : 's'} → <span className={accent}>{nr.label}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-center text-[11px] italic text-white/70">
                “Thank you for growing with us. Every stamp is a seat at our table.” — the founders
              </p>
              {earnedRewardPositions.length === 0 && (
                <p className="py-6 text-center text-xs text-white/50">No rewards yet — keep collecting stamps.</p>
              )}
              {earnedRewardPositions.map(pos => {
                const e = entryFor(pos); const rw = REWARDS[pos];
                const status = e?.status || 'pending';
                return (
                  <div key={pos} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2">
                      <Gift className={`h-4 w-4 ${accent}`}/>
                      <div>
                        <p className="text-xs font-bold uppercase">{rw.label}</p>
                        <p className="text-[10px] text-white/50">Stamp #{pos}</p>
                      </div>
                    </div>
                    {status === 'pending' && (
                      <Button size="sm" disabled={busyPos === pos || freeze} onClick={() => claim(pos)} className={accent}>
                        {busyPos === pos ? '…' : 'Claim'}
                      </Button>
                    )}
                    {status === 'claimed' && (
                      <code className="rounded bg-black/50 px-2 py-1 text-[11px] font-mono text-lime-300">{e.code}</code>
                    )}
                    {status === 'used' && <span className="text-[10px] uppercase text-white/40">Used</span>}
                  </div>
                );
              })}
              {err && <p className="text-center text-[11px] text-red-300">{err}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}