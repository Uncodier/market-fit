"use client"

import { ProcurementListLoading } from '@/app/purchases/procurement/ui/list-loading'
import { SupplierDetailSkeleton } from './supplier-detail-skeleton'
import { ProcurementEditorLoading } from '@/app/purchases/procurement/ui/editor-loading'
import { useSite } from "@/app/context/SiteContext"
import { isDemoModeActive, isDemoSiteId, isRealSiteId } from "@/lib/demo-utils"
import { SupplierList } from "./supplier-list"
import { SupplierDetail } from "./supplier-detail"
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export function SuppliersWorkspace({ id }: { id?: string }) {
  const { t } = useProcurementI18n()
  const { currentSite } = useSite()
  if (!currentSite) return id === 'new' ? <ProcurementEditorLoading /> : id ? <SupplierDetailSkeleton /> : <ProcurementListLoading />
  if (!isDemoSiteId(currentSite.id) && (!isRealSiteId(currentSite.id) || isDemoModeActive())) {
    return <div className="p-6">{t('procurement.partners.suppliers.realWorkspace')}</div>
  }
  return <main className="h-full min-w-0 w-full" key={`${currentSite.id}:${id ?? "list"}`}>
    {id ? <SupplierDetail siteId={currentSite.id} id={id} /> : <SupplierList siteId={currentSite.id} />}
  </main>
}