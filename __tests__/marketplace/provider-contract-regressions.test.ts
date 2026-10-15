/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import { actOnOrder, fetchNewOrders, fetchOrder, normalizeOrder } from '../../lib/marketplace/providers';
import { config, jsonResponse, rappiOrder } from './provider-fixtures';

describe('official provider contract regressions', () => {
  test('Uber Coffee removal example preserves instructions without a zero-quantity charge', () => {
    // https://developer.uber.com/docs/eats/references/api/v2/get-eats-order-orderid
    const connection = config();
    const money = (amount: number) => ({ amount, currency_code: 'USD' });
    const payload = {
      id: 'order', display_id: 'ORDER', current_state: 'CREATED', type: 'DELIVERY_BY_UBER',
      store: { id: connection.store_id }, deliveries: [],
      cart: { special_instructions: 'No peanuts', items: [{
        id: 'Coffee', instance_id: 'CoffeeInstance', title: 'Coffee', quantity: 1,
        special_instructions: 'make it iced please',
        price: { unit_price: money(300), total_price: money(300) },
        selected_modifier_groups: [{ id: 'Add-sugar', title: 'Add sugar', selected_items: null,
          removed_items: [{ id: 'Sugar', title: 'Sugar', quantity: 0, default_quantity: 2,
            price: { unit_price: money(0), total_price: money(0) } }] }],
      }] },
      payment: { charges: { total: money(300), sub_total: money(300) } },
    };
    const result = normalizeOrder(connection, payload);
    expect(result.notes).toBe('No peanuts');
    expect(result.items[0]).toMatchObject({ notes: 'make it iced please\nRemove: Sugar', total: 3, modifiers: [] });
    expect(result.total).toBe(3);
    payload.cart.items[0].special_instructions = 'x'.repeat(4000);
    expect(() => normalizeOrder(connection, payload)).toThrow();
  });

  test('official Rappi salad prices reconcile without payable child toppings', () => {
    // Price/quantity/totals excerpt: https://dev-portal.rappi.com/en/api-reference/orders/
    const connection = config('rappi');
    const result = normalizeOrder(connection, {
      store: { internal_id: connection.store_id }, order_detail: {
        order_id: '392625', delivery_method: 'delivery',
        totals: { total_products: 204000, total_discounts: 173685, total_order: 204180 },
        items: [
          { id: '2089918083', name: 'Chicken and Apple Salad', price: 28900, quantity: 3,
            subitems: [{ id: '10005260', name: 'Burrata Cheese', price: 13500, quantity: 1 }] },
          { id: '2089918082', name: 'Seafood Salad', price: 34900, quantity: 2,
            subitems: [{ id: '9928277', name: 'With white vinaigrette', price: 0, quantity: 1 },
              { id: '10005257', name: 'Ricotta Cheese', price: 3500, quantity: 1 }] },
        ],
      },
    });
    expect(result.items.map(item => item.total)).toEqual([127200, 76800]);
    expect(result.items.reduce((sum, item) => sum + item.total, 0)).toBe(result.subtotal);
    expect(result.items.every(item => item.modifiers_included_in_price === true)).toBe(true);
    expect(result.items[0].modifiers[0]).toMatchObject({ total: 13500, unit_price: 13500 });
  });

  test('Rappi actions and single-order refresh do not consume unrelated READY orders; recovery can reread SENT', async () => {
    // GET new changes READY -> SENT: https://dev-portal.rappi.com/en/managing-user-orders/
    const connection = config('rappi');
    const original = global.fetch;
    let ready = Array.from({ length: 25 }, (_, i) => rappiOrder(connection.store_id, `new-${i}`));
    const sent = [rappiOrder(connection.store_id, 'existing')];
    const requests: string[] = [];
    global.fetch = jest.fn(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path.includes('/token/')) return jsonResponse({ access_token: randomBytes(24).toString('hex') });
      requests.push(path);
      if (init?.method === 'PUT') return new Response(null, { status: 200 });
      if (path.endsWith('/status/sent')) return jsonResponse(sent);
      const rows = ready;
      sent.push(...ready);
      ready = [];
      return jsonResponse(rows);
    });
    try {
      await actOnOrder(connection, 'existing', { action: 'accept', cooking_time_minutes: 10 });
      await actOnOrder(connection, 'existing', { action: 'reject', reason: 'Unavailable' });
      expect(requests).toHaveLength(2);
      await fetchOrder(connection, 'existing');
      await expect(fetchOrder(connection, 'missing')).rejects.toMatchObject({ code: 'not_found' });
      expect(ready).toHaveLength(25);
      const before = requests.length;
      expect(await fetchNewOrders(connection)).toHaveLength(25);
      expect(requests).toHaveLength(before + 1);
      expect(ready).toHaveLength(0);
      expect(await fetchNewOrders(connection, 'sent')).toHaveLength(26);
      expect(requests).toHaveLength(before + 2);
      expect(requests.at(-1)).toMatch(/\/status\/sent$/);
    } finally { global.fetch = original; }
  });
});