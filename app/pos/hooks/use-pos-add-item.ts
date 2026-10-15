"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { CatalogItem } from "@/app/types";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import { resolveRelationId } from "@/app/commerce/resolve-relation";
import { requestDynamicQuote } from "@/app/quotations/dynamic-quote-actions";
import {
  hasDynamicQuoteFields,
  isDynamicPricedItem,
} from "@/app/catalog/dynamic-pricing";
import {
  isAccessOnlyItem,
  needsBuyerAccount,
  requiresVariantSelection,
} from "@/app/catalog/product-details";
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types";
import type { PosCartItem, PosCartModifier } from "@/app/pos/components/CartPanel";
import { isStorefrontAvailable } from "@/app/catalog/storefront-availability";
import type { PosItemAvailability } from "../cart-availability";
import { getPosItemModifierGroups } from "../item-options";

type Args = {
  siteId?: string;
  userId?: string;
  leadValue: RelationSelectValue | string | null;
  leadRelationValue: RelationSelectValue;
  addItemToCart: (item: CatalogItem, extras?: Partial<PosCartItem>) => void;
  router: { push: (href: string) => void };
  t: (key: string) => string;
  catalogItems: CatalogItem[];
  modifierGroupsByHostId: Record<string, ModifierGroupWithItems[]>;
  getItemAvailability?: (item: CatalogItem) => PosItemAvailability;
};

export function usePosAddItem({
  siteId,
  userId,
  leadValue,
  leadRelationValue,
  addItemToCart,
  router,
  t,
  catalogItems,
  modifierGroupsByHostId,
  getItemAvailability,
}: Args) {
  const variantParentIds = useMemo(() => new Set(
    catalogItems.filter((child) => child.parent_id && child.status === "active"
      && child.is_purchasable !== false).map((child) => child.parent_id),
  ), [catalogItems]);
  const canAdd = (item: CatalogItem) => {
    const availability = getItemAvailability?.(item);
    if (availability && !availability.sellable) {
      toast.error(availability.reason || "Sold out");
      return false;
    }
    return true;
  };
  const [optionsParentItem, setOptionsParentItem] =
    useState<CatalogItem | null>(null);
  const [reservationItem, setReservationItem] = useState<CatalogItem | null>(
    null,
  );
  const [reservationModifiers, setReservationModifiers] = useState<PosCartModifier[]>(
    [],
  );
  const [digitalItem, setDigitalItem] = useState<CatalogItem | null>(null);
  const [digitalModifiers, setDigitalModifiers] = useState<PosCartModifier[]>(
    [],
  );
  const [dynamicQuoteItem, setDynamicQuoteItem] = useState<CatalogItem | null>(
    null,
  );
  const [dynamicQuoteLoading, setDynamicQuoteLoading] = useState(false);

  const requestQuote = async (
    item: CatalogItem,
    fieldValues: Record<string, unknown>,
    quantity: number,
  ) => {
    if (!siteId) return;
    if (!navigator.onLine) {
      toast.error(
        t("pos.sync.requiresOnline") ||
          "This action requires an internet connection",
      );
      return;
    }
    const { id: leadId, error: leadError } = await resolveRelationId(
      "lead",
      leadRelationValue,
      siteId,
    );
    if (leadError || !leadId) {
      toast.error(leadError || "Select a client before requesting a quote");
      return;
    }
    setDynamicQuoteLoading(true);
    try {
      const res = await requestDynamicQuote({
        siteId,
        catalogItemId: item.id,
        leadId,
        quantity,
        fieldValues,
      });
      if (res.error && !res.data?.quotationId) throw new Error(res.error);
      toast.success(
        t("quotations.dynamicQuote.created") || "Quote request created",
      );
      setDynamicQuoteItem(null);
      if (res.data?.quotationId) {
        router.push(`/quotations/${res.data.quotationId}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to request quote");
    } finally {
      setDynamicQuoteLoading(false);
    }
  };

  const confirmOptions = (
    item: CatalogItem,
    modifiers: PosCartModifier[] = [],
  ) => {
    if (!canAdd(item)) return;
    const isReservable = item.is_reservation || optionsParentItem?.is_reservation;
    if (isReservable && !isAccessOnlyItem(item)) {
      setReservationItem(item);
      setReservationModifiers(modifiers);
      setOptionsParentItem(null);
      return;
    }

    if (needsBuyerAccount(item)) {
      setDigitalItem(item);
      setDigitalModifiers(modifiers);
      setOptionsParentItem(null);
      return;
    }
    
    addItemToCart(item, modifiers.length ? { modifiers } : undefined);
    setOptionsParentItem(null);
  };

  const confirmReservation = (
    item: CatalogItem,
    extras: { reservationStart: string; reservationEnd: string; reservationAvailableQty?: number },
  ) => {
    addItemToCart(item, {
      ...extras,
      ...(reservationModifiers.length ? { modifiers: reservationModifiers } : {})
    });
    setReservationItem(null);
    setReservationModifiers([]);
  };

  const confirmDigital = (
    item: CatalogItem,
    modifiers: PosCartModifier[] = [],
  ) => {
    addItemToCart(item, modifiers.length ? { modifiers } : undefined);
    setDigitalItem(null);
    setDigitalModifiers([]);
  };

  const openOptions = (item: CatalogItem) => {
    setOptionsParentItem(item);
  };

  const addToCart = async (item: CatalogItem) => {
    if (!siteId || !userId) return;
    if (!canAdd(item)) return;

    if (isDynamicPricedItem(item)) {
      if (!navigator.onLine) {
        toast.error(
          t("pos.sync.requiresOnline") ||
            "This action requires an internet connection",
        );
        return;
      }
      if (!leadValue) {
        toast.error(
          t("pos.selectClientFirst") ||
            "Select a client before requesting a quote",
        );
        return;
      }
      if (hasDynamicQuoteFields(item)) {
        setDynamicQuoteItem(item);
        return;
      }
      await requestQuote(item, {}, 1);
      return;
    }

    // All choices are already in the site-scoped snapshot. Keep the click path
    // synchronous, including legacy parents without variant_axes metadata.
    if (requiresVariantSelection(item) || variantParentIds.has(item.id)) {
      openOptions(item);
      return;
    }

    if (!isStorefrontAvailable(item)) {
      toast.error(t("pos.errorItemNotAvailable") || "Item is not available");
      return;
    }

    if (item.is_reservation && !isAccessOnlyItem(item)) {
      setReservationItem(item);
      return;
    }

    if (needsBuyerAccount(item)) {
      if (getPosItemModifierGroups(item, modifierGroupsByHostId).length) {
        openOptions(item);
        return;
      }
      setDigitalItem(item);
      setDigitalModifiers([]);
      return;
    }

    // Simple SKU with modifier groups → options dialog (extras only)
    if (getPosItemModifierGroups(item, modifierGroupsByHostId).length) {
      openOptions(item);
      return;
    }

    addItemToCart(item);
  };

  return {
    optionsParentItem,
    setOptionsParentItem,
    reservationItem,
    setReservationItem,
    digitalItem,
    setDigitalItem,
    digitalModifiers,
    dynamicQuoteItem,
    setDynamicQuoteItem,
    dynamicQuoteLoading,
    confirmOptions,
    confirmReservation,
    confirmDigital,
    addToCart,
    requestQuote,
  };
}
