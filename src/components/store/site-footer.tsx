// @ts-nocheck
// Step 11A: Privacy Policy and Terms links open a pop-up window. The wording below is a PLACEHOLDER (no legal terms
// have been written yet). Replace the paragraphs with your real, professionally checked text; nothing else needs to change.
import { useState } from "react";
import { Clock, MapPin, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const LEGAL_TEXT = {
  privacy: {
    title: "Privacy Policy",
    paragraphs: [
      "Our Privacy Policy is being prepared and will be published here soon.",
      "If you have a question about how VEYNS handles your information, please contact us using the details in the footer.",
    ],
  },
  terms: {
    title: "Terms",
    paragraphs: [
      "Our Terms are being prepared and will be published here soon.",
      "If you have a question about ordering with VEYNS, please contact us using the details in the footer.",
    ],
  },
};

export function SiteFooter() {
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  const legalLinkClass =
    "underline-offset-4 transition-colors hover:text-lime-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

  return (
    <footer className="mt-20 bg-[#03120d] text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold text-white">VEYNS<span className="text-lime-400">.</span></p>
          <p className="mt-2 text-sm text-emerald-300/80">
            Filipino comfort food, cooked slow and served warm.
          </p>
        </div>
        <div className="space-y-2 text-sm text-emerald-300/80">
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-lime-400 shrink-0" /> Julio B. Alinsug, Basak, Mandaue City, Cebu 6014
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
      <div className="py-4 text-center text-xs text-emerald-400/60">
        <p>© {new Date().getFullYear()} VEYNS. All rights reserved.</p>
        <p className="mt-2 flex items-center justify-center gap-4">
          <button type="button" onClick={() => setLegal("privacy")} className={legalLinkClass}>
            Privacy Policy
          </button>
          <span aria-hidden="true">•</span>
          <button type="button" onClick={() => setLegal("terms")} className={legalLinkClass}>
            Terms
          </button>
        </p>
      </div>

      <Dialog open={legal !== null} onOpenChange={(isOpen) => { if (!isOpen) setLegal(null); }}>
        <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-900/80 bg-[#03120d] p-6 text-white shadow-2xl">
          {legal && (
            <>
              <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-wide text-white">
                {LEGAL_TEXT[legal].title}
              </DialogTitle>
              <DialogDescription className="sr-only">{LEGAL_TEXT[legal].title} of VEYNS</DialogDescription>
              <div className="space-y-3 text-sm text-emerald-200/90">
                {LEGAL_TEXT[legal].paragraphs.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </footer>
  );
}

export default SiteFooter;
