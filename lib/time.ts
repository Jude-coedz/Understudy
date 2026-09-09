const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const diff = Math.max(0, now - then);
  const days = Math.floor(diff / DAY);
  if (diff < HOUR) return "just now";
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h}h ago`;
  }
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 18) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function daysAgo(iso: string, now = Date.now()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor(Math.max(0, now - then) / DAY);
}
