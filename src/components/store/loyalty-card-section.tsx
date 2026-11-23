// @ts-nocheck
// LoyaltyCardSection — the real loyalty card on the landing page, with a flip button (Step 12).
// Front: the black VEYNS card. Back: lime (Silver tiers, 4 milestone blocks), grey (Platinum) or cyan (Diamond).
// Data: the same public.get_loyalty_status RPC (and profiles.created_at for "Member since") that store-data.tsx uses;
// the claim buttons call the same RPCs with the same messages. The full Loyalty Card dialog (loyalty-card.tsx) is reused
// for "How this works" / "See all vouchers", so no loyalty logic is duplicated here. No database change.
// Everything on the card is sized in cqw (1% of the card width) so the layout scales like a picture.
// Step 12A: smoother flip (see home-page.css), a shining 'Tap to flip' text instead of the button box, and no stamp counter.
// Step 12B: the text says 'Tap to flip' on touch screens and 'Click to flip' where a mouse is the main input (decided by CSS, see home-page.css).
// Step 5G-3d: the old Loyalty Card pop-up is gone from this card. On phones the back now shows the claimed codes, the Food/Delivery
// choice and a short renew timer; tapping a code copies it. 'How this works' opens a short text under the card instead of a pop-up.
// Step P14-2: milestone rewards are claimed here with a Claim button (under the card), through the same gateway route. A claimed voucher never expires;
// its code is shown under the card (tap to copy) until it is used. The checkout no longer applies a milestone discount by itself.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/my-profile';
import { claimLoyaltyReward, claimPlatinumDiscount as claimPlatinumDiscountApi } from '@/lib/loyalty-claims';
import { copyText } from '@/lib/copy-code';
import { SOCIAL_LINKS, isSafeExternalUrl } from '@/lib/social-links';
import frontImg from '@/assets/loyalty/loyalty-front.webp';
import backSilverImg from '@/assets/loyalty/loyalty-back-silver.webp';
import backPlatinumImg from '@/assets/loyalty/loyalty-back-platinum.webp';
import backDiamondImg from '@/assets/loyalty/loyalty-back-diamond.webp';

// Same tables as loyalty-card.tsx (block sizes and the reward at each milestone stamp).
const BLOCK_SIZES = [5, 10, 15, 5];
const BLOCK_WORDS = ['ONE', 'TWO', 'THREE', 'FOUR'];
const MILESTONES: Record<number, Record<number, string>> = {
  1: { 1: 'WELCOME', 5: '10% OFF' },
  2: { 5: '10% OFF', 10: '25% OFF' },
  3: { 5: '10% OFF', 10: '25% OFF', 15: '50% OFF' },
  4: { 5: 'FREE MEAL' },
};
// Short text that fits inside a stamp circle. WELCOME has no discount, so it stays a plain circle.
const shortLabel = (reward?: string) => (!reward || reward === 'WELCOME' ? null : reward === 'FREE MEAL' ? 'FREE' : reward.replace(' OFF', ''));

const INK = '#0b0b0b';
const LIME = '#a3e635';

// Same rule as StoreData: guests never have loyalty data.
const isGuestUser = (u: any) =>
  !u || u.role === 'guest' || u.type === 'guest' ||
  (u.name && u.name.toLowerCase().includes('guest')) ||
  (u.identifier && u.identifier.toLowerCase().includes('guest'));

const abs = (style: any) => ({ position: 'absolute', boxSizing: 'border-box', ...style });

