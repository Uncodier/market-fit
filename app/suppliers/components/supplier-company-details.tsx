"use client"

import type { ReactNode } from "react"
import type { Company } from "@/app/companies/types"
import { COMPANY_INDUSTRIES, LEGAL_STRUCTURES } from "@/app/companies/types"
import { Building, Globe, Mail, Phone, MapPin, Shield, Calendar } from "@/app/components/ui/icons"
import { PropertyRow, hasPropertyValue } from "@/app/leads/components/PropertyRow"
import { safeCompanyUrl } from "./contact-links"

export function SupplierDetailProperty({ label, value, icon = <Building />, href }: {
  label: string; value: unknown; icon?: ReactNode; href?: string
}) {
  if (!hasPropertyValue(value)) return null
  const text = typeof value === "boolean" ? value ? "Yes" : "No" : String(value)
  return <PropertyRow readOnly multiline icon={icon} label={label} copyValue={text} value={
    href ? <a href={href} className="break-words text-sm hover:underline" target="_blank" rel="noopener noreferrer">{text}</a> : text
  } />
}

export function SupplierCompanyDetails({ company, section = "all" }: { company: Company; section?: "all" | "company" | "legal" | "address" }) {
  const field = (label: string, value: unknown, icon?: ReactNode, href?: string) => <SupplierDetailProperty key={label} label={label} value={value} icon={icon} href={href} />
  const address = Object.entries(company.address || {}).filter(([, value]) => hasPropertyValue(value))
  const groups = [
    { title: "Company", section: "company", rows: [
      field("Name", company.name), field("Legal name", company.legal_name),
      field("Website", company.website, <Globe />, safeCompanyUrl(company.website)),
      field("Email", company.email, <Mail />), field("Phone", company.phone, <Phone />),
      field("LinkedIn", company.linkedin_url, <Globe />, safeCompanyUrl(company.linkedin_url)),
      field("Industry", COMPANY_INDUSTRIES.find(item => item.id === company.industry)?.name || company.industry),
      field("Size", company.size), field("Employees", company.employees_count),
      field("Annual revenue", company.annual_revenue), field("Founded", company.founded, <Calendar />),
      field("Description", company.description),
    ] },
    { title: "Legal & tax", section: "legal", rows: [
      field("Tax ID", company.tax_id, <Shield />), field("Tax country", company.tax_country, <Shield />),
      field("Registration", company.registration_number, <Shield />), field("VAT number", company.vat_number, <Shield />),
      field("Legal structure", LEGAL_STRUCTURES.find(item => item.id === company.legal_structure)?.name || company.legal_structure, <Shield />),
      field("Public company", company.is_public), field("Stock symbol", company.stock_symbol),
      field("Parent company", company.parent_company_id),
    ] },
    { title: "Address", section: "address", rows: address.map(([key, value]) => field(key.replaceAll("_", " "), value, <MapPin />)) },
    { title: "Company record", section: "company", rows: [field("Company ID", company.id), field("Created", company.created_at, <Calendar />), field("Updated", company.updated_at, <Calendar />)] },
  ]
  return <div className="space-y-5">{groups.filter(group => section === "all" || group.section === section).map(group => <section key={group.title} aria-label={group.title}>
    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.title}</h3>
    <div className="space-y-1">{group.rows}</div>
    {group.section === "address" && !address.length && <p className="text-xs text-muted-foreground">No company address recorded.</p>}
  </section>)}</div>
}