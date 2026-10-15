/** @jest-environment node */
import { normalizeOrder, normalizeWebhook, parseWebhook } from '../../lib/marketplace/providers';
import { config, rappiOrder, uberOrder } from './provider-fixtures';

describe('documented provider normalization', () => {
  test('preserves preparation instructions instead of dropping customer requests', () => {
    const rappi = config('rappi');
    const rPayload = rappiOrder(rappi.store_id);
    const rItem = { ...rPayload.order_detail.items[0], comments: 'No vinegar' };
    expect(normalizeOrder(rappi, { ...rPayload, order_detail: { ...rPayload.order_detail, items: [rItem] } }).items[0].notes).toBe('No vinegar');
    const uber = config();
    const uPayload = uberOrder(uber.store_id);
    const uItem = { ...uPayload.cart.items[0], special_instructions: 'No cheese' };
    const normalized = normalizeOrder(uber, { ...uPayload, cart: { items: [uItem], special_instructions: 'Ring the bell' } });
    expect(normalized.notes).toBe('Ring the bell');
    expect(normalized.items[0].notes).toBe('No cheese');
  });
  test('Uber preserves provider totals and modifier prices without double counting', () => {
    const connection = config();
    const payload = uberOrder(connection.store_id);
    const result = normalizeOrder(connection, payload);
    expect(result).toMatchObject({ external_order_id: payload.id, external_store_id: connection.store_id,
      currency: 'USD', total: 28, subtotal: 25, discount_total: 3, totals_provisional: false,
      delivery: { courier: { id: 'courier-id', name: 'Courier', vehicle: 'Test Bike' } } });
    expect(result.items[0]).toMatchObject({ unit_price: 12.5, total: 25, modifiers_included_in_price: true });
    expect(result.items[0].modifiers[0]).toMatchObject({ unit_price: 2.5, total: 2.5, modifier_group_id: 'extras' });
    expect(result.marketplace_totals).toEqual({ total: 31, sub_total: 25, total_promo_applied: 28 });
    expect(result.delivery?.courier).not.toHaveProperty('latitude');
  });
  test('zero-decimal Uber currency follows actual currency exponent', () => {
    const connection = config();
    const payload = JSON.parse(JSON.stringify(uberOrder(connection.store_id)).replace(/USD/g, 'JPY'));
    expect(normalizeOrder(connection, payload).total).toBe(2800);
  });
  test('merchant-provided delivery is not falsely labelled marketplace-managed', () => {
    const connection = config();
    const payload = uberOrder(connection.store_id);
    expect(normalizeOrder(connection, { ...payload, type: 'DELIVERY_BY_RESTAURANT' }).delivery_mode).toBe('merchant_managed');
  });
  test('Rappi keeps major-unit totals, products and per-parent toppings', () => {
    const connection = config('rappi');
    const payload = rappiOrder(connection.store_id);
    const result = normalizeOrder(connection, payload);
    expect(result).toMatchObject({ total: 315, subtotal: 300, discount_total: 20, currency: 'MXN', status: 'pending' });
    expect(result.items[0]).toMatchObject({ quantity: 2, unit_price: 100, total: 250, sku: 'sku-meal' });
    expect(result.delivery).toBeUndefined();
  });
  test('repeated customized products have distinct stable root and modifier line identities', () => {
    for (const provider of ['uber_eats', 'rappi'] as const) {
      const connection = config(provider);
      const source = provider === 'uber_eats' ? uberOrder(connection.store_id) : rappiOrder(connection.store_id);
      const payload = JSON.parse(JSON.stringify(source));
      const items = provider === 'uber_eats' ? payload.cart.items : payload.order_detail.items;
      items.push(JSON.parse(JSON.stringify(items[0])));
      const first = normalizeOrder(connection, payload);
      const second = normalizeOrder(connection, payload);
      expect(first.items.map(item => item.external_id)).toEqual(second.items.map(item => item.external_id));
      expect(first.items[0].external_id).not.toBe(first.items[1].external_id);
      expect(first.items[0].external_product_id).toBe(first.items[1].external_product_id);
      expect(first.items[0].modifiers[0].external_id).not.toBe(first.items[1].modifiers[0].external_id);
      expect(first.items[0].total).toBe(first.items[1].total);
    }
  });
  test('official scheduled shape with absent aggregate fields is accepted only as provisional', () => {
    const connection = config('rappi');
    const payload = { action: 'scheduled', store: { internal_id: connection.store_id },
      order_detail: { order_id: 'scheduled-order', place_at: '2026-07-22 17:35:00', delivery_method: 'delivery',
        totals: { total_order: 0, total_to_pay: 0, charges: {}, other_totals: { tip: 0, total_rappi_pay: 0, total_rappi_credits: 0 } },
        items: [{ id: 'product-8', name: 'Product 8', quantity: 4, sku: '0007', price: 0, unit_price_with_discount: 0, unit_price_without_discount: 0 }] } };
    const order = normalizeWebhook(connection, payload).normalized_order;
    expect(order).toMatchObject({ status: 'scheduled', totals_provisional: true, total: 0, subtotal: 0, discount_total: 0 });
    expect(order?.marketplace_totals).toEqual({ total_order: 0, total_to_pay: 0, 'other_totals.tip': 0, 'other_totals.total_rappi_pay': 0, 'other_totals.total_rappi_credits': 0 });
    expect(() => normalizeWebhook(connection, { ...payload, action: undefined })).toThrow();
  });
  test('scheduled zero values are explicitly provisional and local time is preserved', () => {
    const connection = config('rappi');
    const payload = rappiOrder(connection.store_id);
    payload.order_detail.totals = { total_order: 0, total_products: 0, total_discounts: 0 };
    payload.order_detail.items[0].price = 0;
    payload.order_detail.items[0].subitems[0].price = 0;
    const event = normalizeWebhook(connection, { ...payload, action: 'scheduled',
      order_detail: { ...payload.order_detail, place_at: '2026-07-22 17:35:00' } });
    expect(event.normalized_order).toMatchObject({ status: 'scheduled', total: 0, totals_provisional: true, scheduled_at: '2026-07-22 17:35:00' });
    expect(normalizeWebhook(connection, payload).normalized_order?.totals_provisional).toBe(false);
    const cancelled = normalizeWebhook(connection, { action: 'cancelled', order_detail: { order_id: payload.order_detail.order_id, store_id: connection.store_id } });
    expect(cancelled.kind).toBe('cancel');
    expect(cancelled.normalized_order).toBeUndefined();
  });
  test('Uber webhook ignores its fetch target and parses IDs only', () => {
    const connection = config();
    const event = parseWebhook('uber_eats', { event_type: 'orders.notification', event_time: 1700000000,
      meta: { user_id: connection.store_id, resource_id: 'order-id' }, resource_href: 'https://127.0.0.1/private' });
    expect(event).toMatchObject({ external_store_id: connection.store_id, external_order_id: 'order-id', kind: 'order' });
    expect(event).not.toHaveProperty('resource_href');
    expect(parseWebhook('uber_eats', { event_type: 'orders.release', meta: { user_id: connection.store_id, resource_id: 'order-id' } }).kind).toBe('delivery');
  });
  test('tracking contains only provided external courier data and validates coordinates', () => {
    const connection = config('rappi');
    const payload = { store_id: connection.store_id, order_id: 'order-id', courier_id: 'courier-id', lat: 19, lng: -99, eta_in_millis: 120000 };
    expect(normalizeWebhook(connection, payload)).toMatchObject({ kind: 'delivery', delivery: { courier: { latitude: 19, longitude: -99 }, eta_minutes: 2 } });
    expect(() => normalizeWebhook(connection, { ...payload, lat: 91 })).toThrow();
    const taken = normalizeWebhook(connection, { store_id: connection.store_id, order_id: 'order-id', event: 'taken_visible_order',
      additional_information: { storekeeper_name: 'External Courier', eta_to_store: 147 } });
    expect(taken.delivery).toMatchObject({ provider_event: 'taken_visible_order', courier: { name: 'External Courier' }, eta_minutes: 2.45 });
    expect(taken.delivery?.status).toBeUndefined();
    for (const event of ['cancel_by_user', 'cancel_without_charges', 'canceled_store_closed']) {
      expect(parseWebhook('rappi', { store_id: connection.store_id, order_id: 'order-id', event }).kind).toBe('cancel');
    }
    expect(parseWebhook('rappi', { store_id: 999 }).kind).toBe('ignore');
    expect(parseWebhook('rappi', { store_id: connection.store_id, order_id: 'order-id', event: 'unrecognized', additional_information: {} }).kind).toBe('ignore');
  });
  test('malformed money, quantity, unsupported status and cross-store data fail closed', () => {
    const connection = config();
    const payload = uberOrder(connection.store_id);
    expect(() => normalizeOrder(connection, { ...payload, current_state: 'UNKNOWN' })).toThrow();
    expect(normalizeOrder(connection, { ...payload, current_state: 'DENIED' }).status).toBe('rejected');
    expect(() => normalizeOrder(connection, { ...payload, store: { id: 'different-store' } })).toThrow();
    payload.cart.items[0].quantity = -1;
    expect(() => normalizeOrder(connection, payload)).toThrow();
    payload.cart.items[0].quantity = 1;
    payload.payment.charges.total.amount = Number.NaN;
    expect(() => normalizeOrder(connection, payload)).toThrow();
    expect(() => normalizeOrder(config('rappi'), {})).toThrow();
  });
});