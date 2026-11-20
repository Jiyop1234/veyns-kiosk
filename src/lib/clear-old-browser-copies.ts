// Step 5C: older versions copied the menu, every customer's stamps and penalty data, and promo codes into this browser.
// Nothing reads those copies, so they are deleted once, the first time the app starts after this update.
const OLD_KEYS = ['veyns_manageable_menu', 'veyns_promo_codes'];
const OLD_PREFIXES = ['veyns_detailed_stamps_', 'veyns_stamps_', 'veyns_fair_play_penalty_'];

export function clearOldBrowserCopies() {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (OLD_KEYS.includes(k) || OLD_PREFIXES.some((p) => k.startsWith(p)))) stale.push(k);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
}
