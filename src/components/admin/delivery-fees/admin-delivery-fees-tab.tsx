// @ts-nocheck
// Admin Delivery Fee tab: the Fare Lab (map, estimate, simulator, fee curve, rate ladder, impact preview, fare rules, test scenarios).
// Step B11a: new file. This screen is a simulator: the rules you change are a draft that only exists here (and in scenarios saved in this browser).
// Nothing is published: checkout and the database keep using the live rule (free under 1 km, 40 up to 2 km, then 40 + 5 per started km).
// The only database call is a read-only fee preview (admin_preview_delivery_fee) used by "Check live fee with the database".
// The tab body shows only when `active` is true, but this component stays mounted, so the draft rule, the pin and the scenarios are kept when you switch tabs.
import { useState, useMemo } from 'react';
import { Truck, RotateCcw, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  LIVE_RULE, normalizeRule, rulesDiffer, computeFee, analyzeOrders, distanceFromStoreKm, bearingFromStore, pointFromStore, formatPeso,
} from '@/components/admin/delivery-fees/admin-delivery-fee-math';
import { loadScenarios, saveScenarios, newScenarioId, MAX_SCENARIOS } from '@/components/admin/delivery-fees/admin-delivery-fee-scenarios';
import { rulesJson, comparisonCsv, downloadTextFile } from '@/components/admin/delivery-fees/admin-delivery-fee-export';
import { AdminDeliveryFeeMap } from '@/components/admin/delivery-fees/admin-delivery-fee-map';
import { AdminDeliveryFeeCurve } from '@/components/admin/delivery-fees/admin-delivery-fee-curve';
import { AdminDeliveryFeeLadder } from '@/components/admin/delivery-fees/admin-delivery-fee-ladder';
import { AdminDeliveryFeeEstimate } from '@/components/admin/delivery-fees/admin-delivery-fee-estimate';
import { AdminDeliveryFeeSimulator } from '@/components/admin/delivery-fees/admin-delivery-fee-simulator';
import { AdminDeliveryFeeImpact } from '@/components/admin/delivery-fees/admin-delivery-fee-impact';
import { AdminDeliveryFeeRulesPanel } from '@/components/admin/delivery-fees/admin-delivery-fee-rules-panel';
import { AdminDeliveryFeeScenariosPanel } from '@/components/admin/delivery-fees/admin-delivery-fee-scenarios-panel';

const DB_IDLE = { status: 'idle', text: '', match: false };
const START_BEARING = 45;
const START_KM = 1.7;
const HEADER_BTN = 'flex cursor-pointer items-center gap-2 rounded-2xl bg-white/[0.06] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

