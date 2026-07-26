export const SOS_COUNTDOWN_SECONDS = 10;
export const SOS_COUNTDOWN_MS = SOS_COUNTDOWN_SECONDS * 1_000;

export function resolveSosCountdownDeadline(
  startedAt: string | number | undefined,
  now = Date.now(),
): number {
  const parsed = Number(startedAt);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed + SOS_COUNTDOWN_MS
    : now + SOS_COUNTDOWN_MS;
}

export function sosCountdownSecondsRemaining(
  deadline: number,
  now = Date.now(),
): number {
  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}
