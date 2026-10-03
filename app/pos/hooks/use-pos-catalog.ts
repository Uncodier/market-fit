"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { PosInventorySnapshot } from "@/app/pos/inventory-availability";

export function usePosCatalog(siteId: string | undefined) {
  const activeSiteId = useRef(siteId);
  const reloadSequence = useRef(0);
  const [loadedSiteId, setLoadedSiteId] = useState<string>();
  const [inventorySnapshot, setInventorySnapshotValue] = useState<PosInventorySnapshot | null>(null);
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
    if (!siteId || activeSiteId.current !== siteId) return;
    const sequence = ++reloadSequence.current;
    const local = await readLocalCatalog(siteId);
    const [orders, promos, pli] = await Promise.all([
      readLocalPendingOrders(siteId),
      readLocalPromotions(siteId),
      getPosDb().priceListItems.toArray(),
    ]);
    if (activeSiteId.current !== siteId || sequence !== reloadSequence.current) return;
    setLoadedSiteId(siteId);
    setInventorySnapshotValue(local.inventorySnapshot ?? null);
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
    activeSiteId.current = siteId;
    queueMicrotask(() => void reload());
    return () => {
      activeSiteId.current = undefined;
      reloadSequence.current += 1;
    };
  }, [siteId, reload]);

  const setInventorySnapshot = useCallback((snapshot: PosInventorySnapshot | null) => {
    if (siteId && activeSiteId.current === siteId) setInventorySnapshotValue(snapshot);
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    let lastSig = "";
    return subscribePosSync((status) => {
      const sig = `${status.lastPulledAt ?? ""}:${status.lastOrdersPulledAt ?? ""}:${status.pendingCount}:${status.failedCount}`;
      if (sig === lastSig) return;
      lastSig = sig;
      void reload();
    });
  }, [siteId, reload]);

  const getTaxesForCart = useCallback(async (itemIds: string[]) => {
    return readTaxesByItemIds(itemIds);
  }, []);

  const availableItems = useMemo(
    () => catalogItems.filter((item) => item.is_pos_available !== false && isStorefrontAvailable(item)),
    [catalogItems],
  );

  const unavailableItems = useMemo(
    () => catalogItems.filter((item) => item.is_pos_available !== false && !isStorefrontAvailable(item)),
    [catalogItems],
  );

  const isCurrentSite = !!siteId && loadedSiteId === siteId;
  return {
    catalogItems: isCurrentSite ? catalogItems : [],
    availableItems: isCurrentSite ? availableItems : [],
    unavailableItems: isCurrentSite ? unavailableItems : [],
    categories: isCurrentSite ? categories : [],
    locations: isCurrentSite ? locations : [],
    leads: isCurrentSite ? leads : [],
    priceLists: isCurrentSite ? priceLists : [],
    priceListItems: isCurrentSite ? priceListItems : [],
    modifierGroupsByHostId: isCurrentSite ? modifierGroupsByHostId : {},
    inventorySnapshot: isCurrentSite ? inventorySnapshot : null,
    setInventorySnapshot,
    pendingOrders: isCurrentSite ? selectPosOpenOrders(pendingOrders.map((o) => o.raw || o)) : [],
    promotions: isCurrentSite ? promotions : [],
    hydrated: isCurrentSite && hydrated,
    hasLocalData: isCurrentSite && hasLocalData,
    lastPulledAt: isCurrentSite ? lastPulledAt : null,
    reload,
    getTaxesForCart,
    setLeads,
  };
}
