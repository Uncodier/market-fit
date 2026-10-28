import { act, renderHook } from "@testing-library/react";
import { usePosCheckout } from "@/app/pos/hooks/use-pos-checkout";
import { fetchPosOrder as getPosOrder } from "@/app/pos/operation-client";
import { posOrderVersion } from "@/app/pos/order-version";
import { enqueueCheckout } from "@/app/pos/local/outbox";
import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment";
import { toast } from "sonner";
import { resetCheckoutCartSession } from "@/app/pos/local/checkout-attempt-storage";
import { syncPosCheckout } from "@/app/pos/local/sync-engine";
import { PaymentRegisterRequiredError } from "@/app/pos/register/payment-register-required";

let permissionCurrent = true;
const pendingDelete = jest.fn();
const pendingPut = jest.fn();
const outboxFirst = jest.fn();

jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: () => ({ generation: 1 }),
  isPosPermissionCurrent: () => permissionCurrent,
}));

jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }));
jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), enqueueCreateLead: jest.fn() }));
jest.mock("@/app/pos/register/prepare-payment", () => ({ enqueueRegisteredCheckout: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ syncPosCheckout: jest.fn(), refreshPosSyncCounts: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: () => ({
  pendingOrders: { delete: pendingDelete, put: pendingPut },
  outbox: { where: () => ({ equals: () => ({ first: outboxFirst }) }) },
}) }));
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
    localStorage.clear();
    permissionCurrent = true;
    pendingDelete.mockReset().mockResolvedValue(undefined);
    pendingPut.mockReset().mockResolvedValue(undefined);
    outboxFirst.mockReset().mockResolvedValue({ status: "failed", lastError: "old sale failure" });
    jest.mocked(enqueueRegisteredCheckout).mockImplementation(async (siteId, data) => {
      await enqueueCheckout(siteId, data);
      return { id: "row", siteId, status: "synced", payload: { kind: "checkout", data }, clientMutationId: data.clientMutationId } as never;
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

  it("submits the restored online promotion ID and discounted balance unchanged", async () => {
    const saved = { ...snapshot, promotion_id: "shop-promo", discount_total: 20, total: 80,
      sales: { ...snapshot.sales, amount: 80, amount_due: 80 } };
    jest.mocked(getPosOrder).mockResolvedValueOnce({ data: saved } as never);
    const { result } = renderHook(() => usePosCheckout({ ...args(), total: 80, promoCode: "SAVE20",
      appliedPromo: { promotionId: "shop-promo", code: "SAVE20", byConditions: false },
      expectedOrderVersion: posOrderVersion(saved) }));
    await act(async () => { await result.current.handleCheckout([{ ...payments[0], amount: 80, tendered: 80 }]); });
    expect(enqueueRegisteredCheckout).toHaveBeenCalledWith("site", expect.objectContaining({
      existingOrderId: "order", promotionId: "shop-promo", promotionCode: "SAVE20",
      payments: [expect.objectContaining({ amount: 80 })],
    }), expect.any(Function), expect.any(Function), { waitForConfirmation: false });
  });

  it("rejects a payment-dialog replacement code before admitting a recorded coupon payment", async () => {
    const saved = { ...snapshot, promotion_id: "shop-promo", discount_total: 20 };
    const { result } = renderHook(() => usePosCheckout({ ...args(), promoCode: "SAVE20",
      appliedPromo: { promotionId: "shop-promo", code: "SAVE20", byConditions: false },
      expectedOrderVersion: posOrderVersion(saved) }));
    await act(async () => { await result.current.handleCheckout(payments, "OTHER"); });
    expect(enqueueRegisteredCheckout).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("recorded promotion"));
  });

  it("uses the only location even before the cart default has been restored", async () => {
    const input = { ...args(), originLocationId: "", locations: [{ id: "store" }] };
    const { result } = renderHook(usePosCheckout, { initialProps: input });
    act(() => result.current.initiateCheckout());
    expect(result.current.isPaymentDialogOpen).toBe(true);
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(enqueueCheckout).toHaveBeenCalledWith("site", expect.objectContaining({ originLocationId: "store" }));
  });

  it("overlays register setup without closing payment, clearing the cart or automatically retrying", async () => {
    jest.mocked(enqueueRegisteredCheckout).mockRejectedValueOnce(new PaymentRegisterRequiredError("Open a register"));
    const input = args();
    const { result } = renderHook(usePosCheckout, { initialProps: input });
    act(() => result.current.initiateCheckout());
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(result.current.isRegisterDialogOpen).toBe(true);
    expect(result.current.isPaymentDialogOpen).toBe(true);
    expect(result.current.checkoutLoading).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
    expect(enqueueCheckout).not.toHaveBeenCalled();
    expect(input.onCleared).not.toHaveBeenCalled();
    act(() => result.current.setIsRegisterDialogOpen(false));
    expect(enqueueRegisteredCheckout).toHaveBeenCalledTimes(1);
    expect(result.current.isPaymentDialogOpen).toBe(true);
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(getPosOrder).toHaveBeenCalledTimes(2);
    expect(enqueueCheckout).toHaveBeenCalledTimes(1);
  });

  it("keeps other register errors as errors rather than opening setup", async () => {
    jest.mocked(enqueueRegisteredCheckout).mockRejectedValueOnce(new Error("This shift belongs to another cashier"));
    const { result } = renderHook(usePosCheckout, { initialProps: args() });
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(result.current.isRegisterDialogOpen).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("This shift belongs to another cashier");
  });

  it.each(["site", "actor", "order", "cart", "session", "close"])("does not carry register setup across a changed %s", async (change) => {
    jest.mocked(enqueueRegisteredCheckout).mockRejectedValueOnce(new PaymentRegisterRequiredError("Open a register"));
    const input = args();
    const { result, rerender } = renderHook(usePosCheckout, { initialProps: input });
    act(() => result.current.initiateCheckout());
    await act(async () => { await result.current.handleCheckout(payments); });
    if (change === "session") { resetCheckoutCartSession("site"); rerender(input); }
    if (change === "site") rerender({ ...input, siteId: "other-site" });
    if (change === "actor") rerender({ ...input, userId: "other-cashier" });
    if (change === "order") rerender({ ...input, activeOrderId: "new" });
    if (change === "cart") rerender({ ...input, cart: [{ ...input.cart[0], cartQty: 2 }] });
    if (change === "close") act(() => result.current.setIsPaymentDialogOpen(false));
    expect(result.current.isRegisterDialogOpen).toBe(false);
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

  it("allows a new customer while old confirmation hangs, and ignores the old completion", async () => {
    let finish!: (value: never) => void;
    const input = { ...args(), activeOrderId: "new" };
    jest.mocked(enqueueRegisteredCheckout).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(usePosCheckout, { initialProps: input });
    let old!: Promise<void>;
    await act(async () => { old = result.current.handleCheckout(payments); });
    expect(result.current.checkoutLoading).toBe(true);
    act(() => resetCheckoutCartSession("site"));
    rerender({ ...input, cart: [{ ...input.cart[0], cartQty: 2 }], total: 200 });
    expect(result.current.checkoutLoading).toBe(false);
    await act(async () => { await result.current.handleCheckout([{ ...payments[0], amount: 200 }]); });
    expect(enqueueRegisteredCheckout).toHaveBeenCalledTimes(2);
    expect(input.onCleared).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ clientMutationId: "old" } as never); await old; });
    expect(input.onCleared).toHaveBeenCalledTimes(1);
    expect(result.current.checkoutLoading).toBe(false);
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

  it.each(["delete", "put"] as const)("rechecks permission and selection after deferred pendingOrders.%s", async (operation) => {
    for (const change of ["order", "permission", "reset", "cart"] as const) {
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => { finish = resolve; });
      (operation === "delete" ? pendingDelete : pendingPut).mockReturnValueOnce(pending);
      const input = args();
      const { result, rerender, unmount } = renderHook(usePosCheckout, { initialProps: input });
      let request!: Promise<void>;
      await act(async () => { request = result.current.handleCheckout([{ ...payments[0], amount: 10 }]); });
      expect(operation === "delete" ? pendingDelete : pendingPut).toHaveBeenCalled();
      const putCalls = pendingPut.mock.calls.length;
      jest.mocked(toast.success).mockClear();
      jest.mocked(toast.message).mockClear();
      if (change === "order") rerender({ ...input, activeOrderId: "another" });
      if (change === "permission") permissionCurrent = false;
      if (change === "reset") resetCheckoutCartSession("site");
      if (change === "cart") rerender({ ...input, cart: [{ ...input.cart[0], cartQty: 2 }] });
      await act(async () => { finish(); await request; });
      expect(input.onCleared).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.message).not.toHaveBeenCalled();
      expect(pendingPut).toHaveBeenCalledTimes(putCalls);
      unmount();
      permissionCurrent = true;
    }
  });

  it("retains the receipt on permission loss during local cleanup, including remount after sync", async () => {
    const input = args();
    let finish!: () => void;
    pendingDelete.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const first = renderHook(usePosCheckout, { initialProps: input });
    let request!: Promise<void>;
    await act(async () => { request = first.result.current.handleCheckout(payments); });
    const original = jest.mocked(enqueueRegisteredCheckout).mock.calls[0][1].clientMutationId;
    permissionCurrent = false;
    first.unmount();
    await act(async () => { finish(); await request; });
    permissionCurrent = true;
    const second = renderHook(usePosCheckout, { initialProps: input });
    await act(async () => { await second.result.current.handleCheckout(payments); });
    expect(jest.mocked(enqueueRegisteredCheckout).mock.calls[1][1].clientMutationId).toBe(original);
    expect(input.onCleared).toHaveBeenCalledTimes(1);
    // Success intentionally permits a fresh identical purchase.
    await act(async () => { await second.result.current.handleCheckout(payments); });
    expect(jest.mocked(enqueueRegisteredCheckout).mock.calls[2][1].clientMutationId).not.toBe(original);
  });

  it("keeps receipt-specific feedback active after the cashier starts a new cart", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    let finish!: () => void;
    jest.mocked(syncPosCheckout).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const input = { ...args(), activeOrderId: "new" };
    const { result, rerender } = renderHook(usePosCheckout, { initialProps: input });
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(input.onCleared).toHaveBeenCalledTimes(1);
    rerender({ ...input, cart: [{ ...input.cart[0], cartQty: 3 }] });
    jest.mocked(toast.message).mockClear();
    await act(async () => { finish(); });
    expect(toast.message).not.toHaveBeenCalled();
    expect(outboxFirst).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("needs review"), expect.objectContaining({ id: "pos-checkout:row" }));
  });

  it("suppresses background feedback after permission loss during a receipt lookup", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    jest.mocked(syncPosCheckout).mockResolvedValueOnce(undefined);
    let finish!: (value: { status: string; lastError: string }) => void;
    outboxFirst.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const input = { ...args(), activeOrderId: "new" };
    const { result, rerender } = renderHook(usePosCheckout, { initialProps: input });
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(outboxFirst).toHaveBeenCalledTimes(1);
    permissionCurrent = false;
    rerender({ ...input, siteId: "other-site" });
    await act(async () => { finish({ status: "failed", lastError: "old sale failure" }); });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("closes after local acceptance while confirmation hangs, without claiming payment or changing the balance", async () => {
    jest.mocked(enqueueRegisteredCheckout).mockImplementationOnce(async (siteId, data) => ({
      id: "pending-row", siteId, status: "pending", clientMutationId: data.clientMutationId,
      payload: { kind: "checkout", data },
    } as never));
    jest.mocked(syncPosCheckout).mockReturnValueOnce(new Promise(() => {}));
    const input = args();
    const { result } = renderHook(() => usePosCheckout(input));
    act(() => result.current.initiateCheckout());
    await act(async () => { await result.current.handleCheckout(payments); });
    expect(result.current.checkoutLoading).toBe(false);
    expect(result.current.isPaymentDialogOpen).toBe(false);
    expect(input.onCleared).toHaveBeenCalledTimes(1);
    expect(enqueueRegisteredCheckout).toHaveBeenCalledWith("site", expect.any(Object), expect.any(Function), expect.any(Function), { waitForConfirmation: false });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.message).toHaveBeenCalledWith(expect.stringContaining("Confirming in the background"), expect.any(Object));
    expect(pendingDelete).not.toHaveBeenCalled();
    expect(pendingPut).not.toHaveBeenCalled();
  });

  it("retains the payment alias after failed durable cart cleanup and still starts confirmation", async () => {
    const input = { ...args(), activeOrderId: "new", onCleared: jest.fn().mockRejectedValue(new Error("Cart storage unavailable")) };
    jest.mocked(syncPosCheckout).mockReturnValue(new Promise(() => {}));
    const first = renderHook(() => usePosCheckout(input));
    await act(async () => { await first.result.current.handleCheckout(payments); });
    const original = jest.mocked(enqueueRegisteredCheckout).mock.calls[0][1].clientMutationId;
    expect(syncPosCheckout).toHaveBeenCalledWith("site", original);
    expect(toast.error).toHaveBeenCalledWith("Cart storage unavailable");
    first.unmount();
    const retry = renderHook(() => usePosCheckout(input));
    await act(async () => { await retry.result.current.handleCheckout(payments); });
    expect(jest.mocked(enqueueRegisteredCheckout).mock.calls[1][1].clientMutationId).toBe(original);
  });
});