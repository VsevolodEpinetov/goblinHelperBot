export const COOLDOWN_HOURS = 6;

export function computeCooldownUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + COOLDOWN_HOURS * 3600_000);
}

export function formatTimeRemaining(until: Date, now: Date = new Date()): string {
  const diff = until.getTime() - now.getTime();
  if (diff <= 0) return '0 минут';
  const hours = Math.floor(diff / 3600_000);
  const minutes = Math.floor((diff % 3600_000) / 60_000);
  return hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
}
