// Delivery fee calculations for the admin Delivery Fee screen (no screen code).
// Step B11a: new file. LIVE_RULE and the store coordinates are a copy of what the database does today in
// private.delivery_fee_from_coords (free under 1 km, 40 up to 2 km, then 40 + 5 for each started extra km).
// Checkout still uses the database function; this file only lets the screen simulate and compare rules.

export const STORE_LAT = 10.359511; // same as the database function and the customer checkout
export const STORE_LNG = 123.952739;
const EARTH_KM = 6371;

export type FeeRule = {
  freeKm: number;          // under this distance the delivery is free
  baseFare: number;        // fee from the free radius up to baseUpperKm
  baseUpperKm: number;     // last distance (inclusive) that pays only the base fare
  perKmRate: number;       // added for each started km beyond baseUpperKm
  distanceStep: number;    // 0 = exact; 0.5 or 1 = distance is rounded UP to this step (draft only)
  feeStep: number;         // 0 = exact; 1, 5 or 10 = fee is rounded UP to this step (draft only)
  maxRadiusOn: boolean;    // draft only: no delivery beyond maxRadiusKm
  maxRadiusKm: number;
  capOn: boolean;          // draft only: the fee never goes above capAmount
  capAmount: number;
  minOrderOn: boolean;     // draft only: no delivery for orders below minOrderAmount
  minOrderAmount: number;
  surchargeOn: boolean;    // draft only: fixed amount added to every delivery that already has a fee
  surchargeAmount: number;
};

// The rule the database applies today. The "draft only" options are all off.
export const LIVE_RULE: FeeRule = {
  freeKm: 1, baseFare: 40, baseUpperKm: 2, perKmRate: 5,
  distanceStep: 0, feeStep: 0,
  maxRadiusOn: false, maxRadiusKm: 12,
  capOn: false, capAmount: 120,
  minOrderOn: false, minOrderAmount: 200,
  surchargeOn: false, surchargeAmount: 10,
};

// ---------------------------------------------------------------------------
// Rule limits and clean-up (used for the sliders, for saved scenarios and for Reset)
// ---------------------------------------------------------------------------
export const RULE_LIMITS = {
  freeKm: { min: 0, max: 5, step: 0.1 },
  baseFare: { min: 0, max: 300, step: 1 },
  baseUpperKm: { min: 0, max: 10, step: 0.1 },
  perKmRate: { min: 0, max: 100, step: 1 },
  maxRadiusKm: { min: 1, max: 30, step: 0.5 },
  capAmount: { min: 0, max: 1000, step: 1 },
  minOrderAmount: { min: 0, max: 5000, step: 10 },
  surchargeAmount: { min: 0, max: 200, step: 1 },
};
export const DISTANCE_STEPS = [0, 0.5, 1];
export const FEE_STEPS = [0, 1, 5, 10];

const clampTo = (value: unknown, min: number, max: number, step: number, fallback: number): number => {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return fallback;
  const snapped = Math.round(Math.min(max, Math.max(min, n)) / step) * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(2));
};
const pickFrom = (value: unknown, allowed: number[], fallback: number): number => {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return allowed.includes(n) ? n : fallback;
};

export const normalizeRule = (input: any): FeeRule => {
  const r = input && typeof input === 'object' ? input : {};
  const L = RULE_LIMITS;
  const freeKm = clampTo(r.freeKm, L.freeKm.min, L.freeKm.max, L.freeKm.step, LIVE_RULE.freeKm);
  return {
    freeKm,
    baseFare: clampTo(r.baseFare, L.baseFare.min, L.baseFare.max, L.baseFare.step, LIVE_RULE.baseFare),
    baseUpperKm: clampTo(r.baseUpperKm, Math.max(L.baseUpperKm.min, freeKm), L.baseUpperKm.max, L.baseUpperKm.step, Math.max(freeKm, LIVE_RULE.baseUpperKm)),
    perKmRate: clampTo(r.perKmRate, L.perKmRate.min, L.perKmRate.max, L.perKmRate.step, LIVE_RULE.perKmRate),
    distanceStep: pickFrom(r.distanceStep, DISTANCE_STEPS, 0),
    feeStep: pickFrom(r.feeStep, FEE_STEPS, 0),
    maxRadiusOn: r.maxRadiusOn === true,
    maxRadiusKm: clampTo(r.maxRadiusKm, L.maxRadiusKm.min, L.maxRadiusKm.max, L.maxRadiusKm.step, LIVE_RULE.maxRadiusKm),
    capOn: r.capOn === true,
    capAmount: clampTo(r.capAmount, L.capAmount.min, L.capAmount.max, L.capAmount.step, LIVE_RULE.capAmount),
    minOrderOn: r.minOrderOn === true,
    minOrderAmount: clampTo(r.minOrderAmount, L.minOrderAmount.min, L.minOrderAmount.max, L.minOrderAmount.step, LIVE_RULE.minOrderAmount),
    surchargeOn: r.surchargeOn === true,
    surchargeAmount: clampTo(r.surchargeAmount, L.surchargeAmount.min, L.surchargeAmount.max, L.surchargeAmount.step, LIVE_RULE.surchargeAmount),
  };
};