// ---------------------------------------------------------------- small pieces for the Platinum / Diamond backs
function OrdersPanel({ orders, style, compact }: any) {
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div style={abs({ background: '#060606', borderRadius: '1.4cqw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8cqw', ...style })}>
      <div style={{ position: 'relative', width: compact ? '11cqw' : '10.5cqw', height: compact ? '11cqw' : '10.5cqw' }}>
        <svg viewBox="0 0 80 80" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
          <circle cx="40" cy="40" r={R} fill="none" stroke={orders >= 3 ? LIME : '#e2e8f0'} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - orders / 3)} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <span style={{ fontSize: compact ? '3.6cqw' : '3.8cqw', fontWeight: 900, lineHeight: 1 }}>{orders}</span>
          <span style={{ fontSize: 'max(6px, 1.3cqw)', fontWeight: 700, letterSpacing: '0.08em' }}>ORDERS</span>
        </div>
      </div>
      <span style={{ fontSize: 'max(7px, 1.9cqw)', fontWeight: 700, color: '#e2e8f0' }}>Total orders</span>
    </div>
  );
}

function FreeMealPanel({ state, weekly, onClaim, style, compact }: any) {
  const size = compact ? '11cqw' : '10.5cqw';
  const ring = state === 'unlocked' ? LIME : state === 'claimed' ? '#34d399' : '#475569';
  return (
    <div style={abs({ background: '#060606', borderRadius: '1.4cqw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8cqw', ...style })}>
      <button
        type="button"
        disabled={state !== 'unlocked'}
        onClick={() => weekly?.free_meal_reward_id && onClaim(weekly.free_meal_reward_id)}
        aria-label={state === 'unlocked' ? 'Claim your free meal' : state === 'claimed' ? 'Free meal claimed' : 'Free meal locked'}
        style={{ width: size, height: size, borderRadius: '50%', border: `0.6cqw solid ${ring}`, background: state === 'unlocked' ? 'rgba(163,230,53,0.15)' : 'transparent', color: state === 'unlocked' ? '#bef264' : '#cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: state === 'unlocked' ? 'pointer' : 'default', padding: 0 }}
      >
        <span style={{ fontSize: '3.2cqw', lineHeight: 1 }}>{state === 'unlocked' ? '🎁' : state === 'claimed' ? '✓' : '🔒'}</span>
        <span style={{ fontSize: 'max(6px, 1.3cqw)', fontWeight: 800, marginTop: '0.3cqw' }}>FREE MEAL</span>
      </button>
      <span style={{ fontSize: 'max(7px, 1.6cqw)', fontWeight: 700, color: '#e2e8f0', textAlign: 'center', lineHeight: 1.15, padding: '0 0.8cqw' }}>
        {state === 'unlocked' ? 'Claim your reward!' : state === 'claimed' ? (weekly?.free_meal_used ? 'Voucher used' : weekly?.free_meal_code ? `Code: ${weekly.free_meal_code}` : 'Reward claimed') : 'Order 3× in one week'}
      </span>
    </div>
  );
}

// A claimed code: tapping it copies it (no separate Copy button). Taps here never flip the card (the card ignores buttons).
function TapCode({ code, compact }: any) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<any>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onTap = async (e: any) => {
    e.stopPropagation();
    let ok = false;
    try { ok = await copyText(code); } catch { ok = false; }
    if (!ok) { alert(`Your code: ${code}`); return; } // copying was refused: show the code so it can be typed
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" onClick={onTap} aria-label={`Copy code ${code}`}
      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3cqw', color: '#fff', width: '100%', minWidth: 0 }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: compact ? 'max(10px, 3.3cqw)' : 'max(9px, 2.6cqw)', fontWeight: 900, letterSpacing: '0.06em', wordBreak: 'break-all' }}>{code}</span>
      <span aria-live="polite" style={{ fontSize: compact ? 'max(7px, 2cqw)' : 'max(7px, 1.8cqw)', fontWeight: 800, color: copied ? '#bef264' : '#bae6fd' }}>{copied ? '✓ Copied!' : 'Tap to copy'}</span>
    </button>
  );
}

// Step P14-2: '10%_off' -> '10% OFF', 'free_meal' / 'weekly_free_meal' -> 'FREE MEAL'.
const rewardLabel = (t?: string) => (/free_meal/.test(String(t || '')) ? 'FREE MEAL' : String(t || 'reward').replace(/_/g, ' ').toUpperCase());

// A voucher code under the card: tapping it copies it (same behaviour as the codes on the back of the card).
function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<any>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onTap = async () => {
    let ok = false;
    try { ok = await copyText(code); } catch { ok = false; }
    if (!ok) { alert(`Your code: ${code}`); return; }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" onClick={onTap} aria-label={`Copy code ${code}`} className="cursor-pointer text-left">
      <span className="block font-mono text-sm font-black tracking-wider text-white">{code}</span>
      <span aria-live="polite" className={`block text-[10px] font-bold ${copied ? 'text-lime-300' : 'text-sky-200'}`}>{copied ? '✓ Copied!' : 'Tap to copy'}</span>
    </button>
  );
}

