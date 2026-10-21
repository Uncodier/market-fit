import Dexie, { type DBCoreCursor, type DBCoreTransaction, type Table } from "dexie";
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
  sort_order?: number | null;
  [key: string]: unknown;
};

export type PosLead = {
  id: string;
  site_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_local?: boolean;
  [key: string]: unknown;
};

export type PosLocation = {
  id: string;
  site_id: string;
  name?: string | null;
  is_default?: boolean;
  [key: string]: unknown;
};

export type PosTaxByItem = {
  catalogItemId: string;
  taxes: Tax[];
};

export class PosLocalDatabase extends Dexie {
  private activeTransactions = new Set<DBCoreTransaction>();
  private retired = false;
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

  constructor(isCurrent?: () => boolean) {
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
    if (isCurrent) {
      const check = () => {
        if (this.retired || !isCurrent()) {
          this.abortActiveTransactions();
          throw new Error("POS access changed");
        }
      };
      const gate = <T,>(operation: () => Promise<T>): Promise<T> => {
        check();
        return operation().then((result) => { check(); return result; });
      };
      const cursorGate = (cursor: DBCoreCursor | null): DBCoreCursor | null => cursor && new Proxy(cursor, {
        get(target, key) {
          check();
          if (key === "start") return (onNext: () => void) => gate(() => target.start(() => { check(); onNext(); }));
          if (key === "next") return () => gate(() => target.next()).then((next) => cursorGate(next));
          const value = Reflect.get(target, key);
          return typeof value === "function" ? (...args: unknown[]) => { check(); return value.apply(target, args); } : value;
        },
      });
      this.use({
        stack: "dbcore", name: "POS permission lease", level: 100,
        create: (core) => ({ ...core,
          transaction: (stores, mode, options) => {
            check();
            const transaction = core.transaction(stores, mode, options);
            this.activeTransactions.add(transaction);
            const release = () => { this.activeTransactions.delete(transaction); };
            // Dexie's browser core returns the native IDBTransaction.
            const events = transaction as IDBTransaction;
            events.addEventListener("complete", release, { once: true });
            events.addEventListener("abort", release, { once: true });
            return transaction;
          },
          table: (name) => {
            const table = core.table(name);
            return { ...table,
              get: (req) => gate(() => table.get(req)),
              getMany: (req) => gate(() => table.getMany(req)),
              query: (req) => gate(() => table.query(req)),
              openCursor: (req) => gate(() => table.openCursor(req)).then(cursorGate),
              count: (req) => gate(() => table.count(req)),
              mutate: (req) => gate(() => table.mutate(req)),
            };
          },
        }),
      });
    }
  }

  abortActiveTransactions() {
    this.retired = true;
    for (const transaction of this.activeTransactions) {
      try { transaction.abort(); } catch { /* Already finished. */ }
    }
    this.activeTransactions.clear();
  }
}

let dbInstance: PosLocalDatabase | null = null;
let accessAllowed = false;
let accessCurrent = () => false;

/** Retired handles must never auto-open after an actor/scope change. */
export function lockPosDb() {
  accessAllowed = false;
  dbInstance?.abortActiveTransactions();
  dbInstance?.close({ disableAutoOpen: true });
  dbInstance = null;
}

export function unlockPosDb(isCurrent: () => boolean) {
  accessAllowed = true;
  accessCurrent = isCurrent;
}

/** Erase every table: legacy tax/price/slot rows have no site index. */
export async function clearPosPrivateData() {
  const db = new PosLocalDatabase();
  try {
    await db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
    });
    for (const key of Object.keys(localStorage)) {
      if (["pos-active-order:", "pos-checkout-session:", "pos-checkout-attempt:"].some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  } finally {
    db.close({ disableAutoOpen: true });
  }
}

export function getPosDb(): PosLocalDatabase {
  if (typeof window === "undefined") {
    throw new Error("POS local DB is only available in the browser");
  }
  if (!accessAllowed || !navigator.onLine || !accessCurrent()) {
    throw new Error("POS requires verified online access");
  }
  if (!dbInstance) {
    const current = accessCurrent;
    dbInstance = new PosLocalDatabase(() => accessAllowed && current());
  }
  return dbInstance;
}

/** Test helper to inject/reset DB */
export function setPosDbForTests(db: PosLocalDatabase | null) {
  dbInstance = db;
}