export const rulesDiffer = (a: FeeRule, b: FeeRule): boolean => JSON.stringify(normalizeRule(a)) !== JSON.stringify(normalizeRule(b));

// ---------------------------------------------------------------------------
// Distance (same formula as the database function)
// ---------------------------------------------------------------------------
const rad = (d: number): number => (d * Math.PI) / 180;

export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const distanceFromStoreKm = (lat: number, lng: number): number => haversineKm(STORE_LAT, STORE_LNG, lat, lng);

// Direction from the store to a point, in degrees (0 = north, 90 = east)
export const bearingFromStore = (lat: number, lng: number): number => {
  const f1 = rad(STORE_LAT);
  const f2 = rad(lat);
  const dl = rad(lng - STORE_LNG);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

// The point that is `km` away from the store in the direction `bearing`
export const pointFromStore = (bearing: number, km: number): { lat: number; lng: number } => {
  const f1 = rad(STORE_LAT);
  const l1 = rad(STORE_LNG);
  const t = rad(bearing);
  const d = km / EARTH_KM;
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
  return { lat: (f2 * 180) / Math.PI, lng: (((l2 * 180) / Math.PI + 540) % 360) - 180 };
};

// ---------------------------------------------------------------------------
// The fee of one delivery
// ---------------------------------------------------------------------------
export type FeeZone = 'free' | 'base' | 'perkm';
export type FeeRejection = 'radius' | 'minimum' | null;
export type FeeResult = {
  rawKm: number;
  km: number;            // distance after the distance rounding
  zone: FeeZone;
  rejected: FeeRejection;
  baseFare: number;      // base fare charged (0 in the free zone)
  extraKm: number;       // started km beyond baseUpperKm
  extraFee: number;
  surcharge: number;
  roundingAdj: number;   // what the fee rounding added
  capAdj: number;        // what the cap took off (0 or negative)
  fee: number | null;    // null when the delivery is not accepted
};

export const computeFee = (rule: FeeRule, rawKm: number, subtotal: number): FeeResult => {
  const km = rule.distanceStep > 0 ? Math.ceil(rawKm / rule.distanceStep - 1e-9) * rule.distanceStep : rawKm;
  const zone: FeeZone = km < rule.freeKm ? 'free' : km <= rule.baseUpperKm ? 'base' : 'perkm';
  const baseFare = zone === 'free' ? 0 : rule.baseFare;
  const extraKm = zone === 'perkm' ? Math.ceil(km - rule.baseUpperKm) : 0;
  const extraFee = extraKm * rule.perKmRate;
  const preSurcharge = baseFare + extraFee;
  const surcharge = rule.surchargeOn && preSurcharge > 0 ? rule.surchargeAmount : 0;
  const before = preSurcharge + surcharge;
  const rounded = rule.feeStep > 0 ? Math.ceil(before / rule.feeStep - 1e-9) * rule.feeStep : before;
  const capped = rule.capOn ? Math.min(rounded, rule.capAmount) : rounded;
  const rejected: FeeRejection = rule.maxRadiusOn && km > rule.maxRadiusKm ? 'radius' : rule.minOrderOn && subtotal < rule.minOrderAmount ? 'minimum' : null;
  return { rawKm, km, zone, rejected, baseFare, extraKm, extraFee, surcharge, roundingAdj: rounded - before, capAdj: capped - rounded, fee: rejected ? null : capped };
};

// ---------------------------------------------------------------------------
// The curve for the Fee Curve chart (distance on the x axis; the minimum order does not matter here)
// ---------------------------------------------------------------------------
export type CurvePoint = { km: number; fee: number | null; zone: FeeZone };

export const buildCurve = (rule: FeeRule, maxKm: number, stepKm: number = 0.02): CurvePoint[] => {
  const points: CurvePoint[] = [];
  const count = Math.round(maxKm / stepKm);
  for (let i = 0; i <= count; i++) {
    const km = Number((i * stepKm).toFixed(4));
    const r = computeFee(rule, km, Number.POSITIVE_INFINITY);
    points.push({ km, fee: r.fee, zone: r.zone });
  }
  return points;
};

// ---------------------------------------------------------------------------
// Impact on real orders: delivery orders of the last `days` days that have a map pin
// ---------------------------------------------------------------------------
export type EligibleOrder = { order: any; rawKm: number };

export const eligibleOrders = (orders: any[], nowMs: number, days: number): { rows: EligibleOrder[]; withoutPin: number } => {
  const since = nowMs - days * 86400000;
  const rows: EligibleOrder[] = [];
  let withoutPin = 0;
  for (const o of orders || []) {
    if ((o.fulfillment || 'delivery') !== 'delivery') continue;
    const status = String(o.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled') continue;
    const created = Date.parse(o.createdAt || '');
    if (!Number.isFinite(created) || created < since || created > nowMs + 86400000) continue;
    const lat = Number(o.pinLat);
    const lng = Number(o.pinLng);
    if (o.pinLat === null || o.pinLat === undefined || o.pinLng === null || o.pinLng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      withoutPin += 1;
      continue;
    }
    rows.push({ order: o, rawKm: distanceFromStoreKm(lat, lng) });
  }
  return { rows, withoutPin };
};

export type BandStat = { orders: number; revenue: number };
export type FeeAnalysis = {
  windowDays: number;
  analyzed: number;
  withoutPin: number;
  liveRevenue: number;
  draftRevenue: number;
  revenueDelta: number;
  revenueDeltaPct: number | null;
  liveFree: number;
  draftFree: number;
  liveFreePct: number;
  draftFreePct: number;
  rejected: number;
  rejectedPct: number;
  liveAvg: number;
  draftAvg: number;
  bands: { free: BandStat; base: BandStat; perkm: BandStat; rejected: number };
};

export const analyzeOrders = (orders: any[], draft: FeeRule, live: FeeRule, nowMs: number, days: number): FeeAnalysis => {
  const { rows, withoutPin } = eligibleOrders(orders, nowMs, days);
  const a: FeeAnalysis = {
    windowDays: days, analyzed: rows.length, withoutPin,
    liveRevenue: 0, draftRevenue: 0, revenueDelta: 0, revenueDeltaPct: null,
    liveFree: 0, draftFree: 0, liveFreePct: 0, draftFreePct: 0,
    rejected: 0, rejectedPct: 0, liveAvg: 0, draftAvg: 0,
    bands: { free: { orders: 0, revenue: 0 }, base: { orders: 0, revenue: 0 }, perkm: { orders: 0, revenue: 0 }, rejected: 0 },
  };
  let liveAccepted = 0;
  let draftAccepted = 0;
  for (const { order, rawKm } of rows) {
    const subtotal = Number(order.subtotal || 0);
    const l = computeFee(live, rawKm, subtotal);
    const d = computeFee(draft, rawKm, subtotal);
    if (l.fee !== null) {
      liveAccepted += 1;
      a.liveRevenue += l.fee;
      if (l.fee === 0) a.liveFree += 1;
    }
    if (d.fee === null) {
      a.rejected += 1;
      a.bands.rejected += 1;
    } else {
      draftAccepted += 1;
      a.draftRevenue += d.fee;
      if (d.fee === 0) a.draftFree += 1;
      a.bands[d.zone].orders += 1;
      a.bands[d.zone].revenue += d.fee;
    }
  }
  a.revenueDelta = a.draftRevenue - a.liveRevenue;
  a.revenueDeltaPct = a.liveRevenue > 0 ? (a.revenueDelta / a.liveRevenue) * 100 : null;
  a.liveFreePct = a.analyzed > 0 ? (a.liveFree / a.analyzed) * 100 : 0;
  a.draftFreePct = a.analyzed > 0 ? (a.draftFree / a.analyzed) * 100 : 0;
  a.rejectedPct = a.analyzed > 0 ? (a.rejected / a.analyzed) * 100 : 0;
  a.liveAvg = liveAccepted > 0 ? a.liveRevenue / liveAccepted : 0;
  a.draftAvg = draftAccepted > 0 ? a.draftRevenue / draftAccepted : 0;
  return a;
};

export const formatPeso = (n: number): string => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
export const formatKm = (n: number): string => `${Number(n.toFixed(2))} km`;
