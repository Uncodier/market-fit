"use client";

import { Button } from "@/app/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "@/app/components/ui/icons";
import type { SyncStatus } from "@/app/pos/local/sync-engine";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { catalogSyncLabel, formatSyncDuration, PosCatalogSyncDetails } from "./PosCatalogSyncDetails";

export function posSyncBadgeView(status: SyncStatus, t: (key: string) => string) {
  const pending = status.pendingCount + status.failedCount;
  const busy = status.pulling || status.syncing || status.pendingCount > 0;
  const hasError = status.failedCount > 0 || !!status.lastError || !!status.catalogSync?.error;
  const expanded = !status.online || status.accessVerified === false || hasError || busy || !status.lastPulledAt || !!status.catalogSync?.lastSuccess;

  let label = t("pos.sync.synced") || "Synced";
  let tone = "text-emerald-800 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-950/50";

  if (!status.online) {
    label =
      pending > 0
        ? `${t("pos.sync.offline") || "Offline"} · ${pending}`
        : t("pos.sync.offline") || "Offline";
    tone = "text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/50";
  } else if (status.accessVerified === false) {
    label = catalogSyncLabel(status, t);
    tone = "text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/50";
  } else if (hasError) {
    label = t("pos.sync.error") || "Sync error";
    if (status.failedCount > 0) label += ` · ${status.failedCount}`;
    tone = "text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-950/50";
  } else if (busy) {
    label = status.pulling ? catalogSyncLabel(status, t) : `${t("pos.sync.syncing") || "Syncing"} · ${status.pendingCount || "…"}`;
    tone = "text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-950/50";
  } else if (!status.lastPulledAt) {
    label = catalogSyncLabel(status, t);
    tone = "text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/50";
  } else if (status.catalogSync?.lastSuccess) {
    label += ` · ${formatSyncDuration(status.catalogSync.lastSuccess.durationMs)}`;
  }

  const Icon =
    hasError
      ? AlertTriangle
      : busy
        ? Loader2
        : !status.lastPulledAt ? Clock : CheckCircle2;

  return { label, tone, Icon, busy, expanded };
}

export function PosSyncBadge({
  status,
  onClick,
  onRefresh,
  locale = "en",
  t,
}: {
  status: SyncStatus;
  onClick?: () => void;
  onRefresh?: () => void;
  locale?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const { label, tone, Icon, busy, expanded } = posSyncBadgeView(status, t);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!status.pulling) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status.pulling]);
  const elapsed = status.pulling && status.catalogSync?.startedAt != null
    ? formatSyncDuration(now - status.catalogSync.startedAt) : null;
  const visibleLabel = elapsed ? `${label} · ${elapsed}` : label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={visibleLabel}
          className={cn(
            "h-8 rounded-full text-xs font-medium overflow-hidden transition-[padding,gap,width] duration-200",
            expanded ? "gap-1.5 px-3" : "w-8 px-0 justify-center",
            tone,
          )}
          title={status.lastError || visibleLabel}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0",
              busy && "animate-spin motion-reduce:animate-none",
            )}
          />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200",
              expanded ? "max-w-64 opacity-100" : "max-w-0 opacity-0",
            )}
          >
            {visibleLabel}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-4">
        <PosCatalogSyncDetails status={status} now={now} locale={locale} t={t} />
        <div className="flex flex-wrap gap-2">
          {onRefresh && <Button type="button" variant="outline" size="sm" disabled={!status.online || status.accessVerified === false || status.pulling} onClick={onRefresh}>{t("pos.sync.catalog.refresh")}</Button>}
          {onClick && <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); onClick(); }}>{t("pos.sync.queue")}{status.pendingCount + status.failedCount > 0 ? ` · ${status.pendingCount + status.failedCount}` : ""}</Button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
