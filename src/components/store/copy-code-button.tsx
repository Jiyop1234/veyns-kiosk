// @ts-nocheck
// A small "Copy" button for a voucher code. Shows "Copied!" for a moment after it works.
// Used on the loyalty card (home page) and in the loyalty card pop-up.
import React, { useState, useRef, useEffect } from 'react';
import { copyText } from '@/lib/copy-code';

export function CopyCodeButton({ code, className, style }: { code: string; className?: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<any>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onClick = async (e: any) => {
    e.stopPropagation(); // a tap on this button must not flip the card
    const ok = await copyText(String(code || ''));
    if (!ok) { alert(`Could not copy automatically. Your code is: ${code}`); return; }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button type="button" onClick={onClick} aria-label={`Copy code ${code}`} className={className} style={style}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
