"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Loader2, Printer } from "@/app/components/ui/icons";
import { usePrinterSettings } from "@/lib/printer/hooks/use-printer";
import { fetchRegisterSummary as getRegisterSummary } from "../operation-client";
import type { RegisterSession, RegisterSummary } from "./types";
import { registerDate } from "./register-ui-utils";
import { RegisterSummaryView } from "./RegisterSummaryView";
import { RegisterWriteForms, type RegisterWriteAction } from "./RegisterWriteForms";
import { printRegisterReport } from "./print-register-report";
import { RegisterActions } from "./RegisterLayout";
import { RegisterReadError } from "./RegisterReadError";
import { RegisterReconciliation } from "./RegisterReconciliation";
import { RegisterSummarySkeleton } from "./RegisterSkeletons";

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
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const printInFlight = useRef(false);
  const printerSettings = usePrinterSettings();
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
  const writeDisabled = !writable || loading || !!error || !summary;
  async function handlePrint() {
    if (!reportSummary || printInFlight.current) return;
    printInFlight.current = true;
    setPrinting(true);
    setPrintError(null);
    setPrintStatus(null);
    try {
      const target = await printRegisterReport(session, reportSummary, locationName, printerSettings);
      setPrintStatus(target === "printer" ? "Report sent to printer." : "System print dialog opened.");
    } catch (failure) {
      setPrintError(failure instanceof Error ? failure.message : "Unable to print report.");
    } finally {
      printInFlight.current = false;
      setPrinting(false);
    }
  }
  const printButton = (
    <Button type="button" variant="outline" disabled={!reportSummary || loading || !!error || printing} onClick={() => void handlePrint()}>
      {printing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden={true} /> : <Printer className="mr-2 h-4 w-4" aria-hidden={true} />}{printing ? "Printing…" : "Print report"}
    </Button>
  );

  return (
    <div className="space-y-4">
      {error && <RegisterReadError error={error} hasPreviousData={!!summary} />}
      <Card hidden={action !== null} className="overflow-hidden">
        <CardHeader className="gap-3 space-y-0 border-b bg-muted/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base"><span className={`h-2 w-2 rounded-full ${session.status === "open" ? "bg-emerald-500" : "bg-muted-foreground"}`} aria-hidden={true} />{session.status === "open" ? "Open session" : "Closed session"}</CardTitle>
              <p className="break-words text-sm text-muted-foreground">{locationName} · {session.currency}</p>
            </div>
            {session.status === "open" && <div role="group" aria-label="Register tools">{printButton}</div>}
          </div>
          <p className="text-xs text-muted-foreground">Opened {registerDate(session.opened_at)}{session.status === "closed" && <> · Closed {registerDate(session.closed_at)}</>}</p>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <details className="rounded-lg border bg-muted/10 p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Session information</summary>
            <dl className="mt-3 grid gap-1 text-xs text-muted-foreground break-words">
              <div><dt className="inline font-medium">Session: </dt><dd className="inline">{session.id}</dd></div>
              <div><dt className="inline font-medium">Opened: </dt><dd className="inline">{registerDate(session.opened_at)}</dd></div>
              <div><dt className="inline font-medium">Responsible (user ID): </dt><dd className="inline">{session.opened_by}</dd></div>
              {session.status === "closed" && <>
                <div><dt className="inline font-medium">Closed: </dt><dd className="inline">{registerDate(session.closed_at)}</dd></div>
                <div><dt className="inline font-medium">Closed by (user ID): </dt><dd className="inline">{session.closed_by || "—"}</dd></div>
              </>}
            </dl>
          </details>
          {printError && <p role="alert" className="text-sm text-destructive">{printError}</p>}
          {printStatus && <p role="status" className="text-sm text-muted-foreground">{printStatus}</p>}
          {session.status === "closed" && <>
            <p className="text-xs text-muted-foreground">Immutable closing snapshot. Later payments and movements do not change this report.</p>
            <RegisterReconciliation currency={session.currency} amount={session.counted_amount} difference={session.difference} />
            {session.notes && <p className="rounded-lg bg-muted/40 p-3 whitespace-pre-wrap break-words text-sm">Notes: {session.notes}</p>}
            {!reportSummary && <p role="alert">The closing snapshot is unavailable. Close and reopen this dialog to try again.</p>}
          </>}
          {loading ? <RegisterSummarySkeleton /> : reportSummary && <RegisterSummaryView summary={reportSummary} currency={session.currency} />}
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
