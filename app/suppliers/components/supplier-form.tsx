"use client"

import { useId } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { SectionCard, SectionCardHeader, SectionCardContent } from "@/app/components/ui/section-card"
import { Choice } from "@/app/purchases/procurement/components/form-fields"
import { Badge } from "@/app/components/ui/badge"
import type { SupplierContact, SupplierInput } from "../schema"
import { SupplierReferencePicker } from "./reference-picker"
import { SupplierContacts } from "./supplier-contacts"

export function SupplierForm({ siteId, value, onChange, disabled, section = "all" }: {
  siteId: string; value: SupplierInput; onChange: (value: SupplierInput) => void; disabled: boolean; section?: "all" | "about" | "contacts"
}) {
  const id = useId()
  const editContact = (index: number, patch: Partial<SupplierContact>) => onChange({ ...value,
    contacts: value.contacts.map((contact, row) => row === index ? { ...contact, ...patch }
      : patch.is_primary ? { ...contact, is_primary: false } : contact) })
  return <fieldset disabled={disabled} className="space-y-6">
    {section !== "contacts" && <SectionCard>
      <SectionCardHeader title="Supplier identity" />
      <SectionCardContent className="space-y-4">
      <div className="space-y-2"><label htmlFor={`${id}-name`}>Supplier name</label>
        <Input id={`${id}-name`} required maxLength={200} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></div>
      <p className="text-sm text-muted-foreground">A company or an independent professional. No CRM lead is created. Linking a company does not grant account access.</p>
      {value.expected_version > 0 && value.status !== "archived" && <div className="space-y-2">
        <Choice disabled={disabled} label="Workspace approval status" value={value.status} options={["prospect", "under_review", "approved", "blocked"]} onChange={status => onChange({ ...value, status })} />
        <p className="text-sm text-muted-foreground">Approval applies only to this buyer workspace. It does not verify account representation or grant portal access.</p>
      </div>}
      {value.expected_version === 0 && <p className="text-sm text-muted-foreground">New suppliers start as prospects. Registration does not approve a supplier.</p>}
      <SupplierReferencePicker disabled={disabled} siteId={siteId} kind="companies" selected={value.company_id ? [value.company_id] : []} onChange={ids => onChange({ ...value, company_id: ids[0] ?? null })} />
      <SupplierReferencePicker disabled={disabled} siteId={siteId} kind="categories" selected={value.category_ids} onChange={ids => onChange({ ...value, category_ids: ids })} />
      </SectionCardContent>
    </SectionCard>}
    {section === "contacts" && <SupplierContacts contacts={value.contacts} disabled={disabled} onChange={contacts => onChange({ ...value, contacts })} />}
    {section === "all" && <SectionCard>
      <SectionCardHeader title="Contacts" />
      <SectionCardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Contact details are private to this workspace. Contacts are not account representatives or portal users.</p>
      {value.contacts.map((contact, index) => <fieldset key={index} className="space-y-3 rounded border p-3">
        <legend className="px-1 text-sm">Contact {index + 1} {contact.is_primary && <Badge variant="secondary">Primary</Badge>}</legend>
        <div className="grid gap-3 md:grid-cols-2">{(["name", "email", "phone", "role"] as const).map(field => <div key={field} className="space-y-1">
          <label htmlFor={`${id}-${index}-${field}`} className="capitalize">{field === "role" ? "Relationship role" : field}</label>
          <Input id={`${id}-${index}-${field}`} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
            required={field === "name"} maxLength={{ name: 200, email: 254, phone: 60, role: 120 }[field]}
            value={contact[field]} onChange={event => editContact(index, { [field]: event.target.value })} />
        </div>)}</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={contact.is_primary} onChange={event => editContact(index, { is_primary: event.target.checked })} />Primary contact</label>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, contacts: value.contacts.filter((_, row) => row !== index) })}>Remove contact {index + 1}</Button>
      </fieldset>)}
      {value.contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts added.</p>}
      <Button type="button" variant="outline" disabled={value.contacts.length >= 50} onClick={() => onChange({ ...value, contacts: [...value.contacts, { name: "", email: "", phone: "", role: "", is_primary: value.contacts.length === 0 }] })}>Add contact</Button>
      </SectionCardContent>
    </SectionCard>}
    {section !== "contacts" && <SectionCard>
      <SectionCardHeader title="Commercial relationship" />
      <SectionCardContent className="space-y-4">
      <div className="space-y-2"><label htmlFor={`${id}-terms`}>Commercial terms</label>
        <Textarea id={`${id}-terms`} rows={5} maxLength={10000} placeholder="Payment terms, delivery conditions, minimum orders…" value={value.commercial_terms} onChange={event => onChange({ ...value, commercial_terms: event.target.value })} /></div>
      <div className="space-y-2"><label htmlFor={`${id}-notes`}>Private workspace notes</label>
        <Textarea id={`${id}-notes`} rows={5} maxLength={20000} value={value.private_notes} onChange={event => onChange({ ...value, private_notes: event.target.value })} />
        <p className="text-sm text-muted-foreground">Visible to authorized workspace members only. Never shared with the supplier.</p></div>
      </SectionCardContent>
    </SectionCard>}
  </fieldset>
}