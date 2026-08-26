import type { CheckoutCartParams } from "@/app/commerce/checkout";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options";
import type { PosShippingAddress } from "@/app/pos/shipping-address";

export type OutboxStatus = "pending" | "syncing" | "failed" | "synced";

export type OutboxKind = "checkout" | "check_in" | "create_lead";

export type CheckoutOutboxPayload = Omit<CheckoutCartParams, "clientMutationId"> & {
  clientMutationId: string;
  /** Local temp lead id when created offline */
  localLeadId?: string | null;
};

export type CheckInOutboxPayload = {
  siteId: string;
  code: string;
  clientMutationId: string;
};

export type CreateLeadOutboxPayload = {
  siteId: string;
  localLeadId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  clientMutationId: string;
};

export type OutboxPayload =
  | { kind: "checkout"; data: CheckoutOutboxPayload }
  | { kind: "check_in"; data: CheckInOutboxPayload }
  | { kind: "create_lead"; data: CreateLeadOutboxPayload };

export type PosOutboxRow = {
  id: string;
  siteId: string;
  kind: OutboxKind;
  clientMutationId: string;
  payload: OutboxPayload;
  status: OutboxStatus;
  attempts: number;
  lastError?: string | null;
  resultSaleId?: string | null;
  resultOrderId?: string | null;
  resultOrderNumber?: string | null;
  resultKitchenDelta?: import("@/lib/printer/core/types").KitchenDelta | null;
  resultFulfillment?: string | null;
  resultLeadId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PosCartSession = {
  siteId: string;
  cart: PosCartItem[];
  leadValue: RelationSelectValue | string | null;
  fulfillment: CheckoutFulfillmentMethod;
  originLocationId: string;
  priceListId: string;
  promoCode: string;
  activeOrderId: string;
  buyerUserId: string | null;
  orderNotes?: string;
  shippingAddress?: PosShippingAddress;
  updatedAt: string;
};

export type PosMeta = {
  siteId: string;
  lastPulledAt: string | null;
  schemaVersion: number;
  /** host catalog_item_id → modifier groups with options (from last POS pull). */
  modifierGroupsByHostId?: Record<string, any[]>;
};

export type LocalPriceList = {
  id: string;
  site_id: string;
  name: string;
  is_active: boolean;
  is_default?: boolean;
  channels?: string[] | null;
};

export type LocalPriceListItem = {
  id: string;
  price_list_id: string;
  catalog_item_id: string;
  unit_price: number;
};

export type LocalPromotion = {
  id: string;
  site_id: string;
  name: string;
  code: string | null;
  status: string;
  discount_type: string;
  discount_value: number;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  applies_to: string;
  min_order_amount?: number | null;
  usage_limit?: number | null;
  usage_count?: number | null;
  usage_limit_per_user?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active_weekdays?: number[] | null;
  required_items_mode?: string | null;
  channels?: string[] | null;
  location_ids?: string[] | null;
  catalog_item_ids?: string[];
  category_ids?: string[];
  required_items?: { catalog_item_id: string; min_quantity: number }[];
  required_categories?: { catalog_category_id: string; min_quantity: number }[];
  image_url?: string | null;
  show_on_shop?: boolean;
  show_on_marketplace?: boolean;
};

export type LocalPendingOrder = {
  id: string;
  site_id: string;
  status: string;
  created_at: string;
  lead_id?: string | null;
  price_list_id?: string | null;
  amount_due?: number | null;
  total?: number | null;
  leads?: { id: string; name?: string | null; email?: string | null } | null;
  payment_status?: string | null;
  raw: any;
};

export type LocalReservationSlots = {
  id: string; // `${catalogItemId}:${startDate}:${endDate}`
  catalogItemId: string;
  startDate: string;
  endDate: string;
  slots: { start: string; end: string; available: number; timezone?: string }[];
  expiresAt: string;
};

export type IdMapRow = {
  localId: string;
  serverId: string;
  kind: "lead" | "order" | "sale";
  siteId: string;
};
