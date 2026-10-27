import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useRecoveredOrderPayment } from "@/app/pos/hooks/use-recovered-order-payment";
it("opens the actual payment form after the refreshed cart renders", async () => {
  const loadOrder = jest.fn().mockResolvedValue(true);
  const initiateCheckout = jest.fn();
  const props = { siteId: "site", activeOrderId: "order", ready: true, loadOrder, initiateCheckout };
  const { result } = renderHook(useRecoveredOrderPayment, { initialProps: props });
  await act(async () => { expect(await result.current("order")).toBe(true); });
  expect(loadOrder).toHaveBeenCalledWith("order", true);
  expect(initiateCheckout).toHaveBeenCalledTimes(1);
});
it("does not open payment after loading fails or the site changes", async () => {
  let finish!: (loaded: boolean) => void;
  const loadOrder = jest.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
  const initiateCheckout = jest.fn();
  const props = { siteId: "site", activeOrderId: "order", ready: true, loadOrder, initiateCheckout };
  const view = renderHook(useRecoveredOrderPayment, { initialProps: props });
  let pending!: Promise<boolean>;
  act(() => { pending = view.result.current("order"); });
  view.rerender({ ...props, siteId: "other" });
  await act(async () => { finish(true); expect(await pending).toBe(false); });
  expect(initiateCheckout).not.toHaveBeenCalled();
});

it("uses the newly rendered order rather than the previous customer's cart", async () => {
  const openedOrders: string[] = [];
  const { result } = renderHook(() => {
    const [orderId, setOrderId] = useState("previous-customer");
    return useRecoveredOrderPayment({
      siteId: "site", activeOrderId: orderId, ready: true,
      loadOrder: async (id) => { await Promise.resolve(); setOrderId(id); return true; },
      initiateCheckout: () => { openedOrders.push(orderId); },
    });
  });
  await act(async () => { await result.current("recovered-order"); });
  expect(openedOrders).toEqual(["recovered-order"]);
});