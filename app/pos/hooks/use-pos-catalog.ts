"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { CatalogItem } from "@/app/types";
import {
  readLocalCatalog,
  readLocalPendingOrders,
  readLocalPromotions,
  readTaxesByItemIds,
} from "@/app/pos/local/snapshot-pull";
import { getPosDb, type PosLead } from "@/app/pos/local/db";
import { subscribePosSync } from "@/app/pos/local/sync-engine";
import type { LocalPendingOrder, LocalPriceListItem, LocalPromotion } from "@/app/pos/local/types";
import { selectPosOpenOrders } from "@/app/pos/open-orders";
import { isStorefrontAvailable } from "@/app/catalog/storefront-availability";
import type { PosInventorySnapshot } from "@/app/pos/inventory-availability";
import { createPosRefreshQueue } from "../local/refresh-queue";
import { readPosLocalWithDeadline } from "../local/read-deadline";

type LocalCatalog = Awaited<ReturnType<typeof readLocalCatalog>>;

export function usePosCatalog(siteId: string | undefined) {
  const activeSiteId = useRef(siteId);
  const reloadSequence = useRef(0);
  const ordersSequence = useRef(0);
  const customersSequence = useRef(0);
  const [customersSiteId, setCustomersSiteId] = useState<string>();
  const [ordersSiteId, setOrdersSiteId] = useState<string>();
  const [readErrors, setReadErrors] = useState<{ siteId?: string; catalog: boolean; orders: boolean }>({ catalog: false, orders: false });
  const [loadedSiteId, setLoadedSiteId] = useState<string>();
  const [inventorySnapshot, setInventorySnapshotValue] = useState<PosInventorySnapshot | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<LocalCatalog["categories"]>([]);
  const [locations, setLocations] = useState<LocalCatalog["locations"]>([]);
  const [leads, setLeadsValue] = useState<PosLead[]>([]);
  const [priceLists, setPriceLists] = useState<LocalCatalog["priceLists"]>([]);
  const [pendingOrders, setPendingOrders] = useState<LocalPendingOrder[]>([]);
  const [promotions, setPromotions] = useState<LocalPromotion[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [lastPulledAt, setLastPulledAt] = useState<string | null>(null);
  const [priceListItems, setPriceListItems] = useState<LocalPriceListItem[]>([]);
  const [taxesByItem, setTaxesByItem] = useState<Awaited<ReturnType<typeof readTaxesByItemIds>>>({});
  const [modifierGroupsByHostId, setModifierGroupsByHostId] = useState<
    LocalCatalog["modifierGroupsByHostId"]
  >({});

  const setLeads = useCallback((update: SetStateAction<PosLead[]>) => {
    if (!siteId || activeSiteId.current !== siteId) return;
    // A local customer edit supersedes any already-started background read.
    customersSequence.current += 1;
    setLeadsValue((previous) => typeof update === "function"
      ? update(customersSiteId === siteId ? previous : []) : update);
    setCustomersSiteId(siteId);
  }, [siteId, customersSiteId]);

  const reloadOrders = useCallback(async () => {
    if (!siteId || activeSiteId.current !== siteId) return;
    const sequence = ++ordersSequence.current;
    const customerSequence = ++customersSequence.current;
    const current = () => activeSiteId.current === siteId && sequence === ordersSequence.current;
    try {
      const [orders, customers] = await Promise.allSettled([
        readPosLocalWithDeadline(() => readLocalPendingOrders(siteId)),
        readPosLocalWithDeadline(() => getPosDb().leads.where("site_id").equals(siteId).toArray()),
      ]);
      if (!current()) return;
      if (orders.status === "fulfilled") {
        setPendingOrders(orders.value);
        setOrdersSiteId(siteId);
      }
      if (customers.status === "fulfilled" && customerSequence === customersSequence.current) {
        setLeadsValue(customers.value);
        setCustomersSiteId(siteId);
      }
      setReadErrors((previous) => ({ siteId, catalog: previous.siteId === siteId && previous.catalog,
        orders: orders.status === "rejected" || customers.status === "rejected" }));
    } catch {
      if (current()) setReadErrors((previous) => ({ siteId, catalog: previous.siteId === siteId && previous.catalog, orders: true }));
    }
  }, [siteId]);

  const reloadCatalog = useCallback(async () => {
    if (!siteId || activeSiteId.current !== siteId) return;
    const sequence = ++reloadSequence.current;
    try {
      const { local, promos, pli, taxes } = await readPosLocalWithDeadline(async () => {
        const local = await readLocalCatalog(siteId);
        const [promos, pli, taxes] = await Promise.all([
          readLocalPromotions(siteId),
          getPosDb().priceListItems.toArray(),
          readTaxesByItemIds(local.catalogItems.map((item) => item.id)),
        ]);
        return { local, promos, pli, taxes };
      });
      if (activeSiteId.current !== siteId || sequence !== reloadSequence.current) return;
      setLoadedSiteId(siteId);
      setInventorySnapshotValue(local.inventorySnapshot ?? null);
      setCatalogItems(local.catalogItems as CatalogItem[]);
      setCategories(local.categories);
      setLocations(local.locations);
      setPriceLists(local.priceLists);
      setPromotions(promos);
      setPriceListItems(pli);
      setTaxesByItem(taxes);
      setModifierGroupsByHostId(local.modifierGroupsByHostId || {});
      setHasLocalData(local.hasLocalData);
      setLastPulledAt(local.lastPulledAt);
      setHydrated(true);
      setReadErrors((previous) => ({ siteId, orders: previous.siteId === siteId && previous.orders, catalog: false }));
    } catch {
      // Keep a coherent last-good pricing bundle; never replace failed taxes or
      // price reads with empty data, or claim first-load readiness on failure.
      if (activeSiteId.current === siteId && sequence === reloadSequence.current) {
        setReadErrors((previous) => ({ siteId, orders: previous.siteId === siteId && previous.orders, catalog: true }));
      }
    }
  }, [siteId]);

  const reload = useCallback(async () => {
    await Promise.all([reloadCatalog(), reloadOrders()]);
  }, [reloadCatalog, reloadOrders]);

  useEffect(() => {
    activeSiteId.current = siteId;
    queueMicrotask(() => { void reload().catch(() => undefined); });
    return () => {
      activeSiteId.current = undefined;
      reloadSequence.current += 1;
      ordersSequence.current += 1;
      customersSequence.current += 1;
    };
  }, [siteId, reload]);

  const setInventorySnapshot = useCallback((snapshot: PosInventorySnapshot | null) => {
    if (siteId && activeSiteId.current === siteId) setInventorySnapshotValue(snapshot);
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    let lastCatalog: string | null = null;
    let lastOrders = "";
    const catalogQueue = createPosRefreshQueue(reloadCatalog);
    const ordersQueue = createPosRefreshQueue(reloadOrders);
    const unsub = subscribePosSync((status) => {
      if (status.lastPulledAt !== lastCatalog) {
        lastCatalog = status.lastPulledAt;
        catalogQueue.request();
        // A snapshot may also replace customers; their own lane owns publication.
        ordersQueue.request();
      }
      const orders = `${status.lastOrdersPulledAt ?? ""}:${status.pendingCount}:${status.failedCount}`;
      if (orders !== lastOrders) {
        lastOrders = orders;
        ordersQueue.request();
      }
    }, siteId);
    return () => { unsub(); catalogQueue.stop(); ordersQueue.stop(); };
  }, [siteId, reloadCatalog, reloadOrders]);

  const catalogError = readErrors.siteId === siteId && readErrors.catalog;
  const ordersError = readErrors.siteId === siteId && readErrors.orders;
  useEffect(() => {
    if (!catalogError && !ordersError) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const retry = () => {
      timer = setTimeout(async () => {
        if (stopped) return;
        await Promise.all([catalogError ? reloadCatalog() : undefined, ordersError ? reloadOrders() : undefined]);
        if (!stopped && ++attempts < 3) retry();
      }, 1_000 * 2 ** attempts);
    };
    retry();
    return () => { stopped = true; clearTimeout(timer); };
  }, [catalogError, ordersError, reloadCatalog, reloadOrders]);

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
    leads: isCurrentSite && customersSiteId === siteId ? leads : [],
    priceLists: isCurrentSite ? priceLists : [],
    priceListItems: isCurrentSite ? priceListItems : [],
    taxesByItem: isCurrentSite ? taxesByItem : {},
    modifierGroupsByHostId: isCurrentSite ? modifierGroupsByHostId : {},
    inventorySnapshot: isCurrentSite ? inventorySnapshot : null,
    setInventorySnapshot,
    pendingOrders: isCurrentSite && ordersSiteId === siteId ? selectPosOpenOrders(pendingOrders.map((o) => o.raw || o)) : [],
    promotions: isCurrentSite ? promotions : [],
    hydrated: isCurrentSite && hydrated,
    hasLocalData: isCurrentSite && hasLocalData,
    lastPulledAt: isCurrentSite ? lastPulledAt : null,
    catalogError,
    ordersError,
    reload,
    getTaxesForCart,
    setLeads,
  };
}
