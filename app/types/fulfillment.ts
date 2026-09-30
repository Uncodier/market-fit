import type { CatalogItem } from "./catalog"

export interface Subscription {
  id: string;
  site_id: string;
  lead_id: string;
  buyer_user_id?: string | null;
  owner_site_id?: string | null;
  catalog_item_id: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  start_date: string;
  end_date?: string | null;
  next_billing_date?: string;
  amount: number;
  created_at: string;
  updated_at: string;
  catalog_item?: Partial<CatalogItem>;
  lead?: { name: string; email?: string };
}

export type ReservationResourceType = 'catalog_item' | 'location' | 'employee';

export type ReservationChannel = 'physical' | 'online';

export interface VisitsSettings {
  enabled_physical: boolean;
  enabled_online: boolean;
  require_signature: boolean;
  require_photo: boolean;
  require_id: boolean;
  terms_text: string;
  default_duration_minutes: number;
}

export interface Reservation {
  id: string;
  site_id: string;
  lead_id: string;
  buyer_user_id?: string | null;
  owner_site_id?: string | null;
  catalog_item_id?: string | null;
  resource_type?: ReservationResourceType;
  location_id?: string | null;
  assignee_user_id?: string | null;
  channel?: ReservationChannel;
  terms_text?: string | null;
  terms_accepted_at?: string | null;
  signature_url?: string | null;
  photo_url?: string | null;
  id_url?: string | null;
  signed_at?: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  start_time: string;
  end_time: string;
  notes?: string | null;
  quantity?: number;
  sale_order_item_id?: string | null;
  entitlement_id?: string | null;
  sale_order_id?: string | null;
  amount_due?: number | null;
  amount?: number | null;
  created_at: string;
  updated_at: string;
  catalog_item?: Partial<CatalogItem>;
  location?: { id: string; name: string } | null;
  lead?: { name: string; email?: string };
  buyer_profile?: { id: string; name?: string | null; avatar_url?: string | null } | null;
  is_task?: boolean;
  original_task_id?: string;
  original_task_type?: string;
  original_task_title?: string;
  original_task_description?: string;
  original_task_metadata?: any;
  original_schedule_id?: string;
}

export interface ReservationSchedule {
  id: string;
  name?: string;
  site_id: string;
  catalog_item_id: string;
  duration_minutes: number;
  capacity: number;
  timezone: string;
  days: {
    [day: string]: {
      enabled: boolean;
      start?: string;
      end?: string;
      timeBlocks?: { start: string; end: string }[];
    };
  };
  created_at: string;
  updated_at: string;
}

export interface CalendarBlock {
  id: string;
  site_id: string;
  entity_type: 'catalog_item' | 'user' | 'global';
  entity_id?: string | null;
  start_time: string;
  end_time: string;
  reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: string;
  site_id: string;
  deal_id?: string | null;
  lead_id: string;
  buyer_user_id?: string | null;
  price_list_id?: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  valid_until?: string | null;
  currency: string;
  notes?: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  catalog_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  metadata?: any;
}

export interface Entitlement {
  id: string;
  site_id: string;
  buyer_user_id: string;
  owner_site_id?: string | null;
  catalog_item_id: string;
  source_type: 'purchase' | 'subscription';
  source_id: string;
  status: 'active' | 'revoked' | 'expired' | 'used';
  granted_at: string;
  expires_at?: string | null;
  uses_total?: number | null;
  uses_remaining?: number | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlanItem {
  id: string;
  site_id: string;
  plan_catalog_item_id: string;
  digital_catalog_item_id: string;
  created_at: string;
}

export interface PassRedeemableItem {
  id: string;
  site_id: string;
  pass_catalog_item_id: string;
  reservable_catalog_item_id: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  site_id: string;
  name: string;
  code?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryLevel {
  id: string;
  site_id: string;
  catalog_item_id: string;
  location_id: string;
  quantity: number;
  updated_at: string;
}

export type PriceListChannel = "marketplace" | "shop" | "pos";

export interface PriceList {
  id: string;
  site_id: string;
  name: string;
  code?: string;
  currency: string;
  is_default: boolean;
  is_active: boolean;
  /** Channels where this list may apply. Defaults to POS-only. */
  channels?: PriceListChannel[];
  created_at: string;
  updated_at: string;
}

export interface PriceListItem {
  id: string;
  site_id: string;
  price_list_id: string;
  catalog_item_id: string;
  unit_price: number;
  updated_at: string;
}

export interface Shipment {
  id: string;
  site_id: string;
  sale_order_id: string;
  sale_id?: string;
  lead_id?: string;
  origin_location_id: string;
  status: 'pending' | 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  carrier?: string;
  tracking_number?: string;
  shipping_address?: any;
  stock_decremented: boolean;
  estimated_delivery_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  notes?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string | null;
  last_lat?: number;
  last_lng?: number;
  last_located_at?: string;
}

export interface ShipmentLocationPing {
  id: string;
  site_id: string;
  shipment_id: string;
  user_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at: string;
}

export type PromotionChannel = 'marketplace' | 'shop' | 'pos';

export interface Promotion {
  id: string;
  site_id: string;
  campaign_id: string;
  name: string;
  description?: string;
  code?: string;
  discount_type: 'percent' | 'fixed' | 'bogo';
  discount_value: number;
  /** Buy qty for BOGO (Buy X Get Y). Ignored for percent/fixed. */
  bogo_buy_qty?: number;
  /** Get (free) qty for BOGO. Ignored for percent/fixed. */
  bogo_get_qty?: number;
  applies_to: 'all' | 'selected_items';
  /** Channels where the promo applies. Empty/missing = all storefront channels. */
  channels?: PromotionChannel[];
  /** POS location IDs. Empty = all locations when POS is enabled. */
  location_ids?: string[];
  min_order_amount?: number | null;
  usage_limit?: number;
  usage_limit_per_user?: number;
  usage_count: number;
  status: 'draft' | 'active' | 'paused' | 'expired';
  starts_at?: string | null;
  ends_at?: string | null;
  active_weekdays?: number[];
  required_items_mode?: 'all' | 'any';
  /** Merchandising image for shop/marketplace cards. */
  image_url?: string | null;
  /** Show in shop merchandising surfaces. */
  show_on_shop?: boolean;
  /** Show in marketplace Discounts feed / product flags. */
  show_on_marketplace?: boolean;
  /** Currency for fixed discounts / min order. Null = site default. */
  currency?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PromotionRequiredItem {
  id: string;
  promotion_id: string;
  catalog_item_id: string;
  site_id: string;
  min_quantity: number;
}

export interface PromotionRequiredCategory {
  id: string;
  promotion_id: string;
  catalog_category_id: string;
  site_id: string;
  min_quantity: number;
}

export interface PromotionCatalogItem {
  id: string;
  promotion_id: string;
  catalog_item_id: string;
  site_id: string;
}

export interface PromotionCatalogCategory {
  id: string;
  promotion_id: string;
  catalog_category_id: string;
  site_id: string;
}
