import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import RegisterDashboard from "@/app/pos/register/RegisterDashboard";
import { CashRegisterOptions } from "@/app/pos/register/CashRegisterOptions";
import { closePosRegister, fetchRegisterDashboard, fetchRegisterSummary, movePosRegisterCash, openPosRegister } from "@/app/pos/operation-client";
import { withRegisterCloseLock } from "@/app/pos/register/queue-guard";
import type { RegisterDashboard as Dashboard } from "@/app/pos/register/types";
import { closedRegisterSession, registerSession, registerSummary } from "./register-ui-fixtures";

jest.mock("@/app/pos/operation-client", () => ({ fetchRegisterDashboard: jest.fn(), fetchRegisterSummary: jest.fn(), openPosRegister: jest.fn(), movePosRegisterCash: jest.fn(), closePosRegister: jest.fn() }));
jest.mock("@/app/pos/register/queue-guard", () => ({ withRegisterCloseLock: jest.fn() }));
const dashboard = jest.mocked(fetchRegisterDashboard);
const summary = jest.mocked(fetchRegisterSummary);
const open = jest.mocked(openPosRegister);
const input = { siteId: "site-1", locationId: "store-1", locations: [{ id: "store-1", name: "Main store" }, { id: "store-2", name: "Carryout" }], currency: "USD" };
const empty: Dashboard = { active: null, history: [], hasMore: false, role: "owner", userId: "cashier-1" };

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: jest.fn(() => "11111111-1111-4111-8111-111111111111") });
  dashboard.mockResolvedValue({ data: empty });
  summary.mockResolvedValue({ data: registerSummary });
  open.mockResolvedValue({ data: registerSession });
  jest.mocked(movePosRegisterCash).mockResolvedValue({ data: {} });
  jest.mocked(closePosRegister).mockResolvedValue({ data: closedRegisterSession });
  jest.mocked(withRegisterCloseLock).mockImplementation(async (_siteId, operation) => operation());
});

function selectView(name: "Today" | "History") {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
  fireEvent.click(screen.getByRole("tab", { name }));
}

function expectInFooter(button: HTMLElement) {
  expect(button.closest('[data-slot="dialog-footer"]')).not.toBeNull();
  expect(button.closest('[data-slot="dialog-body"]')).toBeNull();
}

function footerButtons() {
  const footer = screen.getByRole("button", { name: /^(Open register|Add cash|Withdraw cash|Close register)$/ }).closest('[data-slot="dialog-footer"]');
  return within(footer as HTMLElement).getAllByRole("button").map((button) => button.textContent);
}

