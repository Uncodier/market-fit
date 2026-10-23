import { pullPosCatalogSnapshot, type PosCatalogSnapshot } from "@/app/pos/actions/pull-snapshot";
import { posOrderAmountDue, selectPosOpenOrders } from "@/app/pos/open-orders";
import { getPosDb } from "./db";
import type { LocalPendingOrder, LocalPromotion } from "./types";
import type { PosPermissionLease } from "./location-permission-state";
import { assertPosRemotePermission, canStartPosRemoteRequest, requirePosRemotePermission } from "./remote-permission";

const SCHEMA_VERSION = 1;

export async function readLocalCatalog(siteId: string) {
  const db = getPosDb();
  const [catalogItemsRaw, categoriesRaw, locations, leads, priceLists, meta] =
    await Promise.all([
      db.catalogItems.where("site_id").equals(siteId).toArray(),
      db.categories.where("site_id").equals(siteId).toArray(),
      db.locations.where("site_id").equals(siteId).toArray(),
      db.leads.where("site_id").equals(siteId).toArray(),
      db.priceLists.where("site_id").equals(siteId).toArray(),
      db.meta.get(siteId),
    ]);

  const categories = categoriesRaw.sort((a, b) => {
    const aOrder = a.sort_order ?? 999999;
    const bOrder = b.sort_order ?? 999999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || "").localeCompare(b.name || "");
  });
  
  const catalogItems = catalogItemsRaw.sort((a, b) => {
    const aOrder = a.sort_order ?? 999999;
    const bOrder = b.sort_order ?? 999999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || "").localeCompare(b.name || "");
  });

  return {
    catalogItems,
    categories,
    locations,
    leads,
    priceLists,
    modifierGroupsByHostId: meta?.modifierGroupsByHostId || {},
    inventorySnapshot: meta?.inventorySnapshot ?? null,
    lastPulledAt: meta?.lastPulledAt ?? null,
    lastCatalogRevision: meta?.lastCatalogRevision ?? null,
    hasLocalData: !!meta?.lastPulledAt || catalogItems.length > 0,
  };
}

export async function readLocalPendingOrders(siteId: string) {
  return getPosDb().pendingOrders.where("site_id").equals(siteId).toArray();
}

export async function readLocalPromotions(siteId: string) {
  return getPosDb().promotions.where("site_id").equals(siteId).toArray();
}

export async function readTaxesByItemIds(catalogItemIds: string[]) {
  if (catalogItemIds.length === 0) return {} as Record<string, any[]>;
  const rows = await getPosDb().taxesByItem.bulkGet(catalogItemIds);
  const map: Record<string, any[]> = {};
  for (const row of rows) {
    if (row) map[row.catalogItemId] = row.taxes;
  }
  return map;
}

export async function applyPosCatalogSnapshot(
  siteId: string, snapshot: PosCatalogSnapshot, revision: string | null, permission?: PosPermissionLease,
) {
  const db = getPosDb();

  const taxRows = Object.entries(snapshot.taxesByItem || {}).map(
    ([catalogItemId, taxes]) => ({
      catalogItemId,
      taxes: taxes || [],
    }),
  );

  const promotions: LocalPromotion[] = (snapshot.promotions || []).map(
    (p: any) => ({
      id: p.id,
      site_id: siteId,
      name: p.name,
      code: p.code,
      status: p.status,
      discount_type: p.discount_type,
      discount_value: Number(p.discount_value),
      bogo_buy_qty: p.bogo_buy_qty ?? 1,
      bogo_get_qty: p.bogo_get_qty ?? 1,
      applies_to: p.applies_to,
      min_order_amount: p.min_order_amount,
      usage_limit: p.usage_limit,
      usage_count: p.usage_count,
      usage_limit_per_user: p.usage_limit_per_user,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      active_weekdays: p.active_weekdays,
      required_items_mode: p.required_items_mode,
      channels: p.channels,
      location_ids: p.location_ids,
      catalog_item_ids: p.catalog_item_ids || [],
      category_ids: p.category_ids || [],
      required_items: p.required_items || [],
      required_categories: p.required_categories || [],
      image_url: p.image_url || null,
      show_on_shop: Boolean(p.show_on_shop),
      show_on_marketplace: Boolean(p.show_on_marketplace),
    }),
  );

  await db.transaction(
    "rw",
    [
      db.meta,
      db.catalogItems,
      db.categories,
      db.locations,
      db.leads,
      db.priceLists,
      db.priceListItems,
      db.taxesByItem,
      db.promotions,
    ],
    async () => {
      if (permission) assertPosRemotePermission(permission);
      // Keep locally-created leads that have not synced yet
      const localLeads = await db.leads
        .where("site_id")
        .equals(siteId)
        .filter((l) => !!l.is_local)
        .toArray();

      await db.catalogItems.where("site_id").equals(siteId).delete();
      await db.categories.where("site_id").equals(siteId).delete();
      await db.locations.where("site_id").equals(siteId).delete();
      if (snapshot.replaceLeads !== false) {
        await db.leads
          .where("site_id")
          .equals(siteId)
          .filter((l) => !l.is_local)
          .delete();
      }
      await db.priceLists.where("site_id").equals(siteId).delete();
      await db.priceListItems.clear();
      await db.taxesByItem.clear();
      await db.promotions.where("site_id").equals(siteId).delete();

      if (snapshot.catalogItems.length) {
        await db.catalogItems.bulkPut(
          snapshot.catalogItems.map((i: any) => ({ ...i, site_id: siteId })),
        );
      }
      if (snapshot.categories.length) {
        await db.categories.bulkPut(
          snapshot.categories.map((c: any) => ({ ...c, site_id: siteId })),
        );
      }
      if (snapshot.locations.length) {
        await db.locations.bulkPut(
          snapshot.locations.map((l: any) => ({ ...l, site_id: siteId })),
        );
      }
      if (snapshot.leads.length) {
        await db.leads.bulkPut(
          snapshot.leads.map((l: any) => ({
            ...l,
            site_id: siteId,
            is_local: false,
          })),
        );
      }
      if (localLeads.length) {
        await db.leads.bulkPut(localLeads);
      }
      if (snapshot.priceLists.length) {
        await db.priceLists.bulkPut(
          snapshot.priceLists.map((pl: any) => ({
            channels: pl.channels ?? ["pos"],
            id: pl.id,
            site_id: siteId,
            name: pl.name,
            is_active: !!pl.is_active,
            is_default: !!pl.is_default,
          })),
        );
      }
      if (snapshot.priceListItems.length) {
        await db.priceListItems.bulkPut(snapshot.priceListItems);
      }
      if (taxRows.length) {
        await db.taxesByItem.bulkPut(taxRows);
      }
      if (promotions.length) {
        await db.promotions.bulkPut(promotions);
      }

      await db.meta.put({
        siteId,
        lastPulledAt: snapshot.pulledAt,
        lastCatalogRevision: revision,
        schemaVersion: SCHEMA_VERSION,
        modifierGroupsByHostId: snapshot.modifierGroupsByHostId || {},
        inventorySnapshot: snapshot.inventorySnapshot ?? null,
      });
      if (permission) assertPosRemotePermission(permission);
    },
  );
}

