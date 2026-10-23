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

  it("shows phases and elapsed time in the badge and its details", () => {
    const progress = { phase: "checking" as const, startedAt: Date.now(), lastAttemptDurationMs: null, lastSuccess: null, error: false };
    const { rerender } = render(<PosSyncBadge status={{ ...base, pulling: true, catalogSync: progress }} t={t} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Checking catalog · 0s" }));
    act(() => jest.advanceTimersByTime(65000));
    expect(screen.getByRole("button", { name: "Checking catalog · 1m 5s" })).toBeInTheDocument();
    expect(screen.getByText("Elapsed: 1m 5s")).toBeInTheDocument();
    rerender(<PosSyncBadge status={{ ...base, pulling: true, catalogSync: { ...progress, phase: "saving" } }} t={t} onRefresh={jest.fn()} />);
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
    fireEvent.click(screen.getByRole("button", { name: "Synced · 12s" }));
    expect(screen.getByText("Full download without snapshot cache")).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2026-10-23T12:00:00.000Z");
    expect(container).toHaveTextContent("Synced · 12s");
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

  it("shows permission re-verification instead of synced and disables catalog refresh", () => {
    const { rerender } = render(<PosSyncBadge status={{ ...base, lastPulledAt: "2026-10-23T12:00:00Z" }} t={t} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Synced" }));
    rerender(<PosSyncBadge status={{ ...base, accessVerified: false }} t={t} onRefresh={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Waiting for verified POS access" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for verified POS access");
    expect(document.querySelector("time")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh catalog" })).toBeDisabled();
  });

  it("formats duration without a progress percentage", () => {
    expect(formatSyncDuration(0)).toBe("0s");
    expect(formatSyncDuration(3720000)).toBe("62m 0s");
  });
});