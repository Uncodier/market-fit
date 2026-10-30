"use client"

import Link from "next/link"
import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { demoSuppliers } from '@/lib/demo-data/procurement-suppliers'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Pagination } from "@/app/components/ui/pagination"
import { Plus } from "@/app/components/ui/icons"
import { ViewSelector, type ViewType } from "@/app/components/view-selector"
import { SupplierBoard } from "./supplier-board"
import { DocumentListHead, DocumentListRow, EntityCell, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { ProcurementListSkeleton } from '@/app/purchases/procurement/ui/list-loading'
import { ProcurementWorkspace, ProcurementToolbar, ProcurementState } from "@/app/purchases/procurement/ui/workspace"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { supplierResponse } from "./client"
import { SupplierDetail } from "./supplier-detail"
import type { Supplier } from "../schema"
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

type ListResult = { suppliers: Supplier[]; total: number; can_create: boolean }
export function SupplierList({ siteId }: { siteId: string }) {
  const { t, message, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [offset, setOffset] = useState(0)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<ListResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<ViewType>("table")
  const demo = isDemoSiteId(siteId)
  useEffect(() => {
    if (demo) {
      const timer = setTimeout(() => {
        const suppliers = demoSuppliers(siteId).filter(supplier => (status === 'all' || supplier.status === status) &&
          `${supplier.name} ${supplier.contacts.map(contact => contact.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
        setResult({ suppliers: suppliers.slice(offset, offset + 50), total: suppliers.length, can_create: false })
        setLoading(false); setError('')
      }, 0)
      return () => clearTimeout(timer)
    }
    if (isDemoModeActive()) return
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
  }, [siteId, search, status, offset, reload, demo])
  return <>
    <TopBarPrimaryActions><Button size="sm" disabled={!demo && !result?.can_create} onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />{t('procurement.partners.suppliers.create')}</Button></TopBarPrimaryActions>
    <ProcurementWorkspace title={t('procurement.partners.suppliers.title')} toolbar={<ProcurementToolbar search={search} placeholder={t('procurement.partners.suppliers.search')}
      onSearch={value => { setSearch(value); setOffset(0) }} status={status} onStatus={value => { setStatus(value); setOffset(0) }}
      statuses={[{ value: "all", label: t('procurement.partners.suppliers.all') }, ...["prospect", "under_review", "approved", "blocked", "archived"].map(value => ({ value, label: valueLabel(value) }))]}
      viewSelector={<ViewSelector currentView={view} onViewChange={setView} labels={{ table: t('procurement.common.tableView'), kanban: t('procurement.common.kanbanView') }} />} />}>
      {demo && <ProcurementDemoNotice />}
      {loading && <ProcurementListSkeleton columns={4} board={view === 'kanban'} stages={5} />}
      <ProcurementState error={message(error)} empty={!loading && !error && result?.suppliers.length === 0}
        emptyTitle={t('procurement.partners.suppliers.empty')} description={t('procurement.partners.suppliers.emptyHint')} onRetry={() => setReload(value => value + 1)} />
      {!loading && !error && result && <>
        {!!result.suppliers.length && <>
        {view === "kanban" && <SupplierBoard suppliers={result.suppliers} status={status} />}
        {view === "table" && <div className={documentListShellClassName()}><Table>
          <TableHeader><TableRow><DocumentListHead>{t('procurement.partners.suppliers.supplier')}</DocumentListHead><DocumentListHead>{t('procurement.common.status')}</DocumentListHead><DocumentListHead>{t('procurement.partners.contacts.primaryContact')}</DocumentListHead><DocumentListHead>{t('procurement.partners.suppliers.updated')}</DocumentListHead></TableRow></TableHeader>
          <TableBody>{result.suppliers.map(supplier => {
            const contact = supplier.contacts?.find(contact => contact.is_primary) ?? supplier.contacts?.[0]
            return <DocumentListRow key={supplier.id}>
              <TableCell className="px-4 py-3"><Link aria-label={supplier.name} href={`/suppliers/${supplier.id}`}><EntityCell name={supplier.name} secondary={t(supplier.company_id ? 'procurement.partners.suppliers.company' : 'procurement.partners.suppliers.independent')} secondaryMono={false} /></Link></TableCell>
              <TableCell className="px-4 py-3"><StatusDot status={supplier.status === "approved" ? "active" : supplier.status === "under_review" ? "review" : supplier.status === "prospect" ? "new" : supplier.status} label={valueLabel(supplier.status)} /></TableCell>
              <TableCell className="px-4 py-3"><p className="text-sm">{contact?.name || "—"}</p><p className="text-xs text-muted-foreground">{contact?.email || contact?.phone}</p></TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{formatDate(supplier.updated_at, { dateStyle: 'medium' })}</TableCell>
            </DocumentListRow>
          })}</TableBody>
        </Table></div>}
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{t('procurement.partners.suppliers.range', { count: formatNumber(result.total), from: formatNumber(offset + 1), to: formatNumber(Math.min(offset + 50, result.total)) })}</span>
          <Pagination currentPage={offset / 50 + 1} totalPages={Math.ceil(result.total / 50)} onPageChange={page => setOffset((page - 1) * 50)} /></div></>}
        {!result.can_create && <p className="text-sm text-muted-foreground">{t('procurement.partners.suppliers.readOnlyList')}</p>}
      </>}
    </ProcurementWorkspace>
    {creating && <SupplierDetail siteId={siteId} id="new" onCancel={() => setCreating(false)} />}
  </>
}
