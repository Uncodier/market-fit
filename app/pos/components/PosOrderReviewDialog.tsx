"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPosOrder } from "../operation-client";
import { isPosOpenOrder, isPosOrderPaid, posOrderAmountDue } from "../open-orders";
import { hasPosOrderCartSnapshot } from "../order-session";
import { posOrderVersion } from "../order-version";
import { listOutbox } from "../local/outbox";
import { reconcilePosCheckout } from "../local/checkout-recovery";
import { canReviewReceivedCash, recoverReceivedCash } from "../local/recover-received-cash";
import type { PosOutboxRow } from "../local/types";
import { checkoutReviewOrderId, PosCheckoutRecoveryDetails } from "./PosCheckoutRecoveryDetails";
import type { PosOrderSnapshot } from "../order-snapshot";
import { CancelCheckoutOperation } from "./CancelCheckoutOperation";
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext";
import { Button } from "@/app/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/app/components/ui/dialog";

type Props = {
  siteId?: string;
  orderId?: string;
  rowId?: string;
  onOpenChange: (open: boolean) => void;
  onReloadOrder?: (orderId: string) => Promise<boolean> | boolean;
  onRegisterPayment?: (orderId: string) => Promise<boolean> | boolean;
  onContinueSelling?: () => void;
};

type ReviewSnapshot = { row: PosOutboxRow | null; order: PosOrderSnapshot | null; error: string | null };
type ReviewAction = "refresh" | "check" | "reload" | "pay" | "cash";

function receivedCashEvidence({ row, order, error }: ReviewSnapshot) {
  if (error || row?.payload.kind !== "checkout" || !order?.currency || !canReviewReceivedCash(row, order)) return null;
  const amount = row.payload.data.payments?.reduce((sum, p) => sum + p.amount, 0);
  if (!amount || !Number.isFinite(amount) || amount <= 0) return null;
  return {
    amount: `${order.currency} ${amount.toFixed(2)}`,
    // Consent applies only to the attempt and evidence the cashier actually saw.
    key: JSON.stringify([row.id, row.clientMutationId, row.payload.data, posOrderVersion(order)]),
  };
}

async function readReview(siteId: string, rowId?: string, orderId?: string, isCurrent = () => true): Promise<ReviewSnapshot> {
  const row = rowId ? (await listOutbox(siteId)).find((item) =>
    item.id === rowId && item.siteId === siteId && item.payload.kind === "checkout") ?? null : null;
  if (!isCurrent()) return { row: null, order: null, error: null };
  if (rowId && !row) throw new Error("Attempt unavailable");
  // The original queue row, not a potentially stale order prop, owns the recovery identity.
  const id = row ? checkoutReviewOrderId(row) : orderId;
  if (!id || id.startsWith("local_")) return { row, order: null, error: null };
  try {
    const result = await fetchPosOrder(siteId, id);
    const order = result.data;
    if (result.error || !order) return { row, order: null, error: result.error || "Unable to load POS order." };
    if (order.id !== id || order.site_id !== siteId) return { row, order: null, error: "This order is not available for this review." };
    return { row, order, error: null };
  } catch {
    return { row, order: null, error: "Unable to load POS order. Try refreshing the order." };
  }
}

function canReload(snapshot: ReviewSnapshot): boolean {
  const { row, order, error } = snapshot;
  const due = order && posOrderAmountDue(order);
  return !error && row?.status === "failed" && row.recoveryState === "rejected" &&
    Boolean(order && due !== null && due > 0.009 && isPosOpenOrder(order) && hasPosOrderCartSnapshot(order));
}

/** Review payment evidence without putting a paid or unresolved ticket back in the cart. */
export function PosOrderReviewDialog(props: Props) {
  return <OrderReviewSession key={`${props.siteId ?? ""}:${props.rowId ?? ""}:${props.orderId ?? ""}`} {...props} />;
}

