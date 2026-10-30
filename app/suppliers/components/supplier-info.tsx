"use client"

import { Building, User, Shield, Mail, Phone, FileText } from "@/app/components/ui/icons"
import { PropertyRow } from "@/app/leads/components/PropertyRow"
import { useProcurementI18n } from "@/app/purchases/procurement/i18n/use-procurement-i18n"
import { SupplierReferenceProperty } from "./supplier-reference-property"
import type { Company } from "@/app/companies/types"
import type { Supplier, SupplierInput } from "../schema"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { SupplierCompanyDetails, SupplierDetailProperty } from "./supplier-company-details"
import { SupplierContactActions } from "./supplier-contact-actions"
import { SupplierEditableProperty } from "./supplier-editable-property"

/** Lead-style tabs and inline edits backed by the existing versioned supplier draft. */
export function SupplierInfo({ siteId, value, onChange, disabled, supplier, company, companyLoading, companyError, onRetryCompany }: {
  siteId: string; value: SupplierInput; onChange: (value: SupplierInput) => void; disabled: boolean
  supplier?: Supplier | null; company?: Company | null; companyLoading?: boolean; companyError?: string; onRetryCompany?: () => void
}) {
  const { t } = useProcurementI18n()
  const companyState = <>
    {companyLoading && <div role="status" aria-label="Loading company details" className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-24 w-full" /></div>}
    {companyError && <div role="alert" className="space-y-2 text-xs"><p>{companyError}</p><Button type="button" variant="outline" size="sm" onClick={onRetryCompany}>Retry company details</Button></div>}
    {!company && !companyLoading && !companyError && <p className="text-xs text-muted-foreground">{value.company_id ? "No additional company details are available." : "No company linked."}</p>}
  </>
  return <div className="w-full min-w-0">
    <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('procurement.partners.form.identity')}</h3>
    <Tabs defaultValue="info" className="w-full min-w-0">
      <TabsList aria-label="Supplier details" className="h-8 p-0.5 bg-muted/30 rounded-full w-full justify-start overflow-x-auto mb-3">
        {[
          ["info", "Info"], ["company", "Company"], ["contacts", "Contacts"], ["notes", "Notes"],
        ].map(([tab, label]) => <TabsTrigger key={tab} value={tab} className="h-7 px-3 rounded-full text-xs font-medium">
          {label}{tab === "notes" && value.private_notes.trim() && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
        </TabsTrigger>)}
      </TabsList>
      <TabsContent value="info" className="mt-0 min-w-0 space-y-4">
        <div className="grid min-w-0">
          <SupplierEditableProperty icon={<User />} label={t('procurement.partners.form.supplierName')} value={value.name} disabled={disabled} required onChange={name => onChange({ ...value, name })} />
          <SupplierReferenceProperty disabled={disabled} siteId={siteId} kind="categories" selected={value.category_ids} onChange={category_ids => onChange({ ...value, category_ids })} />
        </div>
        <section aria-label="Supplier record">
          <SupplierDetailProperty label="Type" value={value.company_id ? "Company" : "Independent professional"} />
          <SupplierDetailProperty label="Version" value={value.expected_version} />
          <SupplierDetailProperty label="Supplier ID" value={supplier?.id} />
          <SupplierDetailProperty label="Created" value={supplier?.created_at} />
          <SupplierDetailProperty label="Updated" value={supplier?.updated_at} />
        </section>
        <p className="text-xs text-muted-foreground">{t('procurement.partners.form.identityHint')}</p>
        {companyState}
        {company && <div className="space-y-5">
          <SupplierCompanyDetails company={company} section="address" />
          <SupplierCompanyDetails company={company} section="legal" />
        </div>}
      </TabsContent>
      <TabsContent value="company" className="mt-0 min-w-0 space-y-4">
        <SupplierReferenceProperty disabled={disabled} siteId={siteId} kind="companies" selected={value.company_id ? [value.company_id] : []} onChange={ids => onChange({ ...value, company_id: ids[0] ?? null })} />
        {companyState}
        {company && <><p className="text-xs text-muted-foreground">Linked company profile · Read-only in supplier details.</p><SupplierCompanyDetails company={company} section="company" /></>}
      </TabsContent>
      <TabsContent value="contacts" className="mt-0 min-w-0">
        {!value.contacts.length && <p className="text-xs text-muted-foreground">No supplier contacts recorded.</p>}
        {value.contacts.map((contact, index) => {
          const update = (patch: Partial<typeof contact>) => onChange({ ...value, contacts: value.contacts.map((item, row) => row === index ? { ...item, ...patch } : patch.is_primary ? { ...item, is_primary: false } : item) })
          return <section key={index} aria-label={`Contact ${index + 1}`} className="border-b border-border/50 py-3 first:pt-0 last:border-0">
            <SupplierEditableProperty icon={<User />} label="Name" value={contact.name} disabled={disabled} required onChange={name => update({ name })} />
            <SupplierEditableProperty icon={<Building />} label="Role" value={contact.role} disabled={disabled} maxLength={120} onChange={role => update({ role })} />
            <SupplierEditableProperty icon={<Mail />} label="Email" value={contact.email} disabled={disabled} type="email" maxLength={254} onChange={email => update({ email })} />
            <SupplierEditableProperty icon={<Phone />} label="Phone" value={contact.phone} disabled={disabled} type="tel" maxLength={60} onChange={phone => update({ phone })} />
            <PropertyRow readOnly={disabled} icon={<Shield />} label="Primary" value={contact.is_primary ? "Yes" : "No"} editValue={contact.is_primary}
              onCommit={async is_primary => { if (!disabled) update({ is_primary }) }}
              renderEditor={(draft, setDraft) => <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" disabled={disabled} checked={draft} onChange={event => setDraft(event.target.checked)} />Primary contact</label>} />
            <SupplierContactActions email={contact.email} phone={contact.phone} />
          </section>
        })}
      </TabsContent>
      <TabsContent value="notes" className="mt-0 min-w-0 space-y-3">
        <SupplierEditableProperty icon={<FileText />} label={t('procurement.partners.form.terms')} value={value.commercial_terms} disabled={disabled} multiline maxLength={10000} onChange={commercial_terms => onChange({ ...value, commercial_terms })} />
        <SupplierEditableProperty icon={<FileText />} label={t('procurement.partners.form.notes')} value={value.private_notes} disabled={disabled} multiline maxLength={20000} onChange={private_notes => onChange({ ...value, private_notes })} />
        <p className="text-xs text-muted-foreground">{t('procurement.partners.form.notesHint')}</p>
      </TabsContent>
    </Tabs>
    {!disabled && <p className="mt-6 text-[11px] text-muted-foreground">Apply inline edits, then choose Save changes to save the supplier.</p>}
  </div>
}