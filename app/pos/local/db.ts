import Dexie, { type Table } from "dexie";
import type { CatalogItem, Tax } from "@/app/types";
import type {
  IdMapRow,
  LocalPendingOrder,
  LocalPriceList,
  LocalPriceListItem,
  LocalPromotion,
  LocalReservationSlots,
  PosCartSession,
  PosMeta,
  PosOutboxRow,
} from "./types";

export type PosCatalogCategory = {
  id: string;
  site_id: string;
  name: string;
  [key: string]: any;
};

export type PosLead = {
  id: string;
  site_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_local?: boolean;
  [key: string]: any;
};

export type PosLocation = {
  id: string;
  site_id: string;
  name?: string | null;
  is_default?: boolean;
  [key: string]: any;
};

export type PosTaxByItem = {
  catalogItemId: string;
  taxes: Tax[];
};

export class PosLocalDatabase extends Dexie {
  meta!: Table<PosMeta, string>;
  catalogItems!: Table<CatalogItem, string>;
  categories!: Table<PosCatalogCategory, string>;
  priceLists!: Table<LocalPriceList, string>;
  priceListItems!: Table<LocalPriceListItem, string>;
  leads!: Table<PosLead, string>;
  locations!: Table<PosLocation, string>;
  taxesByItem!: Table<PosTaxByItem, string>;
  promotions!: Table<LocalPromotion, string>;
  pendingOrders!: Table<LocalPendingOrder, string>;
  reservationSlots!: Table<LocalReservationSlots, string>;
  cartSessions!: Table<PosCartSession, string>;
  outbox!: Table<PosOutboxRow, string>;
  idMaps!: Table<IdMapRow, string>;

  constructor() {
    super("market-fit-pos");
    this.version(1).stores({
      meta: "siteId",
      catalogItems: "id, site_id, category_id, kind, name",
      categories: "id, site_id, name",
      priceLists: "id, site_id, is_active",
      priceListItems: "id, price_list_id, catalog_item_id, [price_list_id+catalog_item_id]",
      leads: "id, site_id, name, email",
      locations: "id, site_id",
      taxesByItem: "catalogItemId",
      promotions: "id, site_id, code, status",
      pendingOrders: "id, site_id, status, created_at",
      reservationSlots: "id, catalogItemId, expiresAt",
      cartSessions: "siteId",
      outbox: "id, siteId, status, kind, clientMutationId, createdAt",
      idMaps: "localId, siteId, kind, serverId",
    });
  }
}

let dbInstance: PosLocalDatabase | null = null;

export function getPosDb(): PosLocalDatabase {
  if (typeof window === "undefined") {
    throw new Error("POS local DB is only available in the browser");
  }
  if (!dbInstance) {
    dbInstance = new PosLocalDatabase();
  }
  return dbInstance;
}

/** Test helper to inject/reset DB */
export function setPosDbForTests(db: PosLocalDatabase | null) {
  dbInstance = db;
}
