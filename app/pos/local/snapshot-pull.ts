import { pullPosSnapshot, type PosSnapshot } from "@/app/pos/actions/pull-snapshot";
import { getPosDb } from "./db";
import type { LocalPendingOrder, LocalPromotion } from "./types";

const SCHEMA_VERSION = 1;

export async function readLocalCatalog(siteId: string) {
  const db = getPosDb();
  const [catalogItems, categories, locations, leads, priceLists, meta] =
    await Promise.all([
      db.catalogItems.where("site_id").equals(siteId).toArray(),
      db.categories.where("site_id").equals(siteId).toArray(),
      db.locations.where("site_id").equals(siteId).toArray(),
      db.leads.where("site_id").equals(siteId).toArray(),
      db.priceLists.where("site_id").equals(siteId).toArray(),
      db.meta.get(siteId),
    ]);

  return {
    catalogItems,
    categories,
    locations,
    leads,
    priceLists,
    modifierGroupsByHostId: meta?.modifierGroupsByHostId || {},
    lastPulledAt: meta?.lastPulledAt ?? null,
    hasLocalData: catalogItems.length > 0,
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

export async function applyPosSnapshot(siteId: string, snapshot: PosSnapshot) {
  const db = getPosDb();

  const taxRows = Object.entries(snapshot.taxesByItem || {}).map(
    ([catalogItemId, taxes]) => ({
      catalogItemId,
      taxes: taxes || [],
    }),
  );

  const pendingOrders: LocalPendingOrder[] = (snapshot.pendingOrders || []).map(
    (o: any) => ({
      id: o.id,
      site_id: siteId,
      status: o.status,
      created_at: o.created_at,
      lead_id: o.lead_id ?? o.leads?.id ?? null,
      price_list_id: o.price_list_id ?? null,
      amount_due: o.amount_due ?? null,
      total: o.total ?? o.amount ?? null,
      leads: o.leads ?? null,
      payment_status: o.payment_status ?? null,
      raw: o,
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
      db.pendingOrders,
    ],
    async () => {
      // Keep locally-created leads that have not synced yet
      const localLeads = await db.leads
        .where("site_id")
        .equals(siteId)
        .filter((l) => !!l.is_local)
        .toArray();

      await db.catalogItems.where("site_id").equals(siteId).delete();
      await db.categories.where("site_id").equals(siteId).delete();
      await db.locations.where("site_id").equals(siteId).delete();
      await db.leads
        .where("site_id")
        .equals(siteId)
        .filter((l) => !l.is_local)
        .delete();
      await db.priceLists.where("site_id").equals(siteId).delete();
      await db.priceListItems.clear();
      await db.taxesByItem.clear();
      await db.promotions.where("site_id").equals(siteId).delete();
      await db.pendingOrders.where("site_id").equals(siteId).delete();

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
      if (pendingOrders.length) {
        await db.pendingOrders.bulkPut(pendingOrders);
      }

      await db.meta.put({
        siteId,
        lastPulledAt: snapshot.pulledAt,
        schemaVersion: SCHEMA_VERSION,
        modifierGroupsByHostId: snapshot.modifierGroupsByHostId || {},
      });
    },
  );
}

export async function pullAndStorePosSnapshot(siteId: string): Promise<{
  ok: boolean;
  error?: string;
  pulledAt?: string;
}> {
  const res = await pullPosSnapshot(siteId);
  if ("error" in res) {
    return { ok: false, error: res.error };
  }
  await applyPosSnapshot(siteId, res.data);
  return { ok: true, pulledAt: res.data.pulledAt };
}
