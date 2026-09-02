import {
  shouldRestockOrder,
  restockOrderInventory,
} from "../../app/commerce/restock-order-inventory";

describe("shouldRestockOrder", () => {
  it("restocks completed and in-progress orders", () => {
    expect(shouldRestockOrder("completed")).toBe(true);
    expect(shouldRestockOrder("in_progress")).toBe(true);
  });

  it("skips pending and already cancelled orders", () => {
    expect(shouldRestockOrder("pending")).toBe(false);
    expect(shouldRestockOrder("cancelled")).toBe(false);
    expect(shouldRestockOrder(null)).toBe(false);
  });

  it("restocks a pending order when the sale was already paid", () => {
    expect(shouldRestockOrder("pending", { saleAlreadyPaid: true })).toBe(true);
  });
});

describe("restockOrderInventory", () => {
  const createChain = (resolved?: any) => {
    const chain: any = {};
    chain.select = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.maybeSingle = jest.fn().mockResolvedValue(resolved ?? { data: null });
    chain.then = (resolve: any, reject: any) =>
      Promise.resolve(resolved ?? { data: [] }).then(resolve, reject);
    return chain;
  };

  it("adds tracked item quantity back at the origin location", async () => {
    const settings = createChain();
    settings.maybeSingle.mockResolvedValue({ data: { commerce: { decrement_stock_on: "ship" } } });
    const shipments = createChain({ data: [] });
    const catalog = createChain();
    catalog.maybeSingle.mockResolvedValue({ data: { track_inventory: true } });
    const inventory = createChain();
    inventory.maybeSingle.mockResolvedValue({ data: { id: "inv-1", quantity: 4 } });

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "settings") return settings;
        if (table === "shipments") return shipments;
        if (table === "catalog_items") return catalog;
        if (table === "inventory_levels") return inventory;
        return createChain();
      }),
    };

    await restockOrderInventory(supabase, {
      id: "order-1",
      site_id: "site-1",
      status: "completed",
      origin_location_id: "loc-1",
      items: [{ catalog_item_id: "sku-1", quantity: 2 }],
    });

    expect(inventory.update).toHaveBeenCalledWith({ quantity: 6 });
  });

  it("does not restock when policy is never", async () => {
    const settings = createChain();
    settings.maybeSingle.mockResolvedValue({ data: { commerce: { decrement_stock_on: "never" } } });
    const inventory = createChain();

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "settings") return settings;
        if (table === "inventory_levels") return inventory;
        return createChain();
      }),
    };

    await restockOrderInventory(supabase, {
      id: "order-1",
      site_id: "site-1",
      status: "completed",
      origin_location_id: "loc-1",
      items: [{ catalog_item_id: "sku-1", quantity: 2 }],
    });

    expect(inventory.update).not.toHaveBeenCalled();
    expect(inventory.insert).not.toHaveBeenCalled();
  });
});
