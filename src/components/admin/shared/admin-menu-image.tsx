// @ts-nocheck
// Admin menu image: shows a menu item picture, or the VEYNS tile when the item has no picture.
// Step A3: moved from employee-dashboard.tsx (via the A2 photo file); the function is now named AdminMenuImage, the body is unchanged.
// --- Menu image display helper: renders an image or the VEYNS fallback ---
export function AdminMenuImage({ src, alt, className }: { src?: string; alt: string; className: string }) {
  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-[#0d2e26] font-display text-sm font-bold text-[#d4af37]`}>
        VEYNS
      </div>
    );
  }
  return <img src={src} alt={alt} width={512} height={512} className={className} />;
}
