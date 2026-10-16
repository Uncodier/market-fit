import { reportPosSyncError } from "@/app/pos/actions/report-sync-error";
import type { PosSyncErrorReport } from "@/app/pos/sync-error-report";
import type { PosOutboxRow } from "./types";

type SyncError = { error: string; reporting: boolean; reportedAt: number | null };
const errorsBySite = new Map<string, Map<string, SyncError>>();
const REPORT_INTERVAL_MS = 15 * 60_000;

function siteErrors(siteId: string) {
  let errors = errorsBySite.get(siteId);
  if (!errors) {
    errors = new Map();
    errorsBySite.set(siteId, errors);
  }
  return errors;
}

export function getPosSyncError(siteId: string): string | null {
  const errors = Array.from(siteErrors(siteId).values());
  return errors[errors.length - 1]?.error ?? null;
}

export function clearPosSyncError(siteId: string, key: string) {
  siteErrors(siteId).delete(key);
}

export function recordPosSyncError(key: string, report: PosSyncErrorReport) {
  const errors = siteErrors(report.siteId);
  let state = errors.get(key);
  if (!state || state.error !== report.error) {
    state = { error: report.error, reporting: false, reportedAt: null };
    errors.delete(key);
    errors.set(key, state);
  }
  if (state.reporting || (state.reportedAt !== null && Date.now() - state.reportedAt < REPORT_INTERVAL_MS)) return;

  state.reporting = true;
  const current = state;
  // Diagnostics must never delay checkout or turn a recovered operation into a failure.
  void reportPosSyncError({ ...report, error: report.error.slice(0, 2000) || "Sync failed" }).then((result) => {
    if (errors.get(key) === current && !("error" in result)) current.reportedAt = Date.now();
  }).catch(() => {
    // Retry reporting on a subsequent failed sync attempt, not in a tight loop.
  }).finally(() => {
    current.reporting = false;
  });
}

export function reconcilePosOutboxErrors(siteId: string, rows: PosOutboxRow[]) {
  const errors = siteErrors(siteId);
  const failed = rows.filter((row) => row.status === "failed");
  const openKeys = new Set(rows.filter((row) => row.status !== "synced").map((row) => `outbox:${row.id}`));
  for (const key of errors.keys()) {
    if (key.startsWith("outbox:") && !openKeys.has(key)) errors.delete(key);
  }
  for (const row of failed) {
    const key = `outbox:${row.id}`;
    if (!errors.has(key)) {
      errors.set(key, { error: row.lastError || "Sync failed", reporting: false, reportedAt: null });
    }
  }
}