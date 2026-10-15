export type MarketplaceProvider = 'uber_eats' | 'rappi';
export interface ProviderConfig {
  provider: MarketplaceProvider;
  environment: 'production' | 'sandbox';
  country: string;
  store_id: string;
  client_id: string;
  client_secret: string;
  /** Explicit Uber HMAC key; an empty platform value fails closed instead of using OAuth. */
  webhook_signing_key?: string;
  webhook_secret?: string;
  webhook_secrets?: Record<string, string>;
  /** Rappi must enable manual ready-for-pickup notifications for this store. */
  manual_ready?: boolean;
}

export type MarketplaceOrderStatus = 'pending' | 'accepted' | 'ready' | 'rejected' | 'cancelled' | 'completed' | 'scheduled';
export interface MarketplaceAction {
  action: 'accept' | 'reject' | 'ready' | 'cancel';
  reason?: string;
  cooking_time_minutes?: number;
}
export interface NormalizedOrderItem {
  /** Stable order-line identity, distinct from the repeatable menu product ID. */
  external_id: string;
  external_product_id?: string;
  sku?: string;
  name: string;
  notes?: string;
  quantity: number;
  unit_price: number;
  total: number;
  modifiers: NormalizedOrderItem[];
  modifier_group_id?: string;
  modifier_group_name?: string;
  /** Normalized parent line total already includes modifiers; do not charge them twice. */
  modifiers_included_in_price?: boolean;
}
export interface MarketplaceDelivery {
  courier?: {
    id?: string;
    name?: string;
    phone?: string;
    vehicle?: string;
    latitude?: number;
    longitude?: number;
    tracking_url?: string;
  };
  status?: string;
  /** Raw provider event label is not a native shipment stage. */
  provider_event?: string;
  address?: string;
  estimated_arrival_at?: string;
  eta_minutes?: number;
}
export interface NormalizedOrder {
  external_order_id: string;
  external_store_id: string;
  display_id: string;
  notes?: string;
  status: MarketplaceOrderStatus;
  currency: string;
  /** All monetary values are currency major units, never recalculated from catalog prices. */
  total: number;
  subtotal: number;
  discount_total: number;
  /** Scheduled early notifications must not settle sales using provisional zero prices. */
  totals_provisional: boolean;
  /** Provider-reported charge variants, when available; never inferred catalog/settlement values. */
  marketplace_totals?: Record<string, number>;
  items: NormalizedOrderItem[];
  customer: { name?: string; phone?: string; email?: string };
  fulfillment_method: 'delivery' | 'pickup';
  delivery_mode?: 'marketplace_managed' | 'merchant_managed';
  delivery?: MarketplaceDelivery;
  /** Rappi place_at may be store-local time without an offset; do not assume UTC. */
  scheduled_at?: string;
  accept_by?: string;
  event_at?: string;
}
export interface ProviderWebhookEvent {
  external_store_id: string;
  external_order_id?: string;
  event_key?: string;
  event_type: string;
  kind: 'order' | 'cancel' | 'delivery' | 'ignore';
  normalized_order?: NormalizedOrder;
  delivery?: MarketplaceDelivery;
  event_at?: string;
}
export interface ProviderActionResult {
  external_order_id: string;
  action: MarketplaceAction['action'];
  /** Provider acknowledgement, not a fabricated order/delivery state transition. */
  acknowledged: true;
}
export type ProviderErrorCode = 'invalid_config' | 'invalid_payload' | 'unsupported_operation' | 'not_found' | 'store_mismatch' | 'http_error' | 'timeout' | 'invalid_response';
export class MarketplaceProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode, message: string, public readonly http_status?: number) {
    super(message);
    this.name = 'MarketplaceProviderError';
  }
}