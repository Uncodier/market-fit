"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Pagination } from "@/app/components/ui/pagination"
import { Plus, RotateCw } from "@/app/components/ui/icons"
import { DocumentListHead, DocumentListRow, EntityCell, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { ProcurementWorkspace, ProcurementToolbar, ProcurementState } from "@/app/purchases/procurement/ui/workspace"
import { humanize } from "@/app/purchases/procurement/components/form-fields"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { supplierResponse } from "./client"
import { SupplierDetail } from "./supplier-detail"
import type { Supplier } from "../schema"

type ListResult = { suppliers: Supplier[]; total: number; can_create: boolean }
export function SupplierList({ siteId }: { siteId: string }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [offset, setOffset] = useState(0)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<ListResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true); setError(""); setResult(null)
      try {
        const response = await fetch(`/api/procurement/suppliers?site_id=${siteId}&q=${encodeURIComponent(search)}&status=${status}&offset=${offset}`, {
          signal: controller.signal, cache: "no-store",
        })
        const data = await supplierResponse<ListResult>(response)
        if (!controller.signal.aborted) setResult(data)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load suppliers")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, search, status, offset, reload])
  return <>
    <TopBarPrimaryActions><Button size="sm" disabled={!result?.can_create} onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Create supplier</Button></TopBarPrimaryActions>
    <ProcurementWorkspace title="Suppliers" toolbar={<ProcurementToolbar search={search} placeholder="Search suppliers"
      onSearch={value => { setSearch(value); setOffset(0) }} status={status} onStatus={value => { setStatus(value); setOffset(0) }}
      statuses={[{ value: "all", label: "All suppliers" }, ...["prospect", "under_review", "approved", "blocked", "archived"].map(value => ({ value, label: humanize(value) }))]}
      actions={<Button variant="ghost" size="icon" title="Refresh suppliers" aria-label="Refresh suppliers" disabled={loading} onClick={() => setReload(value => value + 1)}><RotateCw className="h-4 w-4" /></Button>} />}>
      <ProcurementState loading={loading} error={error} empty={!loading && !error && result?.suppliers.length === 0}
        emptyTitle="No suppliers found" description="Adjust your filters or create your first supplier relationship." onRetry={() => setReload(value => value + 1)} />
      {!loading && !error && result && <>
        {!!result.suppliers.length && <div className={documentListShellClassName()}><Table>
          <TableHeader><TableRow><DocumentListHead>Supplier</DocumentListHead><DocumentListHead>Status</DocumentListHead><DocumentListHead>Primary contact</DocumentListHead><DocumentListHead>Last updated</DocumentListHead></TableRow></TableHeader>
          <TableBody>{result.suppliers.map(supplier => {
            const contact = supplier.contacts?.find(contact => contact.is_primary) ?? supplier.contacts?.[0]
            return <DocumentListRow key={supplier.id}>
              <TableCell className="px-4 py-3"><Link aria-label={supplier.name} href={`/suppliers/${supplier.id}`}><EntityCell name={supplier.name} secondary={supplier.company_id ? "Company relationship" : "Independent supplier"} secondaryMono={false} /></Link></TableCell>
              <TableCell className="px-4 py-3"><StatusDot status={supplier.status === "approved" ? "active" : supplier.status === "under_review" ? "review" : supplier.status === "prospect" ? "new" : supplier.status} label={humanize(supplier.status)} /></TableCell>
              <TableCell className="px-4 py-3"><p className="text-sm">{contact?.name || "—"}</p><p className="text-xs text-muted-foreground">{contact?.email || contact?.phone}</p></TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{new Date(supplier.updated_at).toLocaleDateString("en")}</TableCell>
            </DocumentListRow>
          })}</TableBody>
        </Table><div className="flex items-center justify-between border-t px-4 py-3"><span className="text-xs text-muted-foreground">{result.total} suppliers · {offset + 1}–{Math.min(offset + 50, result.total)}</span>
          <Pagination currentPage={offset / 50 + 1} totalPages={Math.ceil(result.total / 50)} onPageChange={page => setOffset((page - 1) * 50)} /></div></div>}
        {!result.can_create && <p className="text-sm text-muted-foreground">Read-only access. Workspace editors can create and manage suppliers.</p>}
      </>}
    </ProcurementWorkspace>
    {creating && <SupplierDetail siteId={siteId} id="new" onCancel={() => setCreating(false)} />}
  </>
}
