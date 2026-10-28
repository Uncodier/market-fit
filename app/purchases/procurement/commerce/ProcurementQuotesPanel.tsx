"use client"

import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import type { ImportOption, ProcurementQuotation } from "./contracts"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { DialogForm, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import { DocumentToolbar, DocumentTable, DocumentDialog } from "./document-ui"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { RotateCw } from "@/app/components/ui/icons"
import { CommerceApproval } from "./CommerceApproval"
import { SharedEvidence } from "../evidence/shared-evidence"

const base = "/api/procurement/commerce"
export function ProcurementQuotesPanel({ siteId }: { siteId: string }) {
  return <QuotesContent key={siteId} siteId={siteId} />
}

function QuotesContent({ siteId }: { siteId: string }) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<ProcurementQuotation | null>(null)
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [quotes, setQuotes] = useState<ProcurementQuotation[]>([])
  const [options, setOptions] = useState<ImportOption[]>([])
  const [tender, setTender] = useState("")
  const [supplier, setSupplier] = useState("")
  const [reference, setReference] = useState("")
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generation, setGeneration] = useState(0)
  const [retryKey, setRetryKey] = useState<string | null>(null)
  const option = options.find(item => item.tender_id === tender)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all(["quotes", "options"].map(async path => {
      const response = await fetch(`${base}/${path}?site_id=${encodeURIComponent(siteId)}`, { signal: controller.signal })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Procurement could not be loaded")
      return body.data
    })).then(([rows, choices]) => { setQuotes(rows ?? []); setOptions(choices ?? []) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, generation])

  async function record() {
    if (!option) return
    const lines = option.requirements.map(line => ({ requirement_id: line.id, unit_net_minor: Number(prices[line.id]) }))
    if (option.requirements.some(line => !/^\d+$/.test(prices[line.id] ?? "")) || lines.some(line => !Number.isSafeInteger(line.unit_net_minor))) {
      setError("Enter each unit price as a whole number of minor currency units (for example, 1234 for 12.34).")
      return
    }
    setBusy(true); setError("")
    const key = retryKey ?? crypto.randomUUID()
    setRetryKey(key)
    try {
      const response = await fetch(`${base}/quotes?site_id=${encodeURIComponent(siteId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: supplier, tender_id: tender, publication_id: option.publication_id,
          reference, lines, idempotency_key: key }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Quotation could not be recorded")
      setTender(""); setSupplier(""); setReference(""); setPrices({}); setRetryKey(null)
      setEditing(false); setGeneration(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Quotation could not be recorded") }
    finally { setBusy(false) }
  }

  return <section className="space-y-4 border-b p-6" aria-label="Procurement quotations">
    <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Procurement quotations</h2>
      </div>
    <TopBarPrimaryActions><Button disabled={loading || !!error} onClick={() => setEditing(true)}>Record external quotation</Button></TopBarPrimaryActions>
    <p className="text-sm text-muted-foreground">Procurement quotations, separate from online seller quotes. Buyer-recorded documents are not authenticated supplier submissions. Sealed supplier offers appear only after opening.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <DocumentToolbar workspace tabs={[{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending review' }, { value: 'awarded', label: 'Awarded' }]} value={status} onChange={setStatus} search={search} onSearch={setSearch}
      actions={<Button variant="ghost" size="icon" title="Refresh quotations" aria-label="Refresh" disabled={loading || busy} onClick={() => { setError(""); setLoading(true); setGeneration(value => value + 1) }}><RotateCw className="h-4 w-4" /></Button>} />
    {!error && <DocumentTable loading={loading} empty="No procurement quotations recorded." rows={quotes.filter(quote => (status === 'all' || (status === 'awarded' ? !!quote.award_id : !quote.award_id)) && `${quote.supplier_name} ${quote.reference} ${quote.tender_title}`.toLowerCase().includes(search.toLowerCase()))}
      columns={[
        { label: 'Supplier / reference', render: quote => <Button variant="link" onClick={() => setSelected(quote)}>{quote.supplier_name} — {quote.reference}</Button> },
        { label: 'Tender', render: quote => quote.tender_title },
        { label: 'Net amount', render: quote => `${quote.currency} ${(quote.net_amount_minor / 100).toFixed(2)}` },
        { label: 'Source / status', render: quote => `${quote.source === 'supplier_submitted' ? 'Supplier submitted' : 'Buyer recorded'} · ${quote.award_id ? 'Award approved' : 'Not awarded'}` },
        { label: 'Recorded', render: quote => new Date(quote.recorded_at).toLocaleString() },
      ]} />}
    <DocumentDialog open={!!selected} onClose={() => setSelected(null)} title={selected?.reference ?? 'Quotation'} description="Immutable quotation lines and policy-controlled approval actions.">
      <DialogBody>{selected && <><DocumentTable rows={selected.lines} empty="No lines" columns={[
        { label: 'Item', render: line => line.name }, { label: 'Quantity', render: line => line.quantity },
        { label: 'Unit net', render: line => `${selected.currency} ${(line.unit_net_minor / 100).toFixed(2)}` },
      ]} /><SharedEvidence siteId={siteId} quotationId={selected.id} /><CommerceApproval siteId={siteId} targetId={selected.award_id ?? selected.id} version={1} event={selected.award_id ? 'order' : 'award'} onChange={() => { setSelected(null); setGeneration(value => value + 1) }} /></>}</DialogBody>
    </DocumentDialog>
    <DocumentDialog open={editing} onClose={() => setEditing(false)} busy={busy} title="Record an external quotation" description="Record an immutable buyer-entered document, not an authenticated supplier submission.">
      <DialogForm onSubmit={event => { event.preventDefault(); if (!busy && supplier && reference.trim()) void record() }}><DialogBody>
        <p className="my-3 text-sm">Only invited, approved suppliers on currently published tenders are eligible. All published lines are required. The original quotation reference is retained; the record is immutable.</p>
        {options.length === 0 ? <p>No eligible open tender is available.</p> : <div className="space-y-3 pt-3">
          <RelationSelect label="Tender" allowCreate={false} disabled={busy || !!retryKey}
            options={options.map(item => ({ id: item.tender_id, label: item.title }))}
            value={option ? { mode: 'existing', id: tender, label: option.title } : null}
            onValueChange={value => { setTender(value?.mode === 'existing' ? value.id : ''); setSupplier(''); setPrices({}) }} />
          {option && <>
            <RelationSelect label="Invited supplier" allowCreate={false} disabled={busy || !!retryKey}
              options={option.suppliers.map(item => ({ id: item.id, label: item.name }))}
              value={supplier ? { mode: 'existing', id: supplier, label: option.suppliers.find(item => item.id === supplier)?.name ?? supplier } : null}
              onValueChange={value => setSupplier(value?.mode === 'existing' ? value.id : '')} />
            <Label htmlFor="commerce-reference">External quotation reference</Label>
            <Input id="commerce-reference" value={reference} maxLength={120} disabled={busy || !!retryKey} onChange={event => setReference(event.target.value)} />
            {option.requirements.map(line => <div key={line.id}>
              <Label htmlFor={`price-${line.id}`}>{line.description} ({line.quantity} {line.unit}) — unit net price in {option.currency} minor units</Label>
              <Input id={`price-${line.id}`} inputMode="numeric" value={prices[line.id] ?? ""} disabled={busy || !!retryKey}
                onChange={event => setPrices(current => ({ ...current, [line.id]: event.target.value }))} />
            </div>)}

            {retryKey && <p className="text-sm">The submitted fields are locked for a safe retry. Close and reopen to retry the same quotation.</p>}
          </>}
        </div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Close and keep draft</Button><Button type="submit" disabled={busy || !supplier || !reference.trim()}>{busy ? 'Recording…' : retryKey ? 'Retry the same quotation' : 'Record quotation'}</Button></DialogFooter></DialogForm>
    </DocumentDialog>
  </section>
}