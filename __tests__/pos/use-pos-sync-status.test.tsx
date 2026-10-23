import { act, renderHook } from "@testing-library/react";
import { usePosSyncStatus } from "@/app/pos/hooks/use-pos-sync-status";
import { getPosSyncStatus, subscribePosSync } from "@/app/pos/local/sync-engine";
import type { SyncStatus } from "@/app/pos/local/sync-engine";

jest.mock("@/app/pos/local/sync-engine", () => ({
  getPosSyncStatus: jest.fn(), subscribePosSync: jest.fn(), startPosSyncLoop: jest.fn(),
  stopPosSyncLoop: jest.fn(), runPosSyncCycle: jest.fn(), drainPosOutbox: jest.fn(),
}));

const base: SyncStatus = { online: true, pulling: false, syncing: false, pendingCount: 0,
  failedCount: 0, lastPulledAt: null, lastOrdersPulledAt: null, lastError: null };

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