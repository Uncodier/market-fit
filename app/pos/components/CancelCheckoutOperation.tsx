"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cancelPosCheckout } from "../local/cancel-checkout";
import { waitForSyncDialog } from "./sync-dialog-wait";

export function CancelCheckoutOperation({ siteId, rowId, onResolved }: {
  siteId: string; rowId: string; onResolved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef({ active: true, busy: false });
  useEffect(() => {
    const session = { active: true, busy: false };
    sessionRef.current = session;
    return () => { session.active = false; };
  }, [siteId, rowId]);
  async function cancel() {
    const session = sessionRef.current;
    if (!session.active || session.busy || !reason.trim()) return;
    session.busy = true;
    setBusy(true);
    setError(null);
    try {
      await waitForSyncDialog(cancelPosCheckout(siteId, rowId, reason),
        "Cancellation is not confirmed yet. Check payment status before collecting again.");
      if (!session.active) return;
      setConfirming(false);
      onResolved();
    } catch (failure) {
      if (session.active) setError(failure instanceof Error ? failure.message : "Unable to confirm cancellation. Check payment status.");
    } finally {
      if (session.active) { session.busy = false; setBusy(false); }
    }
  }
  return <section className="space-y-2" aria-label="Cancel queued operation">
    {!confirming ? <Button variant="outline" onClick={() => setConfirming(true)}>Cancel operation</Button> : <>
      <p className="text-sm">Cancel this payment attempt only? The order and audit history will be kept. This does not refund money or cancel the order. The server must confirm that checkout writes have not started.</p>
      <Label htmlFor={`cancel-reason-${rowId}`}>Cancellation reason</Label>
      <Input id={`cancel-reason-${rowId}`} value={reason} maxLength={500}
        disabled={busy} onChange={(event) => setReason(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => { void cancel(); }}>
          {busy ? "Cancelling operation…" : "Confirm cancellation"}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Keep operation</Button>
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}