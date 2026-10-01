import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ReportExportButton } from "@/app/components/navigation/ReportExportButton";
import { REPORTS } from "@/app/dashboard/report-sections";
import type { getReportExportSnapshot } from "@/app/dashboard/export/report-export-store";

type Snapshot = NonNullable<ReturnType<typeof getReportExportSnapshot>>;
let mockSnapshot: Snapshot | null = null;
let mockSite: { id: string } | null = { id: "site-one" };
let mockUser: { id: string } | null = { id: "user-one" };
let mockSiteLoading = false;
let mockAuthLoading = false;
const mockListeners = new Set<() => void>();
const mockDownload = jest.fn();

jest.mock("@/app/dashboard/export/report-export-store", () => ({
  subscribeReportExport: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
  getReportExportSnapshot: () => mockSnapshot,
  getServerReportExportSnapshot: () => null,
}));
jest.mock("@/app/hooks/use-auth", () => ({
  useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading }),
}));
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: mockSite, isLoading: mockSiteLoading }),
}));
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "Export" }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    scopeKey: "current-filter-scope",
    report: "performance",
    section: "outcomes",
    siteId: "site-one",
    userId: "user-one",
    ready: true,
    download: mockDownload,
    ...overrides,
  };
}

function search(query: string) {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>);
}

function publish(next: Snapshot | null) {
  act(() => {
    mockSnapshot = next;
    mockListeners.forEach((listener) => listener());
  });
}

function exportButton() {
  return screen.getByRole("button", { name: "Export current section (CSV)" });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDownload.mockReset();
  mockSite = { id: "site-one" };
  mockUser = { id: "user-one" };
  mockSiteLoading = false;
  mockAuthLoading = false;
  mockSnapshot = snapshot();
  jest.mocked(usePathname).mockReturnValue("/dashboard");
  search("");
});

it("exports the default performance section from the frontend snapshot without fetching", () => {
  render(<ReportExportButton />);
  expect(exportButton()).toHaveAttribute("title", "Export current section (CSV)");
  expect(exportButton()).toBeEnabled();
  fireEvent.click(exportButton());
  expect(mockDownload).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
  expect(toast.success).toHaveBeenCalledWith("Report exported successfully");
});

it.each(Object.entries(REPORTS).flatMap(([report, definition]) =>
  definition.sections.map(({ id }) => [report, id]),
))("uses the selected %s/%s report section", (report, section) => {
  search(`tab=${report}&section=${section}`);
  mockSnapshot = snapshot({ report, section });
  render(<ReportExportButton />);
  fireEvent.click(exportButton());
  expect(mockDownload).toHaveBeenCalledTimes(1);
});

it.each([
  ["tab=unknown&section=unknown", "performance", "outcomes"],
  ["tab=analytics&section=unknown", "analytics", "distribution"],
  ["tab=traffic", "traffic", "summary"],
])("normalizes report and section with the dashboard helpers: %s", (query, report, section) => {
  search(query);
  mockSnapshot = snapshot({ report, section });
  render(<ReportExportButton />);
  expect(exportButton()).toBeEnabled();
});

