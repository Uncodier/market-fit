import {
  shouldRestockOrder,
  restockOrderInventory,
} from "../../app/commerce/restock-order-inventory";
jest.mock("server-only", () => ({}));

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
      rpc: jest.fn().mockResolvedValue({ data: { quantity: 6 }, error: null }),
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

    expect(supabase.rpc).toHaveBeenCalledWith("apply_location_inventory_delta", {
      p_site_id: "site-1", p_catalog_item_id: "sku-1", p_location_id: "loc-1",
      p_delta: 2, p_floor_zero: false,
    });
    expect(supabase.from).not.toHaveBeenCalledWith("inventory_levels");
  });

  it("does not restock when policy is never", async () => {
    const settings = createChain();
    settings.maybeSingle.mockResolvedValue({ data: { commerce: { decrement_stock_on: "never" } } });
    const inventory = createChain();

    const supabase = {
      rpc: jest.fn(),
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
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("does not clear shipment stock flags if its restock RPC fails", async () => {
    const shipments = createChain({ data: [{ id: "shipment", origin_location_id: "origin",
      stock_decremented: true, status: "shipped" }] });
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "denied" } }),
      from: jest.fn((table: string) => {
        if (table === "shipments") return shipments;
        if (table === "sale_order_items") return createChain({ data: [{ catalog_item_id: "sku", quantity: 2 }] });
        if (table === "catalog_items") return createChain({ data: { track_inventory: true } });
        if (table === "inventory_levels") throw new Error("Legacy stock access");
        return createChain();
      }),
    };
    await expect(restockOrderInventory(supabase, { id: "order", site_id: "site", status: "completed" }))
      .rejects.toThrow("Failed to apply inventory delta");
    expect(shipments.update).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
