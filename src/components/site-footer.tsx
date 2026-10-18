import { Clock, MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold">VEYNS</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Filipino comfort food, cooked slow and served warm.
          </p>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" /> 123 Mabini Street, Quezon City
          </p>
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-primary" /> (02) 8123-4567
          </p>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Clock className="size-4 text-primary" /> Tue–Sun, 10:00 AM – 10:00 PM
          </p>
          <p>Closed on Mondays</p>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VEYNS. All rights reserved.
      </div>
    </footer>
  );
}
