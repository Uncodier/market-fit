import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { searchPosCustomers } from "@/app/pos/actions/search-customers";
import { usePosCustomerSearch } from "@/app/pos/hooks/use-pos-customer-search";
import { PosCustomerSelect } from "@/app/pos/components/PosCustomerSelect";
import { PosCustomerPickerDialog } from "@/app/pos/components/PosCustomerPickerDialog";
import { canStartPosRemoteRequest } from "@/app/pos/local/remote-permission";

jest.mock("@/app/pos/actions/search-customers", () => ({ searchPosCustomers: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn((siteId) => ({ siteId })),
  subscribePosPermission: jest.fn(() => jest.fn()),
}));
jest.mock("@/app/pos/local/remote-permission", () => ({ canStartPosRemoteRequest: jest.fn(() => true) }));
jest.mock("@/app/leads/actions", () => ({ createLead: jest.fn() }));
jest.mock("@/app/pos/components/PosLeadDetailsDialog", () => ({ PosLeadDetailsDialog: () => null }));

const alice = { id: "alice", site_id: "site", name: "Alice", email: "alice@example.com" };
const tick = async () => { await act(async () => { jest.advanceTimersByTime(300); }); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(canStartPosRemoteRequest).mockReturnValue(true);
  jest.mocked(searchPosCustomers).mockResolvedValue({ leads: [alice] });
});
afterEach(() => { jest.useRealTimers(); });

it("finds and selects an uncached lead in the cart selector", async () => {
  const select = jest.fn();
  render(<PosCustomerSelect leads={[]} leadValue={null} setLeadValue={select} siteId="site" t={(key) => key} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Alice" } });
  expect(screen.getByRole("status")).toHaveTextContent("Searching customers");
  await tick();
  fireEvent.click(screen.getByText("Alice · alice@example.com"));
  expect(select).toHaveBeenCalledWith({ mode: "existing", id: "alice", label: "Alice · alice@example.com" });
  expect(searchPosCustomers).toHaveBeenCalledWith("site", "Alice");
});

it("finds and selects an uncached lead in the customer dialog", async () => {
  const select = jest.fn();
  const close = jest.fn();
  render(<PosCustomerPickerDialog open onOpenChange={close} leads={[]} value={null}
    onSelect={select} siteId="site" label={(_key, fallback) => fallback} />);
  await act(async () => { jest.runAllTicks(); });
  fireEvent.change(screen.getByPlaceholderText("Search by name, email, or phone..."), { target: { value: "Alice" } });
  await tick();
  fireEvent.click(screen.getByRole("button", { name: /Alice alice@example.com/ }));
  expect(select).toHaveBeenCalledWith({ mode: "existing", id: "alice", label: "Alice" });
  expect(close).toHaveBeenCalledWith(false);
});

it("debounces typing and deduplicates local and remote leads", async () => {
  const view = renderHook(({ term }) => usePosCustomerSearch("site", term, [alice]), { initialProps: { term: "A" } });
  view.rerender({ term: "Alice" });
  await tick();
  expect(searchPosCustomers).toHaveBeenCalledTimes(1);
  expect(view.result.current.leads).toEqual([alice]);
});

it("keeps local personal-email and company search available offline without remote requests", async () => {
  jest.mocked(canStartPosRemoteRequest).mockReturnValue(false);
  const local = { ...alice, personal_email: "personal@example.com", company: { name: "Acme" } };
  const view = renderHook(({ term }) => usePosCustomerSearch("site", term, [local]), { initialProps: { term: "personal" } });
  await tick();
  expect(view.result.current.leads).toEqual([local]);
  view.rerender({ term: "Acme" });
  expect(view.result.current.leads).toEqual([local]);
  expect(searchPosCustomers).not.toHaveBeenCalled();
  expect(view.result.current.status).toMatch(/connection/);
});

it("reports connection failures while retaining local matches", async () => {
  jest.mocked(searchPosCustomers).mockRejectedValue(new Error("network"));
  const view = renderHook(() => usePosCustomerSearch("site", "Alice", [alice]));
  await tick();
  expect(view.result.current.leads).toEqual([alice]);
  expect(view.result.current.status).toMatch(/unavailable/);
});

it("ignores late responses from a previous site", async () => {
  let resolve!: (result: { leads: typeof alice[] }) => void;
  jest.mocked(searchPosCustomers).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const view = renderHook(({ site }) => usePosCustomerSearch(site, "Alice", []), { initialProps: { site: "site" } });
  await tick();
  view.rerender({ site: "other-site" });
  await act(async () => { resolve({ leads: [alice] }); });
  expect(view.result.current.leads).toEqual([]);
  await tick();
  expect(view.result.current.leads).toEqual([]);
});

it("does not search for an empty query or a closed dialog", async () => {
  const view = renderHook(({ term, enabled }) => usePosCustomerSearch("site", term, [], enabled),
    { initialProps: { term: "", enabled: true } });
  await tick();
  view.rerender({ term: "Alice", enabled: false });
  await tick();
  expect(searchPosCustomers).not.toHaveBeenCalled();
});

it("ignores an earlier query response after the user types another search", async () => {
  let resolve!: (result: { leads: typeof alice[] }) => void;
  jest.mocked(searchPosCustomers).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const view = renderHook(({ term }) => usePosCustomerSearch("site", term, []), { initialProps: { term: "Alice" } });
  await tick();
  view.rerender({ term: "Bob" });
  await act(async () => { resolve({ leads: [alice] }); });
  expect(view.result.current.leads).toEqual([]);
});

it("discards results when POS access is revoked during the request", async () => {
  let resolve!: (result: { leads: typeof alice[] }) => void;
  jest.mocked(searchPosCustomers).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const view = renderHook(() => usePosCustomerSearch("site", "Alice", []));
  await tick();
  jest.mocked(canStartPosRemoteRequest).mockReturnValue(false);
  await act(async () => { resolve({ leads: [alice] }); });
  expect(view.result.current.leads).toEqual([]);
});

it("bounds a hung request and ignores its eventual late success", async () => {
  let resolve!: (result: { leads: typeof alice[] }) => void;
  jest.mocked(searchPosCustomers).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const view = renderHook(() => usePosCustomerSearch("site", "Alice", []));
  await tick();
  await act(async () => { jest.advanceTimersByTime(10_000); });
  expect(view.result.current.status).toMatch(/timed out/);
  expect(view.result.current.searching).toBe(false);
  await act(async () => { resolve({ leads: [alice] }); });
  expect(view.result.current.leads).toEqual([]);
});