export type CartMode = 'cart' | 'buynow';

export function getCartKey(mode: CartMode, source: string, siteId?: string | null): string {
  if (mode === 'buynow') {
    return 'market-checkout-buynow';
  }
  return source === 'marketplace' ? 'market-cart-marketplace' : `market-cart-${siteId}`;
}

export function getCartItems(mode: CartMode, source: string, siteId?: string | null): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getCartKey(mode, source, siteId);
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    console.error('Error reading cart', e);
    return [];
  }
}

export function setCartItems(mode: CartMode, source: string, siteId: string | null | undefined, items: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getCartKey(mode, source, siteId);
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Error saving cart', e);
  }
}

export function clearCart(mode: CartMode, source: string, siteId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getCartKey(mode, source, siteId);
    localStorage.removeItem(key);
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Error clearing cart', e);
  }
}