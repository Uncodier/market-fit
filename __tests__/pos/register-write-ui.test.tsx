import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RegisterWriteForms, type RegisterWriteAction } from "@/app/pos/register/RegisterWriteForms";
import { RegisterSessionPanel } from "@/app/pos/register/RegisterSessionPanel";
import { closePosRegister, fetchRegisterSummary, movePosRegisterCash } from "@/app/pos/operation-client";
import { withRegisterCloseLock } from "@/app/pos/register/queue-guard";
import { closedRegisterSession, registerSession, registerSummary } from "./register-ui-fixtures";

jest.mock("@/app/pos/operation-client", () => ({ fetchRegisterSummary: jest.fn(), movePosRegisterCash: jest.fn(), closePosRegister: jest.fn() }));
jest.mock("@/app/pos/register/queue-guard", () => ({ withRegisterCloseLock: jest.fn() }));

const move = jest.mocked(movePosRegisterCash);
const close = jest.mocked(closePosRegister);
const guard = jest.mocked(withRegisterCloseLock);
const summary = jest.mocked(fetchRegisterSummary);

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: jest.fn(() => "11111111-1111-4111-8111-111111111111") });
  guard.mockImplementation(async (_siteId, operation) => operation());
  move.mockResolvedValue({ data: {} });
  close.mockResolvedValue({ data: closedRegisterSession });
  summary.mockResolvedValue({ data: registerSummary });
});

function renderForms(action: RegisterWriteAction = "cash_in") {
  const onChanged = jest.fn();
  render(<RegisterWriteForms siteId="site-1" session={registerSession} summary={registerSummary} disabled={false} action={action} onCancel={jest.fn()} onChanged={onChanged} />);
  return onChanged;
}

function movement() {
  fireEvent.change(screen.getByLabelText("Movement amount (USD)"), { target: { value: "25.00" } });
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Petty cash" } });
}

