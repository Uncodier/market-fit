export type CatalogSyncProgress = {
  phase: "checking" | "downloading" | "saving" | "idle";
  startedAt: number | null;
  lastAttemptDurationMs: number | null;
  lastSuccess: { completedAt: string; durationMs: number; fresh: boolean } | null;
  error: boolean;
};

type Entry = { progress: CatalogSyncProgress; start: number };
const entries = new Map<string, Entry>();

export function getCatalogSyncProgress(siteId: string): CatalogSyncProgress | undefined {
  const progress = entries.get(siteId)?.progress;
  return progress ? { ...progress, lastSuccess: progress.lastSuccess ? { ...progress.lastSuccess } : null } : undefined;
}

export function clearCatalogSyncProgress() {
  entries.clear();
}

export function beginCatalogSync(siteId: string) {
  const previous = entries.get(siteId)?.progress;
  entries.set(siteId, {
    start: performance.now(),
    progress: {
      phase: "checking", startedAt: Date.now(), error: false,
      lastAttemptDurationMs: previous?.lastAttemptDurationMs ?? null,
      lastSuccess: previous?.lastSuccess ?? null,
    },
  });
}

export function setCatalogSyncPhase(siteId: string, phase: "downloading" | "saving") {
  const entry = entries.get(siteId);
  if (entry) entry.progress = { ...entry.progress, phase };
}

export function finishCatalogSync(siteId: string, result: "checked" | "success" | "error", fresh = false) {
  const entry = entries.get(siteId);
  if (!entry) return;
  const durationMs = Math.max(0, performance.now() - entry.start);
  entry.progress = {
    ...entry.progress, phase: "idle", startedAt: null,
    error: result === "error", lastAttemptDurationMs: durationMs,
    lastSuccess: result === "success"
      ? { completedAt: new Date().toISOString(), durationMs, fresh }
      : entry.progress.lastSuccess,
  };
}