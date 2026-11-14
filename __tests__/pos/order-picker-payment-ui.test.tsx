import { fireEvent, render, screen } from "@testing-library/react";
import { PosOrderSelect } from "@/app/pos/components/PosOrderSelect";

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });

test("shows pending/review feedback in the picker and prevents another selection for collection", () => {
  const select = jest.fn();
  const order = { id: "order", notes: "Table 1", status: "pending", amount_due: 20,
    pos_picker_payment_pending: true, pos_picker_message: "Payment confirmation pending" };
  const props = { activeOrderId: "new", onOrderSelect: select, t: (key: string) => key };
  const view = render(<PosOrderSelect {...props} pendingOrders={[order]} />);
  fireEvent.click(screen.getByPlaceholderText("New Order"));
  expect(screen.getByText("Payment confirmation pending")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Table 1"));
  expect(select).not.toHaveBeenCalled();
  view.rerender(<PosOrderSelect {...props} pendingOrders={[{ ...order,
    pos_picker_message: "Payment needs review · Check sync queue" }]} />);
  expect(screen.getByText("Payment needs review · Check sync queue")).toBeInTheDocument();
  view.rerender(<PosOrderSelect {...props} pendingOrders={[{ ...order,
    pos_picker_payment_pending: false, pos_picker_message: undefined }]} />);
  fireEvent.click(screen.getByText("Table 1"));
  expect(select).toHaveBeenCalledWith("order");
});