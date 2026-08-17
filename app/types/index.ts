// Campaign types
export type CampaignStatus = 'active' | 'pending' | 'completed';
export type CampaignPriority = 'high' | 'medium' | 'low';
export type CampaignType = 'inbound' | 'outbound' | 'branding' | 'product' | 'events' | 'success' | 'account' | 'community' | 'guerrilla' | 'affiliate' | 'experiential' | 'programmatic' | 'performance' | 'publicRelations';

// KPI types
export type KpiType = 'revenue' | 'conversion' | 'retention' | 'acquisition' | 'engagement' | 'satisfaction' | 'growth' | 'custom';
export type KpiUnit = 'currency' | 'percentage' | 'count' | 'ratio' | 'time' | 'custom';

export interface Kpi {
  id: string;
  name: string;
  description: string | null;
  value: number;
  previous_value: number;
  unit: string;
  type: KpiType;
  period_start: string;
  period_end: string;
  segment_id: string | null;
  is_highlighted: boolean;
  target_value: number | null;
  metadata: any | null;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  trend: number;
  benchmark: number | null;
}

export interface KpiData {
  id: string;
  name: string;
  description: string | null;
  value: number;
  previous_value: number;
  unit: string;
  type: string;
  period_start: string;
  period_end: string;
  segment_id: string | null;
  is_highlighted: boolean;
  target_value: number | null;
  metadata: any | null;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  trend: number;
  benchmark: number | null;
}

export interface Revenue {
  actual: number;
  projected: number;
  estimated: number;
  currency: string;
}

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

export interface Budget {
  allocated: number;
  remaining: number;
  currency: string;
}

export interface Transaction {
  id: string;
  campaignId: string;
  type: 'fixed' | 'variable';
  amount: number;
  description: string;
  category: string;
  date: string;
  currency: string;
  siteId: string;
  userId: string;
  locationId?: string | null;
  leadId?: string | null;
  segmentId?: string | null;
  catalogItemId?: string | null;
  catalogCategoryId?: string | null;
  companyId?: string | null;
  saleOrderId?: string | null;
  accountingState?: 'pending' | 'posted' | 'unpublished';
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  notes?: string;
}

export interface Sale {
  id: string;
  title: string;
  description?: string;
  productName: string;
  productType?: string | null;
  productDetails?: any;
  amount: number;
  amount_due: number;
  currency?: string;
  location_id?: string | null;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  locationId?: string | null;
  leadId: string | null;
  leadName: string | null;
  leadEmail?: string | null;
  lastEmailedAt?: string | null;
  publicAccessToken?: string | null;
  campaignId: string | null;
  segmentId: string | null;
  saleDate: string;
  paymentMethod: string;
  paymentDetails?: any;
  payments?: Payment[];
  invoiceNumber?: string;
  referenceCode?: string;
  externalId?: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  source: 'retail' | 'online' | 'quote' | 'marketplace';
  channel?: string;
  notes?: string;
  tags?: string[];
  siteId: string;
  userId: string;
  buyerUserId?: string | null;
  ownerSiteId?: string | null;
  companyId?: string | null;
  accountingState?: 'pending' | 'posted' | 'unpublished';
  createdAt: string;
  updatedAt: string;
  commandId?: string;
}

export interface SaleOrderItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  subtotal: number;
}

