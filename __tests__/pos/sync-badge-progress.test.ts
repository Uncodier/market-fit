import { posSyncBadgeProgress } from "@/app/pos/components/PosSyncBadge";
import type { SyncStatus } from "@/app/pos/local/sync-engine";

const base: SyncStatus = {
  online: true, pulling: false, syncing: false, pendingCount: 0, failedCount: 0,
  lastPulledAt: "2026-10-23T12:00:00Z", lastOrdersPulledAt: null, lastError: null,
};
const catalogSync = {
  phase: "idle" as const, startedAt: null, lastAttemptDurationMs: 4000, error: false,
  lastSuccess: { completedAt: "2026-10-23T12:00:00Z", durationMs: 4000, fresh: true },
};

describe("sync badge phase progress", () => {
  it.each([
    ["checking", "1/3", 0],
    ["downloading", "2/3", 100 / 3],
    ["saving", "3/3", 200 / 3],
    ["idle", "1/3", 0],
  ] as const)("shows the active %s phase without assuming record progress", (phase, label, value) => {
    const progress = posSyncBadgeProgress({ ...base, pulling: true, catalogSync: { ...catalogSync, phase } });
    expect(progress?.label).toBe(label);
    expect(progress?.value).toBeCloseTo(value);
    expect(progress?.value).toBeLessThan(100);
  });

  it("fills fully only after completion and resets when a new check begins", () => {
    expect(posSyncBadgeProgress({ ...base, catalogSync })).toEqual({ label: "3/3", value: 100 });
    expect(posSyncBadgeProgress({ ...base, catalogSync, pulling: true })).toEqual({ label: "1/3", value: 0 });
  });

  it.each([
    { online: false },
    { accessVerified: false },
    { lastError: "Catalog unavailable" },
    { failedCount: 1 },
    { catalogSync: { ...catalogSync, error: true } },
  ])("does not show active progress when blocked: %j", (blocked) => {
    expect(posSyncBadgeProgress({ ...base, catalogSync, pulling: true, ...blocked })).toBeNull();
  });

  it("does not treat orders or an unconfirmed catalog as completed phase progress", () => {
    expect(posSyncBadgeProgress(base)).toBeNull();
    expect(posSyncBadgeProgress({ ...base, catalogSync, syncing: true })).toBeNull();
    expect(posSyncBadgeProgress({ ...base, catalogSync, pendingCount: 2 })).toBeNull();
    expect(posSyncBadgeProgress({ ...base, catalogSync, lastPulledAt: null })).toBeNull();
  });
});