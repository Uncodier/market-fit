"use client";

import { useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions";
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types";
import type { PosCartItem, PosCartModifier } from "@/app/pos/components/CartPanel";
import { getPosDb } from "@/app/pos/local/db";
import { isStorefrontAvailable } from "@/app/catalog/storefront-availability";

type Args = {
  siteId?: string;
  userId?: string;
  leadValue: RelationSelectValue | string | null;
  leadRelationValue: RelationSelectValue;
  addItemToCart: (item: CatalogItem, extras?: Partial<PosCartItem>) => void;
  router: { push: (href: string) => void };
  t: (key: string) => string;
  modifierGroupsByHostId?: Record<string, ModifierGroupWithItems[]>;
};

function groupsFromMap(
  hostIds: string[],
  map?: Record<string, ModifierGroupWithItems[]>,
): ModifierGroupWithItems[] {
  if (!map) return [];
  for (const hostId of hostIds) {
    if (map[hostId]?.length) return map[hostId];
  }
  return [];
}

async function hasModifierGroups(
  item: CatalogItem,
  siteId: string | undefined,
  modifierGroupsByHostId?: Record<string, ModifierGroupWithItems[]>,
): Promise<boolean> {
  const hostIds = [item.id, item.parent_id].filter(Boolean) as string[];

  if (groupsFromMap(hostIds, modifierGroupsByHostId).length > 0) return true;

  if (typeof window !== "undefined" && siteId) {
    try {
      const meta = await getPosDb().meta.get(siteId);
      if (
        groupsFromMap(
          hostIds,
          (meta as any)?.modifierGroupsByHostId,
        ).length > 0
      ) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const { data } = await getModifierGroupsForCatalogItem(item.id);
      if (data?.length) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export function usePosAddItem({
  siteId,
  userId,
  leadValue,
  leadRelationValue,
  addItemToCart,
  router,
  t,
  modifierGroupsByHostId,
}: Args) {
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
    fieldValues: Record<string, any>,
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
    } catch (err: any) {
      toast.error(err?.message || "Failed to request quote");
    } finally {
      setDynamicQuoteLoading(false);
    }
  };

  const confirmOptions = (
    item: CatalogItem,
    modifiers: PosCartModifier[] = [],
  ) => {
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

    if (requiresVariantSelection(item)) {
      openOptions(item);
      return;
    }

    // Legacy parents with purchasable children but no variant_axes metadata
    if (navigator.onLine && !item.parent_id) {
      const supabase = createClient();
      const { count } = await supabase
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", item.id)
        .eq("status", "active")
        .eq("is_purchasable", true);
      if ((count || 0) > 0) {
        openOptions(item);
        return;
      }
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
      if (await hasModifierGroups(item, siteId, modifierGroupsByHostId)) {
        openOptions(item);
        return;
      }
      setDigitalItem(item);
      setDigitalModifiers([]);
      return;
    }

    // Simple SKU with modifier groups → options dialog (extras only)
    if (await hasModifierGroups(item, siteId, modifierGroupsByHostId)) {
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
