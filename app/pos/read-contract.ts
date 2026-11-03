import { z } from "zod";
import type { PosCatalogSnapshot } from "./actions/pull-snapshot";
import type { listPosOpenOrders } from "./actions/list-open-orders";
import { posOrderReadLines } from "./order-read-lines";

export const posReadSiteSchema = z.string().uuid().or(z.string().max(128).regex(/^demo-[a-zA-Z0-9-]+$/));
export const posCatalogReadInput = z.object({
  siteId: posReadSiteSchema,
  revision: z.string().min(1).max(4096).optional(),
  bypassCache: z.enum(["true", "false"]).optional(),
}).strict();
export const posOrdersReadInput = z.object({ siteId: posReadSiteSchema }).strict();

const id = z.string().min(1).max(256);
const number = z.number().finite();
const text = z.string().nullable().optional();
const amount = number.nullable().optional();
const namedRow = z.object({ id, name: z.string(), site_id: id.optional() }).passthrough();
const lead = z.object({ id, name: text, email: text }).passthrough();
const catalogItem = namedRow.extend({
  kind: z.string(), status: z.string(), parent_id: id.nullable().optional(),
  target_sale_price: amount, sort_order: amount, currency: text,
  is_pos_available: z.boolean().nullable().optional(),
  is_purchasable: z.boolean().nullable().optional(),
  track_inventory: z.boolean().nullable().optional(),
  availability_mode: z.enum(["manual", "inventory", "always"]).nullable().optional(),
  availability_status: text,
});
const promotion = namedRow.extend({
  discount_type: z.enum(["percent", "fixed", "bogo"]), discount_value: number,
  status: z.string(), applies_to: z.enum(["all", "selected_items"]),
  catalog_item_ids: z.array(id), category_ids: z.array(id),
  required_items: z.array(z.object({ catalog_item_id: id, min_quantity: number }).passthrough()),
  required_categories: z.array(z.object({ catalog_category_id: id, min_quantity: number }).passthrough()),
  channels: z.array(z.string()).nullable().optional(), location_ids: z.array(id).nullable().optional(),
  bogo_buy_qty: amount, bogo_get_qty: amount, min_order_amount: amount,
  usage_limit: amount, usage_limit_per_user: amount, usage_count: amount,
  active_weekdays: z.array(number.int().min(0).max(6)).nullable().optional(),
});
const modifier = namedRow.extend({
  min_select: number, max_select: number.nullable(), sort_order: number,
  items: z.array(z.object({
    id, catalog_item_id: id, name: z.string(), price: number, sort_order: number,
  }).passthrough()),
});

// Preserve the existing catalog's extensible fields, while validating all row
// identities, collection shapes and pricing/stock structures before replacement.
const snapshot = z.object({
  catalogItems: z.array(catalogItem), categories: z.array(namedRow),
  locations: z.array(namedRow.extend({ is_active: z.boolean().nullable().optional(), is_default: z.boolean().nullable().optional() })),
  leads: z.array(lead.extend({ site_id: id.optional() })),
  priceLists: z.array(namedRow.extend({ is_active: z.boolean(), is_default: z.boolean().nullable().optional(), channels: z.array(z.string()).nullable().optional() })),
  priceListItems: z.array(z.object({ id, price_list_id: id, catalog_item_id: id, unit_price: number }).passthrough()),
  taxesByItem: z.record(id, z.array(namedRow.extend({ rate: number }))),
  promotions: z.array(promotion), modifierGroupsByHostId: z.record(id, z.array(modifier)),
  inventorySnapshot: z.object({
    policy: z.enum(["allow", "warn", "block"]),
    levels: z.array(z.object({ catalog_item_id: id, location_id: id, quantity: number }).strict()),
  }).strict(),
  pulledAt: z.string().datetime({ offset: true }), replaceLeads: z.boolean().optional(),
}).strict();

const sale = z.object({
  id: id.optional(), status: text, source: text, amount, amount_due: number,
  payment_method: text, payments: z.array(z.object({ amount }).passthrough()).nullable().optional(),
  leads: lead.nullable().optional(),
}).passthrough();
const order = z.object({
  id, site_id: id, sale_id: id, status: z.enum(["pending", "in_progress", "completed"]),
  created_at: z.string().datetime({ offset: true }), updated_at: text,
  total: amount, subtotal: amount, tax_total: amount, discount_total: amount,
  order_number: text, currency: text, notes: text, origin_location_id: text,
  price_list_id: text, promotion_id: text, buyer_user_id: text, seller_user_id: text,
  scheduled_for: text, fulfillment_method: text,
  seller: z.object({ id, name: z.string() }).optional(),
  sale_order_items: posOrderReadLines,
  sales: sale, leads: lead.nullable().optional(),
}).passthrough();

export type PosOpenOrdersResult = Awaited<ReturnType<typeof listPosOpenOrders>>;
export type PosCatalogReadResult = { data: PosCatalogSnapshot } | { error: string };

function hasForeignSite(rows: Array<Record<string, unknown> | null | undefined>, siteId: string): boolean {
  // Scope only known database entities, not arbitrary metadata/extension JSON.
  return rows.some((row) => row && "site_id" in row && row.site_id !== siteId);
}

export function parsePosCatalogRead(value: unknown, siteId: string): PosCatalogSnapshot | null {
  const result = z.object({ data: snapshot }).strict().safeParse(value);
  if (!result.success) return null;
  const data = result.data.data;
  const groups = Object.values(data.modifierGroupsByHostId).flat();
  if (hasForeignSite([
    ...data.catalogItems, ...data.categories, ...data.locations, ...data.leads,
    ...data.priceLists, ...data.priceListItems, ...data.promotions,
    ...Object.values(data.taxesByItem).flat(), ...groups, ...groups.flatMap((group) => group.items),
  ], siteId)) return null;
  return data;
}

export function parsePosOrdersRead(value: unknown, siteId: string): PosOpenOrdersResult["data"] | null {
  const result = z.object({ data: z.array(order).max(100) }).strict().safeParse(value);
  if (!result.success || hasForeignSite(result.data.data.flatMap((row) => [
    row, ...row.sale_order_items, row.sales, row.leads, row.sales.leads,
  ]), siteId)) return null;
  // The action's generic return type includes DB fields preserved by passthrough.
  return result.data.data as PosOpenOrdersResult["data"];
}