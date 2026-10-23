import {
  shouldRunCatalogPull,
  shouldRefreshCatalogSnapshot,
  shouldRunOrdersPull,
  shouldDrainOutbox,
  CATALOG_INTERVAL_MS,
  ORDERS_INTERVAL_MS,
  CATALOG_VISIBILITY_MIN_MS,
} from "@/app/pos/local/sync-policy";

describe("sync-policy", () => {
  describe("shouldRefreshCatalogSnapshot", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    it.each([null, "invalid", "2026-10-24T12:00:00Z"])("repairs missing or invalid snapshot timestamps (%s)", (timestamp) => {
      expect(shouldRefreshCatalogSnapshot(now, timestamp)).toBe(true);
    });
    it("refreshes at five minutes but not before", () => {
      expect(shouldRefreshCatalogSnapshot(now, new Date(now - CATALOG_INTERVAL_MS).toISOString())).toBe(true);
      expect(shouldRefreshCatalogSnapshot(now, new Date(now - CATALOG_INTERVAL_MS + 1).toISOString())).toBe(false);
    });
  });

  describe("shouldRunCatalogPull", () => {
    it("returns true if force is true", () => {
      expect(shouldRunCatalogPull({ now: 1000, lastCatalogAt: 1000, visible: false, force: true })).toBe(true);
    });

    it("returns false if not visible (and not forced)", () => {
      expect(shouldRunCatalogPull({ now: 1000, lastCatalogAt: null, visible: false })).toBe(false);
    });

    it("returns true if no lastCatalogAt", () => {
      expect(shouldRunCatalogPull({ now: 1000, lastCatalogAt: null, visible: true })).toBe(true);
    });

    it("returns true if elapsed >= CATALOG_INTERVAL_MS", () => {
      const lastCatalogAt = 1000;
      const now = lastCatalogAt + CATALOG_INTERVAL_MS;
      expect(shouldRunCatalogPull({ now, lastCatalogAt, visible: true })).toBe(true);
    });

    it("returns false if elapsed < CATALOG_INTERVAL_MS", () => {
      const lastCatalogAt = 1000;
      const now = lastCatalogAt + CATALOG_INTERVAL_MS - 1;
      expect(shouldRunCatalogPull({ now, lastCatalogAt, visible: true })).toBe(false);
    });

    it("returns true if isVisibilityTrigger and elapsed >= CATALOG_VISIBILITY_MIN_MS", () => {
      const lastCatalogAt = 1000;
      const now = lastCatalogAt + CATALOG_VISIBILITY_MIN_MS;
      expect(shouldRunCatalogPull({ now, lastCatalogAt, visible: true, isVisibilityTrigger: true })).toBe(true);
    });

    it("returns false if isVisibilityTrigger and elapsed < CATALOG_VISIBILITY_MIN_MS", () => {
      const lastCatalogAt = 1000;
      const now = lastCatalogAt + CATALOG_VISIBILITY_MIN_MS - 1;
      expect(shouldRunCatalogPull({ now, lastCatalogAt, visible: true, isVisibilityTrigger: true })).toBe(false);
    });
  });

  describe("shouldRunOrdersPull", () => {
    it("returns true if force is true", () => {
      expect(shouldRunOrdersPull({ now: 1000, lastOrdersAt: 1000, visible: false, force: true })).toBe(true);
    });

    it("returns false if not visible", () => {
      expect(shouldRunOrdersPull({ now: 1000, lastOrdersAt: null, visible: false })).toBe(false);
    });

    it("returns true if no lastOrdersAt", () => {
      expect(shouldRunOrdersPull({ now: 1000, lastOrdersAt: null, visible: true })).toBe(true);
    });

    it("returns true if elapsed >= ORDERS_INTERVAL_MS", () => {
      const lastOrdersAt = 1000;
      const now = lastOrdersAt + ORDERS_INTERVAL_MS;
      expect(shouldRunOrdersPull({ now, lastOrdersAt, visible: true })).toBe(true);
    });

    it("returns false if elapsed < ORDERS_INTERVAL_MS", () => {
      const lastOrdersAt = 1000;
      const now = lastOrdersAt + ORDERS_INTERVAL_MS - 1;
      expect(shouldRunOrdersPull({ now, lastOrdersAt, visible: true })).toBe(false);
    });
  });

  describe("shouldDrainOutbox", () => {
    it("returns true if force is true and online", () => {
      expect(shouldDrainOutbox({ pendingCount: 0, online: true, force: true })).toBe(true);
    });

    it("returns false if force is true but offline", () => {
      expect(shouldDrainOutbox({ pendingCount: 0, online: false, force: true })).toBe(false);
    });

    it("returns false if offline", () => {
      expect(shouldDrainOutbox({ pendingCount: 5, online: false })).toBe(false);
    });

    it("returns true if online and pendingCount > 0", () => {
      expect(shouldDrainOutbox({ pendingCount: 1, online: true })).toBe(true);
    });

    it("returns false if online and pendingCount is 0", () => {
      expect(shouldDrainOutbox({ pendingCount: 0, online: true })).toBe(false);
    });

    it("retries failed operations even when there are no pending operations", () => {
      expect(shouldDrainOutbox({ pendingCount: 0, failedCount: 1, online: true })).toBe(true);
      expect(shouldDrainOutbox({ pendingCount: 0, failedCount: 1, online: false })).toBe(false);
    });
  });
});
