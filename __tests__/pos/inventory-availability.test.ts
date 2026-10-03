import type { CatalogItem } from "@/app/types";
import {
  getPosItemAvailability,
  normalizePosInventoryQuantity,
  type PosInventorySnapshot,
  type StockShortagePolicy,
} from "@/app/pos/inventory-availability";

const item = {
  id: "item-1",
  availability_mode: "inventory",
  availability_status: "available",
  track_inventory: true,
} as CatalogItem;

function inventory(policy: StockShortagePolicy = "block"): PosInventorySnapshot {
  return {
    policy,
    levels: [
      { catalog_item_id: item.id, location_id: "location-1", quantity: 2 },
      { catalog_item_id: item.id, location_id: "location-2", quantity: 5 },
      { catalog_item_id: "other", location_id: "location-1", quantity: 100 },
    ],
  };
}

describe("getPosItemAvailability", () => {
  it("blocks archived SKUs even in always mode", () => {
    expect(getPosItemAvailability({ ...item, status: "archived", availability_mode: "always" }, null))
      .toMatchObject({ sellable: false, status: "sold_out" });
  });
  it.each(["unavailable", "sold_out"] as const)("always blocks manual %s", (status) => {
    expect(getPosItemAvailability({ ...item, availability_mode: "manual", availability_status: status }, inventory("allow")))
      .toMatchObject({ sellable: false, status: "sold_out", backorderQty: 0 });
  });

  it.each(["manual", "always"] as const)("does not let tracking override explicit %s mode", (mode) => {
    expect(getPosItemAvailability({ ...item, availability_mode: mode }, null))
      .toEqual({ sellable: true, status: "available", backorderQty: 0 });
  });

  it.each([null, undefined])("fails closed for an inventory item with missing snapshot %s", (snapshot) => {
    const result = getPosItemAvailability(item, snapshot);
    expect(result).toMatchObject({ sellable: false, status: "unknown", backorderQty: 0 });
    expect(result.availableQty).toBeUndefined();
  });

  it("uses only the selected location, even if another has enough stock", () => {
    expect(getPosItemAvailability(item, inventory(), "location-1", 3))
      .toMatchObject({ sellable: false, status: "sold_out", availableQty: 2 });
    expect(getPosItemAvailability(item, inventory(), "missing"))
      .toMatchObject({ sellable: false, status: "sold_out", availableQty: 0 });
  });

  it.each([undefined, null, ""])("sums matching item stock globally without location %s", (location) => {
    expect(getPosItemAvailability(item, inventory(), location, 7))
      .toEqual({ sellable: true, status: "available", availableQty: 7, backorderQty: 0 });
  });

  it("honors inventory mode even if tracking is false", () => {
    expect(getPosItemAvailability({ ...item, track_inventory: false }, inventory(), "missing").sellable).toBe(false);
  });

  it.each(["allow", "warn"] as const)("marks only the shortage as backorder under %s", (policy) => {
    expect(getPosItemAvailability(item, inventory(policy), "location-1", 5))
      .toMatchObject({ sellable: true, status: "backorder", availableQty: 2, backorderQty: 3 });
    expect(getPosItemAvailability(item, { levels: [], policy }, undefined, 5))
      .toMatchObject({ sellable: true, status: "backorder", availableQty: 0, backorderQty: 5 });
  });

  it("defaults absent policy to allow for legacy snapshots", () => {
    expect(getPosItemAvailability(item, { levels: [] } as unknown as PosInventorySnapshot))
      .toMatchObject({ sellable: true, status: "backorder", backorderQty: 1 });
  });

  it("allows exactly the stock on hand and blocks the next increment", () => {
    expect(getPosItemAvailability(item, inventory(), "location-1", 2).status).toBe("available");
    expect(getPosItemAvailability(item, inventory(), "location-1", 2.5).status).toBe("sold_out");
  });

  it("normalizes numeric strings, invalid values, negative totals and requested quantities safely", () => {
    const levels = ["2.5", Number.NaN, Infinity, -1].map((quantity) => ({
      catalog_item_id: item.id, location_id: "location-1", quantity: quantity as number,
    }));
    expect(getPosItemAvailability(item, { levels, policy: "block" }, null, "1.5" as unknown as number))
      .toMatchObject({ sellable: true, availableQty: 1.5 });
    expect(getPosItemAvailability(item, { levels: [{ ...levels[0], quantity: -5 }], policy: "allow" }))
      .toMatchObject({ availableQty: 0, backorderQty: 1 });
    for (const requested of [0, -2, Number.NaN, Infinity]) {
      expect(getPosItemAvailability(item, { levels: [], policy: "allow" }, null, requested))
        .toMatchObject({ sellable: false, status: "unknown", backorderQty: 0 });
    }
  });

  it("does not aggregate variants into a parent", () => {
    expect(getPosItemAvailability({ ...item, id: "parent" }, inventory()))
      .toMatchObject({ availableQty: 0, status: "sold_out" });
  });

  it.each([null, undefined, {}, [], "bad", Infinity, Number.NaN])("normalizes invalid numeric value %s", (value) => {
    expect(normalizePosInventoryQuantity(value)).toBe(0);
  });

  it("keeps numeric overflow finite", () => {
    expect(normalizePosInventoryQuantity(Number.MAX_VALUE)).toBe(Number.MAX_SAFE_INTEGER);
  });
});