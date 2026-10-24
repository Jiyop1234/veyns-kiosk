// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ShieldAlert, Crown, Gem, Sparkles, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const TIERS = [
  { v: 'silver',   label: 'Silver (Journey)', Icon: Sparkles },
  { v: 'platinum', label: 'Platinum (VIP)',   Icon: Crown },
  { v: 'diamond',  label: 'Diamond (Inner Circle)', Icon: Gem },
];

export default function LoyaltyManager({ profile, onSaved }) {
  const [life, setLife] = useState(1);
  const [tier, setTier] = useState('silver');
  const [freeze, setFreeze] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const ld = profile?.loyalty_data || {};
    setLife(Math.min(Math.max(parseInt(ld.lifetime || 1, 10) || 1, 1), 59));
    setTier(ld.tier || 'silver');
    setFreeze(!!ld.freeze);
    setRewards(Array.isArray(ld.rewards) ? ld.rewards : []);
    setMsg('');
  }, [profile]);

  const apply = async (patch) => {
    if (!profile?.id) return;
    setBusy(true); setMsg('');
    const { data, error } = await supabase.rpc('adjust_veyns_loyalty_admin', {
      p_profile_id: profile.id,
      p_lifetime: patch.lifetime ?? null,
      p_freeze:   patch.freeze   ?? null,
      p_tier:     patch.tier     ?? null,
    });
    if (error) setMsg('Error: ' + error.message);
    else {
      const ld = data?.loyalty || {};
      setLife(Math.min(Math.max(parseInt(ld.lifetime || life, 10) || life, 1), 59));
      setTier(ld.tier || tier); setFreeze(!!ld.freeze);
      setRewards(Array.isArray(ld.rewards) ? ld.rewards : []);
      setMsg('Saved.'); if (onSaved) onSaved();
    }
    setBusy(false);
  };

  if (!profile) return <p className="text-xs text-emerald-300/60">Select a customer to manage their card.</p>;

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-800/60 bg-[#041913] p-4 text-emerald-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-lime-400">{profile.name || 'Customer'}</p>
          <p className="font-mono text-[11px] text-emerald-300/70">{profile.identifier}</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase">
          {tier}
        </span>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300/70">Lifetime stamps (1–59)</p>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" disabled={busy} onClick={() => apply({ lifetime: life - 1 })}><Minus className="h-4 w-4"/></Button>
          <input type="number" min={1} max={59} value={life} onChange={e => setLife(parseInt(e.target.value || '1', 10))}
            className="w-20 rounded-xl border border-emerald-800 bg-black/40 px-3 py-2 text-center font-mono" />
          <Button size="icon" variant="outline" disabled={busy} onClick={() => apply({ lifetime: life + 1 })}><Plus className="h-4 w-4"/></Button>
          <Button size="sm" disabled={busy} onClick={() => apply({ lifetime: life })}>Apply</Button>
        </div>
        <p className="mt-1 text-[10px] text-emerald-300/50">Adding past a milestone arms its reward; removing below an unclaimed milestone drops it.</p>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300/70">Tier</p>
        <div className="flex flex-wrap gap-2">
          {TIERS.map(({ v, label, Icon }) => (
            <Button key={v} size="sm" variant={tier === v ? 'default' : 'outline'} disabled={busy}
              className={tier === v ? 'bg-emerald-500 text-black' : ''} onClick={() => apply({ tier: v })}>
              <Icon className="mr-1 h-3.5 w-3.5"/> {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase">
          <ShieldAlert className="h-4 w-4 text-red-400"/> Suspend stamping
        </div>
        <Button size="sm" variant={freeze ? 'destructive' : 'outline'} disabled={busy} onClick={() => apply({ freeze: !freeze })}>
          {freeze ? 'Suspended — tap to lift' : 'Active — tap to suspend'}
        </Button>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300/70">Rewards ({rewards.length})</p>
        <div className="max-h-32 space-y-1 overflow-auto text-[11px]">
          {rewards.length === 0 && <p className="text-emerald-300/40">None yet.</p>}
          {rewards.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-black/30 px-2 py-1">
              <span>Stamp #{r.pos} · {r.type === 'free_meal' ? 'Free Meal' : r.value + '%'} </span>
              <span className={r.status === 'pending' ? 'text-amber-300' : r.status === 'claimed' ? 'text-lime-300' : 'text-white/40'}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>

      {msg && <p className={`text-center text-[11px] ${msg.startsWith('Error') ? 'text-red-300' : 'text-lime-300'}`}>{msg}</p>}
    </div>
  );
}