function VoucherCards({ slots, onClaim, target, style, compact }: any) {
  if (!slots.length) return null;
  const card = { background: '#111a07', border: '0.3cqw solid #5f8f1a', borderRadius: '2.4cqw', padding: '1.2cqw', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: compact ? '0.6cqw' : '0.9cqw', minWidth: 0 };
  const small = compact ? 'max(7px, 2.1cqw)' : 'max(7px, 1.7cqw)';
  const foot = compact ? 'max(6px, 1.8cqw)' : 'max(6px, 1.5cqw)';
  return (
    <div style={abs({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? '2cqw' : '1.5cqw', ...style })}>
      {slots.map((sl: any) =>
        sl.kind === 'available' ? (
          <div key={sl.key} style={card}>
            <span style={{ fontSize: compact ? '4.4cqw' : '3.6cqw', fontWeight: 900, color: '#bef264', lineHeight: 1 }}>10% OFF</span>
            <span style={{ fontSize: compact ? 'max(7px, 2.3cqw)' : 'max(7px, 1.9cqw)', color: '#e5e7eb', fontWeight: 600 }}>Ready to claim</span>
            <button type="button" onClick={() => onClaim(target)} style={{ background: '#f1f5f9', color: INK, fontWeight: 800, fontSize: compact ? 'max(8px, 2.8cqw)' : 'max(8px, 2.3cqw)', borderRadius: '1.4cqw', padding: '1cqw 0', cursor: 'pointer' }}>Claim code</button>
          </div>
        ) : sl.kind === 'code' ? (
          <div key={sl.key} style={{ ...card, border: '0.3cqw solid rgba(56,189,248,0.6)', background: '#06131a' }}>
            <span style={{ fontSize: small, fontWeight: 800, color: '#bae6fd', textTransform: 'uppercase' }}>{sl.target === 'delivery' ? 'Delivery fee' : 'Food'} · 10% OFF</span>
            <TapCode code={sl.promo_code} compact={compact} />
            <span style={{ fontSize: foot, color: '#cbd5e1' }}>Type at checkout · single-use</span>
          </div>
        ) : (
          <div key={sl.key} style={{ ...card, border: '0.3cqw solid #475569', background: '#0a0a0a', opacity: 0.85 }}>
            <span style={{ fontSize: small, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{sl.target === 'delivery' ? 'Delivery fee' : 'Food'} · 10% OFF</span>
            <span style={{ fontSize: compact ? '3.6cqw' : '3cqw', fontWeight: 900, color: '#cbd5e1' }}>USED ✓</span>
            <span style={{ fontSize: foot, color: '#94a3b8' }}>Renews Monday</span>
          </div>
        )
      )}
    </div>
  );
}

function RenewBar({ countdown, style, fontSize }: any) {
  return (
    <div style={abs({ background: '#050505', border: '0.3cqw solid rgba(56,189,248,0.4)', borderRadius: '2.2cqw', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2.4cqw', ...style })}>
      <span style={{ fontSize: fontSize || 'max(7px, 1.9cqw)', fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⏱ Renews in</span>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: fontSize ? fontSize : 'max(9px, 3cqw)', fontWeight: 800, color: '#7dd3fc' }}>{countdown}</span>
    </div>
  );
}

// ---------------------------------------------------------------- the section
export function LoyaltyCardSection({ currentUser, orderHistory, onOpenSignUp }: { currentUser?: any; orderHistory?: any[]; onOpenSignUp?: () => void }) {
  const guest = isGuestUser(currentUser);
  const authId = currentUser?.authUserId;
  const canLoad = !!currentUser && !guest && !!authId;
  const nickname = (currentUser?.name || 'Foodie').toString();

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [target, setTarget] = useState<'subtotal' | 'delivery'>('subtotal');
  const [showHow, setShowHow] = useState(false); // the 'How this works' text under the card
  const [claimingId, setClaimingId] = useState<string | null>(null); // the reward being claimed right now (blocks double taps)
  const [now, setNow] = useState(Date.now());
  const [seen, setSeen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const loadStatus = useCallback(async () => {
    if (!canLoad) { setStatus(null); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_loyalty_status', { p_user_id: authId });
      if (error || !data) throw error || new Error('no loyalty data');
      const prof = await fetchMyProfile(); // Step 5D: through the gateway
      // Which of the claimed vouchers were already used (a voucher never expires now, so it stays listed until used).
      let usedCodes: string[] = [];
      const claimedCodes = (data.rewards || []).filter((r: any) => r.status === 'claimed' && r.promo_code).map((r: any) => r.promo_code);
      if (claimedCodes.length > 0) {
        try {
          const { data: promoRows } = await supabase.from('promos').select('code, usage_count').in('code', claimedCodes);
          usedCodes = (promoRows || []).filter((p: any) => (p.usage_count || 0) > 0).map((p: any) => String(p.code).toUpperCase());
        } catch { usedCodes = []; }
      }
      if (!alive.current) return;
      setStatus({ ...data, member_since: prof?.created_at || null, used_codes: usedCodes });
      setLoadError(false);
    } catch (e) {
      console.error('Loyalty card load failed:', e);
      if (alive.current) setLoadError(true);
    }
    if (alive.current) setLoading(false);
  }, [canLoad, authId]);

  // Load on arrival and after the customer places an order.
  useEffect(() => { void loadStatus(); }, [loadStatus, orderHistory?.length]);
  // Staff complete orders while the page is open: refresh when the customer comes back to this tab.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void loadStatus(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadStatus]);

  // Fade in when the section first scrolls into view (same idea as the other sections).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ---- what the card shows
  const tier = status?.tier || 'SILVER';
  const isDiamond = tier === 'DIAMOND';
  const isPlatinum = tier === 'PLATINUM';
  const isPlatDia = isPlatinum || isDiamond;
  const block = Math.min(status?.block || 1, 4);
  const size = BLOCK_SIZES[block - 1] || 5;
  const pos = status?.position_in_block || 0;
  const weekly = status?.weekly;
  const ordersThisWeek = Math.min(weekly?.qualifying_orders || 0, 3);
  const fmState: string = weekly?.free_meal_state || 'locked';

  // The renew countdown only ticks while the back is on screen.
  useEffect(() => {
    if (!(isPlatDia && flipped)) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isPlatDia, flipped]);

  const resetAt = weekly?.next_reset_at ? new Date(weekly.next_reset_at).getTime() : null;
  const msLeft = resetAt ? Math.max(0, resetAt - now) : 0;
  const d = Math.floor(msLeft / 86400000), h = Math.floor((msLeft % 86400000) / 3600000), m = Math.floor((msLeft % 3600000) / 60000), s = Math.floor((msLeft % 60000) / 1000);
  const countdown = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  const shortCountdown = `${d}d ${h}h ${m}m`; // phones: no seconds, so it fits
  const voucherSlots: any[] = [
    ...((weekly?.slots || []).map((sl: any, i: number) => ({ ...sl, kind: sl.used ? 'used' : 'code', key: 's' + i }))),
    ...Array.from({ length: Math.max(0, weekly?.claims_remaining || 0) }).map((_, i) => ({ kind: 'available', key: 'a' + i })),
  ];

  // ---- rewards under the card (Step P14-2): rewards to claim, and claimed vouchers not used yet
  const wallet: any[] = status?.rewards || [];
  const usedSet = new Set<string>(status?.used_codes || []);
  const rewardsToClaim = wallet.filter((r: any) => r.status === 'unclaimed' && r.reward_type !== 'weekly_free_meal'); // the Platinum free meal has its own gift circle
  const myVouchers = wallet.filter((r: any) => r.status === 'claimed' && r.promo_code && !usedSet.has(String(r.promo_code).toUpperCase()));

  // ---- claims: through the gateway (Step 5G-3), same messages as store-data.tsx
  const refreshVouchers = () => { try { window.dispatchEvent(new Event('storage')); } catch { /* checkout list also refreshes by itself */ } };
  const claimReward = async (rewardId: string) => {
    if (claimingId) return;
    setClaimingId(rewardId);
    try {
      const { data, error } = await claimLoyaltyReward(rewardId);
      if (error || !data?.success) { alert(error?.message || data?.message || 'Unable to claim reward.'); return; }
      alert(`Reward claimed! Voucher code: ${data.promo_code} (single-use, never expires). Use it on your next order: tap the code under your card to copy it, then type it at checkout.`);
      await loadStatus();
      refreshVouchers();
    } finally {
      if (alive.current) setClaimingId(null);
    }
  };
  const claimPlatinumDiscount = async (t: 'subtotal' | 'delivery' = 'subtotal') => {
    const { data, error } = await claimPlatinumDiscountApi(t); // the helper, renamed on import so it is not this function itself
    if (error || !data?.success) { alert(error?.message || data?.message || 'No 10% voucher left this week.'); return; }
    alert(`Your Platinum 10% code for ${data.target === 'delivery' ? 'DELIVERY FEE' : 'FOOD'}: ${data.promo_code} — single-use, valid until Monday 12:00 AM (${data.claims_remaining} voucher(s) left this week).`);
    await loadStatus();
    refreshVouchers();
  };

  // ---- flipping: the button, or a tap on the card (taps on buttons and links inside do not flip)
  const canFlip = !guest && !!currentUser; // guests see the front only
  const onCardClick = (e: any) => {
    if (!canFlip) return;
    if (e.target?.closest && e.target.closest('button, a')) return;
    setFlipped((f) => !f);
  };

  const backImg = isDiamond ? backDiamondImg : isPlatinum ? backPlatinumImg : backSilverImg;
  const social = (id: string) => SOCIAL_LINKS.find((l) => l.id === id && isSafeExternalUrl(l.url));
  const fb = social('facebook');
  const ig = social('instagram');
  // Invisible link areas over the Facebook and Instagram icons that are part of the front picture.
  const hot = (left: string) => ({ position: 'absolute', left, top: '51.5cqw', width: '5.2cqw', height: '7.5cqw', display: 'block' });

  // ---- the lime back: title, nickname and the stamp circles
  const rows = Math.ceil(size / 5);
  const dia = size === 5 ? 8.5 : size === 10 ? 7.5 : 6.5;
  const gap = size === 5 ? 5.5 : size === 10 ? 6.5 : 7.5;
  const rowTops = size === 5 ? [41.5] : size === 10 ? [37.5, 48] : [35, 44.5, 54];
  const silverBack = (
    <>
      <div className="font-display" style={abs({ left: '11cqw', top: '12.6cqw', fontSize: block === 3 ? '6.4cqw' : '7.5cqw', lineHeight: 0.82, letterSpacing: '-0.045em', fontWeight: 800, color: INK })}>
        MILESTONE<br />BLOCK {BLOCK_WORDS[block - 1]}
      </div>
      <p style={abs({ left: '7.2cqw', top: '28.4cqw', margin: 0, maxWidth: '42cqw', fontSize: 'max(10px, 2.55cqw)', fontWeight: 700, letterSpacing: '-0.02em', color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>
        Nickname: {nickname}
      </p>
      <div role="img" aria-label={`Stamps this block: ${Math.min(pos, size)} of ${size}`}>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={abs({ left: 0, right: 0, top: `${rowTops[r]}cqw`, display: 'flex', justifyContent: 'center', gap: `${gap}cqw` })}>
            {Array.from({ length: 5 }).map((__, c) => {
              const num = r * 5 + c + 1;
              if (num > size) return null;
              const stamped = num <= pos;
              const label = shortLabel(MILESTONES[block]?.[num]);
              return (
                <div key={num} style={{ width: `${dia}cqw`, height: `${dia}cqw`, borderRadius: '50%', border: `0.55cqw solid ${INK}`, background: stamped ? INK : label ? 'rgba(0,0,0,0.14)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: `${dia * 0.34}cqw`, color: stamped ? LIME : INK }}>
                  {stamped ? (label ? label : <Star style={{ width: `${dia * 0.5}cqw`, height: `${dia * 0.5}cqw`, fill: LIME, color: LIME }} />) : label}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );

  // ---- the grey (Platinum) and cyan (Diamond) backs: full layout (card wide enough) and compact layout (phones)
  const tierWord = isDiamond ? 'DIAMOND' : 'PLATINUM';
  const titleStyle = { fontSize: '7.5cqw', lineHeight: 0.85, letterSpacing: '-0.045em', fontWeight: 800, color: INK };
  const useOnAt = (left: string, top: string, big?: boolean) => (
    <div style={abs({ left, top, display: 'flex', alignItems: 'center', gap: '0.6cqw' })}>
      <span style={{ fontSize: big ? '2.9cqw' : '2.3cqw', fontWeight: 800, color: INK, letterSpacing: '-0.02em', marginRight: '0.4cqw' }}>Use on:</span>
      {[['subtotal', 'Food'], ['delivery', 'Delivery']].map(([key, label]) => (
        <button key={key} type="button" onClick={() => setTarget(key)} aria-pressed={target === key}
          style={{ fontSize: big ? '2.7cqw' : '2.2cqw', fontWeight: 800, textTransform: 'uppercase', color: target === key ? '#fff' : INK, background: target === key ? INK : 'transparent', borderRadius: '99px', padding: big ? '0.6cqw 1.5cqw' : '0.4cqw 1.1cqw', cursor: 'pointer' }}>{label}</button>
      ))}
    </div>
  );
  const platDiaBack = (
    <>
      {/* full layout */}
      <div className="veyns-lc-full">
        <div className="font-display" style={abs({ left: '11.5cqw', top: '12cqw', ...titleStyle })}>{tierWord}</div>
        <p style={abs({ left: '11.5cqw', top: '20.5cqw', margin: 0, maxWidth: '36cqw', fontSize: 'max(9px, 2.3cqw)', fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>Nickname: {nickname}</p>
        {isPlatinum ? (
          <>
            <OrdersPanel orders={ordersThisWeek} style={{ left: '51.2cqw', top: '9.9cqw', width: '16.2cqw', height: '17.6cqw' }} />
            <FreeMealPanel state={fmState} weekly={weekly} onClaim={claimReward} style={{ left: '69.2cqw', top: '9.9cqw', width: '16.2cqw', height: '17.6cqw' }} />
          </>
        ) : (
          <p style={abs({ left: '51.2cqw', top: '10.5cqw', width: '34.2cqw', margin: 0, fontSize: 'max(8px, 2cqw)', fontStyle: 'italic', lineHeight: 1.35, color: '#08303a' })}>
            “Thank you for being a founder of our story. This card is our handshake — no quotas, no counters, just our gratitude.”
          </p>
        )}
        {weekly && (
          <>
            {useOnAt('14.6cqw', '25.2cqw')}
            <VoucherCards slots={voucherSlots} onClaim={claimPlatinumDiscount} target={target} style={{ left: '14.6cqw', top: '30.1cqw', width: '70.8cqw', height: '17.7cqw' }} />
            <RenewBar countdown={countdown} style={{ left: '14.6cqw', top: '48.8cqw', width: '70.8cqw', height: '7.9cqw' }} />
          </>
        )}
      </div>
      {/* compact layout (phones) */}
      <div className="veyns-lc-compact">
        <div className="font-display" style={abs({ left: '7cqw', top: '9cqw', ...titleStyle, fontSize: '8cqw' })}>{tierWord}</div>
        <p style={abs({ left: '7cqw', top: '19.5cqw', margin: 0, maxWidth: '40cqw', fontSize: 'max(9px, 3cqw)', fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>Nickname: {nickname}</p>
        {isPlatinum && (
          <>
            <OrdersPanel compact orders={ordersThisWeek} style={{ left: '52cqw', top: '7cqw', width: '20cqw', height: '24cqw' }} />
            <FreeMealPanel compact state={fmState} weekly={weekly} onClaim={claimReward} style={{ left: '74cqw', top: '7cqw', width: '20cqw', height: '24cqw' }} />
          </>
        )}
        {weekly && (
          <>
            {useOnAt('7cqw', '24.6cqw', true)}
            <VoucherCards compact slots={voucherSlots} onClaim={claimPlatinumDiscount} target={target} style={{ left: '7cqw', top: '32.5cqw', width: '86cqw', height: '17cqw' }} />
            <RenewBar countdown={shortCountdown} fontSize="max(9px, 3.2cqw)" style={{ left: '7cqw', top: '51.5cqw', width: '86cqw', height: '7cqw' }} />
          </>
        )}
      </div>
    </>
  );

  const memberSince = status?.member_since
    ? `Member since ${new Date(status.member_since).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}`
    : 'VEYNS. member';

  return (
    <section
      id="home-loyalty"
      ref={sectionRef}
      aria-label="Loyalty card"
      className={`veyns-fullscreen veyns-lc-section relative overflow-hidden bg-[#03120d] px-4 py-10 transition-opacity duration-700 motion-reduce:transition-none ${seen ? 'opacity-100' : 'opacity-0'}`}
    >
      <h2 className="mx-auto mb-5 text-center font-display text-4xl font-medium uppercase tracking-tight text-white sm:mb-7 sm:text-5xl">Loyalty card</h2>

      <div className="veyns-lc-wrap mx-auto w-full">
        {/* The card: container for the cqw sizes; the flip itself is pure CSS (home-page.css). */}
        <div className="veyns-lc-card" role="group" aria-label={flipped ? 'Loyalty card, back' : 'Loyalty card, front'} onClick={onCardClick} style={{ cursor: canFlip ? 'pointer' : 'default' }}>
          <div className={`veyns-flip ${flipped ? 'veyns-flipped' : ''}`}>
            <div className="veyns-flip-inner">
              <div className="veyns-flip-face veyns-flip-front">
                <img src={frontImg} alt="VEYNS loyalty card" width={1029} height={660} draggable={false} className="h-full w-full select-none object-cover" />
                {fb && <a href={fb.url} target="_blank" rel="noopener noreferrer" aria-label="VEYNS on Facebook" style={hot('6cqw')} />}
                {ig && <a href={ig.url} target="_blank" rel="noopener noreferrer" aria-label="VEYNS on Instagram" style={hot('11.5cqw')} />}
              </div>
              <div className="veyns-flip-face veyns-flip-back">
                <img src={backImg} alt="" width={1029} height={660} draggable={false} className="h-full w-full select-none object-cover" />
                <div style={{ position: 'absolute', inset: 0 }}>{isPlatDia ? platDiaBack : silverBack}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Under the card */}
        {guest || !currentUser ? (
          <div className="mt-4 flex items-center justify-between gap-3 px-1">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-200">
              <CreditCard className="size-4 text-lime-400" /> Create an account to start collecting stamps
            </span>
            <button type="button" onClick={() => onOpenSignUp && onOpenSignUp()} className="cursor-pointer font-display text-sm font-extrabold uppercase tracking-tight text-white hover:text-lime-300">Sign up</button>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-200">
                <CreditCard className="size-4 shrink-0 text-lime-400" /> {memberSince}
              </span>
              <button type="button" onClick={() => setShowHow((v) => !v)} aria-expanded={showHow} className="cursor-pointer font-display text-sm font-extrabold uppercase tracking-tight text-white hover:text-lime-300">How this works</button>
            </div>
            {showHow && (
              <div role="region" aria-label="How the loyalty card works" className="mt-3 space-y-1.5 rounded-2xl border border-emerald-800/60 bg-[#061c16] p-3 text-[12px] leading-snug text-emerald-100">
                <p className="font-extrabold uppercase tracking-wide text-lime-400">How it works</p>
                {isPlatinum && <p>• 2-week Platinum trial — afterwards you return to Block 2 and can climb back to Platinum anytime.</p>}
                {isPlatDia && <p>• 2× single-use 10% OFF codes per week (food or delivery fee). They renew every Monday 12:00 AM Manila time and never stack. Tap a code to copy it, then type it at checkout.</p>}
                {isPlatinum && <p>• FREE MEAL: order 3 times within a week to unlock a one-time voucher, then tap the gift circle to claim it.</p>}
                {!isPlatDia && <p>• Fill the circles on your card. Milestone circles earn a reward: 10% OFF, 25% OFF, 50% OFF or a FREE MEAL.</p>}
                {!isPlatDia && <p>• When your order is completed and you reach a milestone, tap Claim under the card. The card moves on to the next milestone right away.</p>}
                {!isPlatDia && <p>• A claimed voucher is single-use and never expires. Use it on your next order: tap the code to copy it, then type it at checkout.</p>}
              </div>
            )}
            {(rewardsToClaim.length > 0 || myVouchers.length > 0) && (
              <div role="region" aria-label="Your rewards" className="mt-3 space-y-2 rounded-2xl border border-lime-400/30 bg-[#061c16] p-3 text-[12px] text-emerald-100">
                <p className="font-extrabold uppercase tracking-wide text-lime-400">Your rewards</p>
                {rewardsToClaim.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-lime-400/40 bg-[#0a2a1f] p-2.5">
                    <div>
                      <p className="text-base font-black leading-none text-lime-300">{rewardLabel(r.reward_type)}</p>
                      <p className="mt-1 text-[10px] text-emerald-200">Ready to claim · never expires</p>
                    </div>
                    <button type="button" disabled={claimingId === r.id} onClick={() => void claimReward(r.id)}
                      className="cursor-pointer rounded-lg bg-lime-400 px-4 py-2 text-[11px] font-extrabold text-black hover:bg-lime-300 disabled:cursor-wait disabled:opacity-60">
                      {claimingId === r.id ? 'Claiming…' : 'Claim'}
                    </button>
                  </div>
                ))}
                {myVouchers.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-sky-400/40 bg-[#06131a] p-2.5">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-sky-200">{rewardLabel(r.reward_type)} · single-use</p>
                      <CodeChip code={r.promo_code} />
                    </div>
                    <p className="text-right text-[10px] leading-snug text-slate-300">Never expires<br />Use on your next order</p>
                  </div>
                ))}
              </div>
            )}
            {loadError && (
              <p role="status" className="mt-2 px-1 text-[11px] text-amber-300">
                Couldn’t load your stamps. <button type="button" onClick={() => void loadStatus()} className="cursor-pointer font-bold underline">Try again</button>
              </p>
            )}
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                aria-label={flipped ? 'Flip card to the front' : 'Flip card to the back'}
                className="veyns-silver-shine cursor-pointer select-none bg-transparent px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.3em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-sm"
              >
                <span className="veyns-label-touch">Tap to flip</span>
                <span className="veyns-label-mouse">Click to flip</span>
              </button>
            </div>
          </>
        )}
      </div>

    </section>
  );
}
