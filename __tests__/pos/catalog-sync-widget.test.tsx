import { act, fireEvent, render, screen } from "@testing-library/react";
import { PosSyncBadge } from "@/app/pos/components/PosSyncBadge";
import { formatSyncDuration } from "@/app/pos/components/PosCatalogSyncDetails";
import { localeMessages } from "@/app/context/locale-catalog";
import type { SyncStatus } from "@/app/pos/local/sync-engine";

const t = (key: string, params?: Record<string, string | number>) => Object.entries(params || {}).reduce(
  (text, [name, value]) => text.replace(`{{${name}}}`, String(value)), localeMessages.en[key] || key,
);
const base: SyncStatus = { online: true, pulling: false, syncing: false, pendingCount: 0, failedCount: 0,
  lastPulledAt: null, lastOrdersPulledAt: null, lastError: null };

describe("catalog status within the sync widget", () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-23T12:00:00Z")); });
  afterEach(() => jest.useRealTimers());

  it("does not claim synced before the first catalog download and exposes manual refresh", () => {
    const refresh = jest.fn();
    render(<PosSyncBadge status={base} t={t} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Waiting for catalog sync" }));
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for catalog sync");
    expect(screen.getByText(/Not synchronized yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh catalog" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the phase number and matching background fill, keeping elapsed time in details", () => {
    const progress = { phase: "checking" as const, startedAt: Date.now(), lastAttemptDurationMs: null, lastSuccess: null, error: false };
    const { rerender } = render(<PosSyncBadge status={{ ...base, pulling: true, catalogSync: progress }} t={t} onRefresh={jest.fn()} />);
    const checking = screen.getByRole("button", { name: "Checking catalog · 1/3" });
    expect(checking.querySelector("[data-state]")).toHaveAttribute("aria-hidden", "true");
    expect(checking.querySelector("[data-state]")).toHaveAttribute("aria-valuenow", "0");
    fireEvent.click(checking);
    act(() => jest.advanceTimersByTime(65000));
    expect(screen.getByRole("button", { name: "Checking catalog · 1/3" })).toBeInTheDocument();
    expect(screen.getByText("Elapsed: 1m 5s")).toBeInTheDocument();
    rerender(<PosSyncBadge status={{ ...base, pulling: true, catalogSync: { ...progress, phase: "downloading" } }} t={t} onRefresh={jest.fn()} />);
    const downloading = screen.getByRole("button", { name: "Downloading catalog · 2/3" });
    expect(Number(downloading.querySelector("[data-state]")?.getAttribute("aria-valuenow"))).toBeCloseTo(100 / 3);
    rerender(<PosSyncBadge status={{ ...base, pulling: true, catalogSync: { ...progress, phase: "saving" } }} t={t} onRefresh={jest.fn()} />);
    const saving = screen.getByRole("button", { name: "Saving catalog locally · 3/3" });
    expect(Number(saving.querySelector("[data-state]")?.getAttribute("aria-valuenow"))).toBeCloseTo(200 / 3);
    expect(screen.getByRole("status")).toHaveTextContent("Saving catalog locally");
    expect(screen.getByRole("button", { name: "Refresh catalog" })).toBeDisabled();
  });

  it("keeps completion time, source and duration available after syncing stops", () => {
    const status: SyncStatus = { ...base, lastPulledAt: "2026-10-23T12:00:00Z", catalogSync: {
      phase: "idle", startedAt: null, error: false, lastAttemptDurationMs: 12345,
      lastSuccess: { completedAt: "2026-10-23T12:00:00Z", durationMs: 12345, fresh: true },
    } };
    const queue = jest.fn();
    const { container } = render(<PosSyncBadge status={status} t={t} onClick={queue} />);
    const synced = screen.getByRole("button", { name: "Synced · 3/3" });
    expect(synced.querySelector("[data-state]")).toHaveAttribute("aria-valuenow", "100");
    fireEvent.click(synced);
    expect(screen.getByText("Full download without snapshot cache")).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2026-10-23T12:00:00.000Z");
    expect(container).toHaveTextContent("Synced · 3/3");
    expect(screen.getByText(/Last successful catalog sync/)).toHaveTextContent("12s");
    fireEvent.click(screen.getByRole("button", { name: "Queued Operations" }));
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it("shows catalog failure with the previous success and the failed attempt duration", () => {
    render(<PosSyncBadge status={{ ...base, lastError: "Catalog unavailable", catalogSync: {
      phase: "idle", startedAt: null, error: true, lastSuccess: null, lastAttemptDurationMs: 42000,
    } }} t={t} />);
    fireEvent.click(screen.getByRole("button", { name: "Sync error" }));
    expect(screen.getByRole("status")).toHaveTextContent("Retrying on the next background cycle");
    expect(screen.getByText("Failed attempt took 42s. Previous catalog preserved.")).toBeInTheDocument();
  });

  it("does not label unrelated order errors as catalog failure", () => {
    render(<PosSyncBadge status={{ ...base, lastPulledAt: "2026-10-23T12:00:00Z", lastError: "Order error" }} t={t} />);
    fireEvent.click(screen.getByRole("button", { name: "Sync error" }));
    expect(screen.getByRole("status")).toHaveTextContent("Synced");
  });

  it("disables catalog refresh while offline", () => {
    render(<PosSyncBadge status={{ ...base, online: false }} t={t} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Offline" }));
    expect(screen.getByRole("button", { name: "Refresh catalog" })).toBeDisabled();
  });

  it("requests access verification while connected without invoking catalog refresh", () => {
    const recheck = jest.fn();
    const refresh = jest.fn();
    window.addEventListener("pos-access-recheck", recheck);
    const { rerender } = render(<PosSyncBadge status={{ ...base, lastPulledAt: "2026-10-23T12:00:00Z" }} t={t} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Synced" }));
    rerender(<PosSyncBadge status={{ ...base, online: false, networkOnline: true, accessVerified: false, pulling: true }} t={t} onRefresh={refresh} />);
    expect(screen.getByRole("button", { name: "Waiting for verified POS access" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for verified POS access");
    expect(document.querySelector("time")).not.toBeInTheDocument();
    const verify = screen.getByRole("button", { name: "Verify POS access" });
    expect(verify).toBeEnabled();
    fireEvent.click(verify);
    expect(recheck).toHaveBeenCalledTimes(1);
    expect(recheck.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
    expect(refresh).not.toHaveBeenCalled();
    window.removeEventListener("pos-access-recheck", recheck);
  });

  it("does not offer verification without network connectivity", () => {
    const refresh = jest.fn();
    render(<PosSyncBadge status={{ ...base, online: false, networkOnline: false, accessVerified: false }} t={t} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Offline" }));
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
    expect(screen.getByRole("button", { name: "Verify POS access" })).toBeDisabled();
  });

  it.each([
    { online: false },
    { accessVerified: false },
    { lastError: "Catalog unavailable" },
    { failedCount: 1 },
  ])("removes the phase number and fill when sync is blocked: %j", (blocked) => {
    const catalogSync = { phase: "saving" as const, startedAt: Date.now(), lastAttemptDurationMs: null, lastSuccess: null, error: false };
    const { rerender } = render(<PosSyncBadge status={{ ...base, pulling: true, catalogSync }} t={t} />);
    expect(screen.getByRole("button")).toHaveTextContent("3/3");
    rerender(<PosSyncBadge status={{ ...base, pulling: true, catalogSync, ...blocked }} t={t} />);
    const badge = screen.getByRole("button");
    expect(badge).not.toHaveTextContent("3/3");
    expect(badge.querySelector("[aria-valuenow]")).toBeNull();
  });

  it("formats duration without a progress percentage", () => {
    expect(formatSyncDuration(0)).toBe("0s");
    expect(formatSyncDuration(3720000)).toBe("62m 0s");
  });
});