describe("cash register write UI", () => {
  it("blocks offline writes and retains all inputs", async () => {
    renderForms();
    movement();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You are offline");
    expect(move).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Movement amount (USD)")).toHaveValue("25.00");
    expect(screen.getByLabelText("Reason")).toHaveValue("Petty cash");
  });

  it("reuses the same request ID on ambiguous failure and clears only after success", async () => {
    move.mockRejectedValueOnce(new Error("Connection lost"));
    const changed = renderForms();
    movement();
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    expect(changed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Movement amount (USD)"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(move).toHaveBeenCalledTimes(2);
    expect(move.mock.calls[1][0]).toEqual(move.mock.calls[0][0]);
    expect(screen.getByLabelText("Reason")).toHaveValue("");
  });

  it("requires valid amounts and a nonblank reason", async () => {
    renderForms();
    movement();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A reason is required");
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Change float" } });
    fireEvent.change(screen.getByLabelText("Movement amount (USD)"), { target: { value: "1.123" } });
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("two decimal places"));
    expect(move).not.toHaveBeenCalled();
  });

  it("shows a difference preview and blocks close when payments cannot settle", async () => {
    guard.mockRejectedValueOnce(new Error("Unresolved payment outbox"));
    const changed = renderForms("close");
    fireEvent.change(screen.getByLabelText("Counted cash (USD)"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Closing notes"), { target: { value: "Short five" } });
    expect(screen.getByText("-$5.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close register" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unresolved payment outbox");
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Counted cash (USD)")).toHaveValue("150");
    expect(screen.getByLabelText("Closing notes")).toHaveValue("Short five");
    fireEvent.click(screen.getByRole("button", { name: "Close register" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(closedRegisterSession));
    expect(guard).toHaveBeenCalledWith("site-1", expect.any(Function));
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ siteId: "site-1", sessionId: "session-1", countedAmount: 150, notes: "Short five" }));
  });

  it("does not notify a new location after an old write resolves", async () => {
    let resolve!: (value: { data: unknown }) => void;
    move.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const oldChanged = jest.fn();
    const newChanged = jest.fn();
    const { rerender } = render(<RegisterWriteForms key="old" siteId="site-1" session={registerSession} summary={registerSummary} disabled={false} action="cash_in" onCancel={jest.fn()} onChanged={oldChanged} />);
    movement();
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    rerender(<RegisterWriteForms key="new" siteId="site-2" session={{ ...registerSession, id: "session-2" }} summary={registerSummary} disabled={false} action="cash_in" onCancel={jest.fn()} onChanged={newChanged} />);
    await act(async () => { resolve({ data: {} }); });
    expect(oldChanged).not.toHaveBeenCalled();
    expect(newChanged).not.toHaveBeenCalled();
  });

  it("ignores double submit while a cash write is in flight", async () => {
    let resolve!: (value: { data: unknown }) => void;
    move.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const changed = renderForms();
    movement();
    const button = screen.getByRole("button", { name: "Add cash" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(move).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Movement amount (USD)")).toBeDisabled();
    await act(async () => { resolve({ data: {} }); });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("ignores live summary responses from an old session", async () => {
    let resolve!: (value: { data: typeof registerSummary }) => void;
    summary.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { rerender } = render(<RegisterSessionPanel key="old" siteId="site-1" session={registerSession} locationName="Store" revision={0} writable={false} />);
    rerender(<RegisterSessionPanel key="new" siteId="site-2" session={{ ...registerSession, id: "session-2" }} locationName="Other store" revision={0} writable={false} />);
    await screen.findByText("Expected drawer cash");
    await act(async () => { resolve({ data: { ...registerSummary, expected_amount: 999 } }); });
    expect(screen.queryByText("$999.00")).not.toBeInTheDocument();
    expect(screen.getByText("$155.00")).toBeInTheDocument();
  });

  it("reads a closed session from its immutable snapshot without fetching live totals", () => {
    render(<RegisterSessionPanel siteId="site-1" session={closedRegisterSession} locationName="Store" revision={0} writable={false} />);
    expect(screen.getByText(/Immutable closing snapshot/)).toBeInTheDocument();
    expect(screen.getByText("Cash received")).toBeInTheDocument();
    expect(screen.getAllByText("$155.00")).not.toHaveLength(0);
    expect(screen.getByText("cashier-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close register" })).not.toBeInTheDocument();
    expect(summary).not.toHaveBeenCalled();
  });

  it("keeps last known totals on summary failure but disables closing with stale data", async () => {
    const onChanged = jest.fn();
    const { rerender } = render(<RegisterSessionPanel siteId="site-1" session={registerSession} locationName="Store" revision={0} writable onChanged={onChanged} />);
    await screen.findByText("Expected drawer cash");
    expect(screen.getByRole("button", { name: "Close register" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /refresh/i, hidden: true })).not.toBeInTheDocument();
    summary.mockResolvedValueOnce({ error: "Summary migration unavailable" });
    rerender(<RegisterSessionPanel siteId="site-1" session={registerSession} locationName="Store" revision={1} writable onChanged={onChanged} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Last loaded figures have not been reset");
    expect(screen.getAllByText("$155.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Close register" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /refresh/i, hidden: true })).not.toBeInTheDocument();
    rerender(<RegisterSessionPanel siteId="site-1" session={registerSession} locationName="Store" revision={2} writable onChanged={onChanged} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close register" })).toBeEnabled());
  });

  it("lets the cashier cancel a selected action after summary failure without writing", async () => {
    const onChanged = jest.fn();
    const { rerender } = render(<RegisterSessionPanel siteId="site-1" session={registerSession} locationName="Store" revision={0} writable onChanged={onChanged} />);
    await screen.findByText("Expected drawer cash");
    fireEvent.click(screen.getByRole("button", { name: "Close register" }));
    fireEvent.change(screen.getByLabelText("Counted cash (USD)"), { target: { value: "150" } });
    summary.mockResolvedValueOnce({ error: "Summary unavailable" });
    rerender(<RegisterSessionPanel siteId="site-1" session={registerSession} locationName="Store" revision={1} writable onChanged={onChanged} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close register" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Summary unavailable");
    expect(close).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /refresh/i, hidden: true })).not.toBeInTheDocument();
    rerender(<RegisterSessionPanel siteId="site-1" session={registerSession} locationName="Store" revision={2} writable onChanged={onChanged} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close register" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Close register" }));
    expect(screen.getByLabelText("Counted cash (USD)")).toHaveValue("150");
  });
});