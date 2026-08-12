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
import { isAccessOnlyItem, requiresVariantSelection } from "@/app/catalog/product-details";
import { createClient } from "@/lib/supabase/client";
import type { PosCartItem } from "@/app/pos/components/CartPanel";

type Args = {
  siteId?: string;
  userId?: string;
  leadValue: RelationSelectValue | string | null;
  leadRelationValue: RelationSelectValue;
  addItemToCart: (item: CatalogItem, extras?: Partial<PosCartItem>) => void;
  router: { push: (href: string) => void };
  t: (key: string) => string;
};

export function usePosAddItem({
  siteId,
  userId,
  leadValue,
  leadRelationValue,
  addItemToCart,
  router,
  t,
}: Args) {
  const [variantParentItem, setVariantParentItem] = useState<CatalogItem | null>(
    null,
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
      setVariantParentItem(item);
      return;
    }

    // Legacy parent_id children without variant_axes / is_purchasable=false
    if (navigator.onLine && !item.parent_id) {
      const supabase = createClient();
      const { count } = await supabase
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", item.id)
        .eq("status", "active")
        .eq("is_purchasable", true);
      if ((count || 0) > 0) {
        setVariantParentItem(item);
        return;
      }
    }

    if (
      item.availability_mode === "manual" &&
      item.availability_status !== "available"
    ) {
      toast.error(t("pos.errorItemNotAvailable") || "Item is not available");
      return;
    }

    if (item.is_reservation && !isAccessOnlyItem(item)) {
      router.push(`/pos/book/${item.id}`);
      return;
    }

    addItemToCart(item);
  };

  return {
    variantParentItem,
    setVariantParentItem,
    dynamicQuoteItem,
    setDynamicQuoteItem,
    dynamicQuoteLoading,
    addToCart,
    requestQuote,
  };
}
