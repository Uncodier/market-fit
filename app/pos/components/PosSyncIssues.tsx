"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { listOutbox } from "@/app/pos/local/outbox";
import { drainPosOutbox, subscribePosSync } from "@/app/pos/local/sync-engine";
import { reconcilePosCheckout } from "../local/checkout-recovery";
import type { PosOutboxRow } from "@/app/pos/local/types";
import { CheckCircle2, Loader2, AlertTriangle, Clock } from "@/app/components/ui/icons";
import { cn } from "@/lib/utils";
import { recoveryDetails } from "./PosCheckoutRecoveryDetails";
import { waitForSyncDialog } from "./sync-dialog-wait";
import { CancelCheckoutOperation } from "./CancelCheckoutOperation";

type PosSyncIssuesProps = {
  siteId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
  onReviewOrder?: (orderId: string | undefined, rowId?: string) => void;
};

export function PosSyncIssues(props: PosSyncIssuesProps) {
  // A new dialog/site session must not display or act on the previous session's rows.
  return <PosSyncIssuesSession key={`${props.siteId ?? ""}:${props.open}`} {...props} />;
}

function PosSyncIssuesSession({ siteId, open, onOpenChange, t, onReviewOrder }: PosSyncIssuesProps) {
  const [rows, setRows] = useState<PosOutboxRow[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(open && Boolean(siteId));
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ rowId?: string; message: string } | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const busyRef = useRef(new Set<string>());
  const sessionRef = useRef({ active: false });

  useEffect(() => {
    const session = { active: true };
    sessionRef.current = session;
    return () => { session.active = false; };
  }, []);

  useEffect(() => {
    if (!open || !siteId) return;
    let active = true;
    void waitForSyncDialog(listOutbox(siteId), "Queue loading timed out.").then((data) => {
      if (!active) return;
      setRows(
        [...data].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
      setListError(null);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setListError("Unable to load queued operations. Try refreshing the list.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [open, siteId, refreshTrigger]);

  useEffect(() => {
    if (!open || !siteId) return;
    let active = true;
    const unsub = subscribePosSync(() => {
      if (active) setRefreshTrigger((v) => v + 1);
    }, siteId);
    return () => { active = false; unsub(); };
  }, [open, siteId]);

  async function runAction(row?: PosOutboxRow) {
    const session = sessionRef.current;
    const actionId = row?.id ?? "retry";
    if (!session.active || !open || !siteId || busyRef.current.has(actionId)) return;
    if (row && (row.siteId !== siteId || !["failed", "syncing"].includes(row.status) || row.payload.kind !== "checkout")) return;
    busyRef.current.add(actionId);
    setBusy(new Set(busyRef.current));
    setActionError(null);
    try {
      await waitForSyncDialog<unknown>(
        row ? reconcilePosCheckout(siteId, row.id) : drainPosOutbox(siteId),
        "The operation is still unconfirmed. You can check payment status again or review the order. Do not collect again or clear device data.",
      );
      if (session.active) setRefreshTrigger((v) => v + 1);
    } catch (error) {
      if (!session.active) return;
      const fallback = row ? "Unable to check payment status. Try again." : "Unable to retry sync. Try again.";
      setActionError({ rowId: row?.id, message: error instanceof Error ? `${fallback} ${error.message}` : fallback });
    } finally {
      if (session.active) {
        busyRef.current.delete(actionId);
        setBusy(new Set(busyRef.current));
      }
    }
  }

  function label(key: string, fallback: string) {
    const translated = t(key);
    return translated && translated !== key ? translated : fallback;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {label("pos.sync.queue", "Queued Operations")}
          </DialogTitle>
          <DialogDescription>
            Check failed checkout payment status before confirming again. A status check does not retry checkout.
            {" "}You can close this window and serve other orders while confirmation is pending.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {listError && (
            <div role="alert" className="text-sm text-destructive space-y-2">
              <p>{listError}</p>
              <Button variant="outline" size="sm" disabled={loading} onClick={() => {
                setLoading(true);
                setRefreshTrigger((v) => v + 1);
              }}>Refresh list</Button>
            </div>
          )}
          {actionError && !actionError.rowId && <p role="alert" className="text-sm text-destructive">{actionError.message}</p>}
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">Loading queued operations…</p>
          ) : rows.length === 0 && !listError ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {label("pos.sync.emptyQueue", "No queued operations")}
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

              const checkout = row.payload.kind === "checkout" ? row.payload.data : null;
              const recovery = row.recoveryState ? recoveryDetails[row.recoveryState] : null;
              const existingOrderId = checkout?.existingOrderId ?? (row.payload.kind === "update_order_notes" ? row.payload.data.orderId : null);
              const reviewOrderId = row.recoveryOrderId || row.resultOrderId || existingOrderId;
              const paymentTotal = (checkout?.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
              const paymentMethods = [...new Set(checkout?.payments?.map((payment) => payment.method) ?? [])];

              let details = "";
              if (row.payload.kind === "checkout") {
                const pd = row.payload.data;
                details = `${pd.intent || "pay"} · ${pd.lines?.length || 0} items`;
              } else if (row.payload.kind === "create_lead") {
                details = row.payload.data.name;
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
                      {row.recoveryState === "rejected" ? "Closed — no payment recorded" : row.status}
                    </span>
                  </div>
                  {details && (
                    <div className="text-xs opacity-80">{details}</div>
                  )}
                  {checkout && <p className="text-xs font-medium">
                    {row.status === "synced" ? "Confirmed by the server"
                      : row.recoveryState === "rejected" ? "Attempt closed without payment — retained for audit"
                      : row.status === "failed" ? "Requires review — do not collect again before checking payment status"
                      : "Processing — saved on this device, not yet confirmed by the server"}
                  </p>}
                  <dl className="text-xs break-words space-y-1">
                    {[
                      ["Client mutation ID", row.clientMutationId],
                      ["Existing order ID", existingOrderId],
                      ["Result order ID", row.resultOrderId],
                      ["Recovery order ID", row.recoveryOrderId],
                      ["Recovery sale ID", row.recoverySaleId],
                    ].map(([name, value]) => (
                      <div key={name}><dt className="inline font-medium">{name}: </dt><dd className="inline">{value || "Not available"}</dd></div>
                    ))}
                    {checkout && <>
                      <div><dt className="inline font-medium">Queued payment total: </dt><dd className="inline">{paymentTotal.toFixed(2)}</dd></div>
                      <div><dt className="inline font-medium">Payment method: </dt><dd className="inline">{paymentMethods.join(", ") || checkout.paymentMethod || "None"}</dd></div>
                    </>}
                  </dl>
                  {recovery && (
                    <div className="text-xs space-y-1">
                      <p className="font-semibold">{recovery.label}</p>
                      <p>{recovery.explanation}</p>
                    </div>
                  )}
                  {row.recoveryMessage && <p className="text-xs font-medium">{row.recoveryMessage}</p>}
                  {row.lastError && (
                    <div className="text-destructive text-xs font-medium">{row.lastError}</div>
                  )}
                  {checkout && row.status !== "synced" && (
                    <p className="text-xs text-muted-foreground">
                      Retry sync does not collect a failed payment again. Review order to register a payment after a verified rejection, or cancel this attempt below. Cancellation does not refund money or delete the order.
                    </p>
                  )}
                  {actionError?.rowId === row.id && <p role="alert" className="text-xs text-destructive">{actionError.message}</p>}
                  <div className="flex flex-wrap gap-2">
                    {checkout && (row.status === "failed" || row.status === "syncing") && (
                      <Button variant="outline" size="sm" disabled={busy.has(row.id)} onClick={() => { void runAction(row); }}>
                        {busy.has(row.id) && <Loader2 aria-hidden={true} className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        {busy.has(row.id) ? "Checking payment status…" : "Check payment status"}
                      </Button>
                    )}
                    {onReviewOrder && (checkout || reviewOrderId) && (
                      <Button variant="outline" size="sm" onClick={() => {
                        if (!sessionRef.current.active || !open || row.siteId !== siteId) return;
                        onOpenChange(false);
                        onReviewOrder(reviewOrderId || undefined, checkout ? row.id : undefined);
                      }}>Review order</Button>
                    )}
                  </div>
                  {checkout && row.status !== "synced" && siteId && <CancelCheckoutOperation
                    siteId={siteId} rowId={row.id} onResolved={() => setRefreshTrigger((v) => v + 1)} />}
                  <div className="text-xs opacity-60">
                    {new Date(row.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close queue</Button>
          <Button disabled={!siteId || busy.has("retry") || loading} onClick={() => { void runAction(); }}>
            {busy.has("retry") && <Loader2 aria-hidden={true} className="mr-2 h-4 w-4 animate-spin" />}
            {busy.has("retry") ? "Retrying sync…" : label("pos.sync.retry", "Retry sync")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
