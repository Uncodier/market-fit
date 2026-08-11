"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { listOutbox } from "@/app/pos/local/outbox";
import { drainPosOutbox } from "@/app/pos/local/sync-engine";
import type { PosOutboxRow } from "@/app/pos/local/types";

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

  useEffect(() => {
    if (!open || !siteId) return;
    void listOutbox(siteId, ["failed", "pending"]).then(setRows);
  }, [open, siteId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("pos.sync.error") || "Sync issues"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-80 overflow-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("pos.sync.synced") || "Synced"}
            </p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="rounded-md border p-3 text-sm space-y-1"
              >
                <div className="font-medium capitalize">
                  {row.kind.replace("_", " ")} · {row.status}
                </div>
                {row.lastError && (
                  <div className="text-destructive text-xs">{row.lastError}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
        <Button
          onClick={() => {
            if (siteId) void drainPosOutbox(siteId);
            onOpenChange(false);
          }}
        >
          {t("pos.sync.syncing") || "Retry sync"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
