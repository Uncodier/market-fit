import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { RegisterSummaryView } from "@/app/pos/register/RegisterSummaryView";
import { RegisterSessionPanel } from "@/app/pos/register/RegisterSessionPanel";
import { printRegisterReport } from "@/app/pos/register/print-register-report";
import { closedRegisterSession, registerSummary } from "./register-ui-fixtures";

jest.mock("@/app/pos/register/print-register-report", () => ({ printRegisterReport: jest.fn() }));
jest.mock("@/lib/printer/hooks/use-printer", () => ({ usePrinterSettings: () => ({ devices: [] }) }));
jest.mock("@/app/pos/operation-client", () => ({ fetchRegisterSummary: jest.fn() }));

const print = jest.mocked(printRegisterReport);
const panelProps = { siteId: "site-1", session: closedRegisterSession, locationName: "Main store", revision: 0, writable: false };

beforeEach(() => jest.clearAllMocks());

describe("register summary presentation", () => {
  it("separates expected drawer cash from all-method collections and displays the full breakdown", () => {
    render(<RegisterSummaryView summary={registerSummary} currency="USD" />);
    const summary = screen.getByRole("region", { name: "Register summary" });
    expect(within(summary).getByText("Expected drawer cash").parentElement).toHaveTextContent("$155.00");
    expect(within(summary).getByText("Total received (all methods)").parentElement).toHaveTextContent("$120.00");
    expect(within(summary).getByText("Receipt count").parentElement).toHaveTextContent("2");
    const breakdown = screen.getByRole("region", { name: "Cash breakdown" });
    for (const [label, value] of [["Opening cash", "$100.00"], ["Cash received", "+$50.00"], ["Cash in", "+$20.00"], ["Cash out", "−$10.00"], ["Cash refunds", "−$5.00"]]) {
      expect(within(breakdown).getByText(label).parentElement).toHaveTextContent(value);
    }
    const payments = screen.getByRole("region", { name: "Payment totals" });
    expect(within(payments).getByText("card").parentElement).toHaveTextContent("$70.00");
    expect(within(payments).getByText("cash").parentElement).toHaveTextContent("$50.00");
  });

  it("keeps audit records available in expandable sections without interpreting user content as HTML", () => {
    const reason = '<img src="https://example.com/tracker">';
    const { container } = render(<RegisterSummaryView summary={{ ...registerSummary, movements: [{ ...registerSummary.movements[0], reason }] }} currency="USD" />);
    const movements = screen.getByText("Cash movements (1)").closest("details")!;
    expect(movements).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Cash movements (1)"));
    expect(within(movements).getByText(reason)).toBeInTheDocument();
    expect(movements).toHaveTextContent("cashier-1");
    expect(movements).toHaveTextContent("movement-1");
    expect(screen.getByText("Receipts (1)").closest("details")).toHaveTextContent("sale-1");
    expect(container.querySelector("img")).toBeNull();
  });

  it("distinguishes empty payment, movement and receipt states", () => {
    render(<RegisterSummaryView summary={{ ...registerSummary, payment_totals: {}, movements: [], receipts: [], receipt_count: 0 }} currency="MXN" />);
    expect(screen.getByText("No payments received.")).toBeInTheDocument();
    expect(screen.getByText("No cash movements.")).toBeInTheDocument();
    expect(screen.getByText("No receipts.")).toBeInTheDocument();
  });

  it.each([[0, "Balanced"], [-5, "Cash shortage"], [5, "Cash surplus"], [null, "Unavailable"]])("describes closing difference %s without relying on color", (difference, label) => {
    render(<RegisterSessionPanel {...panelProps} session={{ ...closedRegisterSession, difference: difference as number | null }} />);
    expect(screen.getByLabelText("Closing reconciliation")).toHaveTextContent(label as string);
    expect(screen.getByText("Main store · USD")).toBeVisible();
    expect(screen.getByText("Immutable closing snapshot. Later payments and movements do not change this report.")).toBeVisible();
  });
});

describe("register print feedback", () => {
  it("prints the summary separately and blocks full-report printing while it is pending", async () => {
    let resolve!: (target: "printer" | "system") => void;
    print.mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<RegisterSessionPanel {...panelProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Print summary" }));
    expect(print).toHaveBeenCalledWith(closedRegisterSession, registerSummary, "Main store", { devices: [] }, { includeTransactions: false });
    expect(screen.getByRole("button", { name: "Printing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Print report" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Print report" }));
    expect(print).toHaveBeenCalledTimes(1);
    await act(async () => resolve("printer"));
    expect(screen.getByRole("status")).toHaveTextContent("Summary sent to printer.");
    expect(screen.getByRole("button", { name: "Print summary" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Print report" })).toBeEnabled();
  });

  it("waits for the printer, prevents duplicate submissions and confirms dispatch", async () => {
    let resolve!: (target: "printer" | "system") => void;
    print.mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<RegisterSessionPanel {...panelProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Print report" }));
    expect(screen.getByRole("button", { name: "Printing…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Printing…" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledWith(closedRegisterSession, registerSummary, "Main store", { devices: [] });
    await act(async () => resolve("printer"));
    expect(screen.getByRole("status")).toHaveTextContent("Report sent to printer.");
    expect(screen.getByRole("button", { name: "Print report" })).toBeEnabled();
  });

  it("surfaces async transport failures and allows an explicit retry", async () => {
    print.mockRejectedValueOnce(new Error("USB disconnected. Check for a partial ticket before retrying."));
    render(<RegisterSessionPanel {...panelProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Print report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("USB disconnected");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    print.mockResolvedValueOnce("system");
    fireEvent.click(screen.getByRole("button", { name: "Print report" }));
    expect(await screen.findByRole("status")).toHaveTextContent("System print dialog opened.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});