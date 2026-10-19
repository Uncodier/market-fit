import { act, renderHook } from "@testing-library/react";
import { usePosCheckout } from "@/app/pos/hooks/use-pos-checkout";
import { getPosOrder } from "@/app/pos/actions/get-order";
import { posOrderVersion } from "@/app/pos/order-version";
import { enqueueCheckout } from "@/app/pos/local/outbox";
import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment";
import { toast } from "sonner";

jest.mock("@/app/pos/actions/get-order", () => ({ getPosOrder: jest.fn() }));
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }));
jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), enqueueCreateLead: jest.fn() }));
jest.mock("@/app/pos/register/prepare-payment", () => ({ enqueueRegisteredCheckout: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ drainPosOutbox: jest.fn(), refreshPosSyncCounts: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: () => ({ pendingOrders: { delete: jest.fn(), put: jest.fn() } }) }));
jest.mock("@/lib/printer", () => ({ normalizePrintersSettings: jest.fn(), ticketBrandFromSite: jest.fn() }));
jest.mock("@/app/pos/print-after-checkout", () => ({ printAfterPosCheckout: jest.fn(), receiptFromPosCart: jest.fn() }));
jest.mock("@/app/pos/create-pending-split-orders", () => ({ createPendingSplitOrders: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn() } }));

const snapshot = {
  id: "order", site_id: "site", status: "pending", total: 100, currency: "USD",
  sales: { status: "pending", amount: 100, amount_due: 100, payments: [] },
  sale_order_items: [{ id: "line", catalog_item_id: "sku", unit_price: 100, quantity: 1,
    status: "sent", metadata: {}, parent_sale_order_item_id: null }],
};
type Args = Parameters<typeof usePosCheckout>[0];
function args(): Args {
  return { siteId: "site", userId: "cashier", cart: [{ id: "sku", name: "Coffee", cartQty: 1, cartPrice: 100 } as Args["cart"][number]],
    total: 100, activeOrderId: "order", expectedOrderVersion: posOrderVersion(snapshot),
    leadValue: null, leadRelationValue: null, fulfillment: "pickup", originLocationId: "store",
    priceListId: "none", promoCode: "", buyerUserId: null, onCleared: jest.fn(), t: (key) => key,
    onOrderChanged: jest.fn() };
}
const payments = [{ method: "cash", amount: 100, tendered: 100, change: 0 }];

describe("POS payment preparation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(enqueueRegisteredCheckout).mockImplementation(async (siteId, data) => {
      await enqueueCheckout(siteId, data);
      return { clientMutationId: data.clientMutationId } as never;
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    jest.mocked(getPosOrder).mockResolvedValue({ data: snapshot } as never);
  });
  afterEach(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); });

  it("opens immediately with only the selected ID while detail loading prevents confirmation", async () => {
    const input = { ...args(), cart: [], orderPreparing: true };
    const { result } = renderHook(() => usePosCheckout(input));
    act(() => result.current.initiateCheckout());
    expect(result.current.isPaymentDialogOpen).toBe(true);
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(getPosOrder).not.toHaveBeenCalled();
    expect(enqueueCheckout).not.toHaveBeenCalled();
  });

  it("still keeps an empty new order out of checkout", () => {
    const { result } = renderHook(() => usePosCheckout({ ...args(), activeOrderId: "new", cart: [] }));
    act(() => result.current.initiateCheckout());
    expect(result.current.isPaymentDialogOpen).toBe(false);
  });

  it("refuses an old balance and requests a forced order refresh", async () => {
    const input = args();
    jest.mocked(getPosOrder).mockResolvedValue({ data: { ...snapshot,
      sales: { ...snapshot.sales, amount_due: 40, payments: [{ amount: 60 }] } } } as never);
    const { result } = renderHook(() => usePosCheckout(input));
    act(() => result.current.initiateCheckout());
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(enqueueCheckout).not.toHaveBeenCalled();
    expect(input.onCleared).not.toHaveBeenCalled();
    expect(input.onOrderChanged).toHaveBeenCalledWith("order");
    expect(result.current.isPaymentDialogOpen).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("balance has changed"));
  });

  it.each(["cancelled", "paid", "unavailable"])("does not queue %s orders", async (state) => {
    jest.mocked(getPosOrder).mockResolvedValue(state === "unavailable" ? { error: "Unavailable" }
      : { data: state === "cancelled" ? { ...snapshot, status: state }
        : { ...snapshot, sales: { ...snapshot.sales, amount_due: 0 } } } as never);
    const { result } = renderHook(() => usePosCheckout(args()));
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(enqueueCheckout).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("queues one payment with its baseline version despite repeated clicks", async () => {
    let finish!: (value: never) => void;
    jest.mocked(getPosOrder).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const input = args();
    const { result } = renderHook(() => usePosCheckout(input));
    let first!: Promise<void>;
    act(() => { first = result.current.handleCheckout(payments); });
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(getPosOrder).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ data: snapshot } as never); await first; });
    expect(enqueueCheckout).toHaveBeenCalledTimes(1);
    expect(enqueueCheckout).toHaveBeenCalledWith("site", expect.objectContaining({
      existingOrderId: "order", expectedOrderVersion: input.expectedOrderVersion, payments,
    }));
    expect(input.onCleared).toHaveBeenCalledTimes(1);
  });

  it("compares the stored baseline, not a cashier's subsequent cart edit", async () => {
    const input = args();
    input.cart[0].cartQty = 2;
    input.total = 200;
    const { result } = renderHook(() => usePosCheckout(input));
    await act(async () => { await result.current.handleCheckout([{ ...payments[0], amount: 200 }]); });
    expect(enqueueCheckout).toHaveBeenCalledWith("site", expect.objectContaining({
      lines: [expect.objectContaining({ quantity: 2 })], expectedOrderVersion: input.expectedOrderVersion,
    }));
  });

  it("does not enqueue an old payment after switching orders during verification", async () => {
    let finish!: (value: never) => void;
    jest.mocked(getPosOrder).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const input = args();
    const { result, rerender } = renderHook(usePosCheckout, { initialProps: input });
    let request!: Promise<void>;
    act(() => { request = result.current.handleCheckout(payments); });
    rerender({ ...input, activeOrderId: "another-order" });
    await act(async () => { finish({ data: snapshot } as never); await request; });
    expect(enqueueCheckout).not.toHaveBeenCalled();
    expect(input.onCleared).not.toHaveBeenCalled();
  });

  it("does not carry an open payment dialog into a different order", () => {
    const input = args();
    const { result, rerender } = renderHook(usePosCheckout, { initialProps: input });
    act(() => result.current.initiateCheckout());
    expect(result.current.isPaymentDialogOpen).toBe(true);
    rerender({ ...input, activeOrderId: "new" });
    expect(result.current.isPaymentDialogOpen).toBe(false);
  });

  it("does not force an old order back into selection when verification fails late", async () => {
    let finish!: (value: never) => void;
    jest.mocked(getPosOrder).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const input = args();
    const { result, rerender } = renderHook(usePosCheckout, { initialProps: input });
    let request!: Promise<void>;
    act(() => { request = result.current.handleCheckout(payments); });
    rerender({ ...input, activeOrderId: "another-order" });
    await act(async () => { finish({ data: { ...snapshot, status: "cancelled" } } as never); await request; });
    expect(input.onOrderChanged).not.toHaveBeenCalled();
    expect(enqueueCheckout).not.toHaveBeenCalled();
  });
});