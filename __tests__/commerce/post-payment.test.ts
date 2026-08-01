import { processPostPaymentFulfillment } from "../../app/commerce/post-payment";
import { createShipment } from "../../app/shipments/actions";

jest.mock("../../lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("../../app/shipments/actions", () => ({
  createShipment: jest.fn(),
}));

describe("processPostPaymentFulfillment", () => {
  let mockSupabase: any;
  let ordersChain: any;
  let itemsChain: any;
  let reservationsChain: any;
  let settingsChain: any;
  let catalogChain: any;
  let inventoryChain: any;

  const createChainable = () => {
    const chainable: any = {};
    chainable.select = jest.fn().mockReturnValue(chainable);
    chainable.update = jest.fn().mockReturnValue(chainable);
    chainable.insert = jest.fn().mockReturnValue(chainable);
    chainable.eq = jest.fn().mockReturnValue(chainable);
    chainable.in = jest.fn().mockReturnValue(chainable);
    chainable.order = jest.fn().mockReturnValue(chainable);
    chainable.limit = jest.fn().mockReturnValue(chainable);
    chainable.single = jest.fn();
    return chainable;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ordersChain = createChainable();
    itemsChain = createChainable();
    reservationsChain = createChainable();
    settingsChain = createChainable();
    catalogChain = createChainable();
    inventoryChain = createChainable();

    mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "sale_orders") return ordersChain;
        if (table === "sale_order_items") return itemsChain;
        if (table === "reservations") return reservationsChain;
        if (table === "settings") return settingsChain;
        if (table === "catalog_items") return catalogChain;
        if (table === "inventory_levels") return inventoryChain;
        return createChainable();
      })
    };

    const { createServiceClient } = require("../../lib/supabase/server");
    createServiceClient.mockResolvedValue(mockSupabase);
  });

  const setupOrder = (fulfillment_method: string, items: any[] = [], hasShipping = false) => {
    ordersChain.single.mockResolvedValueOnce({
      data: {
        fulfillment_method,
        origin_location_id: hasShipping ? "loc-123" : null,
        shipping_address: hasShipping ? { line1: "123 St" } : null,
        items
      }
    }); // order query
    
    // items query is awaited directly without single()
    itemsChain.eq.mockResolvedValueOnce({ data: items.map((_, i) => ({ id: `item-${i}` })) }); 
  };

  it("completes digital ('none') items immediately and creates no shipment", async () => {
    setupOrder("none", [{ id: "cat-1", quantity: 1 }]);

    await processPostPaymentFulfillment("order-1", "site-1", "sale-1", "lead-1", "user-1");

    // Line items promoted to completed
    expect(itemsChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    // No shipment created
    expect(createShipment).not.toHaveBeenCalled();
  });

  it("promotes 'ship' items to 'new' and creates a shipment", async () => {
    setupOrder("ship", [{ id: "cat-2", quantity: 2 }], true);
    (createShipment as jest.Mock).mockResolvedValue({ data: { id: "ship-123" } });
    
    // settings
    settingsChain.single.mockResolvedValueOnce({ data: { commerce: { decrement_stock_on: 'ship' } } });
    // catalog item
    catalogChain.single.mockResolvedValueOnce({ data: { track_inventory: true } });
    // inventory levels
    inventoryChain.single.mockResolvedValueOnce({ data: { id: "inv-1", quantity: 10 } });

    await processPostPaymentFulfillment("order-2", "site-1", "sale-1", "lead-1", "user-1");

    // Line items promoted to new
    expect(itemsChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "new" }));
    
    // Shipment created
    expect(createShipment).toHaveBeenCalledWith(expect.objectContaining({
      originLocationId: "loc-123",
      shippingAddress: { line1: "123 St" },
    }));

    // Inventory decremented
    expect(inventoryChain.update).toHaveBeenCalledWith({ quantity: 8 });
  });

  it("decrements inventory for pickup and sets items to 'new'", async () => {
    setupOrder("pickup", [{ id: "cat-3", quantity: 3 }], true);
    
    // settings
    settingsChain.single.mockResolvedValueOnce({ data: { commerce: { decrement_stock_on: 'ship' } } });
    // catalog item
    catalogChain.single.mockResolvedValueOnce({ data: { track_inventory: true } });
    // inventory levels (not found, causes insert)
    inventoryChain.single.mockResolvedValueOnce({ data: null });

    await processPostPaymentFulfillment("order-3", "site-1", "sale-1", "lead-1", "user-1");

    // Line items promoted to new
    expect(itemsChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "new" }));
    
    // No shipment
    expect(createShipment).not.toHaveBeenCalled();

    // Inventory inserted (since level didn't exist)
    expect(inventoryChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      location_id: "loc-123",
      quantity: 0
    }));
  });
});
