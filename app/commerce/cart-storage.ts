export type CartMode = 'cart' | 'buynow';

export function getCartKey(mode: CartMode, source: string, siteId?: string | null): string {
  if (mode === 'buynow') {
    return 'market-checkout-buynow';
  }
  return source === 'marketplace' ? 'market-cart-marketplace' : `market-cart-${siteId}`;
}

/** Keep only fields needed for cart UI and checkout to stay under localStorage quotas. */
export function slimCartItem(item: Record<string, any>): Record<string, any> {
  const meta = item.metadata;
  const slimMeta =
    meta && typeof meta === 'object'
      ? Object.fromEntries(
          Object.entries({
            delivery_options: meta.delivery_options,
            pickup_location_ids: meta.pickup_location_ids,
            payment_options: meta.payment_options,
            shipping_cost: meta.shipping_cost,
            shipping_cost_mode: meta.shipping_cost_mode,
          }).filter(([, value]) => value !== undefined)
        )
      : undefined;

  const site = item.site;
  const slimSite =
    site && typeof site === 'object'
      ? {
          id: site.id,
          name: site.name,
          logo_url: site.logo_url,
          slug: site.slug,
        }
      : undefined;

  return {
    id: item.id,
    site_id: item.site_id,
    name: item.name,
    image_url: item.image_url,
    kind: item.kind,
    digital_subtype: item.digital_subtype ?? null,
    currency: item.currency,
    target_sale_price: item.target_sale_price,
    is_recurring: Boolean(item.is_recurring),
    is_reservation: Boolean(item.is_reservation),
    is_dynamic_price: Boolean(item.is_dynamic_price),
    cartQty: item.cartQty,
    cartPrice: item.cartPrice,
    reservationStart: item.reservationStart,
    reservationEnd: item.reservationEnd,
    ...(Array.isArray(item.modifiers) && item.modifiers.length > 0
      ? {
          modifiers: item.modifiers.map((m: any) => ({
            groupId: m.groupId,
            catalogItemId: m.catalogItemId,
            name: m.name,
            cartQty: m.cartQty,
            cartPrice: m.cartPrice,
          })),
        }
      : {}),
    ...(item.lineKey ? { lineKey: item.lineKey } : {}),
    ...(slimMeta && Object.keys(slimMeta).length > 0 ? { metadata: slimMeta } : {}),
    ...(slimSite ? { site: slimSite } : {}),
  };
}

function isQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  );
}

function freeLocalStorageSpace(preserveKey: string): void {
  try {
    localStorage.removeItem('swr-cache');
  } catch {
    // ignore
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === preserveKey) continue;
      if (key.startsWith('market-cart-') || key === 'market-checkout-buynow') {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
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

  const key = getCartKey(mode, source, siteId);
  const payload = JSON.stringify(items.map((item) => slimCartItem(item)));

  try {
    localStorage.setItem(key, payload);
    window.dispatchEvent(new Event('storage'));
    return;
  } catch (e) {
    if (!isQuotaExceeded(e)) {
      console.error('Error saving cart', e);
      return;
    }
  }

  // Retry after clearing disposable / competing cart data
  try {
    freeLocalStorageSpace(key);
    localStorage.setItem(key, payload);
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Error saving cart after freeing space', e);
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
