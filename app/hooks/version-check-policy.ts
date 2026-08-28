export const VERSION_CHECK_THROTTLE_MS = 60_000;

export function shouldCheckVersion({
  now,
  lastCheck,
  visible,
}: {
  now: number;
  lastCheck: number | null;
  visible: boolean;
}): boolean {
  if (!visible) return false;
  if (!lastCheck) return true;
  return now - lastCheck >= VERSION_CHECK_THROTTLE_MS;
}
