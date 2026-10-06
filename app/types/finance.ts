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
  dueDate?: string | null;
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
  created_by_user_id?: string | null;
  seller_user_id?: string | null;
  requested_by_lead_id?: string | null;
  promotion_id?: string;
  price_list_id?: string;
  fulfillment_method?: 'pickup' | 'ship' | 'dine_in' | 'none' | null;
  shipping_address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
  scheduled_for?: string | null;
  created_at: string;
  updated_at: string;
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
  dueDate?: string | null
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
  due_date?: string | null;
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
