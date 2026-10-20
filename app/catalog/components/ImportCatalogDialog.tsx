"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Progress } from "@/app/components/ui/progress"
import { Badge } from "@/app/components/ui/badge"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { ImportCatalogMapping } from "./ImportCatalogMapping"
import { ImportCatalogErrors, ImportCatalogReview } from "./ImportCatalogReview"
import { useImportCatalogState } from "./ImportCatalogState"
import { ImportCatalogSteps } from "./ImportCatalogSteps"
import { ImportCatalogUpload } from "./ImportCatalogUpload"

export interface ImportCatalogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: string
  onSuccess: () => void
}

/** Remounting on site/close invalidates all pending parse, preflight and batch continuations. */
export function ImportCatalogDialog(props: ImportCatalogDialogProps) {
  if (!props.open) return null
  return <ImportCatalogDialogContent key={props.siteId} {...props} />
}

function ImportCatalogDialogContent({ open, onOpenChange, siteId, onSuccess }: ImportCatalogDialogProps) {
  const state = useImportCatalogState(siteId, onSuccess)
  const [acknowledged, setAcknowledged] = useState(false)
  const validRows = state.review?.rows.filter(row => !row.category || !state.review?.missingCategories.includes(row.category)).length ?? 0
  const totalRows = state.session?.batches.reduce((total, batch) => total + batch.rows.length, 0) ?? 0
  const completedRows = state.session?.completedRows ?? 0
  const close = () => { if (!state.busy) onOpenChange(false) }

  return (
    <Dialog open={open} onOpenChange={value => { if (!state.busy) onOpenChange(value) }}>
      <DialogContent size="xl" busy={state.busy} showClose={!state.busy}>
        <DialogHeader>
          <DialogTitle>Import Catalog</DialogTitle>
          <DialogDescription>Import products from CSV or Excel files. Download a sample file to get started.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <ImportCatalogSteps currentStep={state.step} />

          {state.error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{state.error}</p>}

          {state.step === "upload" && <ImportCatalogUpload busy={state.busy} onSelectFile={state.selectFile} />}

          {state.step === "mapping" && state.parsed && <>
            <p className="text-sm text-muted-foreground">{state.fileName} · {state.parsed.rows.length.toLocaleString()} rows · {state.parsed.headers.length} columns</p>
            <ImportCatalogMapping headers={state.parsed.headers} mapping={state.mapping} onMappingChange={state.setMapping}
              defaultCurrency={state.defaultCurrency} onCurrencyChange={state.setDefaultCurrency} disabled={state.busy} />
            {state.busy && <div role="status" className="space-y-2">
              <p>Checking existing SKUs and categories: {state.scanRows.toLocaleString()} rows scanned…</p>
              <Progress value={state.scanRows / state.parsed.rows.length * 100} aria-label="Catalog preflight progress" />
            </div>}
          </>}

          {state.step === "review" && state.review && <ImportCatalogReview review={state.review} mode={state.mode}
            onModeChange={mode => { state.setMode(mode); setAcknowledged(false) }} acknowledged={acknowledged} onAcknowledge={setAcknowledged} />}

          {state.step === "import" && state.session && <div className="space-y-4">
            <h3 className="font-medium">{state.status === "done" ? "Import complete" : state.status === "running" ? "Importing products…" : "Import paused"}</h3>
            <Progress value={totalRows ? completedRows / totalRows * 100 : 0} aria-label="Catalog import progress" />
            <p role="status">{completedRows.toLocaleString()} of {totalRows.toLocaleString()} rows completed</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{state.session.totals.created.toLocaleString()} created</Badge>
              <Badge variant="secondary">{state.session.totals.updated.toLocaleString()} updated</Badge>
              <Badge variant="secondary">{state.session.totals.skipped.toLocaleString()} skipped</Badge>
            </div>
            <ImportCatalogErrors errors={[...(state.review?.errors ?? []), ...state.session.totals.errors]} />
            <p className="text-sm text-muted-foreground">These totals include acknowledged batches only. Already committed changes are saved, even if you stop or a later batch fails.</p>
            {state.status !== "done" && <p className="text-sm text-muted-foreground">Keep this dialog open. Resume continues the same rows and safely retries the pending batch with the same request ID. Closing, changing sites, or leaving this page cancels future batches; imports do not run in the background.</p>}
            {state.stopRequested && state.busy && <p role="status">Stopping after the current batch is acknowledged…</p>}
          </div>}
        </DialogBody>
        <DialogFooter>
          {!state.busy && state.step !== "upload" && <Button variant="outline" onClick={close}>{state.status === "done" && state.step === "import" ? "Done" : "Close"}</Button>}
          {state.step === "mapping" && <>
            <Button variant="outline" disabled={state.busy} onClick={state.reset}>Choose another file</Button>
            <Button disabled={state.busy || !state.mapping.sku || !state.mapping.name || !/^[A-Z]{3}$/.test(state.defaultCurrency)}
              onClick={() => { setAcknowledged(false); void state.prepareReview() }}>Review import</Button>
          </>}
          {state.step === "review" && <>
            <Button variant="outline" onClick={() => { state.setStep("mapping"); setAcknowledged(false) }}>Back to columns</Button>
            <Button disabled={!acknowledged || !validRows || state.busy} onClick={state.confirm}>Confirm import ({validRows.toLocaleString()} valid rows)</Button>
          </>}
          {state.step === "import" && state.status === "running" && <Button variant="outline" disabled={state.stopRequested} onClick={state.requestStop}>Stop after this batch</Button>}
          {state.step === "import" && state.status === "paused" && <Button onClick={state.resume}>Resume import</Button>}
          {state.step === "import" && state.status === "done" && <Button onClick={() => { state.reset(); setAcknowledged(false) }}>Import another file</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}