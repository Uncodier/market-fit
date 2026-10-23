import { act, fireEvent, render, screen } from "@testing-library/react";
import { PosOrderReviewDialog } from "@/app/pos/components/PosOrderReviewDialog";
import { fetchPosOrder as getPosOrder } from "@/app/pos/operation-client";
import { checkoutCart } from "@/app/commerce/checkout";
import { updateOutboxRow } from "@/app/pos/local/outbox";
import type { PosOrderSnapshot } from "@/app/pos/order-snapshot";

jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/commerce/checkout", () => ({ checkoutCart: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ updateOutboxRow: jest.fn(), listOutbox: jest.fn() }));
jest.mock("@/app/pos/local/checkout-recovery", () => ({ reconcilePosCheckout: jest.fn() }));
jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number, currency: string) => `${currency} ${amount.toFixed(2)}` }),
}));

const order = {
  id: "order-a", site_id: "site-a", sale_id: "sale-a", order_number: "POS-123",
  status: "completed", currency: "MXN", total: 100, notes: "Table 5",
  sales: { amount: 100, amount_due: 0, payments: [{ amount: 100 }], status: "completed" },
  sale_order_items: [{ id: "line-a", name: "Coffee", quantity: 2, unit_price: 50, status: "completed" }],
} as unknown as PosOrderSnapshot;
const props = { siteId: "site-a", orderId: "order-a", onOpenChange: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getPosOrder).mockReset().mockResolvedValue({ data: order });
});

it.each([0, 40])("reviews a paid or partially paid order with balance %s without collecting or synchronizing", async (amountDue) => {
  jest.mocked(getPosOrder).mockResolvedValue({ data: {
    ...order, sales: { ...order.sales!, amount_due: amountDue, payments: [{ amount: 100 - amountDue }] },
  } });
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("POS-123");
  expect(getPosOrder).toHaveBeenCalledWith("site-a", "order-a");
  expect(screen.getByText("Balance due").parentElement).toHaveTextContent(`MXN ${amountDue.toFixed(2)}`);
  expect(screen.getByText("Payment status").parentElement).toHaveTextContent(amountDue === 0 ? "Paid" : "Unpaid");
  expect(screen.getByText("Coffee")).toBeInTheDocument();
  expect(screen.getByText("Table 5")).toBeInTheDocument();
  expect(screen.getByText(/does not confirm checkout completion/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /charge|pay|sync/i })).not.toBeInTheDocument();
  expect(checkoutCart).not.toHaveBeenCalled();
  expect(updateOutboxRow).not.toHaveBeenCalled();
});

it("preserves unknown balance instead of displaying zero", async () => {
  jest.mocked(getPosOrder).mockResolvedValue({ data: { ...order, sales: null } });
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("POS-123");
  expect(screen.getByText("Balance due").parentElement).toHaveTextContent("Not available");
});

it("can review an empty or cancelled order without requiring an editable cart", async () => {
  jest.mocked(getPosOrder).mockResolvedValue({ data: { ...order, status: "cancelled", sale_order_items: [] } });
  render(<PosOrderReviewDialog {...props} />);
  await screen.findByText("No order items available.");
  expect(screen.getByText("Order status").parentElement).toHaveTextContent("cancelled");
});

it("shows authorization errors and retries only the scoped read", async () => {
  jest.mocked(getPosOrder).mockResolvedValueOnce({ error: "Forbidden" });
  render(<PosOrderReviewDialog {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
  fireEvent.click(screen.getByRole("button", { name: "Refresh order" }));
  await screen.findByText("POS-123");
  expect(getPosOrder).toHaveBeenCalledTimes(2);
  expect(checkoutCart).not.toHaveBeenCalled();
  expect(updateOutboxRow).not.toHaveBeenCalled();
});

it("does not expose unexpected transport errors", async () => {
  jest.mocked(getPosOrder).mockRejectedValueOnce(new Error("private transport details"));
  render(<PosOrderReviewDialog {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load POS order. Try refreshing the order.");
  expect(screen.queryByText(/private transport/)).not.toBeInTheDocument();
});

it.each(["site", "close"])("ignores a late response after %s changes", async (change) => {
  let resolve!: (value: { data: PosOrderSnapshot }) => void;
  jest.mocked(getPosOrder).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const view = render(<PosOrderReviewDialog {...props} />);
  view.rerender(<PosOrderReviewDialog {...props}
    siteId={change === "site" ? "site-b" : "site-a"} orderId={change === "site" ? "order-b" : undefined} />);
  await act(async () => { resolve({ data: { ...order, order_number: "Old response" } }); });
  expect(screen.queryByText("Old response")).not.toBeInTheDocument();
});

it("does not request server data for an unresolved local order", () => {
  render(<PosOrderReviewDialog {...props} orderId="local_order-a" />);
  expect(screen.getByRole("alert")).toHaveTextContent("No server order is available yet");
  expect(getPosOrder).not.toHaveBeenCalled();
});