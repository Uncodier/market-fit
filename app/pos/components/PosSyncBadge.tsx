"use client";

import { Button } from "@/app/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2 } from "@/app/components/ui/icons";
import type { SyncStatus } from "@/app/pos/local/sync-engine";
import { cn } from "@/lib/utils";

export function PosSyncBadge({
  status,
  onRetry,
  t,
}: {
  status: SyncStatus;
  onRetry?: () => void;
  t: (key: string) => string;
}) {
  const pending = status.pendingCount + status.failedCount;
  const busy = status.pulling || status.syncing || status.pendingCount > 0;
  const expanded = !status.online || status.failedCount > 0 || busy;

  let label = t("pos.sync.synced") || "Synced";
  let tone = "text-emerald-800 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-950/50";

  if (!status.online) {
    label =
      pending > 0
        ? `${t("pos.sync.offline") || "Offline"} · ${pending}`
        : t("pos.sync.offline") || "Offline";
    tone = "text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/50";
  } else if (status.failedCount > 0) {
    label = `${t("pos.sync.error") || "Sync error"} · ${status.failedCount}`;
    tone = "text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-950/50";
  } else if (busy) {
    label = `${t("pos.sync.syncing") || "Syncing"} · ${status.pendingCount || "…"}`;
    tone = "text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-950/50";
  }

  const Icon =
    status.failedCount > 0
      ? AlertTriangle
      : status.pulling || status.syncing
        ? Loader2
        : CheckCircle2;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onRetry}
      aria-label={label}
      className={cn(
        "h-8 rounded-full text-xs font-medium overflow-hidden transition-[padding,gap,width] duration-200",
        expanded ? "gap-1.5 px-3" : "w-8 px-0 justify-center",
        tone,
      )}
      title={status.lastError || label}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 flex-shrink-0",
          (status.pulling || status.syncing) && "animate-spin",
        )}
      />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200",
          expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0",
        )}
      >
        {label}
      </span>
    </Button>
  );
}
