import { posSyncBadgeView } from "@/app/pos/components/PosSyncBadge";
import type { SyncStatus } from "@/app/pos/local/sync-engine";

const baseStatus: SyncStatus = {
  online: true,
  pulling: false,
  syncing: false,
  pendingCount: 0,
  failedCount: 0,
  lastPulledAt: "2026-10-23T12:00:00Z",
  lastOrdersPulledAt: null,
  lastError: null,
};

describe("posSyncBadgeView", () => {
  const t = (k: string) => k;

  it("shows checkmark when fully synced", () => {
    const view = posSyncBadgeView(baseStatus, t);
    expect(view.busy).toBe(false);
    expect(view.expanded).toBe(false);
  });

  it("shows spinner when pendingCount > 0 but not yet running", () => {
    const view = posSyncBadgeView({ ...baseStatus, pendingCount: 4 }, t);
    expect(view.busy).toBe(true);
    expect(view.expanded).toBe(true);
    expect(view.label).toContain("pos.sync.syncing");
    expect(view.label).toContain("4");
  });

  it("shows spinner when pulling", () => {
    const view = posSyncBadgeView({ ...baseStatus, pulling: true }, t);
    expect(view.busy).toBe(true);
    expect(view.expanded).toBe(true);
  });

  it("shows offline with count", () => {
    const view = posSyncBadgeView({ ...baseStatus, online: false, pendingCount: 2 }, t);
    expect(view.busy).toBe(false); // Queued local work is waiting, not actively syncing.
    expect(view.expanded).toBe(true);
    expect(view.label).toContain("pos.sync.offline");
    expect(view.label).toContain("2");
  });

  it("shows a pull error and returns to synced after recovery", () => {
    const failed = posSyncBadgeView({ ...baseStatus, lastError: "Catalog pull failed" }, t);
    expect(failed.label).toBe("pos.sync.error");
    expect(failed.expanded).toBe(true);
    const recovered = posSyncBadgeView({ ...baseStatus, lastError: null }, t);
    expect(recovered.label).toBe("pos.sync.synced");
    expect(recovered.expanded).toBe(false);
  });
});
