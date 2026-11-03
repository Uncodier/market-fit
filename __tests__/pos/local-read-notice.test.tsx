import { act, fireEvent, render, screen } from "@testing-library/react";
import { PosLocalReadNotice } from "@/app/pos/components/PosLocalReadNotice";

it("distinguishes initial unavailable pricing from delayed order refresh", () => {
  const props = { catalogError: true, ordersError: false, ready: false, retry: jest.fn() };
  const { rerender } = render(<PosLocalReadNotice {...props} />);
  expect(screen.getByRole("status")).toHaveTextContent("Checkout will remain unavailable");
  rerender(<PosLocalReadNotice {...props} ready />);
  expect(screen.getByRole("status")).toHaveTextContent("last loaded catalog is still available");
  rerender(<PosLocalReadNotice {...props} catalogError={false} ordersError ready />);
  expect(screen.getByRole("status")).toHaveTextContent("these lists may be outdated");
  rerender(<PosLocalReadNotice {...props} catalogError={false} />);
  expect(screen.queryByRole("status")).toBeNull();
});

it("keeps manual retry single-flight until local reads finish", async () => {
  let finish!: () => void;
  const retry = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<PosLocalReadNotice catalogError ordersError={false} ready={false} retry={retry} />);
  fireEvent.click(screen.getByRole("button", { name: "Retry local data" }));
  expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();
  expect(retry).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Retry local data" })).toBeEnabled();
});