// VEYNS Admin: the greeting shown in the top bar (Step B10b).
// The part of the day follows Philippine time (Asia/Manila), whatever the time zone of the computer.
//   05:00 to 11:59  Good Morning
//   12:00 to 17:59  Good Afternoon
//   18:00 to 04:59  Good Evening

// The name in the greeting. It is fixed text for now: the dashboard does not receive the logged-in user's name yet.
export const ADMIN_GREETING_NAME = 'Boss';

// The hour (0 to 23) in Philippine time. Some browsers print midnight as 24, so the result is taken modulo 24.
export function manilaHour(nowMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).formatToParts(new Date(nowMs));
  const hourPart = parts.find((part) => part.type === 'hour');
  const hour = hourPart ? parseInt(hourPart.value, 10) : NaN;
  return Number.isFinite(hour) ? hour % 24 : new Date(nowMs).getHours();
}

export function adminGreeting(nowMs: number): string {
  const hour = manilaHour(nowMs);
  const part = hour >= 5 && hour < 12 ? 'Morning' : hour >= 12 && hour < 18 ? 'Afternoon' : 'Evening';
  return `Good ${part}, ${ADMIN_GREETING_NAME}`;
}
