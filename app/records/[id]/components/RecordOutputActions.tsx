import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { Download, Printer } from "@/app/components/ui/icons"
import { writeRecordOutput, type RecordOutputFormat } from "../record-output"
import { buildRecordOutput, type RecordOutputDraft } from "../record-output-document"
import { useSharedRecordInsights } from "./record-insight-context"

export function RecordOutputActions({ draft, pendingEdits }: { draft: RecordOutputDraft; pendingEdits: boolean }) {
  const { insights, requestInsights } = useSharedRecordInsights()
  const [format, setFormat] = useState<RecordOutputFormat | null>(null)
  const [includeInsights, setIncludeInsights] = useState(false)
  const [busy, setBusy] = useState(false)
  const waiting = includeInsights && (pendingEdits || insights.historyStatus === "loading" || insights.categoryStatus === "loading")
  const action = format === "print" ? "Print" : `Export ${format === "pdf" ? "PDF" : "Markdown"}`

  function reset() {
    setFormat(null)
    setIncludeInsights(false)
    requestInsights(false)
  }

  async function confirm() {
    if (!format || busy || waiting) return
    setBusy(true)
    try {
      await writeRecordOutput(format, buildRecordOutput(draft, insights, includeInsights))
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the record document.")
    } finally {
      setBusy(false)
    }
  }

  return <>
    <Button variant="ghost" type="button" onClick={() => setFormat("print")}><Printer />Print record</Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" type="button"><Download />Export record</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => setFormat("markdown")}>Markdown (.md)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setFormat("pdf")}>PDF (.pdf)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={format !== null} onOpenChange={open => { if (!open && !busy) reset() }}>
      <DialogContent busy={busy}>
        <DialogHeader>
          <DialogTitle>{action}</DialogTitle>
          <DialogDescription>Include the insights summary in this record document?</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeInsights} disabled={busy} onCheckedChange={value => {
              setIncludeInsights(value === true)
              requestInsights(value === true)
            }} /> Include insights
          </label>
          {waiting && <p role="status" className="mt-2 text-sm text-muted-foreground">Preparing insights…</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={reset}>Cancel</Button>
          <Button disabled={busy || waiting} onClick={confirm}>{action}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}