"use client"

import { useId } from "react"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Users, FileText } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { SectionCard, SectionCardHeader, SectionCardContent } from "@/app/components/ui/section-card"
import { Choice } from "@/app/purchases/procurement/components/form-fields"
import { Badge } from "@/app/components/ui/badge"
import type { SupplierContact, SupplierInput } from "../schema"
import { SupplierReferencePicker } from "./reference-picker"
import { SupplierContacts } from "./supplier-contacts"
import { SupplierInfo } from "./supplier-info"
import { SupplierEditableProperty } from "./supplier-editable-property"
import type { Company } from "@/app/companies/types"
import type { Supplier } from "../schema"
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export function SupplierForm({ siteId, value, onChange, disabled, section = "all", supplier, company, companyLoading, companyError, onRetryCompany }: {
  siteId: string; value: SupplierInput; onChange: (value: SupplierInput) => void; disabled: boolean; section?: "all" | "about" | "contacts" | "identity" | "relationship"
  supplier?: Supplier | null; company?: Company | null; companyLoading?: boolean; companyError?: string; onRetryCompany?: () => void
}) {
  const { t, formatNumber } = useProcurementI18n()
  const id = useId()
  const editContact = (index: number, patch: Partial<SupplierContact>) => onChange({ ...value,
    contacts: value.contacts.map((contact, row) => row === index ? { ...contact, ...patch }
      : patch.is_primary ? { ...contact, is_primary: false } : contact) })
  if (section === "identity") return <div className="min-w-0">
    <SupplierInfo siteId={siteId} value={value} onChange={onChange} disabled={disabled} supplier={supplier} company={company} companyLoading={companyLoading} companyError={companyError} onRetryCompany={onRetryCompany} />
  </div>
  if (section === "relationship") return <SectionCard className="min-w-0 overflow-visible rounded-none border-0 bg-transparent shadow-none">
    <SectionCardHeader className="px-0 pb-3 pt-0 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground" title={t('procurement.partners.form.relationship')} />
    <SectionCardContent className="space-y-3 px-0 pb-0">
      <SupplierEditableProperty icon={<FileText />} label={t('procurement.partners.form.terms')} value={value.commercial_terms} disabled={disabled} multiline maxLength={10000} onChange={commercial_terms => onChange({ ...value, commercial_terms })} />
      <SupplierEditableProperty icon={<FileText />} label={t('procurement.partners.form.notes')} value={value.private_notes} disabled={disabled} multiline maxLength={20000} onChange={private_notes => onChange({ ...value, private_notes })} />
      <p className="text-xs text-muted-foreground">{t('procurement.partners.form.notesHint')}</p>
    </SectionCardContent>
  </SectionCard>
  return <fieldset disabled={disabled} className="space-y-6">
    {section !== "contacts" && <SectionCard>
      <SectionCardHeader title={t('procurement.partners.form.identity')} />
      <SectionCardContent className="space-y-4">
      <div className="space-y-2"><label htmlFor={`${id}-name`}>{t('procurement.partners.form.supplierName')}</label>
        <Input id={`${id}-name`} required maxLength={200} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></div>
      <p className="text-sm text-muted-foreground">{t('procurement.partners.form.identityHint')}</p>
      {value.expected_version > 0 && value.status !== "archived" && <div className="space-y-2">
        <Choice disabled={disabled} label={t('procurement.partners.form.approvalStatus')} value={value.status} options={["prospect", "under_review", "approved", "blocked"]} onChange={status => onChange({ ...value, status })} />
        <p className="text-sm text-muted-foreground">{t('procurement.partners.form.approvalHint')}</p>
      </div>}
      {value.expected_version === 0 && <p className="text-sm text-muted-foreground">{t('procurement.partners.form.prospectHint')}</p>}
      <SupplierReferencePicker disabled={disabled} siteId={siteId} kind="companies" selected={value.company_id ? [value.company_id] : []} onChange={ids => onChange({ ...value, company_id: ids[0] ?? null })} />
      <SupplierReferencePicker disabled={disabled} siteId={siteId} kind="categories" selected={value.category_ids} onChange={ids => onChange({ ...value, category_ids: ids })} />
      </SectionCardContent>
    </SectionCard>}
    {section === "contacts" && <SupplierContacts contacts={value.contacts} disabled={disabled} onChange={contacts => onChange({ ...value, contacts })} />}
    {section === "all" && <SectionCard>
      <SectionCardHeader title={t('procurement.partners.contacts.title')} />
      <SectionCardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('procurement.partners.form.contactsHint')}</p>
      {value.contacts.map((contact, index) => <fieldset key={index} className="space-y-3 rounded border p-3">
        <legend className="px-1 text-sm">{t('procurement.partners.contacts.numbered', { number: formatNumber(index + 1) })} {contact.is_primary && <Badge variant="secondary">{t('procurement.partners.contacts.primary')}</Badge>}</legend>
        <div className="grid gap-3 md:grid-cols-2">{(["name", "email", "phone", "role"] as const).map(field => <div key={field} className="space-y-1">
          <label htmlFor={`${id}-${index}-${field}`} className="capitalize">{t(`procurement.partners.contacts.fields.${field}`)}</label>
          <Input id={`${id}-${index}-${field}`} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
            required={field === "name"} maxLength={{ name: 200, email: 254, phone: 60, role: 120 }[field]}
            value={contact[field]} onChange={event => editContact(index, { [field]: event.target.value })} />
        </div>)}</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={contact.is_primary} onChange={event => editContact(index, { is_primary: event.target.checked })} />{t('procurement.partners.contacts.primaryContact')}</label>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, contacts: value.contacts.filter((_, row) => row !== index) })}>{t('procurement.partners.contacts.removeNumbered', { number: formatNumber(index + 1) })}</Button>
      </fieldset>)}
      {value.contacts.length === 0 && <EmptyCard icon={<Users size={24} />} title={t('procurement.partners.contacts.empty')}
        description="" showHint={false} showShadow={false} contentClassName="min-h-0 py-6" />}
      <Button type="button" variant="outline" disabled={value.contacts.length >= 50} onClick={() => onChange({ ...value, contacts: [...value.contacts, { name: "", email: "", phone: "", role: "", is_primary: value.contacts.length === 0 }] })}>{t('procurement.partners.contacts.add')}</Button>
      </SectionCardContent>
    </SectionCard>}
    {section !== "contacts" && <SectionCard>
      <SectionCardHeader title={t('procurement.partners.form.relationship')} />
      <SectionCardContent className="space-y-4">
      <div className="space-y-2"><label className="text-sm font-medium" htmlFor={`${id}-terms`}>{t('procurement.partners.form.terms')}</label>
        <Textarea id={`${id}-terms`} rows={5} maxLength={10000} placeholder={t('procurement.partners.form.termsPlaceholder')} value={value.commercial_terms} onChange={event => onChange({ ...value, commercial_terms: event.target.value })} /></div>
      <div className="space-y-2"><label className="text-sm font-medium" htmlFor={`${id}-notes`}>{t('procurement.partners.form.notes')}</label>
        <Textarea id={`${id}-notes`} rows={5} maxLength={20000} value={value.private_notes} onChange={event => onChange({ ...value, private_notes: event.target.value })} />
        <p className="text-sm text-muted-foreground">{t('procurement.partners.form.notesHint')}</p></div>
      </SectionCardContent>
    </SectionCard>}
  </fieldset>
}