it("does not offer a report download on the legacy onboarding tab", () => {
  search("tab=onboarding");
  render(<ReportExportButton />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it.each(["summary", "categories"])("exports the standalone costs/%s section instead of the dashboard tab", (section) => {
  jest.mocked(usePathname).mockReturnValue("/costs");
  search(`tab=performance&section=${section}`);
  const { rerender } = render(<ReportExportButton />);
  expect(exportButton()).toBeDisabled();
  publish(snapshot({ report: "costs", section }));
  fireEvent.click(exportButton());
  expect(mockDownload).toHaveBeenCalledTimes(1);
  jest.mocked(usePathname).mockReturnValue("/dashboard");
  rerender(<ReportExportButton />);
  expect(exportButton()).toBeDisabled();
});

it.each<Partial<Snapshot>>([
  { report: "overview" },
  { section: "operations" },
  { siteId: "another-site" },
  { userId: "another-user" },
  { ready: false },
  { scopeKey: "" },
])("disables a missing, loading or mismatched export scope: %j", (overrides) => {
  mockSnapshot = snapshot(overrides);
  render(<ReportExportButton />);
  expect(exportButton()).toBeDisabled();
  fireEvent.click(exportButton());
  expect(mockDownload).not.toHaveBeenCalled();
});

it.each(["snapshot", "site", "placeholder site", "user", "site loading", "auth loading"])(
  "disables download while %s is unavailable",
  (missing) => {
    if (missing === "snapshot") mockSnapshot = null;
    if (missing === "site") mockSite = null;
    if (missing === "placeholder site") {
      mockSite = { id: "default" };
      mockSnapshot = snapshot({ siteId: "default" });
    }
    if (missing === "user") mockUser = null;
    if (missing === "site loading") mockSiteLoading = true;
    if (missing === "auth loading") mockAuthLoading = true;
    render(<ReportExportButton />);
    expect(exportButton()).toBeDisabled();
    fireEvent.click(exportButton());
    expect(mockDownload).not.toHaveBeenCalled();
  },
);

it("subscribes to loading/filter-scope changes and cleans up on unmount", () => {
  const { unmount } = render(<ReportExportButton />);
  expect(mockListeners.size).toBe(1);
  publish(snapshot({ scopeKey: "new-date-range", ready: false }));
  expect(exportButton()).toBeDisabled();
  publish(null);
  expect(exportButton()).toBeDisabled();
  const nextDownload = jest.fn();
  publish(snapshot({ scopeKey: "new-date-range", download: nextDownload }));
  fireEvent.click(exportButton());
  expect(nextDownload).toHaveBeenCalledTimes(1);
  expect(mockDownload).not.toHaveBeenCalled();
  unmount();
  expect(mockListeners.size).toBe(0);
});

it("blocks stale exports across report, section, site, account and sign-out transitions", () => {
  const { rerender } = render(<ReportExportButton />);
  search("tab=traffic&section=summary");
  rerender(<ReportExportButton />);
  expect(exportButton()).toBeDisabled();
  publish(snapshot({ report: "traffic", section: "summary" }));
  expect(exportButton()).toBeEnabled();

  search("tab=traffic&section=audience");
  rerender(<ReportExportButton />);
  expect(exportButton()).toBeDisabled();
  publish(snapshot({ report: "traffic", section: "audience" }));
  expect(exportButton()).toBeEnabled();

  mockSite = { id: "site-two" };
  rerender(<ReportExportButton />);
  expect(exportButton()).toBeDisabled();
  publish(snapshot({ report: "traffic", section: "audience", siteId: "site-two" }));
  expect(exportButton()).toBeEnabled();

  mockUser = { id: "user-two" };
  rerender(<ReportExportButton />);
  expect(exportButton()).toBeDisabled();
  publish(snapshot({ report: "traffic", section: "audience", siteId: "site-two", userId: "user-two" }));
  expect(exportButton()).toBeEnabled();

  mockUser = null;
  rerender(<ReportExportButton />);
  expect(exportButton()).toBeDisabled();
  fireEvent.click(exportButton());
  expect(mockDownload).not.toHaveBeenCalled();
});

it("rechecks that the rendered snapshot is still current at click time", () => {
  render(<ReportExportButton />);
  mockSnapshot = null;
  fireEvent.click(exportButton());
  expect(mockDownload).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});

it("reports a download failure without a success toast", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  mockDownload.mockImplementation(() => { throw new Error("Download failed"); });
  render(<ReportExportButton />);
  fireEvent.click(exportButton());
  expect(toast.error).toHaveBeenCalledWith("Failed to export report");
  expect(toast.success).not.toHaveBeenCalled();
  consoleError.mockRestore();
});