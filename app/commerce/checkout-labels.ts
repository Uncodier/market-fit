export type CheckoutCopyMode = 'retail' | 'service';

export function resolveCheckoutCopyMode(items: any[]): CheckoutCopyMode {
  if (!items || items.length === 0) return 'retail';
  
  const allService = items.every(item => item.kind === 'service' || item.is_reservation);
  return allService ? 'service' : 'retail';
}

export function checkoutLabelKey(baseKey: string, mode: CheckoutCopyMode): string {
  return mode === 'service' ? `${baseKey}Service` : baseKey;
}