export function AdminDeliveryFeesTab({ active, orders, fit = false }: { active: boolean; orders: any[]; fit?: boolean }) {
  const startPin = useMemo(() => pointFromStore(START_BEARING, START_KM), []);
  const [rule, setRule] = useState(LIVE_RULE);          // the draft
  const [pin, setPin] = useState(startPin);             // the simulated delivery address
  const [bearing, setBearing] = useState(START_BEARING); // direction of the pin from the store, so the distance slider keeps it
  const [subtotal, setSubtotal] = useState(300);        // the simulated order amount (for the minimum order option)
  const [scenarios, setScenarios] = useState(() => loadScenarios(startPin));
  const [activeId, setActiveId] = useState<string | null>('live');
  const [scenarioMsg, setScenarioMsg] = useState('');
  const [dbCheck, setDbCheck] = useState(DB_IDLE);

  const rawKm = distanceFromStoreKm(pin.lat, pin.lng);
  const result = computeFee(rule, rawKm, subtotal);
  const liveResult = computeFee(LIVE_RULE, rawKm, subtotal);
  const differs = rulesDiffer(rule, LIVE_RULE);
  const analysis = useMemo(() => (active ? analyzeOrders(orders, rule, LIVE_RULE, Date.now(), 30) : null), [active, orders, rule]);

  // --- draft rule ---
  const changeRule = (patch: any) => {
    setRule((r: any) => normalizeRule({ ...r, ...patch }));
    setActiveId(null);
  };
  const resetRule = () => {
    setRule(LIVE_RULE);
    setActiveId('live');
    setScenarioMsg('');
  };

  // --- simulated pin ---
  const movePin = (p: { lat: number; lng: number }) => {
    setPin(p);
    if (distanceFromStoreKm(p.lat, p.lng) > 0.005) setBearing(bearingFromStore(p.lat, p.lng));
    setDbCheck(DB_IDLE);
  };
  const setDistance = (km: number) => {
    setPin(pointFromStore(bearing, Math.min(15, Math.max(0, km))));
    setDbCheck(DB_IDLE);
  };
  const randomizePin = () => {
    const maxKm = rule.maxRadiusOn ? Math.min(15, rule.maxRadiusKm + 2) : 8;
    const b = Math.random() * 360;
    setBearing(b);
    setPin(pointFromStore(b, 0.3 + Math.random() * (maxKm - 0.3)));
    setDbCheck(DB_IDLE);
  };

  // --- read-only check: what does the database say for this pin? ---
  const checkDatabase = async () => {
    const at = { lat: pin.lat, lng: pin.lng };
    setDbCheck({ status: 'loading', text: '', match: false });
    const { data, error } = await supabase.rpc('admin_preview_delivery_fee', { p_lat: at.lat, p_lng: at.lng });
    if (error || !data) {
      setDbCheck({ status: 'error', text: error?.message || 'The database did not answer.', match: false });
      return;
    }
    const dbFee = Number(data.fee);
    const dbKm = Number(data.distanceKm);
    const km = distanceFromStoreKm(at.lat, at.lng);
    const mine = computeFee(LIVE_RULE, km, Number.POSITIVE_INFINITY);
    const match = mine.fee === dbFee && Math.abs(dbKm - km) < 0.001;
    setDbCheck({
      status: 'ok',
      match,
      text: match
        ? `Database: ${formatPeso(dbFee)} at ${dbKm} km. It matches the live rule used on this screen.`
        : `Database says ${formatPeso(dbFee)} at ${dbKm} km, but the live rule on this screen gives ${mine.fee === null ? '—' : formatPeso(mine.fee)} at ${km.toFixed(3)} km. Do not trust the numbers until this is checked.`,
    });
  };

  // --- test scenarios (this browser only) ---
  const saveScenario = (name: string): string => {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) return 'Type a name first.';
    if (scenarios.length >= MAX_SCENARIOS) return `You can keep up to ${MAX_SCENARIOS} scenarios. Delete one first.`;
    if (scenarios.some((s: any) => s.name.toLowerCase() === clean.toLowerCase())) return 'A scenario with that name already exists.';
    const item = { id: newScenarioId(), name: clean.slice(0, 40), rule, pin, subtotal, savedAt: Date.now() };
    const next = [...scenarios, item];
    if (!saveScenarios(next)) return 'This browser would not save it.';
    setScenarios(next);
    setActiveId(item.id);
    setScenarioMsg('');
    return '';
  };
  const applyScenario = (id: string) => {
    setScenarioMsg('');
    if (id === 'live') {
      resetRule();
      return;
    }
    const s = scenarios.find((x: any) => x.id === id);
    if (!s) return;
    setRule(s.rule);
    setPin(s.pin);
    if (distanceFromStoreKm(s.pin.lat, s.pin.lng) > 0.005) setBearing(bearingFromStore(s.pin.lat, s.pin.lng));
    setSubtotal(s.subtotal);
    setActiveId(id);
    setDbCheck(DB_IDLE);
  };
  const deleteScenario = (id: string) => {
    const s = scenarios.find((x: any) => x.id === id);
    if (!s || !window.confirm(`Delete the scenario "${s.name}"?`)) return;
    const next = scenarios.filter((x: any) => x.id !== id);
    if (!saveScenarios(next)) {
      setScenarioMsg('This browser would not save the change.');
      return;
    }
    setScenarios(next);
    if (activeId === id) setActiveId(null);
  };

  // --- downloads ---
  const exportRules = () => downloadTextFile('veyns-delivery-fee-draft-rule.json', rulesJson(rule), 'application/json');
  const exportCsv = () => downloadTextFile(`veyns-delivery-fee-comparison-${new Date().toISOString().slice(0, 10)}.csv`, comparisonCsv(orders, rule, Date.now(), 30), 'text/csv');

  return (
    <>
      {active && analysis && (
        <div className={fit ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-4'}>
          {/* Heading and downloads */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lime-400/15 text-lime-400"><Truck className="size-6" /></div>
              <div>
                <h1 className="font-display text-2xl font-extrabold leading-tight text-white">Delivery fee</h1>
                <p className="text-sm text-white/60">Set your delivery pricing by geography. This is a draft: checkout still uses the live rule.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={resetRule} disabled={!differs} className={HEADER_BTN}><RotateCcw className="size-4" /> Reset to live rule</button>
              <button type="button" onClick={exportRules} className={HEADER_BTN}><Download className="size-4" /> Export rules</button>
              <button type="button" onClick={exportCsv} className={HEADER_BTN}><FileSpreadsheet className="size-4" /> Export CSV</button>
            </div>
          </div>

          {/* Three columns: map and charts, estimate and simulator, rules and scenarios */}
          <div className={`grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] ${fit ? 'min-h-0 flex-1 grid-rows-[minmax(0,1fr)]' : ''}`}>
            <div className="flex min-h-0 flex-col gap-3">
              <div className={fit ? 'flex min-h-0 flex-[1.3] flex-col' : 'flex flex-col'}>
                <AdminDeliveryFeeMap rule={rule} pin={pin} rawKm={rawKm} onPinChange={movePin} fit={fit} />
              </div>
              <div className={fit ? 'flex min-h-[10rem] flex-1 flex-col' : 'flex h-64 flex-col'}>
                <AdminDeliveryFeeCurve rule={rule} liveRule={LIVE_RULE} differs={differs} result={result} />
              </div>
              <AdminDeliveryFeeLadder rule={rule} analysis={analysis} />
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <AdminDeliveryFeeEstimate rule={rule} result={result} liveResult={liveResult} pin={pin} subtotal={subtotal} />
              <AdminDeliveryFeeSimulator
                rawKm={rawKm}
                subtotal={subtotal}
                onDistance={setDistance}
                onSubtotal={setSubtotal}
                onRandomize={randomizePin}
                dbCheck={dbCheck}
                onCheck={checkDatabase}
                onSaveScenario={saveScenario}
              />
              <AdminDeliveryFeeImpact analysis={analysis} />
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <AdminDeliveryFeeRulesPanel rule={rule} differs={differs} onChange={changeRule} />
              <AdminDeliveryFeeScenariosPanel scenarios={scenarios} activeId={activeId} onApply={applyScenario} onDelete={deleteScenario} message={scenarioMsg} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
