"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { CatalogItem } from "@/app/types";
import { toast } from "sonner";
import type { PosCartItem } from "../cart-types";
import type { PosCustomer } from "../customer-search";
import { customerPriceList, posCustomerId, type PosCustomerValue } from "../customer-pricing";
import type { LocalPriceList, LocalPriceListItem, PosCartSession } from "../local/types";
import { resolveUnitPriceLocal } from "../local/resolve-unit-price-local";
import { repricePosCart } from "../reprice-cart";
import { normalizeCheckoutLinesToCurrency, resolveProductCurrency } from "@/app/commerce/checkout-currency";

export function usePosCustomerPricing({ siteId, cart, setCart, catalogItems, customers,
  priceLists, priceListItems, rates, siteCurrency = "USD" }: {
  siteId?: string; siteCurrency?: string; cart: PosCartItem[]; setCart: Dispatch<SetStateAction<PosCartItem[]>>;
  catalogItems: CatalogItem[]; customers: PosCustomer[]; priceLists: LocalPriceList[];
  priceListItems: LocalPriceListItem[]; rates: Record<string, number>;
}) {
  const [leadValue, setCustomer] = useState<PosCustomerValue>(null);
  const [priceListId, setPriceListId] = useState("none");
  const [priceListSource, setSource] = useState<"automatic" | "manual" | "restored">("automatic");
  // One index per dataset refresh, not one scan (or request) per cart product.
  const itemIndex = useMemo(() => new Map(priceListItems.map((row) =>
    [`${row.price_list_id}:${row.catalog_item_id}`, row])), [priceListItems]);
  const resolvePrice = useCallback((item: CatalogItem, listId = priceListId) => {
    const resolved = resolveUnitPriceLocal({ catalogItemId: item.id, targetSalePrice: item.target_sale_price,
      priceListId: listId === "none" ? undefined : listId, priceLists, priceListItems,
      itemIndex });
    const currency = resolveProductCurrency(item.currency, siteCurrency);
    return normalizeCheckoutLinesToCurrency([{ currency: resolved.currency || currency,
      unit_price: resolved.price, subtotal: resolved.price }], currency, rates).lines[0].unit_price;
  }, [priceListId, priceLists, priceListItems, itemIndex, rates, siteCurrency]);

  const restorePricing = useCallback((session: Pick<PosCartSession, "leadValue" | "priceListId" | "priceListSource">) => {
    setCustomer(session.leadValue);
    setPriceListId(session.priceListId || "none");
    setSource(session.priceListSource || "restored");
  }, []);
  const resetPricing = useCallback(() => {
    setCustomer(null); setPriceListId("none"); setSource("automatic");
  }, []);
  const setLeadValue = useCallback((value: PosCustomerValue) => {
    const switched = posCustomerId(value) !== posCustomerId(leadValue);
    // Renaming an uncached selected customer must not discard search-result pricing.
    if (!switched && typeof value === "object" && value && !("priceListId" in value) &&
      typeof leadValue === "object" && leadValue && "priceListId" in leadValue) {
      value = { ...leadValue, ...value };
    }
    if (!switched && priceListSource !== "automatic") { setCustomer(value); return; }
    const nextId = customerPriceList(value, customers, priceLists, siteId);
    try {
      const next = nextId === priceListId ? cart : repricePosCart(cart, catalogItems,
        (item) => resolvePrice(item, nextId), rates, { automatic: true, siteCurrency });
      setCustomer(value); setPriceListId(nextId); setSource("automatic"); setCart(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update customer prices.");
    }
  }, [leadValue, priceListSource, customers, priceLists, siteId, priceListId, cart, catalogItems, resolvePrice, rates, setCart, siteCurrency]);
  const handlePriceListChange = (newId: string) => {
    try {
      const next = repricePosCart(cart, catalogItems, (item) => resolvePrice(item, newId), rates, { siteCurrency });
      setPriceListId(newId); setSource("manual"); setCart(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update line prices.");
    }
  };
  return { leadValue, setLeadValue, priceListId, priceListSource, restorePricing, resetPricing,
    resolvePrice, handlePriceListChange };
}