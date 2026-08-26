"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "@/app/types";
import {
  readLocalCatalog,
  readLocalPendingOrders,
  readLocalPromotions,
  readTaxesByItemIds,
} from "@/app/pos/local/snapshot-pull";
import { getPosDb } from "@/app/pos/local/db";
import { subscribePosSync } from "@/app/pos/local/sync-engine";
import type { LocalPendingOrder, LocalPromotion } from "@/app/pos/local/types";
import { selectPosOpenOrders } from "@/app/pos/open-orders";
import { isStorefrontAvailable } from "@/app/catalog/storefront-availability";

export function usePosCatalog(siteId: string | undefined) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<LocalPendingOrder[]>([]);
  const [promotions, setPromotions] = useState<LocalPromotion[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [lastPulledAt, setLastPulledAt] = useState<string | null>(null);
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [modifierGroupsByHostId, setModifierGroupsByHostId] = useState<
    Record<string, any[]>
  >({});

  const reload = useCallback(async () => {
    if (!siteId) return;
    const local = await readLocalCatalog(siteId);
    const [orders, promos, pli] = await Promise.all([
      readLocalPendingOrders(siteId),
      readLocalPromotions(siteId),
      getPosDb().priceListItems.toArray(),
    ]);
    setCatalogItems(local.catalogItems as CatalogItem[]);
    setCategories(local.categories);
    setLocations(local.locations);
    setLeads(local.leads);
    setPriceLists(local.priceLists);
    setPendingOrders(orders);
    setPromotions(promos);
    setPriceListItems(pli);
    setModifierGroupsByHostId(local.modifierGroupsByHostId || {});
    setHasLocalData(local.hasLocalData);
    setLastPulledAt(local.lastPulledAt);
    setHydrated(true);
  }, [siteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!siteId) return;
    let lastSig = "";
    return subscribePosSync((status) => {
      const sig = `${status.lastPulledAt ?? ""}:${status.pendingCount}:${status.failedCount}`;
      if (sig === lastSig) return;
      lastSig = sig;
      void reload();
    });
  }, [siteId, reload]);

  const getTaxesForCart = useCallback(async (itemIds: string[]) => {
    return readTaxesByItemIds(itemIds);
  }, []);

  const availableItems = useMemo(
    () => catalogItems.filter((item) => isStorefrontAvailable(item)),
    [catalogItems],
  );

  const unavailableItems = useMemo(
    () => catalogItems.filter((item) => !isStorefrontAvailable(item)),
    [catalogItems],
  );

  return {
    catalogItems,
    availableItems,
    unavailableItems,
    categories,
    locations,
    leads,
    priceLists,
    priceListItems,
    modifierGroupsByHostId,
    pendingOrders: selectPosOpenOrders(pendingOrders.map((o) => o.raw || o)),
    promotions,
    hydrated,
    hasLocalData,
    lastPulledAt,
    reload,
    getTaxesForCart,
    setLeads,
  };
}
