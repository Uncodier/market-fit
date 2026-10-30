"use client"

import Link from "next/link"
import { EntityCell } from "@/app/components/documents/document-list"
import { useProcurementI18n } from "@/app/purchases/procurement/i18n/use-procurement-i18n"
import type { Supplier } from "../schema"

const stages: Supplier["status"][] = ["prospect", "under_review", "approved", "blocked", "archived"]

/** A read-only board of the current API page; status changes still use the authorized detail form. */
export function SupplierBoard({ suppliers, status }: { suppliers: Supplier[]; status: string }) {
  const { t, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  return <div className="flex min-w-0 gap-4 overflow-x-auto pb-4">
    {stages.filter(stage => status === "all" || stage === status).map(stage => {
      const rows = suppliers.filter(supplier => supplier.status === stage)
      return <section key={stage} aria-label={valueLabel(stage)} className="min-w-72 flex-1 rounded-xl bg-muted/60 p-3">
        <h2 className="mb-3 flex items-center justify-between gap-3 text-sm font-medium">
          {valueLabel(stage)}<span className="rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground">{formatNumber(rows.length)}</span>
        </h2>
        <div className="space-y-3">{rows.map(supplier => {
          const contact = supplier.contacts.find(contact => contact.is_primary) ?? supplier.contacts[0]
          return <Link key={supplier.id} aria-label={supplier.name} href={`/suppliers/${supplier.id}`}
            className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <EntityCell name={supplier.name} secondary={t(supplier.company_id ? 'procurement.partners.suppliers.company' : 'procurement.partners.suppliers.independent')} secondaryMono={false} />
            {contact && <div className="mt-4 text-sm"><p>{contact.name}</p><p className="truncate text-xs text-muted-foreground">{contact.email || contact.phone}</p></div>}
            <p className="mt-4 text-xs text-muted-foreground">{t('procurement.partners.suppliers.updated')} · {formatDate(supplier.updated_at, { dateStyle: 'medium' })}</p>
          </Link>
        })}</div>
      </section>
    })}
  </div>
}