function OrderReviewSession({ siteId, orderId, rowId, onOpenChange, onReloadOrder, onRegisterPayment, onContinueSelling }: Props) {
  const { formatPrice } = useDisplayCurrency();
  const canRead = Boolean(siteId && (rowId || (orderId && !orderId.startsWith("local_"))));
  const [snapshot, setSnapshot] = useState<ReviewSnapshot>({ row: null, order: null, error: null });
  const [loading, setLoading] = useState(canRead);
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [cashConsent, setCashConsent] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const sessionRef = useRef({ active: false });

  useEffect(() => {
    const session = { active: true };
    sessionRef.current = session;
    if (canRead && siteId) {
      void readReview(siteId, rowId, orderId, () => session.active).then((result) => {
        if (session.active) setSnapshot(result);
      }).catch(() => {
        if (session.active) setActionError("Unable to load the original queued attempt. Try refreshing the review.");
      }).finally(() => { if (session.active) setLoading(false); });
    }
    return () => { session.active = false; };
  }, [canRead, siteId, orderId, rowId]);

  function closeReview(continueSelling = false) {
    sessionRef.current.active = false;
    onOpenChange(false);
    if (continueSelling) onContinueSelling?.();
  }

  async function runAction(action: ReviewAction) {
    const session = sessionRef.current;
    if (!session.active || !siteId || busyRef.current || loading || (action === "cash" && !cashConsent)) return;
    busyRef.current = true;
    setBusy(action);
    setActionError(null);
    setCashConsent(null);
    try {
      let result = await readReview(siteId, rowId, orderId, () => session.active);
      if (!session.active) return;
      if (action === "cash") {
        if (!rowId || receivedCashEvidence(result)?.key !== cashConsent) {
          setSnapshot(result);
          setActionError("Payment details changed. Review the current amounts and items before retrying. Do not collect cash again.");
          return;
        }
        try {
          await recoverReceivedCash(siteId, rowId);
        } catch {
          if (session.active) setActionError("Cash recovery is not confirmed. Check payment status. Do not collect cash again.");
        }
        if (!session.active) return;
        result = await readReview(siteId, rowId, orderId, () => session.active);
        if (!session.active) return;
      } else if (action !== "refresh") {
        if (!rowId || !result.row) throw new Error("Attempt unavailable");
        if (result.row.status !== "failed") {
          setSnapshot(result);
          return;
        }
        if ((action === "reload" || action === "pay") && !canReload(result)) {
          setSnapshot(result);
          setActionError("This attempt is not eligible for a new confirmation. Keep it for review.");
          return;
        }
        const evidence = await reconcilePosCheckout(siteId, rowId);
        if (!session.active) return;
        result = await readReview(siteId, rowId, orderId, () => session.active);
        if (!session.active) return;
        setSnapshot(result);
        if ((action === "reload" || action === "pay") && (evidence.state !== "rejected" || !canReload(result))) {
          setActionError("A new confirmation requires a verified rejection and an available unpaid order.");
          return;
        }
      }
      setSnapshot(result);
      const load = action === "pay" ? onRegisterPayment : onReloadOrder;
      if ((action === "reload" || action === "pay") && canReload(result) && result.order && load) {
        const loaded = await load(result.order.id);
        if (!session.active) return;
        if (loaded) closeReview(true);
        else setActionError("Unable to reload this order for a new confirmation. Keep the original attempt for review.");
      }
    } catch {
      if (session.active) setActionError(action === "cash"
        ? "Unable to verify the current payment details. Refresh the review. Do not collect cash again."
        : action === "refresh"
        ? "Unable to refresh the review. Keep the original queued attempt and try again."
        : "Unable to check payment status. Keep the original queued attempt and try again.");
    } finally {
      if (session.active) { busyRef.current = false; setBusy(null); }
    }
  }

  const { row, order, error } = snapshot;
  const cash = receivedCashEvidence(snapshot);
  const showOtherActions = !cash && row?.status !== "synced";
  const due = order ? posOrderAmountDue(order) : null;
  const payments = order?.sales?.payments;
  const recorded = Array.isArray(payments)
    ? payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) : null;
  const money = (value: number | null) => value === null
    ? "Not available" : row && order?.currency ? `${order.currency} ${value.toFixed(2)}` : formatPrice(value, order?.currency || undefined);

  return (
    <Dialog open={Boolean(rowId || orderId)} onOpenChange={(open) => { if (!open) closeReview(); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Review order</DialogTitle>
          <DialogDescription>
            {cash ? "Review the original order and the cash already received before syncing."
              : row?.status === "synced" ? "The original checkout is synchronized. No further payment is needed for this attempt."
              : "Resolve the original payment attempt using server evidence. Register payment opens the payment form; cancellation requires server confirmation and never refunds a recorded payment."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {row && <PosCheckoutRecoveryDetails row={row} order={order} currency={cash ? order?.currency : undefined} />}
          {row && (row.status === "pending" || row.status === "syncing") && <p className="text-sm">
            This operation is waiting to sync or is still syncing. Wait for sync to finish, then refresh
            this review. Checking a payment must not replace the first submission of a queued sale.
          </p>}
          {rowId && row?.status !== "synced" && <p className="text-sm text-muted-foreground">
            Pending payment is isolated to the affected order, not the entire POS. Continue selling leaves
            your current cart unchanged. Use New Order for another customer; do not re-enter this uncertain payment as a new sale.
          </p>}
          {rowId && onReloadOrder && canReload(snapshot) && <p className="text-sm">
            Reload order for new confirmation replaces the current cart with this unpaid order.
            Review it before confirming a new payment. The original attempt will not be replayed or removed.
          </p>}
          {row && showOtherActions && siteId && <CancelCheckoutOperation
            key={`${siteId}:${row.id}`} siteId={siteId} rowId={row.id}
            onResolved={() => { void runAction("refresh"); }} />}
          {rowId && onRegisterPayment && showOtherActions && <section className="space-y-2 text-sm" aria-label="Register a replacement payment">
            {canReload(snapshot) ? <label className="flex items-start gap-2">
                <input type="checkbox" checked={paymentConfirmed} disabled={Boolean(busy)} onChange={(event) => setPaymentConfirmed(event.target.checked)} />
              <span>Replace the current cart with this unpaid order and open the payment form. I will verify any money already received before confirming.</span>
            </label> : <p>Register payment requires a server-confirmed rejection or cancellation and an available unpaid order. Check payment status or cancel the attempt first. Recorded or uncertain payments cannot be collected again.</p>}
            <Button disabled={loading || Boolean(busy) || !canReload(snapshot) || !paymentConfirmed}
              onClick={() => { void runAction("pay"); }}>{busy === "pay" ? "Preparing payment…" : "Register payment"}</Button>
          </section>}
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          {!loading && !order && !error && <p role="alert" className="text-sm text-destructive">
            No server order is available yet. Keep the queued operation and check payment status.
          </p>}
          {loading ? <p role="status" className="text-sm text-muted-foreground">Loading review…</p>
            : error ? <p role="alert" className="text-sm text-destructive">{error}</p>
            : order && <>
              <dl className="space-y-2 text-sm break-words">
                {[
                  ["Order", order.order_number || order.id],
                  ["Order ID", order.id],
                  ["Sale ID", order.sale_id || "Not available"],
                  ["Order status", order.status],
                  ["Payment status", isPosOrderPaid(order) ? "Paid" : due === null ? "Not confirmed" : "Unpaid"],
                  ["Registered order total", money(Number(order.total))],
                  ["Recorded payments", money(recorded)],
                  ["Balance due", money(due)],
                ].map(([name, value]) => <div key={name} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{name}</dt><dd className="text-right">{value}</dd>
                </div>)}
              </dl>
              {order.notes && <div className="text-sm"><h3 className="font-medium">Notes</h3><p>{order.notes}</p></div>}
              <div className="space-y-2 text-sm">
                <h3 className="font-medium">Registered order items</h3>
                {order.sale_order_items.length ? <ul className="space-y-2">
                  {order.sale_order_items.map((line) => <li key={line.id} className="flex justify-between gap-4">
                    <span>{line.name}<span className="block text-xs text-muted-foreground">{line.status || "Not available"}</span></span>
                    <span>{Number(line.quantity)} × {money(Number(line.unit_price))}</span>
                  </li>)}
                </ul> : <p className="text-muted-foreground">No order items available.</p>}
              </div>
            </>}
          {cash && <section className="space-y-2 text-sm" aria-label="Original cash payment">
            <h3 className="font-medium">Cash already received</h3>
            <p>Compare the registered order with the queued items. The queued payment may include items added after the order was registered. Sync only if the queued items and cash match the sale you made. Do not collect cash again.</p>
            <label className="flex items-start gap-2">
              <input type="checkbox" disabled={Boolean(busy)} checked={cashConsent === cash.key}
                onChange={(event) => setCashConsent(event.target.checked ? cash.key : null)} />
              <span>I checked the amount and currency and already received exactly {cash.amount} in cash for this order.</span>
            </label>
            <Button disabled={Boolean(busy) || cashConsent !== cash.key}
              onClick={() => { void runAction("cash"); }}>{busy === "cash" ? "Syncing received cash…" : "Sync received cash"}</Button>
          </section>}
        </DialogBody>
        <DialogFooter className="sm:flex-wrap">
          <Button variant="outline" disabled={!canRead || loading || Boolean(busy)}
            onClick={() => { void runAction("refresh"); }}>Refresh order</Button>
          {rowId && (!row || row.status === "failed") && <Button variant="outline"
            disabled={!siteId || loading || Boolean(busy)} onClick={() => { void runAction("check"); }}>
            {busy === "check" ? "Checking payment status…" : "Check payment status"}
          </Button>}
          {rowId && onReloadOrder && showOtherActions && <Button variant="outline"
            disabled={loading || Boolean(busy) || !canReload(snapshot)} onClick={() => { void runAction("reload"); }}>
            {busy === "reload" ? "Reloading order…" : "Reload order for new confirmation"}
          </Button>}
          <Button onClick={() => closeReview(Boolean(rowId))}>{rowId ? "Continue selling" : "Close review"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}