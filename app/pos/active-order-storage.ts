export function getActivePosOrderId(siteId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`pos-active-order:${siteId}`);
  } catch (e) {
    console.error('Error reading pos active order', e);
    return null;
  }
}

export function setActivePosOrderId(siteId: string, orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`pos-active-order:${siteId}`, orderId);
  } catch (e) {
    console.error('Error saving pos active order', e);
  }
}

export function clearActivePosOrderId(siteId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`pos-active-order:${siteId}`);
  } catch (e) {
    console.error('Error clearing pos active order', e);
  }
}
