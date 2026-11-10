"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useAuth } from "@/app/hooks/use-auth"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent } from "@/app/components/ui/section-card"
import { usePrinterSettings } from "@/lib/printer/hooks/use-printer"
import { printJobManually } from "@/lib/printer/transports/manual-print"
import { printJobForSettings } from "@/lib/printer/transports/dispatch"
import { stationOwnsPrinter } from "@/lib/printer/core/station-claim"
import { getPrinterBind } from "@/lib/printer/core/bind-store"
import { getShipment } from "../actions"
import { shipmentPackingSlip, claimShipmentPackingSlip } from "../packing-slip"
import { downloadShipmentBlob, packingSlipPdf } from "../packing-slip-pdf"
import type { ShipmentWithRelations } from "../types"

type ShipmentDocument = { id: string; file_name: string; size_bytes: number }

export function ShipmentDocumentsPanel({ shipment }: { shipment: ShipmentWithRelations }) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const permissions = useOptionalPermissions()
  const settings = usePrinterSettings()
  const siteId = currentSite?.id
  const allowed = Boolean(user?.id && siteId === shipment.site_id && permissions?.siteId === siteId
    && permissions.capabilities && permissions.can("select"))
  const canUpload = allowed && Boolean(permissions?.can("update"))
  const [documentState, setDocumentState] = useState<{ context: string; documents: ShipmentDocument[]; error: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState<{ context: string; file: File } | null>(null)
  const [revision, setRevision] = useState(0)
  const context = `${siteId}:${user?.id}:${shipment.id}:${allowed}:${canUpload}`
  const file = selection?.context === context ? selection.file : null
  const liveContext = useRef(context)
  useLayoutEffect(() => {
    liveContext.current = context
    return () => { liveContext.current = "" }
  }, [context])
  const documents = documentState?.context === context ? documentState.documents : []
  const listError = documentState?.context === context && documentState.error
  const base = `/api/shipments/${encodeURIComponent(shipment.id)}/documents`

  useEffect(() => {
    if (!allowed) return
    let active = true
    fetch(base).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load documents")
      const result = await response.json()
      if (active) setDocumentState({ context, documents: result.documents, error: false })
    }).catch(() => { if (active) setDocumentState({ context, documents: [], error: true }) })
    return () => { active = false }
  }, [allowed, base, context, revision])

  useEffect(() => {
    if (!allowed || !siteId || !user?.id || shipment.status !== "preparing"
      || !settings.devices.some((device) => device.enabled && device.transport !== "system"
        && device.modules.shipments && device.autoPrint.shipmentPackingSlip
        && stationOwnsPrinter(device, getPrinterBind(device.id)))) return
    let active = true
    void (async () => {
      const result = await getShipment(shipment.id)
      if (!active || liveContext.current !== context || result.error || !result.data
        || result.data.site_id !== siteId || result.data.status !== "preparing") return
      const payload = shipmentPackingSlip(result.data, currentSite?.name)
      if (!payload.lines.length) return
      if (!await claimShipmentPackingSlip(siteId, user.id, shipment.id)) return
      if (!active || liveContext.current !== context) return
      const printed = await printJobForSettings(settings, {
        id: `shipment-packing-slip:${shipment.id}`, module: "shipments", template: "packing-slip", payload,
      }, { autoPrintFlag: "shipmentPackingSlip", bestEffort: true, fallbackToSystem: false, allowPrompt: false })
      if (!printed && active) toast.info("Automatic packing slip was skipped or incomplete. Check the printer before manually printing.")
    })().catch(() => { /* Automatic printing never blocks shipment work or retries a claim. */ })
    return () => { active = false }
  }, [allowed, siteId, user?.id, shipment.id, shipment.status, settings, context, currentSite?.name])

  async function authoritativeShipment() {
    if (!allowed) throw new Error("Shipment access is unavailable")
    const result = await getShipment(shipment.id)
    if (liveContext.current !== context || result.error || !result.data || result.data.site_id !== siteId) {
      throw new Error("Shipment access changed. Reload and try again.")
    }
    return result.data
  }

  async function run(action: () => Promise<void>) {
    if (busy || !allowed) return
    setBusy(true)
    try { await action() } catch (error) { toast.error(error instanceof Error ? error.message : "Document action failed") }
    finally { setBusy(false) }
  }

  async function packingSlip(print: boolean) {
    const fresh = await authoritativeShipment()
    const payload = shipmentPackingSlip(fresh, currentSite?.name)
    if (print) {
      await printJobManually(settings, { id: crypto.randomUUID(), module: "shipments", template: "packing-slip", payload })
    } else {
      const bytes = await packingSlipPdf(payload)
      if (liveContext.current !== context) return
      downloadShipmentBlob(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), `packing-slip-${shipment.id}.pdf`)
    }
  }

  async function upload() {
    if (!canUpload || !file) return
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf") || file.size > 10 * 1024 * 1024 || !file.size) {
      throw new Error("Choose a PDF file of up to 10 MiB")
    }
    await authoritativeShipment()
    const body = new FormData()
    body.append("file", file)
    const response = await fetch(base, { method: "POST", body })
    if (!response.ok) throw new Error("Unable to upload carrier PDF")
    if (liveContext.current === context) { setSelection(null); setRevision((value) => value + 1); toast.success("Carrier PDF uploaded") }
  }

  if (!allowed) return null
  return <SectionCard>
    <SectionCardHeader><SectionCardTitle>Shipment documents</SectionCardTitle></SectionCardHeader>
    <SectionCardContent className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-medium">Internal packing slip</h3>
        <p className="text-sm text-muted-foreground">Assigned items only. This is not an official carrier label.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void run(() => packingSlip(false))}>Download packing slip PDF</Button>
          <Button variant="outline" disabled={busy} onClick={() => void run(() => packingSlip(true))}>Print packing slip</Button>
        </div>
        <p className="text-xs text-muted-foreground">Automatic printing runs only while this shipment detail is open and preparing, including the first eligible load. It requires an enabled shipment printer and automatic packing slips in Settings. This browser claims each shipment once per site and user before dispatch; skipped or partial jobs are not replayed. System print dialogs never open automatically.</p>
      </div>
      <div className="space-y-2">
        <h3 className="font-medium">Carrier PDFs</h3>
        <p className="text-sm text-muted-foreground">Upload an existing carrier label or document. Open the PDF and use your browser’s system print dialog. Direct thermal PDF printing is not supported.</p>
        {canUpload && <div className="flex flex-wrap gap-2">
          <Input key={context} aria-label="Carrier PDF" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => setSelection(event.target.files?.[0] ? { context, file: event.target.files[0] } : null)} />
          <Button disabled={busy || !file} onClick={() => void run(upload)}>Upload PDF</Button>
        </div>}
        {listError ? <p role="alert">Unable to load carrier documents. <Button variant="link" onClick={() => setRevision((value) => value + 1)}>Retry</Button></p>
          : documents.length === 0 ? <p className="text-sm text-muted-foreground">No carrier PDFs loaded.</p> : <ul className="space-y-2">{documents.map((document) => <li key={document.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span>{document.file_name}</span>
            <a className="underline" href={`${base}/${encodeURIComponent(document.id)}`} download>Download</a>
            <a className="underline" href={`${base}/${encodeURIComponent(document.id)}?disposition=inline`} target="_blank" rel="noopener noreferrer">Open PDF for system printing</a>
          </li>)}</ul>}
      </div>
    </SectionCardContent>
  </SectionCard>
}