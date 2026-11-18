// Test scenarios of the Delivery Fee screen, kept in this browser only (localStorage).
// Step B11a: new file. A scenario is a draft rule, the simulated pin and the simulated order subtotal; nothing is sent to the database.
import { FeeRule, normalizeRule } from '@/components/admin/delivery-fees/admin-delivery-fee-math';

export type FeeScenario = { id: string; name: string; rule: FeeRule; pin: { lat: number; lng: number }; subtotal: number; savedAt: number };

const KEY = 'veyns_admin_fee_scenarios_v1';
export const MAX_SCENARIOS = 12;

export const loadScenarios = (fallbackPin: { lat: number; lng: number }): FeeScenario[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list: any = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_SCENARIOS).map((s: any): FeeScenario => {
      const lat = Number(s && s.pin && s.pin.lat);
      const lng = Number(s && s.pin && s.pin.lng);
      const okPin = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      const subtotal = Number(s && s.subtotal);
      return {
        id: String((s && s.id) || Math.random().toString(36).slice(2)),
        name: String((s && s.name) || 'Scenario').slice(0, 40),
        rule: normalizeRule(s && s.rule),
        pin: okPin ? { lat, lng } : fallbackPin,
        subtotal: Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 300,
        savedAt: Number(s && s.savedAt) || 0,
      };
    });
  } catch (e) {
    return [];
  }
};

export const saveScenarios = (list: FeeScenario[]): boolean => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SCENARIOS)));
    return true;
  } catch (e) {
    return false;
  }
};

export const newScenarioId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
