import type { StorefrontShopFields } from "@/app/commerce/storefront-display-helpers"
import type { PaymentMethodType } from "@/app/commerce/payment-options"

export interface CatalogItemFile {
  id: string;
  site_id: string;
  catalog_item_id: string;
  file_name: string;
  storage_path: string;
  mime_type?: string;
  size_bytes?: number;
  sort_order?: number;
  created_at: string;
}

// --- New Commerce Types ---

export interface CatalogCategory {
  id: string;
  site_id: string;
  name: string;
  description?: string;
  sort_order: number;
  income_account_key?: string | null;
  cogs_account_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tax {
  id: string;
  site_id: string;
  name: string;
  /** Percentage rate, e.g. 16 for 16%. */
  rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogItemTax {
  id: string;
  site_id: string;
  catalog_item_id: string;
  tax_id: string;
  created_at: string;
  tax?: Tax;
}

export interface CatalogItemAttributes {
  // People / place (service, course, ticket, reservation)
  /** @deprecated use item_specs with category 'instructor' */
  instructor?: string;   // maestro / teacher / host
  /** @deprecated use item_specs with category 'venue' */
  venue?: string;        // place name
  /** @deprecated move to venue item_spec */
  address?: string;
  /** @deprecated move to venue item_spec */
  city?: string;

  // Timing / level (course, service, ticket)
  duration?: string;     // e.g. "60 min", "8 weeks"
  level?: string;        // beginner / intermediate / ...
  language?: string;
  event_date?: string;   // ISO or display string for tickets/events

  // Physical product
  /** @deprecated use item_specs with category 'brand' */
  brand?: string;
  material?: string;
  dimensions?: string;
  weight?: string;
  warranty?: string;

  // Digital file / license
  format?: string;       // PDF, ZIP, MP4...
  file_size?: string;
  license_type?: string;
  seats?: string;
}

export type VariantAxisKind =
  | 'size'        // S/M/L, EU 42, etc.
  | 'color'       // swatches
  | 'brand'       // when brand changes SKU/price (not marketing-only)
  | 'condition'   // new / used / refurbished ("estado")
  | 'material'
  | 'style'       // cut, model, flavor
  | 'pack'        // single / pack of 3
  | 'duration'     // 60min / 90min (services)
  | 'capacity'    // individual / duo / group
  | 'format'      // physical vs digital edition, PDF vs EPUB
  | 'custom';

// escape hatch: free label + values

export interface VariantAxisValue {
  id: string;                 // "m", "red"
  label: string;              // "M", "Red"
  hex?: string;               // color swatches
  sort_order?: number;
}

export interface VariantAxis {
  id: string;                 // stable key, e.g. "size"
  kind: VariantAxisKind;
  label?: string;             // override; default from i18n by kind
  values: VariantAxisValue[];
}

export interface ItemSpecCategory {
  id: string;
  site_id: string;
  slug: string;
  name: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemSpec {
  id: string;
  site_id: string;
  category_id: string;
  name: string;
  image_url?: string | null;
  video_url?: string | null;
  address?: string | null;
  city?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  category?: ItemSpecCategory;
}

export interface CatalogItemSpec {
  catalog_item_id: string;
  item_spec_id: string;
  sort_order: number;
  item_spec?: ItemSpec;
}

export type DynamicQuoteFieldType =
  | 'text'
  | 'number'
  | 'phone'
  | 'address'
  | 'email'
  | 'distance'
  | 'location'
  | 'date'
  | 'select'
  | 'boolean';

export interface DynamicQuoteField {
  key: string;
  label: string;
  /** Controls input UX across shop, marketplace, POS, and quotations */
  type: DynamicQuoteFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface QuoteExpiration {
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface DynamicPricingConfig {
  agent_prompt: string;
  min_price?: number;
  revision_count: number;
  requires_advanced_compute: boolean;
  requires_authorization: boolean;
  quote_expiration?: QuoteExpiration;
  fields: DynamicQuoteField[];
}

export type DynamicQuoteStatus =
  | 'pending'
  | 'processing'
  | 'priced'
  | 'failed'
  | 'awaiting_authorization';

export interface DynamicQuoteMetadata {
  field_values?: Record<string, unknown>;
  status?: DynamicQuoteStatus;
  min_price?: number;
  revision_count?: number;
  requires_authorization?: boolean;
  requires_advanced_compute?: boolean;
  quote_expiration?: QuoteExpiration;
  priced_at?: string;
  catalog_item_requirement_id?: string;
  assistant_instance_id?: string;
  assistant_log_ids?: string[];
  error?: string;
  rationale?: string;
}

export interface CatalogItemRequirement {
  id: string;
  site_id: string;
  catalog_item_id: string;
  requirement_id: string;
  instance_id: string;
  created_at: string;
  updated_at: string;
}

export interface CatalogItemMetadata {
  gallery?: string[];                    // extra images beyond image_url
  videos?: { url: string; title?: string }[];  // YouTube/Vimeo/external links
  hashtags?: string[];                   // normalized without leading # preferred
  specs?: { label: string; value: string }[];  // freeform key/value
  attributes?: CatalogItemAttributes;    // typed fields by product kind
  delivery_options?: Array<'pickup' | 'ship' | 'none' | 'dine_in'>;
  payment_options?: PaymentMethodType[];
  /** Location IDs where store pickup is available for this item. Empty = all active site locations. */
  pickup_location_ids?: string[];
  variant_axes?: VariantAxis[];          // For parent items: defined variant axes
  option_values?: Record<string, string>; // For child items: selected axis value ID by axis ID
  dynamic_pricing?: DynamicPricingConfig;
  shipping_cost?: number | null;
  shipping_cost_mode?: 'extra' | 'covers_order';
  reservation_mode?: 'parent' | 'override' | 'independent';
  show_available_inventory?: boolean;
  show_buyers?: boolean;
}

/** Lightweight catalog link for list/table relation chips */
export interface CatalogRelatedItem {
  id: string;
  name: string;
  kind?: 'product' | 'service' | 'digital_asset';
  digital_subtype?: 'ticket' | 'course' | 'file' | 'pass' | 'license' | null;
}

export interface CatalogItem {
  id: string;
  site_id: string;
  site?: {
    id: string;
    name: string;
    logo_url?: string | null;
    description?: string | null;
    slug?: string | null;
  } | null;
  category_id?: string;
  category?: { name: string } | null;
  kind: 'product' | 'service' | 'digital_asset';
  digital_subtype?: 'ticket' | 'course' | 'file' | 'pass' | 'license' | null;
  is_marketplace_listed?: boolean;
  name: string;
  description?: string;
  image_url?: string;
  sku?: string;
  cost?: number;
  lowest_sale_price?: number;
  target_sale_price?: number;
  currency?: string;
  track_inventory: boolean;
  availability_mode: 'manual' | 'inventory' | 'always';
  availability_status: 'available' | 'unavailable' | 'sold_out';
  status: 'active' | 'archived';
  sort_order: number;
  is_pos_available: boolean;
  is_recurring: boolean;
  is_reservation: boolean;
  is_dynamic_price?: boolean;
  pass_uses?: number | null;
  pass_validity_days?: number | null;
  /** Pass redeemables: buyer picks a service, or commerce auto-assigns round-robin. */
  redeem_assignment_mode?: 'user_choice' | 'round_robin' | null;
  metadata?: CatalogItemMetadata;
  item_specs?: ItemSpec[];
  parent_id?: string | null;
  parent?: { name: string };
  _parent?: { name: string };
  _shop?: StorefrontShopFields & {
    categoryName?: string;
    siteDescription?: string | null;
    sellable?: boolean;
    hasVariants?: boolean;
    variantLabels?: string[];
    children?: CatalogItem[];
  };
  is_purchasable?: boolean;
  /** Digital assets included when this recurring plan is purchased */
  plan_includes?: CatalogRelatedItem[];
  /** Reservable services/plans this pass can redeem against */
  pass_redeems?: CatalogRelatedItem[];
  created_at: string;
  updated_at: string;
}
