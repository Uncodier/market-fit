import { act, render, screen } from "@testing-library/react";
import RegisterDashboard from "@/app/pos/register/RegisterDashboard";
import { RegisterSessionPanel } from "@/app/pos/register/RegisterSessionPanel";
import { RegisterDashboardSkeleton } from "@/app/pos/register/RegisterSkeletons";
import { fetchRegisterDashboard, fetchRegisterSummary } from "@/app/pos/operation-client";
import { registerSession, registerSummary } from "./register-ui-fixtures";

jest.mock("@/app/pos/operation-client", () => ({ fetchRegisterDashboard: jest.fn(), fetchRegisterSummary: jest.fn() }));
jest.mock("@/lib/printer/hooks/use-printer", () => ({ usePrinterSettings: () => ({ devices: [] }) }));

beforeEach(() => jest.clearAllMocks());

it("uses shared skeletons and only screen-reader loading announcements for the lazy fallback", () => {
  const { container } = render(<RegisterDashboardSkeleton />);
  expect(container.querySelector('[data-slot="register-dashboard-skeleton"]')).not.toBeNull();
  expect(container.querySelector('[data-slot="register-session-skeleton"]')).not.toBeNull();
  expect(screen.getByRole("status")).toHaveClass("sr-only");
  expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(5);
  for (const skeleton of container.querySelectorAll('.animate-pulse')) {
    expect(skeleton).toHaveClass("motion-reduce:animate-none");
    expect(skeleton.closest('[aria-hidden="true"]')).not.toBeNull();
  }
});

it("shows a session skeleton while loading the dashboard, then the opening form", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof fetchRegisterDashboard>>) => void;
  jest.mocked(fetchRegisterDashboard).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { container } = render(<RegisterDashboard siteId="site-1" locationId="store-1" locations={[{ id: "store-1", name: "Store" }]} currency="USD" />);
  expect(container.querySelector('[data-slot="register-session-skeleton"]')).not.toBeNull();
  expect(screen.getByRole("status")).toHaveClass("sr-only");
  expect(screen.queryByText("Checking the current register for this location.")).not.toBeInTheDocument();
  expect(screen.queryByText("Loading register…")).not.toBeInTheDocument();
  await act(async () => resolve({ data: { active: null, history: [], hasMore: false, role: "owner", userId: "cashier-1" } }));
  expect(screen.getByLabelText("Opening cash (USD)")).toBeVisible();
  expect(container.querySelector('[data-slot="register-session-skeleton"]')).toBeNull();
});

it("replaces a pending summary with a skeleton and restores retained figures after a failed reload", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof fetchRegisterSummary>>) => void;
  jest.mocked(fetchRegisterSummary).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const props = { siteId: "site-1", session: registerSession, locationName: "Store", writable: true, onChanged: jest.fn() };
  const { container, rerender } = render(<RegisterSessionPanel {...props} revision={0} />);
  expect(container.querySelector('[data-slot="register-summary-skeleton"]')).not.toBeNull();
  expect(screen.getByRole("status")).toHaveClass("sr-only");
  expect(screen.getByRole("button", { name: "Print report" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Print summary" })).toBeDisabled();
  await act(async () => resolve({ data: registerSummary }));
  expect(screen.getByText("Expected drawer cash")).toBeVisible();
  expect(container.querySelector('[data-slot="register-summary-skeleton"]')).toBeNull();
  rerender(<RegisterSessionPanel {...props} revision={1} />);
  expect(container.querySelector('[data-slot="register-summary-skeleton"]')).not.toBeNull();
  expect(screen.queryByText("Expected drawer cash")).not.toBeInTheDocument();
  await act(async () => resolve({ error: "Summary unavailable" }));
  expect(screen.getByText("Expected drawer cash")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Last loaded figures have not been reset");
  expect(screen.getByRole("button", { name: "Close register" })).toBeDisabled();
  expect(container.querySelector('[data-slot="register-summary-skeleton"]')).toBeNull();
});