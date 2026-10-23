import { act, fireEvent, render, screen } from "@testing-library/react";
import { PosTopBarSync } from "@/app/components/navigation/PosTopBarSync";
import { getPosSyncStatus, pullPosCatalogInBackground, subscribePosSync, type SyncStatus } from "@/app/pos/local/sync-engine";

let siteId = "site-one";
const base: SyncStatus = { online: true, pulling: false, syncing: false, pendingCount: 0, failedCount: 0,
  lastPulledAt: null, lastOrdersPulledAt: null, lastError: null };
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: siteId } }) }));
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ locale: "en", t: (key: string) => key }) }));
jest.mock("@/app/pos/local/sync-engine", () => ({
  getPosSyncStatus: jest.fn(), subscribePosSync: jest.fn(), pullPosCatalogInBackground: jest.fn(),
}));

describe("top-bar sync widget site scope", () => {
  beforeEach(() => {
    siteId = "site-one";
    jest.clearAllMocks();
    jest.mocked(getPosSyncStatus).mockReturnValue(base);
    jest.mocked(subscribePosSync).mockReturnValue(jest.fn());
  });

  it("subscribes only to the selected site and rejects a late old-site update", async () => {
    const { rerender } = render(<PosTopBarSync />);
    await act(async () => { await Promise.resolve(); });
    const listener = jest.mocked(subscribePosSync).mock.calls[0][0];
    expect(subscribePosSync).toHaveBeenCalledWith(expect.any(Function), "site-one");
    siteId = "site-two";
    rerender(<PosTopBarSync />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    act(() => listener({ ...base, lastError: "Old site's error" }));
    expect(screen.queryByRole("button", { name: "pos.sync.error" })).not.toBeInTheDocument();
    expect(subscribePosSync).toHaveBeenLastCalledWith(expect.any(Function), "site-two");
  });

  it("refreshes only the catalog for the selected site from the widget", async () => {
    render(<PosTopBarSync />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "pos.sync.catalog.waiting" }));
    fireEvent.click(screen.getByRole("button", { name: "pos.sync.catalog.refresh" }));
    expect(pullPosCatalogInBackground).toHaveBeenCalledWith("site-one", true);
  });
});