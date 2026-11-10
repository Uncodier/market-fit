import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import type { PosCustomer } from "./customer-search";
import type { LocalPriceList } from "./local/types";
import { isPriceListAllowedForChannel } from "@/app/price-lists/price-list-channels";

export type PosCustomerValue = RelationSelectValue | string;
type PricedRelation = Exclude<RelationSelectValue, null> & { priceListId?: string | null };

/** Keep search-result pricing with the selection, including customers outside the local page. */
export function withCustomerPricing(value: RelationSelectValue, customer?: PosCustomer): RelationSelectValue {
  return value?.mode === "existing" && customer
    ? { ...value, priceListId: customer.default_price_list_id ?? null } as PricedRelation
    : value;
}

export function posCustomerId(value: PosCustomerValue): string | null {
  return typeof value === "string" ? value : value?.mode === "existing" ? value.id : null;
}

export function customerPriceList(value: PosCustomerValue, customers: PosCustomer[], lists: LocalPriceList[], siteId?: string) {
  const id = posCustomerId(value);
  const customer = customers.find((row) => row.id === id && (!row.site_id || row.site_id === siteId));
  const preference = typeof value === "object" && value && "priceListId" in value
    ? (value as PricedRelation).priceListId : customer?.default_price_list_id;
  return lists.find((list) => list.id === preference && (!siteId || list.site_id === siteId) &&
    list.is_active && isPriceListAllowedForChannel(list.channels, "pos"))?.id || "none";
}