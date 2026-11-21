// @ts-nocheck
// Fare Lab map of the Delivery Fee screen: the store, the free / base / per-km zones as circles, the maximum radius, and the simulated delivery pin.
// Click the map or drag the pin to move it. Leaflet is loaded from the CDN, the same way as the map in admin-delivery-pin-map.tsx.
// Step B11a: new file. The map is only a picture of the draft rule; the delivery fee itself is always calculated by the database at checkout.
import { useEffect, useRef, useState } from 'react';
import { Crosshair, Map as MapIcon } from 'lucide-react';
import { STORE_LAT, STORE_LNG, formatKm } from '@/components/admin/delivery-fees/admin-delivery-fee-math';

const STYLE_ID = 'veyns-fee-map-style';
const CSS = `
.veyns-fee-tiles{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.9) saturate(.6)}
.veyns-fee-tip{background:#020b08;color:#fff;border:0;font-weight:700;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.5)}
.veyns-fee-tip::before{display:none}
.leaflet-container{background:#0b1511}
`;

// Leaflet comes from a script tag; the ids are shared with admin-delivery-pin-map.tsx so it is only loaded once.
const loadLeaflet = (): Promise<any> => new Promise((resolve) => {
  const w = window as any;
  if (w.L) { resolve(w.L); return; }
  if (!document.getElementById('leaflet-css-admin')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css-admin';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  let script = document.getElementById('leaflet-js-admin') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'leaflet-js-admin';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    document.body.appendChild(script);
  }
  script.addEventListener('load', () => resolve((window as any).L || null));
  script.addEventListener('error', () => resolve(null));
});

export function AdminDeliveryFeeMap({ rule, pin, rawKm, onPinChange, fit }: any) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<{ circles: any[]; pin: any }>({ circles: [], pin: null });
  const onPinRef = useRef(onPinChange);
  onPinRef.current = onPinChange;
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [fitSignal, setFitSignal] = useState(0);

  const outerKm = rule.maxRadiusOn ? rule.maxRadiusKm : Math.max(6, Math.ceil(rule.baseUpperKm + 4));
  const outerRef = useRef(outerKm);
  outerRef.current = outerKm;

  // create the map once
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !hostRef.current || mapRef.current) return;
      if (!L) { setState('failed'); return; }
      if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true }).setView([STORE_LAT, STORE_LNG], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', className: 'veyns-fee-tiles' }).addTo(map);
      map.on('click', (e: any) => onPinRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));

      L.marker([STORE_LAT, STORE_LNG], {
        interactive: false,
        keyboard: false,
        zIndexOffset: 500,
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: '<div style="background:#a3e635;color:#04140f;font:800 11px system-ui,sans-serif;padding:5px 9px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.5);white-space:nowrap;transform:translate(-50%,-50%)">VEYNS</div>',
        }),
      }).addTo(map);

      const pinMarker = L.marker([pin.lat, pin.lng], {
        draggable: true,
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: '<div style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 0 4px rgba(239,68,68,.35);transform:translate(-50%,-50%)"></div>',
        }),
      }).addTo(map);
      pinMarker.bindTooltip(formatKm(rawKm), { permanent: true, direction: 'right', offset: [12, 0], className: 'veyns-fee-tip' });
      pinMarker.on('drag', (e: any) => onPinRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));

      mapRef.current = map;
      layersRef.current.pin = pinMarker;
      setState('ready');
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 200);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = { circles: [], pin: null };
      }
    };
  }, []);

  // zones: biggest first so the smaller ones sit on top
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (state !== 'ready' || !L || !map) return;
    layersRef.current.circles.forEach((c: any) => c.remove());
    const common = { interactive: false };
    const circles = [
      L.circle([STORE_LAT, STORE_LNG], { ...common, radius: outerKm * 1000, color: rule.maxRadiusOn ? '#ef4444' : '#38bdf8', weight: 2, dashArray: rule.maxRadiusOn ? '8 6' : '2 6', fillColor: '#38bdf8', fillOpacity: 0.12 }),
      L.circle([STORE_LAT, STORE_LNG], { ...common, radius: rule.baseUpperKm * 1000, color: '#fbbf24', weight: 2, fillColor: '#fbbf24', fillOpacity: 0.2 }),
      ...(rule.freeKm > 0 ? [L.circle([STORE_LAT, STORE_LNG], { ...common, radius: rule.freeKm * 1000, color: '#a3e635', weight: 2, fillColor: '#a3e635', fillOpacity: 0.28 })] : []),
    ];
    circles.forEach((c: any) => c.addTo(map));
    layersRef.current.circles = circles;
  }, [state, rule.freeKm, rule.baseUpperKm, rule.maxRadiusOn, outerKm]);

  // show the whole outer circle when the map opens and when the target button is pressed
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (state !== 'ready' || !L || !map) return;
    map.invalidateSize();
    map.fitBounds(L.latLng(STORE_LAT, STORE_LNG).toBounds(outerRef.current * 2000), { padding: [16, 16] });
  }, [state, fitSignal]);

  // keep the pin and its distance label in step
  useEffect(() => {
    const marker = layersRef.current.pin;
    if (state !== 'ready' || !marker) return;
    marker.setLatLng([pin.lat, pin.lng]);
    marker.setTooltipContent(formatKm(rawKm));
  }, [state, pin.lat, pin.lng, rawKm]);

  // redraw when the card changes size (the screen layout switches between fit and scrolling)
  useEffect(() => {
    if (state !== 'ready' || !hostRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => mapRef.current && mapRef.current.invalidateSize());
    ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, [state]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-white/[0.04] p-4">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-white"><MapIcon className="size-5 text-lime-400" /> Fare lab</h2>
          <p className="text-[11px] text-white/50">Click the map or drag the red pin to try a delivery address.</p>
        </div>
        <button type="button" aria-label="Show the whole delivery area" title="Show the whole delivery area" onClick={() => setFitSignal((n) => n + 1)} className="grid size-9 cursor-pointer place-items-center rounded-xl bg-white/[0.06] text-white/70 hover:text-lime-400"><Crosshair className="size-4" /></button>
      </div>
      <div className={`relative isolate min-h-0 overflow-hidden rounded-2xl bg-[#0b1511] ${fit ? 'flex-1' : 'h-72'}`}>
        <div ref={hostRef} className="absolute inset-0 z-0" />
        {state === 'loading' && <p className="absolute inset-0 grid place-items-center text-xs text-white/50">Loading the map…</p>}
        {state === 'failed' && <p className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-red-300">The map could not be loaded (no internet or the map server is blocked). The fee numbers on this screen still work.</p>}
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/70">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-lime-400" /> Free (under {rule.freeKm} km)</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-400" /> Base fare ({rule.freeKm}–{rule.baseUpperKm} km)</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sky-400" /> Per km (over {rule.baseUpperKm} km)</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-400" /> {rule.maxRadiusOn ? `Max radius (${rule.maxRadiusKm} km)` : 'No maximum radius'}</span>
      </div>
    </div>
  );
}
