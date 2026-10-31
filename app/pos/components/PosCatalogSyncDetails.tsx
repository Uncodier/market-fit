"use client";

import type { SyncStatus } from "../local/sync-engine";

export function formatSyncDuration(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function catalogSyncLabel(status: SyncStatus, t: (key: string) => string) {
  if (!(status.networkOnline ?? status.online)) return t("pos.sync.offline");
  if (status.accessVerified === false) return t("pos.sync.catalog.accessPending");
  if (status.pulling) return t(`pos.sync.catalog.${status.catalogSync?.phase === "idle" ? "checking" : status.catalogSync?.phase ?? "checking"}`);
  if (status.catalogSync?.error) return t("pos.sync.catalog.retryPending");
  if (!status.lastPulledAt) return t("pos.sync.catalog.waiting");
  return t("pos.sync.synced");
}

export function PosCatalogSyncDetails({ status, now, locale, t }: {
  status: SyncStatus;
  now: number;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const progress = status.catalogSync;
  const success = progress?.lastSuccess;
  const completedAt = success?.completedAt ?? status.lastPulledAt;
  const completedDate = completedAt ? new Date(completedAt) : null;
  const validDate = completedDate && Number.isFinite(completedDate.getTime());
  const duration = progress?.startedAt != null && status.pulling && status.online && status.accessVerified !== false
    ? formatSyncDuration(now - progress.startedAt) : null;

  return (
    <section className="space-y-2 text-xs" aria-label={t("pos.sync.catalog.title")}>
      <h3 className="font-medium text-sm">{t("pos.sync.catalog.title")}</h3>
      <p role="status" aria-live="polite">{catalogSyncLabel(status, t)}</p>
      {(status.networkOnline ?? status.online) && status.accessVerified === false && (
        <p className="text-muted-foreground">The browser is online, but session or server access is not verified. Local work is retained. Verification waits for any pending session request; repeated clicks cannot restart a stalled session request.</p>
      )}
      {duration && <p className="text-muted-foreground" aria-live="off">{t("pos.sync.catalog.elapsed", { duration })}</p>}
      <p className="text-muted-foreground">
        {t("pos.sync.catalog.lastSuccess")}{": "}
        {validDate ? <time dateTime={completedDate.toISOString()}>{completedDate.toLocaleString(locale)}</time> : t("pos.sync.catalog.none")}
        {success && ` · ${formatSyncDuration(success.durationMs)}`}
      </p>
      {success && <p className="text-muted-foreground">{t(success.fresh ? "pos.sync.catalog.fresh" : "pos.sync.catalog.cached")}</p>}
      {progress?.error && progress.lastAttemptDurationMs !== null && (
        <p className="text-muted-foreground">{t("pos.sync.catalog.failedDuration", { duration: formatSyncDuration(progress.lastAttemptDurationMs) })}</p>
      )}
    </section>
  );
}