export function canCancelSubscription(
  subscription: { status: string; end_date?: string | null },
  now: number = Date.now()
): boolean {
  if (subscription.status !== 'active' && subscription.status !== 'paused') {
    return false;
  }

  if (!subscription.end_date) {
    return true;
  }

  const endDateMs = new Date(subscription.end_date).getTime();
  if (isNaN(endDateMs)) {
    return true; // Fallback if invalid date
  }

  return now >= endDateMs;
}
