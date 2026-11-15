"use client"

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import type { ReactNode } from "react"
import type { Company } from "@/app/companies/types"
import { COMPANY_INDUSTRIES, LEGAL_STRUCTURES } from "@/app/companies/types"
import { Building, Globe, Mail, Phone, MapPin, Shield, Calendar } from "@/app/components/ui/icons"
import { PropertyRow, hasPropertyValue } from "@/app/leads/components/PropertyRow"
import { safeCompanyUrl } from "./contact-links"

export function SupplierDetailProperty({ label, value, icon = <Building />, href }: {
  label: string; value: unknown; icon?: ReactNode; href?: string
}) {
  const { t } = useProcurementI18n()
  if (!hasPropertyValue(value)) return null
  const text = typeof value === "boolean" ? value ? t('procurement.workflow.snapshot.yes') : t('procurement.workflow.snapshot.no') : String(value)
  return <PropertyRow readOnly multiline icon={icon} label={label} copyValue={text} value={
    href ? <a href={href} className="break-words text-sm hover:underline" target="_blank" rel="noopener noreferrer">{text}</a> : text
  } />
}

export function SupplierCompanyDetails({ company, section = "all" }: { company: Company; section?: "all" | "company" | "legal" | "address" }) {
  const { t } = useProcurementI18n()
  const field = (label: string, value: unknown, icon?: ReactNode, href?: string) => <SupplierDetailProperty key={label} label={label} value={value} icon={icon} href={href} />
  const addressLabel = (key: string) => {
    const messageKey = `procurement.surfaces.suppliers.addressFields.${key}`
    const translated = t(messageKey)
    return translated === messageKey ? key.replaceAll("_", " ") : translated
  }
  const address = Object.entries(company.address || {}).filter(([, value]) => hasPropertyValue(value))
  const groups = [
    { title: t('procurement.surfaces.suppliers.company'), section: "company", rows: [
      field(t('procurement.partners.contacts.fields.name'), company.name), field(t('procurement.surfaces.suppliers.legalName'), company.legal_name),
      field(t('procurement.surfaces.suppliers.website'), company.website, <Globe />, safeCompanyUrl(company.website)),
      field(t('procurement.quoteDetail.email'), company.email, <Mail />), field(t('procurement.quoteDetail.phone'), company.phone, <Phone />),
      field("LinkedIn", company.linkedin_url, <Globe />, safeCompanyUrl(company.linkedin_url)),
      field(t('procurement.surfaces.suppliers.industry'), COMPANY_INDUSTRIES.find(item => item.id === company.industry)?.name || company.industry),
      field(t('procurement.surfaces.suppliers.size'), company.size), field(t('procurement.surfaces.suppliers.employees'), company.employees_count),
      field(t('procurement.surfaces.suppliers.revenue'), company.annual_revenue), field(t('procurement.surfaces.suppliers.founded'), company.founded, <Calendar />),
      field(t('procurement.workflow.common.description'), company.description),
    ] },
    { title: t('procurement.surfaces.suppliers.legalTax'), section: "legal", rows: [
      field(t('procurement.surfaces.suppliers.taxId'), company.tax_id, <Shield />), field(t('procurement.surfaces.suppliers.taxCountry'), company.tax_country, <Shield />),
      field(t('procurement.surfaces.suppliers.registration'), company.registration_number, <Shield />), field(t('procurement.surfaces.suppliers.vat'), company.vat_number, <Shield />),
      field(t('procurement.surfaces.suppliers.legalStructure'), LEGAL_STRUCTURES.find(item => item.id === company.legal_structure)?.name || company.legal_structure, <Shield />),
      field(t('procurement.surfaces.suppliers.publicCompany'), company.is_public), field(t('procurement.surfaces.suppliers.stock'), company.stock_symbol),
      field(t('procurement.surfaces.suppliers.parent'), company.parent_company_id),
    ] },
    { title: t('procurement.surfaces.suppliers.address'), section: "address", rows: address.map(([key, value]) => field(addressLabel(key), value, <MapPin />)) },
    { title: t('procurement.surfaces.suppliers.companyRecord'), section: "company", rows: [field(t('procurement.surfaces.suppliers.companyId'), company.id), field(t('procurement.partners.orders.created'), company.created_at, <Calendar />), field(t('procurement.workflow.common.updated'), company.updated_at, <Calendar />)] },
  ]
  return <div className="space-y-5">{groups.filter(group => section === "all" || group.section === section).map(group => <section key={group.title} aria-label={group.title}>
    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.title}</h3>
    <div className="space-y-1">{group.rows}</div>
    {group.section === "address" && !address.length && <p className="text-xs text-muted-foreground">{t('procurement.surfaces.suppliers.noAddress')}</p>}
  </section>)}</div>
}