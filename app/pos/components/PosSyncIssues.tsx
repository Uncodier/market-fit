"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { listOutbox } from "@/app/pos/local/outbox";
import { drainPosOutbox, subscribePosSync } from "@/app/pos/local/sync-engine";
import type { PosOutboxRow } from "@/app/pos/local/types";
import { CheckCircle2, Loader2, AlertTriangle, Clock } from "@/app/components/ui/icons";
import { cn } from "@/lib/utils";

export function PosSyncIssues({
  siteId,
  open,
  onOpenChange,
  t,
}: {
  siteId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
}) {
  const [rows, setRows] = useState<PosOutboxRow[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!open || !siteId) return;
    void listOutbox(siteId).then((data) => {
      setRows(
        data.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
    });
  }, [open, siteId, refreshTrigger]);

  useEffect(() => {
    if (!open) return;
    const unsub = subscribePosSync(() => {
      setRefreshTrigger((v) => v + 1);
    });
    return unsub;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {t("pos.sync.queue") || "Queued Operations"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("pos.sync.emptyQueue") || "No queued operations"}
            </p>
          ) : (
            rows.map((row) => {
              const Icon =
                row.status === "failed"
                  ? AlertTriangle
                  : row.status === "syncing"
                  ? Loader2
                  : row.status === "synced"
                  ? CheckCircle2
                  : Clock;
              
              const statusColors = {
                failed: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/50 border-red-200 dark:border-red-900/50",
                syncing: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/50",
                synced: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50",
                pending: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50",
              };

              let details = "";
              if (row.kind === "checkout") {
                const pd = row.payload.data as any;
                details = `${pd.intent || "pay"} · ${pd.lines?.length || 0} items`;
              } else if (row.kind === "create_lead") {
                details = (row.payload.data as any).name;
              }

              return (
                <div
                  key={row.id}
                  className={cn("rounded-md border p-3 text-sm space-y-2", statusColors[row.status])}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="capitalize">{row.kind.replace("_", " ")}</span>
                    <span className="flex items-center gap-1 text-xs">
                      <Icon className={cn("w-3.5 h-3.5", row.status === "syncing" && "animate-spin")} />
                      {row.status}
                    </span>
                  </div>
                  {details && (
                    <div className="text-xs opacity-80">{details}</div>
                  )}
                  {row.lastError && (
                    <div className="text-destructive text-xs font-medium">{row.lastError}</div>
                  )}
                  <div className="text-xs opacity-60">
                    {new Date(row.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </DialogBody>
        <DialogFooter>
        <Button
          onClick={() => {
            if (siteId) void drainPosOutbox(siteId);
          }}
        >
          {t("pos.sync.retry") || "Retry sync"}
        </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
