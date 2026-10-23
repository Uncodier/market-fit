"use client";

import { useId, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { closePosRegister as closeRegister, movePosRegisterCash as moveRegisterCash } from "../operation-client";
import { withRegisterCloseLock } from "./queue-guard";
import type { RegisterMovementKind, RegisterSession, RegisterSummary } from "./types";
import { registerAmount, registerMoney, requireRegisterOnline } from "./register-ui-utils";
import { useRegisterMutation } from "./use-register-mutation";
import { RegisterActions } from "./RegisterLayout";

export type RegisterWriteAction = "cash_in" | "cash_out" | "close";

export function RegisterWriteForms({ siteId, session, summary, disabled, action, onCancel, onChanged }: {
  siteId: string;
  session: RegisterSession;
  summary: RegisterSummary | null;
  disabled: boolean;
  action: RegisterWriteAction | null;
  onCancel: () => void;
  onChanged: (closed?: RegisterSession) => void;
}) {
  const id = useId();
  const [withdrawalKind, setWithdrawalKind] = useState<RegisterMovementKind>("cash_out");
  const [drafts, setDrafts] = useState({ cash_in: { amount: "", reason: "" }, cash_out: { amount: "", reason: "" } });
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const mutation = useRegisterMutation();
  const busy = disabled || mutation.pending;
  const movementAction = action === "cash_in" ? "cash_in" : "cash_out";
  const kind = movementAction === "cash_in" ? "cash_in" : withdrawalKind;
  const { amount, reason } = drafts[movementAction];
  const updateDraft = (field: "amount" | "reason", value: string) => setDrafts((current) => ({ ...current, [movementAction]: { ...current[movementAction], [field]: value } }));
  const cancel = () => { if (!mutation.pending) { mutation.setError(null); onCancel(); } };
  const movementLabel = action === "cash_in" ? "Add cash" : "Withdraw cash";
  let difference: number | null = null;
  try { if (summary) difference = Math.round((registerAmount(counted, true) - summary.expected_amount) * 100) / 100; } catch { /* Incomplete counted input has no preview. */ }

  if (!action) return null;

  return (
    <div className="space-y-4">
      {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error} No form values have been cleared. Verify the register state before retrying.</p>}
      {action !== "close" ? <Card className="overflow-hidden">
        <form id={`${id}-movement`} onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          try {
            if (!reason.trim()) throw new Error("A reason is required for every cash movement.");
            const movementAmount = registerAmount(amount);
            mutation.run(JSON.stringify(["move", siteId, session.id, kind, movementAmount, reason.trim()]), async (requestId) => moveRegisterCash({ siteId, sessionId: session.id, kind, amount: movementAmount, reason: reason.trim(), requestId }), () => {
              setDrafts((current) => ({ ...current, [movementAction]: { amount: "", reason: "" } }));
              onChanged();
              onCancel();
            });
          } catch (failure) { mutation.setError(failure instanceof Error ? failure.message : "Invalid cash movement."); }
        }}>
          <CardHeader><CardTitle className="text-base">{movementLabel}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {action === "cash_out" && <div className="space-y-1"><Label htmlFor={`${id}-kind`}>Withdrawal type</Label><select id={`${id}-kind`} value={withdrawalKind} onChange={(event) => setWithdrawalKind(event.target.value as RegisterMovementKind)} disabled={busy} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="cash_out">Cash out</option><option value="cash_refund">Cash refund</option></select></div>}
            <div className="space-y-1"><Label htmlFor={`${id}-amount`}>Movement amount ({session.currency})</Label><Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(event) => updateDraft("amount", event.target.value)} disabled={busy} autoFocus required /></div>
            <div className="space-y-1"><Label htmlFor={`${id}-reason`}>Reason</Label><Input id={`${id}-reason`} value={reason} onChange={(event) => updateDraft("reason", event.target.value)} disabled={busy} maxLength={500} required /></div>
            {action === "cash_out" && <p className="text-xs text-muted-foreground">Cash refunds record money removed from the drawer; they do not reverse a sale or refund a card payment.</p>}
          </CardContent>
          <RegisterActions>
            <Button type="button" variant="outline" disabled={mutation.pending} onClick={cancel}>Cancel</Button>
            <Button type="submit" form={`${id}-movement`} disabled={busy}>{mutation.pending ? "Saving…" : movementLabel}</Button>
          </RegisterActions>
        </form>
      </Card> : <Card className="overflow-hidden">
        <form id={`${id}-close`} onSubmit={(event) => {
          event.preventDefault();
          if (busy || !summary) return;
          try {
            const countedAmount = registerAmount(counted, true);
            mutation.run(JSON.stringify(["close", siteId, session.id, countedAmount, notes.trim()]), async (requestId) => withRegisterCloseLock(siteId, async () => {
              requireRegisterOnline();
              return closeRegister({ siteId, sessionId: session.id, countedAmount, notes: notes.trim(), requestId });
            }), (closed) => onChanged(closed));
          } catch (failure) { mutation.setError(failure instanceof Error ? failure.message : "Invalid closing amount."); }
        }}>
          <CardHeader><CardTitle className="text-base">Close register</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label htmlFor={`${id}-counted`}>Counted cash ({session.currency})</Label><Input id={`${id}-counted`} inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} disabled={busy} autoFocus required /></div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt>Expected cash</dt><dd className="text-right">{summary ? registerMoney(summary.expected_amount, session.currency) : "Unavailable"}</dd>
              <dt>Preview difference</dt><dd className="text-right">{difference === null ? "Enter counted cash" : registerMoney(difference, session.currency)}</dd>
            </dl>
            <div className="space-y-1"><Label htmlFor={`${id}-notes`}>Closing notes</Label><Textarea id={`${id}-notes`} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} maxLength={2000} /></div>
            <p className="text-xs text-muted-foreground">Closing is blocked if any payment remains unresolved. Check payment status before closing. The final expected cash and difference are calculated by the server.</p>
          </CardContent>
          <RegisterActions>
            <Button type="button" variant="outline" disabled={mutation.pending} onClick={cancel}>Cancel</Button>
            <Button type="submit" form={`${id}-close`} disabled={busy || !summary}>{mutation.pending ? "Saving…" : "Close register"}</Button>
          </RegisterActions>
        </form>
      </Card>}
    </div>
  );
}