describe("cash register dashboard UI", () => {
  it("asks for opening cash immediately and creates the shift from the footer", async () => {
    render(<RegisterDashboard {...input} />);
    const openButton = await screen.findByRole("button", { name: "Open register" });
    const openingCash = screen.getByLabelText("Opening cash (USD)");
    expect(openingCash).toBeVisible();
    expect(openingCash).toHaveValue("");
    expect(openingCash).toBeRequired();
    expect(footerButtons()).toEqual(["Open register"]);
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(openButton);
    expect(open).not.toHaveBeenCalled();
    fireEvent.change(openingCash, { target: { value: "100" } });
    expect(open).not.toHaveBeenCalled();
    dashboard.mockResolvedValue({ data: { ...empty, active: registerSession } });
    fireEvent.click(openButton);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(open).toHaveBeenCalledWith({ siteId: "site-1", locationId: "store-1", currency: "USD", openingAmount: 100, requestId: expect.any(String) });
    await waitFor(() => expect(screen.getByRole("button", { name: "Withdraw cash" })).toBeEnabled());
    const footer = screen.getByRole("button", { name: "Withdraw cash" }).closest('[data-slot="dialog-footer"]');
    expect(within(footer as HTMLElement).getAllByRole("button").map((button) => button.textContent)).toEqual(["Add cash", "Withdraw cash", "Close register"]);
    expect(screen.queryByRole("button", { name: "Open register" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Opening cash (USD)")).not.toBeInTheDocument();
  });

  it.each(["-1", "1.234", "not a number", " "])("rejects invalid opening cash %j without creating a shift", async (amount) => {
    render(<RegisterDashboard {...input} />);
    const openingCash = await screen.findByLabelText("Opening cash (USD)");
    fireEvent.change(openingCash, { target: { value: amount } });
    fireEvent.click(screen.getByRole("button", { name: "Open register" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter an amount with no more than two decimal places.");
    expect(open).not.toHaveBeenCalled();
    expect(openingCash).toHaveValue(amount);
  });

  it("allows an explicit zero opening amount and blocks duplicate submissions", async () => {
    let resolve!: (value: { data: typeof registerSession }) => void;
    open.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<RegisterDashboard {...input} currency="MXN" />);
    const openingCash = await screen.findByLabelText("Opening cash (MXN)");
    fireEvent.change(openingCash, { target: { value: "0" } });
    const submit = screen.getByRole("button", { name: "Open register" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ openingAmount: 0, currency: "MXN" }));
    expect(openingCash).toBeDisabled();
    expect(screen.getByRole("button", { name: "Opening…" })).toBeDisabled();
    await act(async () => { resolve({ data: registerSession }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Open register" })).toBeEnabled());
  });

  it("retains opening cash offline and submits it after reconnecting", async () => {
    render(<RegisterDashboard {...input} />);
    const openingCash = await screen.findByLabelText("Opening cash (USD)");
    fireEvent.change(openingCash, { target: { value: "50" } });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent.click(screen.getByRole("button", { name: "Open register" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You are offline");
    expect(open).not.toHaveBeenCalled();
    expect(openingCash).toHaveValue("50");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    fireEvent.click(screen.getByRole("button", { name: "Open register" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.objectContaining({ openingAmount: 50 })));
  });

  it.each(["cash_out", "cash_refund"])("confirms %s only from the withdrawal form", async (kind) => {
    dashboard.mockResolvedValue({ data: { ...empty, active: registerSession } });
    render(<RegisterDashboard {...input} />);
    await screen.findByText("Expected drawer cash");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw cash" }));
    expect(movePosRegisterCash).not.toHaveBeenCalled();
    expect(footerButtons()).toEqual(["Cancel", "Withdraw cash"]);
    expect(screen.queryByLabelText("Counted cash (USD)")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Withdrawal type"), { target: { value: kind } });
    fireEvent.change(screen.getByLabelText("Movement amount (USD)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Drawer withdrawal" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(movePosRegisterCash).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    expect(screen.getByLabelText("Movement amount (USD)")).toHaveValue("");
    expect(screen.queryByLabelText("Withdrawal type")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw cash" }));
    expect(screen.getByLabelText("Movement amount (USD)")).toHaveValue("30");
    expect(screen.getByLabelText("Withdrawal type")).toHaveValue(kind);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw cash" }));
    await waitFor(() => expect(movePosRegisterCash).toHaveBeenCalledWith(expect.objectContaining({ kind, amount: 30, reason: "Drawer withdrawal" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Close register" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("separates Today from History, preserves drafts and places actions outside the scrollable body", async () => {
    render(<RegisterDashboard {...input} />);
    const opening = await screen.findByRole("button", { name: "Open register" });
    expect(screen.getByRole("tab", { name: "Today" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Today" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Register history" })).not.toBeInTheDocument();
    expectInFooter(opening);
    expect(screen.queryByRole("button", { name: /refresh/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Opening cash (USD)")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Opening cash (USD)"), { target: { value: "125" } });

    selectView("History");
    expect(screen.getByRole("tabpanel", { name: "History" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open register" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Opening cash (USD)")).not.toBeVisible();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Register history" });
    expect(table).toBeVisible();
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Session", "Opened", "Closed", "Expected cash"]);
    expect(within(table).getByRole("cell", { name: "No closed register sessions at this location." })).toHaveAttribute("colspan", "4");
    const pagination = screen.getByRole("navigation", { name: "Register history pagination" });
    expect(within(pagination).getByText("Page 1")).toBeVisible();
    expectInFooter(pagination);
    for (const name of ["Previous", "Next"]) {
      const button = within(pagination).getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button.closest("table")).toBeNull();
      expectInFooter(button);
    }
    expect(screen.queryByRole("button", { name: "Apply dates" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    selectView("Today");
    expect(screen.getByLabelText("Opening cash (USD)")).toHaveValue("125");
    expect(screen.queryByRole("navigation", { name: "Register history pagination" })).not.toBeInTheDocument();
    selectView("History");
    expect(dashboard).toHaveBeenCalledTimes(1);
    expect(dashboard).toHaveBeenCalledWith({ siteId: "site-1", locationId: "store-1", page: 0 });
  });

  it("keeps active-session drafts when browsing history", async () => {
    dashboard.mockResolvedValue({ data: { ...empty, active: registerSession } });
    render(<RegisterDashboard {...input} />);
    await screen.findByText("Expected drawer cash");
    for (const name of ["Add cash", "Withdraw cash", "Close register"]) {
      expectInFooter(screen.getByRole("button", { name }));
    }
    expect(screen.queryByLabelText("Movement amount (USD)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Counted cash (USD)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    fireEvent.change(screen.getByLabelText("Movement amount (USD)"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Petty cash" } });
    expect(screen.queryByRole("button", { name: "Withdraw cash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close register" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close register" }));
    fireEvent.change(screen.getByLabelText("Counted cash (USD)"), { target: { value: "155" } });
    selectView("History");
    expect(screen.queryByRole("button", { name: "Close register" })).not.toBeInTheDocument();
    selectView("Today");
    expect(screen.getByLabelText("Counted cash (USD)")).toHaveValue("155");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    expect(screen.getByLabelText("Movement amount (USD)")).toHaveValue("25");
    expect(screen.getByLabelText("Reason")).toHaveValue("Petty cash");
    for (const name of ["Cancel", "Add cash"]) {
      expectInFooter(screen.getByRole("button", { name }));
    }
    const movementButton = screen.getByRole("button", { name: "Add cash" }) as HTMLButtonElement;
    expect(movementButton.form).toBe(screen.getByLabelText("Reason").closest("form"));
    fireEvent.click(movementButton);
    await waitFor(() => expect(movePosRegisterCash).toHaveBeenCalledWith(expect.objectContaining({ amount: 25, reason: "Petty cash" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Withdraw cash" })).toBeEnabled());
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add cash" }));
    expect(screen.getByLabelText("Reason")).toHaveValue("");
  });

  it("has an explicit carryout-compatible location selection and reports it to checkout", async () => {
    const onLocationChange = jest.fn();
    render(<RegisterDashboard {...input} locationId="" onLocationChange={onLocationChange} />);
    expect(dashboard).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Register location"), { target: { value: "store-2" } });
    await screen.findByRole("button", { name: "Open register" });
    expect(onLocationChange).toHaveBeenCalledWith("store-2");
    expect(dashboard).toHaveBeenCalledWith(expect.objectContaining({ locationId: "store-2", page: 0 }));
  });

  it("shows the immutable closing detail in History after submitting the closing footer", async () => {
    dashboard.mockResolvedValueOnce({ data: { ...empty, active: registerSession } });
    render(<RegisterDashboard {...input} />);
    await screen.findByText("Expected drawer cash");
    fireEvent.click(screen.getByRole("button", { name: "Close register" }));
    fireEvent.change(screen.getByLabelText("Counted cash (USD)"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Close register" }));
    expect(await screen.findByText(/Immutable closing snapshot/)).toBeVisible();
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    const detail = screen.getByRole("region", { name: "Session detail" });
    expect(within(detail).getByText("Closed session")).toBeVisible();
    expect(within(detail).queryByRole("button", { name: "Close register" })).not.toBeInTheDocument();
    expect(jest.mocked(closePosRegister)).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1", countedAmount: 150 }));
    await waitFor(() => expect(dashboard).toHaveBeenCalledTimes(2));
    selectView("Today");
    expect(await screen.findByRole("button", { name: "Open register" })).toBeVisible();
  });

  it("recovers a failed dashboard read by reopening the dialog without Refresh buttons", async () => {
    dashboard.mockResolvedValueOnce({ error: "Register unavailable" });
    render(<CashRegisterOptions {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Cash Register" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Register unavailable");
    expect(screen.getByRole("alert")).toHaveTextContent("Close and reopen this dialog after recovery.");
    expect(screen.queryByRole("button", { name: /refresh/i, hidden: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Close$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cash Register" }));
    expect(await screen.findByRole("button", { name: "Open register" })).toBeEnabled();
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it("keeps opening cash after failed writes and history reads without a Refresh control", async () => {
    open.mockResolvedValueOnce({ error: "Register migration unavailable" });
    dashboard.mockResolvedValue({ data: { ...empty, hasMore: true } });
    render(<RegisterDashboard {...input} />);
    await screen.findByRole("button", { name: "Open register" });
    fireEvent.change(screen.getByLabelText("Opening cash (USD)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Open register" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Register migration unavailable");
    expect(screen.getByLabelText("Opening cash (USD)")).toHaveValue("100");
    dashboard.mockResolvedValueOnce({ error: "Register migration unavailable" });
    selectView("History");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByText(/No balance has been reset/)).toBeInTheDocument());
    selectView("Today");
    expect(screen.getByRole("button", { name: "Open register" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /refresh/i, hidden: true })).not.toBeInTheDocument();
    selectView("History");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(screen.queryByText(/No balance has been reset/)).not.toBeInTheDocument());
    selectView("Today");
    await waitFor(() => expect(screen.getByRole("button", { name: "Open register" })).toBeEnabled());
    expect(screen.getByLabelText("Opening cash (USD)")).toHaveValue("100");
  });

  it("paginates all closed history without date filters and shows snapshot detail", async () => {
    dashboard.mockResolvedValue({ data: { ...empty, history: [closedRegisterSession], hasMore: true } });
    render(<RegisterDashboard {...input} />);
    selectView("History");
    await screen.findByText("Session session-1");
    const table = screen.getByRole("table", { name: "Register history" });
    expect(within(table).getByRole("button", { name: "Session session-1" })).toBeVisible();
    expect(within(table).getByRole("cell", { name: "$155.00" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(dashboard).toHaveBeenLastCalledWith({ siteId: "site-1", locationId: "store-1", page: 0 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(dashboard).toHaveBeenLastCalledWith({ siteId: "site-1", locationId: "store-1", page: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Session session-1" }));
    expect(await screen.findByText(/Immutable closing snapshot/)).toBeInTheDocument();
    expectInFooter(screen.getByRole("button", { name: "Print report" }));
    const hide = screen.getByRole("button", { name: "Hide detail" });
    expectInFooter(hide);
    fireEvent.click(hide);
    expect(screen.queryByRole("region", { name: "Session detail" })).not.toBeInTheDocument();
    expect(summary).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(dashboard).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0 })));
  });

  it("keeps the history table and paginator visible while loading and after a failed read", async () => {
    let resolve!: (value: { error: string }) => void;
    dashboard.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<RegisterDashboard {...input} />);
    selectView("History");
    const table = screen.getByRole("table", { name: "Register history" });
    expect(table).toBeVisible();
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent("Loading register history…");
    expect(table.querySelectorAll('[data-slot="register-history-skeleton"]')).toHaveLength(5);
    expect(within(table).queryByText("No closed register sessions at this location.")).not.toBeInTheDocument();
    const pagination = screen.getByRole("navigation", { name: "Register history pagination" });
    expect(pagination).toBeVisible();
    expectInFooter(pagination);
    expect(within(pagination).getByRole("button", { name: "Next" })).toBeDisabled();
    await act(async () => { resolve({ error: "Request failed" }); });
    expect(table).toHaveAttribute("aria-busy", "false");
    expect(table.querySelector('[data-slot="register-history-skeleton"]')).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(within(table).getByText("Register history is unavailable. Close and reopen this dialog to try again.")).toBeVisible();
    expect(within(table).queryByText("No closed register sessions at this location.")).not.toBeInTheDocument();
    expect(within(pagination).getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    selectView("Today");
    expect(screen.queryByRole("button", { name: /refresh/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Close and reopen this dialog after recovery.");
  });

  it.each(["populated", "empty"])("shows history skeletons while loading a %s next page", async (result) => {
    dashboard.mockResolvedValueOnce({ data: { ...empty, history: [closedRegisterSession], hasMore: true } });
    render(<RegisterDashboard {...input} />);
    selectView("History");
    await screen.findByRole("button", { name: "Session session-1" });
    let resolve!: (value: { data: Dashboard }) => void;
    dashboard.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const table = screen.getByRole("table", { name: "Register history" });
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    const rows = table.querySelectorAll('[data-slot="register-history-skeleton"]');
    expect(rows).toHaveLength(5);
    rows.forEach((row) => {
      expect(row).toHaveAttribute("aria-hidden", "true");
      expect(row.querySelectorAll("td")).toHaveLength(4);
    });
    expect(within(table).queryByRole("button", { name: "Session session-1" })).not.toBeInTheDocument();
    expect(within(table).queryByText("No closed register sessions at this location.")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading register history…");
    expectInFooter(screen.getByRole("navigation", { name: "Register history pagination" }));
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    const history = result === "populated" ? [{ ...closedRegisterSession, id: "session-2" }] : [];
    await act(async () => { resolve({ data: { ...empty, history } }); });
    expect(table).toHaveAttribute("aria-busy", "false");
    expect(table.querySelector('[data-slot="register-history-skeleton"]')).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    if (result === "populated") {
      expect(within(table).getByRole("button", { name: "Session session-2" })).toBeVisible();
    } else {
      expect(within(table).getByText("No closed register sessions at this location.")).toBeVisible();
    }
  });

  it("uses a single fixed dialog footer with correctly associated forms", async () => {
    render(<CashRegisterOptions {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Cash Register" }));
    const dialog = await screen.findByRole("dialog", { name: "Cash Register" });
    const opening = await within(dialog).findByRole("button", { name: "Open register" }) as HTMLButtonElement;
    const body = dialog.querySelector('[data-slot="dialog-body"]');
    const footer = dialog.querySelector('[data-slot="dialog-footer"]');
    expect(body).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(body?.parentElement).toBe(footer?.parentElement);
    expect(body?.nextElementSibling).toBe(footer);
    expect(body).not.toContainElement(footer as HTMLElement);
    expect(dialog.querySelectorAll('[data-slot="dialog-footer"]')).toHaveLength(1);
    expectInFooter(opening);
    expect(opening.form).toBe(within(dialog).getByLabelText("Opening cash (USD)").closest("form"));
    selectView("History");
    expect(within(footer as HTMLElement).getAllByRole("button").map((button) => button.textContent)).toEqual(["Previous", "Next"]);
    expect(within(dialog).queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    const table = within(dialog).getByRole("table", { name: "Register history" });
    expect(body).toContainElement(table);
    expect(footer).not.toContainElement(table);
    expect(within(footer as HTMLElement).getByRole("button", { name: "Next" })).toBeDisabled();
    expect(within(table).queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("ignores a dashboard response after switching location", async () => {
    let resolve!: (value: { data: typeof empty }) => void;
    dashboard.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<RegisterDashboard {...input} />);
    fireEvent.change(screen.getByLabelText("Register location"), { target: { value: "store-2" } });
    await screen.findByRole("button", { name: "Open register" });
    await act(async () => { resolve({ data: { ...empty, active: registerSession } }); });
    expect(screen.queryByText("Open session")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open register" })).toBeInTheDocument();
  });

  it("allows only responsible cashier or manager to change an active session", async () => {
    dashboard.mockResolvedValue({ data: { ...empty, active: registerSession, role: "employee", userId: "another-cashier" } });
    render(<RegisterDashboard {...input} />);
    await screen.findByText("Expected drawer cash");
    expect(screen.getByRole("button", { name: "Add cash" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Withdraw cash" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close register" })).toBeDisabled();
  });
});