// Click-to-drop delivery pin (Leaflet from the CDN, same as the customer checkout).
// The delivery fee itself is always calculated by the database from the pin.
import React, { useEffect, useRef } from 'react';

const STORE_LAT = 10.359511; // map centre only
const STORE_LNG = 123.952739;

export type DeliveryPin = { lat: number; lng: number };

export function DeliveryPinMap({
  value,
  onChange,
  heightClass = 'h-56',
}: {
  value: DeliveryPin | null;
  onChange: (pin: DeliveryPin) => void;
  heightClass?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const valueRef = useRef<DeliveryPin | null>(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    const init = () => {
      const L = (window as any).L;
      if (cancelled || !L || !hostRef.current || mapObj.current) return;
      const map = L.map(hostRef.current).setView([STORE_LAT, STORE_LNG], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      map.on('click', (e: any) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapObj.current = map;
      const v = valueRef.current;
      if (v) {
        markerObj.current = L.marker([v.lat, v.lng]).addTo(map);
        map.setView([v.lat, v.lng], 15);
      }
      // the map sits inside an animated dialog, so re-measure once it has finished opening
      setTimeout(() => mapObj.current && mapObj.current.invalidateSize(), 250);
      setTimeout(() => mapObj.current && mapObj.current.invalidateSize(), 700);
    };

    if ((window as any).L) {
      setTimeout(init, 50);
    } else {
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
      script.addEventListener('load', init);
    }

    return () => {
      cancelled = true;
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
        markerObj.current = null;
      }
    };
  }, []);

  // keep the marker in step with the chosen pin
  useEffect(() => {
    const L = (window as any).L;
    if (!value || !L || !mapObj.current) return;
    if (markerObj.current) markerObj.current.setLatLng([value.lat, value.lng]);
    else markerObj.current = L.marker([value.lat, value.lng]).addTo(mapObj.current);
  }, [value]);

  return (
    <div
      ref={hostRef}
      className={`${heightClass} w-full rounded-xl overflow-hidden border border-emerald-800/60 bg-[#04140f] z-0`}
    />
  );
}
