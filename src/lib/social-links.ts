// Single source of truth for the business social accounts.
// URLs are the ones already used in App.tsx (password-help panel).
// `label` is what the floating menu displays: replace it with the exact
// public display name of each account if it differs from the handle.
export type SocialLink = {
  id: 'facebook' | 'instagram';
  label: string;
  url: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { id: 'facebook', label: 'veyns.ubec', url: 'https://www.facebook.com/veyns.ubec' },
  { id: 'instagram', label: '@veyns.ubec', url: 'https://www.instagram.com/veyns.ubec' },
];

// Only https URLs with a non-empty host are allowed to be rendered.
export function isSafeExternalUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.length > 0;
  } catch {
    return false;
  }
}
