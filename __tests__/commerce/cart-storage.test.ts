/**
 * @jest-environment jsdom
 */

import {
  clearCart,
  getCartItems,
  getCartKey,
  setCartItems,
  slimCartItem,
} from '@/app/commerce/cart-storage';

describe('cart-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds shop and marketplace keys', () => {
    expect(getCartKey('cart', 'shop', 'site-1')).toBe('market-cart-site-1');
    expect(getCartKey('cart', 'marketplace')).toBe('market-cart-marketplace');
    expect(getCartKey('buynow', 'shop', 'site-1')).toBe('market-checkout-buynow');
  });

  it('slims bulky catalog fields before persistence', () => {
    const slim = slimCartItem({
      id: 'item-1',
      site_id: 'site-1',
      name: 'Widget',
      image_url: 'https://example.com/w.jpg',
      kind: 'product',
      description: 'A very long description that should not be stored',
      item_specs: [{ id: 'spec', name: 'Heavy' }],
      metadata: {
        gallery: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
        delivery_options: ['ship'],
        pickup_location_ids: ['loc-1'],
        payment_options: ['card'],
        dynamic_pricing: { agent_prompt: 'x'.repeat(5000), fields: [] },
      },
      site: {
        id: 'site-1',
        name: 'Acme',
        logo_url: 'https://example.com/logo.png',
        slug: 'acme',
        settings: { huge: true },
      },
      cartQty: 2,
      cartPrice: 10,
      is_recurring: false,
      is_reservation: false,
    });

    expect(slim).toEqual({
      id: 'item-1',
      site_id: 'site-1',
      name: 'Widget',
      image_url: 'https://example.com/w.jpg',
      kind: 'product',
      digital_subtype: null,
      currency: undefined,
      target_sale_price: undefined,
      is_recurring: false,
      is_reservation: false,
      is_dynamic_price: false,
      cartQty: 2,
      cartPrice: 10,
      reservationStart: undefined,
      reservationEnd: undefined,
      metadata: {
        delivery_options: ['ship'],
        pickup_location_ids: ['loc-1'],
        payment_options: ['card'],
      },
      site: {
        id: 'site-1',
        name: 'Acme',
        logo_url: 'https://example.com/logo.png',
        slug: 'acme',
      },
    });
    expect(slim).not.toHaveProperty('description');
    expect(slim).not.toHaveProperty('item_specs');
  });

  it('persists and reads slim cart items', () => {
    setCartItems('cart', 'shop', 'site-1', [
      {
        id: 'item-1',
        site_id: 'site-1',
        name: 'Widget',
        kind: 'product',
        description: 'drop me',
        cartQty: 1,
        cartPrice: 5,
      },
    ]);

    const stored = getCartItems('cart', 'shop', 'site-1');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Widget');
    expect(stored[0]).not.toHaveProperty('description');
  });

  it('recovers from QuotaExceededError by freeing disposable keys', () => {
    localStorage.setItem('swr-cache', JSON.stringify([['k', { huge: true }]]));
    localStorage.setItem('market-cart-other', JSON.stringify([{ id: 'old' }]));

    const originalSetItem = Storage.prototype.setItem;
    let attempts = 0;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key.startsWith('market-cart-site-1')) {
        attempts += 1;
        if (attempts === 1) {
          const err = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
          throw err;
        }
      }
      return originalSetItem.call(this, key, value);
    });

    expect(() => {
      setCartItems('cart', 'shop', 'site-1', [
        { id: 'item-1', name: 'Widget', kind: 'product', cartQty: 1, cartPrice: 5 },
      ]);
    }).not.toThrow();

    expect(localStorage.getItem('swr-cache')).toBeNull();
    expect(localStorage.getItem('market-cart-other')).toBeNull();
    expect(getCartItems('cart', 'shop', 'site-1')).toHaveLength(1);

    jest.restoreAllMocks();
  });

  it('clears cart keys', () => {
    setCartItems('cart', 'shop', 'site-1', [
      { id: 'item-1', name: 'Widget', kind: 'product', cartQty: 1, cartPrice: 5 },
    ]);
    clearCart('cart', 'shop', 'site-1');
    expect(getCartItems('cart', 'shop', 'site-1')).toEqual([]);
  });
});