export interface SaleOrder {
  id: string;
  saleId: string;
  orderNumber: string;
  items: SaleOrderItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  currency?: string;
  notes?: string;
  status: string;
  siteId: string;
  buyerUserId?: string | null;
  ownerSiteId?: string | null;
  promotionId?: string;
  priceListId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleOrderData {
  id: string;
  sale_id: string;
  order_number: string;
  items: SaleOrderItem[]; // stored as JSONB in the database
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  currency?: string;
  notes?: string;
  status: string;
  site_id: string;
  buyer_user_id?: string | null;
  owner_site_id?: string | null;
  promotion_id?: string;
  price_list_id?: string;
  fulfillment_method?: 'pickup' | 'ship' | 'dine_in' | 'none' | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignSubtask {
  id: string;
  campaignId: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  priority: CampaignPriority;
  status: CampaignStatus;
  dueDate: string;
  assignees: number;
  issues: number;
  revenue: Revenue;
  budget: Budget;
  type: CampaignType;
  siteId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  subtasks?: CampaignSubtask[];
  segments?: string[];
  segmentObjects?: Array<{id: string, name: string}>;
  requirements?: string[];
  metadata?: {
    payment_status?: {
      status: 'pending' | 'paid' | 'failed'
      amount_paid?: number
      amount_due?: number
      currency?: string
      payment_method?: string
      stripe_payment_intent_id?: string
      payment_date?: string
      invoice_number?: string
      outsourced?: boolean
      outsource_provider?: string
      outsource_contact?: string
    }
  };
}

// Database model types (for use with Supabase)
export interface CampaignData {
  id: string;
  title: string;
  description: string | null;
  priority: CampaignPriority;
  status: CampaignStatus;
  due_date: string | null;
  assignees: number;
  issues: number;
  revenue: Revenue;
  budget: Budget;
  type: CampaignType;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export interface TransactionData {
  id: string;
  campaign_id: string;
  type: 'fixed' | 'variable';
  amount: number;
  description: string | null;
  category: string;
  date: string;
  currency: string;
  site_id: string;
  user_id: string;
  location_id?: string | null;
  lead_id?: string | null;
  segment_id?: string | null;
  catalog_item_id?: string | null;
  catalog_category_id?: string | null;
  company_id?: string | null;
  accounting_state?: 'pending' | 'posted' | 'unpublished';
  created_at: string;
  updated_at: string;
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface AccountingAccount {
  id: string;
  siteId: string;
  code: string;
  key: string | null;
  type: AccountType;
  label: string;
  system: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type JournalSourceType = 'sale' | 'expense' | 'purchase' | 'opening' | 'manual';

export type PurchaseLineInput = {
  catalogItemId?: string | null
  name: string
  quantity: number
  unitCost: number
}

export interface PurchaseItem {
  id: string
  purchaseId: string
  siteId: string
  catalogItemId?: string | null
  name: string
  quantity: number
  unitCost: number
  subtotal: number
  catalogItemKind?: string | null
}

export interface Purchase {
  id: string
  siteId: string
  vendorCompanyId?: string | null
  vendorName?: string | null
  vendorEmail?: string | null
  lastEmailedAt?: string | null
  publicAccessToken?: string | null
  userId?: string | null
  title: string
  status: 'draft' | 'pending' | 'completed' | 'cancelled'
  amount: number
  amountDue: number
  currency: string
  payments: Payment[]
  purchaseDate: string
  locationId?: string | null
  accountingState: 'pending' | 'posted' | 'unpublished'
  stockReceived: boolean
  notes?: string | null
  items?: PurchaseItem[]
  createdAt: string
  updatedAt: string
}

export interface JournalEntry {
  id: string;
  siteId: string;
  entryDate: string;
  memo: string | null;
  status: string;
  sourceType: JournalSourceType;
  sourceId: string | null;
  idempotencyKey: string;
  sourceHash: string | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLine {
  id: string;
  entryId: string;
  accountCode: string;
  debit: number;
  credit: number;
  locationId: string | null;
  leadId?: string | null;
  campaignId?: string | null;
  segmentId?: string | null;
  catalogItemId?: string | null;
  catalogCategoryId?: string | null;
  companyId?: string | null;
  createdAt: string;
}

export interface SaleData {
  id: string;
  title: string;
  product_name: string | null;
  product_type: string | null;
  amount: number;
  amount_due: number;
  currency?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  lead_id: string | null;
  lead_name?: string | null; // Para cuando se carga con joins
  campaign_id: string | null;
  segment_id: string | null;
  sale_date: string;
  payment_method: string | null;
  payment_details?: any;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  external_id?: string | null;
  payments?: Payment[];
  source: 'retail' | 'online' | 'quote' | 'marketplace';
  notes: string | null;
  site_id: string;
  user_id: string;
  buyer_user_id?: string | null;
  owner_site_id?: string | null;
  company_id?: string | null;
  accounting_state?: 'pending' | 'posted' | 'unpublished';
  created_at: string;
  updated_at: string;
}

export interface CampaignSubtaskData {
  id: string;
  campaign_id: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface CampaignSegmentData {
  campaign_id: string;
  segment_id: string;
}

export interface CampaignRequirementData {
  campaign_id: string;
  requirement_id: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskCategory {
  task_id: string;
  category_id: string;
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  attachments: any[]
  created_at: string
  updated_at: string
  is_private: boolean
  files: Array<{
    name: string
    url: string
    size: number
    type: string
  }>
  cta?: {
    primary_action: {
      title: string
      url: string
    }
  }
  profiles?: {
    id: string
    name: string
    avatar_url?: string
  }
}

export interface Task {
  id: string
  serial_id: string
  title: string
  description: string | null
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'canceled'
  stage?: 'awareness' | 'consideration' | 'decision' | 'purchase' | 'retention' | 'referral'
  scheduled_date: string
  lead_id?: string
  assignee?: string
  type?: string
  priority: number
  address?: any
  site_id: string
  created_at: string
  updated_at: string
  category_id?: string
  leads?: {
    id: string
    name: string
  }
  assignee_details?: {
    id: string
    name: string
  }
  comments?: TaskComment[]
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
  | 'custom';     // escape hatch: free label + values

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
  /** Location IDs where store pickup is available for this item. Empty = all active site locations. */
  pickup_location_ids?: string[];
  variant_axes?: VariantAxis[];          // For parent items: defined variant axes
  option_values?: Record<string, string>; // For child items: selected axis value ID by axis ID
  dynamic_pricing?: DynamicPricingConfig;
  shipping_cost?: number | null;
  shipping_cost_mode?: 'extra' | 'covers_order';
  reservation_mode?: 'parent' | 'override' | 'independent';
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
  category_id?: string;
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
  is_purchasable?: boolean;
  /** Digital assets included when this recurring plan is purchased */
  plan_includes?: CatalogRelatedItem[];
  /** Reservable services/plans this pass can redeem against */
  pass_redeems?: CatalogRelatedItem[];
  created_at: string;
  updated_at: string;
}

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
  notes?: string;
  quantity?: number;
  sale_order_item_id?: string | null;
  entitlement_id?: string | null;
  created_at: string;
  updated_at: string;
  catalog_item?: Partial<CatalogItem>;
  location?: { id: string; name: string } | null;
  lead?: { name: string; email?: string };
  buyer_profile?: { id: string; name?: string | null; avatar_url?: string | null } | null;
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
  assigned_to?: string;
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
