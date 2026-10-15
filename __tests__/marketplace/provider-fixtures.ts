import { randomBytes, randomUUID } from 'node:crypto';
import type { ProviderConfig, MarketplaceProvider } from '../../lib/marketplace/providers/types';

export function config(provider: MarketplaceProvider = 'uber_eats'): ProviderConfig {
  return { provider, environment: 'sandbox', country: 'MX', store_id: randomUUID(),
    client_id: randomBytes(18).toString('hex'), client_secret: randomBytes(32).toString('hex'),
    webhook_secret: randomBytes(32).toString('hex') };
}
export function uberOrder(storeId: string, orderId: string = randomUUID()) {
  const money = (amount: number) => ({ amount, currency_code: 'USD' });
  return { id: orderId, display_id: 'LOCAL', current_state: 'CREATED', type: 'DELIVERY_BY_UBER',
    store: { id: storeId }, eater: { first_name: 'Offline', phone: '5550100' }, placed_at: '2026-01-01T12:00:00Z',
    cart: { items: [{ id: 'meal', title: 'Meal', quantity: 2, price: { unit_price: money(1250), total_price: money(2500) },
      selected_modifier_groups: [{ id: 'extras', title: 'Extras', selected_items: [{ id: 'cheese', title: 'Cheese', quantity: 1,
        price: { unit_price: money(250), total_price: money(250) }, selected_modifier_groups: null }] }] }] },
    payment: { charges: { total: money(3100), sub_total: money(2500), total_promo_applied: money(2800) },
      promotions: { promotions: [{ promo_discount_value: 300 }] } },
    deliveries: [{ id: 'courier-id', first_name: 'Courier', phone: '5550101', vehicle: { make: 'Test', model: 'Bike' }, current_state: 'EN_ROUTE_TO_PICKUP' }] };
}
export function rappiOrder(storeId: string, orderId: string = randomUUID()) {
  return { store: { internal_id: storeId, external_id: 'merchant-ref' }, customer: { first_name: 'Offline', last_name: 'Customer' },
    order_detail: { order_id: orderId, delivery_method: 'delivery', created_at: '2026-01-01T12:00:00Z',
      totals: { total_order: 315, total_products: 300, total_discounts: 20 },
      items: [{ id: 'meal', sku: 'sku-meal', name: 'Meal', quantity: 2, price: 100,
        subitems: [{ id: 'cheese', name: 'Cheese', quantity: 1, price: 25 }] }] } };
}
export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}