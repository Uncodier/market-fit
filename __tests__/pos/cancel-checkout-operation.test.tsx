import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CancelCheckoutOperation } from "@/app/pos/components/CancelCheckoutOperation";
import { cancelPosCheckout } from "@/app/pos/local/cancel-checkout";
jest.mock("@/app/pos/local/cancel-checkout", () => ({ cancelPosCheckout: jest.fn() }));
const onResolved = jest.fn();
beforeEach(() => { jest.clearAllMocks(); });
it("requires explicit confirmation and a reason, then refreshes confirmed cancellation", async () => {
  jest.mocked(cancelPosCheckout).mockResolvedValue({ state: "rejected", message: "Cancelled" });
  render(<CancelCheckoutOperation siteId="site" rowId="row" onResolved={onResolved} />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel operation" }));
  expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeDisabled();
  expect(cancelPosCheckout).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Cancellation reason"), { target: { value: "Wrong payment" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
  expect(cancelPosCheckout).toHaveBeenCalledWith("site", "row", "Wrong payment");
});
it("does not claim success after a stalled cancellation", async () => {
  jest.useFakeTimers();
  jest.mocked(cancelPosCheckout).mockReturnValue(new Promise(() => {}));
  const view = render(<CancelCheckoutOperation siteId="site" rowId="row" onResolved={onResolved} />);
  try {
    fireEvent.click(screen.getByRole("button", { name: "Cancel operation" }));
    fireEvent.change(screen.getByLabelText("Cancellation reason"), { target: { value: "Wrong payment" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("Cancellation is not confirmed");
    expect(onResolved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Keep operation" })).toBeEnabled();
  } finally { view.unmount(); jest.useRealTimers(); }
});