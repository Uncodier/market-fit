import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname, useRouter } from "next/navigation";
import { TopBarActions } from "@/app/components/navigation/TopBarActions";
import type { TopBarActionsProps } from "@/app/components/navigation/topbar-action-types";
import { safeReload } from "@/app/utils/safe-reload";
import { createClient } from "@/lib/supabase/client";

type DialogProps = { trigger?: React.ReactNode; segments?: unknown[]; onSuccess?: () => void };
const mockDialogProps = new Map<string, DialogProps>();
let mockSite: { id: string; billing?: { account_balance: number } } | null = { id: "site-one" };
const mockPush = jest.fn();

function mockDialog(name: string, props: DialogProps) {
  mockDialogProps.set(name, props);
  return <div data-testid={name}>{props.trigger}</div>;
}

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }));
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/app/utils/safe-reload", () => ({ safeReload: jest.fn() }));
jest.mock("@/app/components/navigation/ReportExportButton", () => ({ ReportExportButton: () => <button>Section CSV</button> }));
jest.mock("@/app/components/navigation/RobotPrimaryActions", () => ({ RobotPrimaryActions: ({ viewMode }: { viewMode?: string }) => <div data-testid="robots">{viewMode}</div> }));
jest.mock("@/app/components/create-task-dialog", () => ({ CreateTaskDialog: (props: DialogProps) => mockDialog("task", props) }));
jest.mock("@/app/components/create-segment-dialog", () => ({ CreateSegmentDialog: (props: DialogProps) => mockDialog("segment", props) }));
jest.mock("@/app/components/create-experiment-dialog", () => ({ CreateExperimentDialog: (props: DialogProps) => mockDialog("experiment", props) }));
jest.mock("@/app/components/create-requirement-dialog", () => ({ CreateRequirementDialog: (props: DialogProps) => mockDialog("requirement", props) }));
jest.mock("@/app/components/create-lead-dialog", () => ({ CreateLeadDialog: (props: DialogProps) => mockDialog("lead", props) }));
jest.mock("@/app/components/upload-asset-dialog", () => ({ UploadAssetDialog: (props: DialogProps) => mockDialog("asset", props) }));
jest.mock("@/app/content/components", () => ({ CreateContentDialog: (props: DialogProps) => mockDialog("content", props) }));
jest.mock("@/app/components/navigation/TopBarCampaignAction", () => ({ TopBarCampaignAction: (props: DialogProps) => mockDialog("campaign", props) }));
jest.mock("@/app/deals/components/CreateDealDialog", () => ({ CreateDealDialog: (props: DialogProps) => mockDialog("deal", props) }));
jest.mock("@/app/quotations/components/CreateQuotationDialog", () => ({ CreateQuotationDialog: (props: DialogProps) => mockDialog("quotation", props) }));
jest.mock("@/app/components/navigation/topbar-create-handlers", () => ({
  handleCreateSegment: jest.fn(), handleCreateExperiment: jest.fn(), handleCreateRequirement: jest.fn(),
  handleCreateLead: jest.fn(), handleCreateAsset: jest.fn(), handleCreateDeal: jest.fn(),
}));

const baseProps: TopBarActionsProps = {
  isDashboardPage: false, isSegmentsPage: false, isExperimentsPage: false,
  isRequirementsPage: false, isLeadsPage: false, isAgentsPage: false,
  isAssetsPage: false, isContentPage: false, isControlCenterPage: false,
  isCampaignsPage: false, isSalesPage: false, isRobotsPage: false,
  isSecurityPage: false, segments: [], requirements: [], campaigns: [],
};

function toolbar(pathname = "/dashboard", props: Partial<TopBarActionsProps> = {}) {
  jest.mocked(usePathname).mockReturnValue(pathname);
  return render(<TopBarActions {...baseProps} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSite = { id: "site-one" };
  mockDialogProps.clear();
  jest.mocked(useRouter).mockReturnValue({ ...useRouter(), push: mockPush });
});

it("only mounts the report export on dashboards with a selected site, without duplicate auth lookup", () => {
  const { rerender } = toolbar("/dashboard", { isDashboardPage: true });
  expect(screen.getByRole("button", { name: "Section CSV" })).toBeInTheDocument();
  expect(createClient).not.toHaveBeenCalled();
  mockSite = null;
  rerender(<TopBarActions {...baseProps} isDashboardPage />);
  expect(screen.queryByRole("button", { name: "Section CSV" })).not.toBeInTheDocument();
  mockSite = { id: "site-one" };
  rerender(<TopBarActions {...baseProps} />);
  expect(screen.queryByRole("button", { name: "Section CSV" })).not.toBeInTheDocument();
});

it("mounts the export on the standalone Costs route with a selected site", () => {
  const { rerender } = toolbar("/costs");
  expect(screen.getByRole("button", { name: "Section CSV" })).toBeInTheDocument();
  mockSite = null;
  rerender(<TopBarActions {...baseProps} />);
  expect(screen.queryByRole("button", { name: "Section CSV" })).not.toBeInTheDocument();
});