export async function applyPosOpenOrders(siteId: string, openOrders: any[], permission?: PosPermissionLease) {
  const db = getPosDb();
  
  const pendingOrders: LocalPendingOrder[] = selectPosOpenOrders(
    openOrders || [],
  ).map((o: any) => {
    const amountDue = posOrderAmountDue(o);
    return {
      id: o.id,
      site_id: siteId,
      status: o.status,
      created_at: o.created_at,
      lead_id: o.lead_id ?? o.leads?.id ?? null,
      price_list_id: o.price_list_id ?? null,
      amount_due: amountDue,
      total: o.total ?? o.amount ?? null,
      leads: o.leads ?? null,
      payment_status: o.payment_status ?? (amountDue != null && amountDue <= 0 ? "paid" : "unpaid"),
      raw: o,
    };
  });

  // Read queue evidence in the same transaction as replacement so replay cannot
  // mark a row synced between deciding to retain it and writing the projection.
  await db.transaction("rw", [db.pendingOrders, db.outbox, db.idMaps], async () => {
    if (permission) assertPosRemotePermission(permission);
    const [local, outbox, mappings] = await Promise.all([
      db.pendingOrders.where("site_id").equals(siteId).toArray(),
      db.outbox.where("siteId").equals(siteId).toArray(),
      db.idMaps.where("siteId").equals(siteId).toArray(),
    ]);
    const mutations = new Set<string>();
    const unresolvedIds = new Set<string>();
    for (const row of outbox) {
      if (row.status === "synced" || row.kind !== "checkout" || row.payload.kind !== "checkout") continue;
      mutations.add(row.clientMutationId);
      unresolvedIds.add(`local_${row.clientMutationId}`);
      for (const id of [row.payload.data.existingOrderId, row.resultOrderId, row.recoveryOrderId]) {
        if (id) unresolvedIds.add(id);
      }
    }
    const orderMappings = mappings.filter((mapping) => mapping.kind === "order");
    for (const mapping of orderMappings) {
      if (unresolvedIds.has(mapping.localId) || unresolvedIds.has(mapping.serverId)) {
        unresolvedIds.add(mapping.localId);
        unresolvedIds.add(mapping.serverId);
      }
    }
    const retained = local.filter((order) => (order.raw?.pending_sync || order.id.startsWith("local_")) &&
      (mutations.has(order.raw?.client_mutation_id) || unresolvedIds.has(order.id)));
    const merged = new Map(pendingOrders.map((order) => [order.id, order]));
    for (const order of retained) {
      // A mapped server copy must not expose a stale payable version alongside
      // the still-unsynchronized local edit.
      for (const mapping of orderMappings) {
        if (mapping.localId === order.id) merged.delete(mapping.serverId);
      }
      merged.set(order.id, order);
    }
    await db.pendingOrders.where("site_id").equals(siteId).delete();
    if (merged.size) {
      await db.pendingOrders.bulkPut(Array.from(merged.values()));
    }
    if (permission) assertPosRemotePermission(permission);
  });
}

export async function pullAndStorePosCatalogSnapshot(
  siteId: string, revision: string | null, bypassCache = false, onSaving?: () => void,
): Promise<{
  ok: boolean;
  error?: string;
  pulledAt?: string;
}> {
  const permission = requirePosRemotePermission(siteId);
  const res = bypassCache
    ? await pullPosCatalogSnapshot(siteId, revision, true)
    : await pullPosCatalogSnapshot(siteId, revision);
  if (!canStartPosRemoteRequest(permission)) return { ok: false, error: "POS access changed" };
  if ("error" in res) {
    return { ok: false, error: res.error };
  }
  onSaving?.();
  await applyPosCatalogSnapshot(siteId, res.data, revision, permission);
  return { ok: true, pulledAt: res.data.pulledAt };
}
