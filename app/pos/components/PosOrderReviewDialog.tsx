"use client";

import { useEffect, useState } from "react";
import { getPosOrder } from "../actions/get-order";
import { isPosOrderPaid, posOrderAmountDue } from "../open-orders";
import type { PosOrderSnapshot } from "../order-snapshot";
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext";
import { Button } from "@/app/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/app/components/ui/dialog";

type Props = {
  siteId?: string;
  orderId?: string;
  onOpenChange: (open: boolean) => void;
};

/** Review payment evidence without putting a paid or unresolved ticket back in the cart. */
export function PosOrderReviewDialog(props: Props) {
  return <OrderReviewSession key={`${props.siteId ?? ""}:${props.orderId ?? ""}`} {...props} />;
}

function OrderReviewSession({ siteId, orderId, onOpenChange }: Props) {
  const { formatPrice } = useDisplayCurrency();
  const canRead = Boolean(siteId && orderId && !orderId.startsWith("local_"));
  const [order, setOrder] = useState<PosOrderSnapshot | null>(null);
  const [loading, setLoading] = useState(canRead);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!canRead || !siteId || !orderId) return;
    let active = true;
    void getPosOrder(siteId, orderId).then((result) => {
      if (!active) return;
      if (result.error || !result.data) {
        setError(result.error || "Unable to load POS order.");
      } else {
        setOrder(result.data);
        setError(null);
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("Unable to load POS order. Try refreshing the order.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [canRead, siteId, orderId, revision]);

  const due = order ? posOrderAmountDue(order) : null;
  const payments = order?.sales?.payments;
  const recorded = Array.isArray(payments)
    ? payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) : null;
  const money = (value: number | null) => value === null
    ? "Not available" : formatPrice(value, order?.currency || undefined);

  return (
    <Dialog open={Boolean(orderId)} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Review order</DialogTitle>
          <DialogDescription>
            Read-only server data. Reviewing an order does not confirm checkout completion,
            collect payment, or clear the queued operation. Do not charge a recorded payment again.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!canRead && <p role="alert" className="text-sm text-destructive">
            No server order is available yet. Keep the queued operation and check payment status.
          </p>}
          {loading ? <p role="status" className="text-sm text-muted-foreground">Loading order…</p>
            : error ? <p role="alert" className="text-sm text-destructive">{error}</p>
            : order && <>
              <dl className="space-y-2 text-sm break-words">
                {[
                  ["Order", order.order_number || order.id],
                  ["Order ID", order.id],
                  ["Sale ID", order.sale_id || "Not available"],
                  ["Order status", order.status],
                  ["Payment status", isPosOrderPaid(order) ? "Paid" : due === null ? "Not confirmed" : "Unpaid"],
                  ["Total", money(Number(order.total))],
                  ["Recorded payments", money(recorded)],
                  ["Balance due", money(due)],
                ].map(([name, value]) => <div key={name} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{name}</dt><dd className="text-right">{value}</dd>
                </div>)}
              </dl>
              {order.notes && <div className="text-sm"><h3 className="font-medium">Notes</h3><p>{order.notes}</p></div>}
              <div className="space-y-2 text-sm">
                <h3 className="font-medium">Order items</h3>
                {order.sale_order_items.length ? <ul className="space-y-2">
                  {order.sale_order_items.map((line) => <li key={line.id} className="flex justify-between gap-4">
                    <span>{line.name}<span className="block text-xs text-muted-foreground">{line.status || "Not available"}</span></span>
                    <span>{Number(line.quantity)} × {money(Number(line.unit_price))}</span>
                  </li>)}
                </ul> : <p className="text-muted-foreground">No order items available.</p>}
              </div>
            </>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={!canRead || loading} onClick={() => {
            setOrder(null);
            setError(null);
            setLoading(true);
            setRevision((value) => value + 1);
          }}>Refresh order</Button>
          <Button onClick={() => onOpenChange(false)}>Close review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}