"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Printer } from "@/app/components/ui/icons";
import { fetchRegisterSummary as getRegisterSummary } from "../operation-client";
import type { RegisterSession, RegisterSummary } from "./types";
import { registerDate, registerMoney } from "./register-ui-utils";
import { RegisterSummaryView } from "./RegisterSummaryView";
import { RegisterWriteForms, type RegisterWriteAction } from "./RegisterWriteForms";
import { printRegisterReport } from "./print-register-report";
import { RegisterActions } from "./RegisterLayout";

interface Props {
  siteId: string;
  session: RegisterSession;
  locationName: string;
  revision: number;
  writable: boolean;
  onChanged?: (closed?: RegisterSession) => void;
  onHideDetail?: () => void;
}

export function RegisterSessionPanel({ siteId, session, locationName, revision, writable, onChanged, onHideDetail }: Props) {
  const [summary, setSummary] = useState<RegisterSummary | null>(session.status === "closed" ? session.snapshot : null);
  const [loading, setLoading] = useState(session.status === "open");
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [action, setAction] = useState<RegisterWriteAction | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (session.status === "closed") return;
    async function load() {
      setLoading(true);
      try {
        const result = await getRegisterSummary({ siteId, sessionId: session.id });
        if (cancelled) return;
        if (result.error !== undefined) throw new Error(result.error);
        setSummary(result.data);
        setError(null);
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "Unable to load register summary. Close and reopen this dialog to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [siteId, session.id, session.status, revision]);
  const reportSummary = session.status === "closed" ? session.snapshot : summary;
  const money = (amount: number) => registerMoney(amount, session.currency);
  const writeDisabled = !writable || loading || !!error || !summary;
  const printButton = (
    <Button type="button" variant="outline" disabled={!reportSummary || loading || !!error} onClick={() => {
      try { if (reportSummary) printRegisterReport(session, reportSummary, locationName); setPrintError(null); }
      catch (failure) { setPrintError(failure instanceof Error ? failure.message : "Unable to print report."); }
    }}><Printer className="mr-2 h-4 w-4" />Print report</Button>
  );

  return (
    <div className="space-y-4">
      <Card hidden={action !== null} className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">{session.status === "open" ? "Open session" : "Closed session"}</CardTitle>
          {session.status === "open" && <div className="flex flex-wrap gap-2 pt-2" role="group" aria-label="Register tools">
            {printButton}
          </div>}
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-1 text-xs text-muted-foreground break-words">
            <div><dt className="inline font-medium">Session: </dt><dd className="inline">{session.id}</dd></div>
            <div><dt className="inline font-medium">Opened: </dt><dd className="inline">{registerDate(session.opened_at)}</dd></div>
            <div><dt className="inline font-medium">Responsible (user ID): </dt><dd className="inline">{session.opened_by}</dd></div>
            {session.status === "closed" && <>
              <div><dt className="inline font-medium">Closed: </dt><dd className="inline">{registerDate(session.closed_at)}</dd></div>
              <div><dt className="inline font-medium">Closed by (user ID): </dt><dd className="inline">{session.closed_by || "—"}</dd></div>
            </>}
          </dl>
          {printError && <p role="alert" className="text-sm text-destructive">{printError}</p>}
          {loading && <p role="status" className="text-sm">Loading summary…</p>}
          {error && <p role="alert" className="text-sm">{error} Last loaded figures have not been reset. Close and reopen this dialog to try again.</p>}
          {session.status === "closed" && <>
            <p className="text-xs text-muted-foreground">Immutable closing snapshot. Later payments and movements do not change this report.</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt>Counted cash</dt><dd className="text-right">{session.counted_amount === null ? "—" : money(session.counted_amount)}</dd>
              <dt>Closing difference</dt><dd className="text-right">{session.difference === null ? "—" : money(session.difference)}</dd>
            </dl>
            {session.notes && <p className="whitespace-pre-wrap break-words text-sm">Notes: {session.notes}</p>}
            {!reportSummary && <p role="alert">The closing snapshot is unavailable. Close and reopen this dialog to try again.</p>}
          </>}
          {reportSummary && <RegisterSummaryView summary={reportSummary} currency={session.currency} />}
        </CardContent>
        {session.status === "closed" && <RegisterActions>
          {onHideDetail && <Button type="button" variant="ghost" onClick={onHideDetail}>Hide detail</Button>}
          {printButton}
        </RegisterActions>}
      </Card>
      {session.status === "open" && onChanged && <>
        {action === null && <RegisterActions>
          <Button type="button" variant="outline" disabled={writeDisabled} onClick={() => setAction("cash_in")}>Add cash</Button>
          <Button type="button" variant="outline" disabled={writeDisabled} onClick={() => setAction("cash_out")}>Withdraw cash</Button>
          <Button type="button" disabled={writeDisabled} onClick={() => setAction("close")}>Close register</Button>
        </RegisterActions>}
        <RegisterWriteForms siteId={siteId} session={session} summary={summary} disabled={writeDisabled} action={action} onCancel={() => setAction(null)} onChanged={onChanged} />
      </>}
      {session.status === "open" && !writable && onChanged && <p className="text-xs text-muted-foreground">Only the responsible cashier or a manager can change this session. Close and reopen this dialog if register data is stale.</p>}
    </div>
  );
}
