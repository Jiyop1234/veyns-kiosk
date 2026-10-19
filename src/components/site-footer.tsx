// @ts-nocheck
import { Clock, MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-emerald-900/60 bg-[#03120d] text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold text-white">VEYNS<span className="text-lime-400">.</span></p>
          <p className="mt-2 text-sm text-emerald-300/80">
            Filipino comfort food, cooked slow and served warm.
          </p>
        </div>
        <div className="space-y-2 text-sm text-emerald-300/80">
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-lime-400 shrink-0" /> Julio B. Alinsug, Basak, Mandaue City, Cebu 6014[cite: 11]
          </p>
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-lime-400 shrink-0" /> (032) 123-4567
          </p>
        </div>
        <div className="space-y-2 text-sm text-emerald-300/80">
          <p className="flex items-center gap-2">
            <Clock className="size-4 text-lime-400 shrink-0" /> Tue–Sun, 10:00 AM – 10:00 PM
          </p>
          <p>Closed on Mondays</p>
        </div>
      </div>
      <div className="border-t border-emerald-900/60 py-4 text-center text-xs text-emerald-400/60">
        © {new Date().getFullYear()} VEYNS. All rights reserved.
      </div>
    </footer>
  );
}

export default SiteFooter;
