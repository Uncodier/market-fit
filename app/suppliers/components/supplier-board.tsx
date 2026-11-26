"use client"

import { DetailViewLink } from "@/app/components/navigation/DetailViewLink"
import { EntityCell } from "@/app/components/documents/document-list"
import { useProcurementI18n } from "@/app/purchases/procurement/i18n/use-procurement-i18n"
import type { Supplier } from "../schema"
import { Card, CardFooter } from '@/app/components/ui/card'
import { SupplierMessageOptions } from './supplier-message-options'

const stages: Supplier["status"][] = ["prospect", "under_review", "approved", "blocked", "archived"]

/** A board of the current API page; status changes still use the authorized detail form. */
export function SupplierBoard({ suppliers, status, canMessage, siteId }: { suppliers: Supplier[]; status: string; canMessage: boolean; siteId?: string }) {
  const { t, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  return <div className="flex min-w-0 gap-4 overflow-x-auto pb-4">
    {stages.filter(stage => status === "all" || stage === status).map(stage => {
      const rows = suppliers.filter(supplier => supplier.status === stage)
      return <section key={stage} aria-label={valueLabel(stage)} className="min-w-72 flex-1 rounded-xl bg-muted/60 p-3">
        <h2 className="mb-3 flex items-center justify-between gap-3 text-sm font-medium">
          {valueLabel(stage)}<span className="rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground">{formatNumber(rows.length)}</span>
        </h2>
        <div className="space-y-3">{rows.map(supplier => {
          const contact = supplier.contacts?.find(contact => contact.is_primary) ?? supplier.contacts?.[0]
          return <Card key={supplier.id} className="rounded-xl transition-colors hover:border-primary/30">
          <DetailViewLink aria-label={supplier.name} href={`/suppliers/${supplier.id}`} siteId={siteId}
            paths={() => stages.flatMap(stage => suppliers.filter(item => item.status === stage && (status === "all" || stage === status)).map(item => `/suppliers/${item.id}`))}
            className="block rounded-t-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <EntityCell name={supplier.name} secondary={t(supplier.company_id ? 'procurement.partners.suppliers.company' : 'procurement.partners.suppliers.independent')} secondaryMono={false} />
            {contact && <div className="mt-4 text-sm"><p>{contact.name}</p><p className="truncate text-xs text-muted-foreground">{contact.email || contact.phone}</p></div>}
          </DetailViewLink>
          <CardFooter data-slot="supplier-card-footer" className="min-h-11 justify-between gap-2 rounded-b-xl border-t bg-muted/30 px-4 py-1">
            <p className="min-w-0 text-xs text-muted-foreground">{t('procurement.partners.suppliers.updated')} · {formatDate(supplier.updated_at, { dateStyle: 'medium' })}</p>
            {canMessage && <SupplierMessageOptions supplier={supplier} allowed />}
          </CardFooter>
          </Card>
        })}</div>
      </section>
    })}
  </div>
}