it.each([
  ["/catalog", "catalog:create"],
  ["/catalog/modifier-groups", "modifier-groups:create"],
  ["/orders", "orders:create"],
  ["/shipments", "shipments:create"],
  ["/inventory", "inventory:create-stock"],
  ["/price-lists", "price-lists:create"],
  ["/promotions", "promotions:create"],
  ["/subscriptions", "subscriptions:create"],
  ["/reservations", "reservations:create"],
  ["/bills", "bills:create"],
  ["/transactions", "transactions:create"],
  ["/content/article-one", "content:publish"],
])("preserves the %s action event", (pathname, eventName) => {
  const listener = jest.fn();
  window.addEventListener(eventName, listener);
  const { rerender } = toolbar(pathname);
  fireEvent.click(screen.getByRole("button"));
  expect(listener).toHaveBeenCalledTimes(1);
  if (!pathname.startsWith("/content/")) {
    mockSite = null;
    rerender(<TopBarActions {...baseProps} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  }
  window.removeEventListener(eventName, listener);
});

it.each([
  ["isRecordsPage", "records:create"],
  ["isAccountingPage", "accounting:create"],
  ["isFinancePage", "finance:loadReport"],
  ["isJournalEntriesPage", "journal:create"],
] as const)("preserves %s events", (flag, eventName) => {
  const listener = jest.fn();
  window.addEventListener(eventName, listener);
  toolbar("/workspace", { [flag]: true });
  fireEvent.click(screen.getByRole("button"));
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener(eventName, listener);
});

it.each([
  ["/purchases/orders", "/marketplace?ownerSiteId=site-one&returnTo=/purchases/orders"],
  ["/purchases/subscriptions", "/marketplace?ownerSiteId=site-one&returnTo=/purchases/subscriptions&filter=recurring"],
])("preserves %s marketplace navigation", (pathname, target) => {
  toolbar(pathname);
  fireEvent.click(screen.getByRole("button"));
  expect(mockPush).toHaveBeenCalledWith(target);
});

it("preserves delayed bill creation after navigating from a bill detail", () => {
  jest.useFakeTimers();
  const listener = jest.fn();
  window.addEventListener("bills:create", listener);
  toolbar("/bills/bill-one");
  fireEvent.click(screen.getByRole("button"));
  expect(mockPush).toHaveBeenCalledWith("/bills");
  expect(listener).not.toHaveBeenCalled();
  jest.advanceTimersByTime(100);
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener("bills:create", listener);
  jest.useRealTimers();
});

it("preserves payout balance gating", () => {
  const listener = jest.fn();
  window.addEventListener("payouts:request-open", listener);
  const { rerender } = toolbar("/payments");
  expect(screen.getByRole("button")).toBeDisabled();
  mockSite = { id: "site-one", billing: { account_balance: 10 } };
  rerender(<TopBarActions {...baseProps} />);
  fireEvent.click(screen.getByRole("button"));
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener("payouts:request-open", listener);
});

it("preserves detail-only price-list creation and the sales callback", () => {
  const listener = jest.fn();
  window.addEventListener("price-list:add-price", listener);
  const { rerender } = toolbar("/price-lists/list-one");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  rerender(<TopBarActions {...baseProps} priceListData={{ id: "list-one", is_active: true }} />);
  fireEvent.click(screen.getByRole("button", { name: "Add Price" }));
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener("price-list:add-price", listener);
  jest.mocked(usePathname).mockReturnValue("/sales");
  const onCreateSale = jest.fn();
  rerender(<TopBarActions {...baseProps} isSalesPage onCreateSale={onCreateSale} />);
  fireEvent.click(screen.getByRole("button"));
  expect(onCreateSale).toHaveBeenCalledTimes(1);
});

it("preserves requirement building state and does not publish deep research", () => {
  const listener = jest.fn();
  window.addEventListener("requirement:build-trigger", listener);
  const requirementData = { id: "req-one", isBuilding: false, hasRequirementStatus: true };
  const { rerender } = toolbar("/content/deepResearch", { requirementData });
  fireEvent.click(screen.getByRole("button", { name: "Rebuild Requirement" }));
  expect(listener).toHaveBeenCalledTimes(1);
  rerender(<TopBarActions {...baseProps} requirementData={{ ...requirementData, isBuilding: true }} />);
  expect(screen.getByRole("button", { name: "Building..." })).toBeDisabled();
  window.removeEventListener("requirement:build-trigger", listener);
});

it.each([
  ["isControlCenterPage", "task"], ["isSegmentsPage", "segment"],
  ["isExperimentsPage", "experiment"], ["isRequirementsPage", "requirement"],
  ["isLeadsPage", "lead"], ["isAssetsPage", "asset"],
  ["isContentPage", "content"], ["isCampaignsPage", "campaign"],
  ["isDealsPage", "deal"], ["isQuotationsPage", "quotation"],
] as const)("preserves %s dialog mounting and site gating", (flag, dialog) => {
  const { rerender } = toolbar("/quotations", { [flag]: true });
  expect(screen.getByTestId(dialog)).toBeInTheDocument();
  mockSite = null;
  rerender(<TopBarActions {...baseProps} {...{ [flag]: true }} />);
  expect(screen.queryByTestId(dialog)).not.toBeInTheDocument();
});

it("preserves content segment fallback, refresh and reload behavior", () => {
  const propSegments = [{ id: "segment-one", name: "Segment", description: "" }];
  toolbar("/content", { isContentPage: true, propSegments });
  expect(mockDialogProps.get("content")?.segments).toEqual(propSegments);
  mockDialogProps.get("content")?.onSuccess?.();
  expect(safeReload).toHaveBeenCalledWith(false, "New content created");
  const target = window as Window & { refreshContentList?: () => void };
  target.refreshContentList = jest.fn();
  mockDialogProps.get("content")?.onSuccess?.();
  expect(target.refreshContentList).toHaveBeenCalledTimes(1);
  delete target.refreshContentList;
});

it("preserves robot view mode and profile logout visibility", () => {
  const { rerender } = toolbar("/robots", { isRobotsPage: true, viewMode: "workflow" });
  expect(screen.getByTestId("robots")).toHaveTextContent("workflow");
  jest.mocked(usePathname).mockReturnValue("/profile");
  rerender(<TopBarActions {...baseProps} />);
  expect(screen.getByRole("button", { name: "layout.topbar.logOut" })).toBeInTheDocument();
});