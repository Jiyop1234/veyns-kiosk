import { useEffect, useMemo, useRef, useState } from 'react';
import { Facebook, Instagram } from 'lucide-react';
import veynsSymbol from '@/assets/VEYNS SYMBOL.png';
import { SOCIAL_LINKS, isSafeExternalUrl } from '@/lib/social-links';

const ICONS = { facebook: Facebook, instagram: Instagram } as const;

export function FloatingSupportButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Skip any account whose configuration is missing or not a valid https URL.
  const links = useMemo(
    () => SOCIAL_LINKS.filter((l) => l.label.trim() && isSafeExternalUrl(l.url)),
    []
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (links.length === 0) return null; // nothing configured: render nothing

  return (
    <div
      ref={rootRef}
      className="fixed z-[45] flex flex-col items-end gap-2"
      style={{
        right: 'calc(1rem + env(safe-area-inset-right, 0px))',
        bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <ul
        id="support-social-menu"
        aria-label="Social media"
        className={`flex flex-col items-end gap-2 transition-all duration-200 origin-bottom-right ${
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
        }`}
      >
        {links.map((link) => {
          const Icon = ICONS[link.id];
          return (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                aria-label={`Open ${link.id === 'facebook' ? 'Facebook' : 'Instagram'}: ${link.label}`}
                className="flex min-h-11 items-center gap-2 rounded-full border border-emerald-700 bg-[#051813] py-1.5 pl-2.5 pr-4 text-xs font-bold text-white shadow-lg transition-colors hover:border-lime-400 hover:text-lime-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-lime-400 text-black">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>{link.label}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chat Support"
        aria-expanded={open}
        aria-controls="support-social-menu"
        className="flex size-14 items-center justify-center overflow-hidden rounded-full border-2 border-lime-400 bg-[#03120d] shadow-xl transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03120d]"
      >
        <img src={veynsSymbol} alt="" className="size-full object-contain p-1" draggable={false} />
      </button>
    </div>
  );
}

export default FloatingSupportButton;
