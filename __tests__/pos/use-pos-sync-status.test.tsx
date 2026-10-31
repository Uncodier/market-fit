import { act, renderHook } from "@testing-library/react";
import { usePosSyncStatus } from "@/app/pos/hooks/use-pos-sync-status";
import { getPosSyncStatus, runPosSyncCycle, subscribePosSync } from "@/app/pos/local/sync-engine";
import type { SyncStatus } from "@/app/pos/local/sync-engine";

jest.mock("@/app/pos/local/sync-engine", () => ({
  getPosSyncStatus: jest.fn(), subscribePosSync: jest.fn(), startPosSyncLoop: jest.fn(),
  stopPosSyncLoop: jest.fn(), runPosSyncCycle: jest.fn(), drainPosOutbox: jest.fn(),
}));

const base: SyncStatus = { online: true, pulling: false, syncing: false, pendingCount: 0,
  failedCount: 0, lastPulledAt: null, lastOrdersPulledAt: null, lastError: null };

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  jest.mocked(subscribePosSync).mockReturnValue(jest.fn());
});

it("hides the previous site's timing immediately and ignores late notifications", async () => {
  const listeners = new Map<string, (status: SyncStatus) => void>();
  jest.mocked(subscribePosSync).mockImplementation((listener, siteId) => {
    listeners.set(siteId!, listener);
    return jest.fn();
  });
  jest.mocked(getPosSyncStatus).mockReturnValue({ ...base, lastPulledAt: "2026-10-23T12:00:00Z" });
  const { result, rerender } = renderHook(({ siteId }) => usePosSyncStatus(siteId), { initialProps: { siteId: "old" } });
  await act(async () => { await Promise.resolve(); });
  expect(result.current.status.lastPulledAt).not.toBeNull();
  rerender({ siteId: "new" });
  expect(result.current.status.lastPulledAt).toBeNull();
  act(() => listeners.get("old")!({ ...base, lastError: "Late old error" }));
  expect(result.current.status.lastError).toBeNull();
  await act(async () => { await Promise.resolve(); });
});

it("requests access revalidation on retry and only syncs after verification", async () => {
  jest.mocked(getPosSyncStatus).mockReturnValue({ ...base, online: false, networkOnline: true, accessVerified: false });
  const recheck = jest.fn();
  window.addEventListener("pos-access-recheck", recheck);
  const { result } = renderHook(() => usePosSyncStatus("site"));
  await act(async () => { await Promise.resolve(); });
  act(() => result.current.retrySync());
  expect(recheck).toHaveBeenCalledTimes(1);
  expect(runPosSyncCycle).not.toHaveBeenCalled();
  jest.mocked(getPosSyncStatus).mockReturnValue({ ...base, accessVerified: true });
  act(() => result.current.retrySync());
  expect(runPosSyncCycle).toHaveBeenCalledWith("site", true);
  expect(recheck).toHaveBeenCalledTimes(1);
  window.removeEventListener("pos-access-recheck", recheck);
});

it("does not request verification offline or without a site", async () => {
  jest.mocked(getPosSyncStatus).mockReturnValue({ ...base, online: false, networkOnline: false, accessVerified: false });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  const recheck = jest.fn();
  window.addEventListener("pos-access-recheck", recheck);
  const initialProps: { siteId?: string } = { siteId: "site" };
  const { result, rerender } = renderHook(({ siteId }) => usePosSyncStatus(siteId), { initialProps });
  await act(async () => { await Promise.resolve(); });
  act(() => result.current.retrySync());
  rerender({ siteId: undefined });
  act(() => result.current.retrySync());
  expect(runPosSyncCycle).not.toHaveBeenCalled();
  expect(recheck).not.toHaveBeenCalled();
  window.removeEventListener("pos-access-recheck", recheck);
});