"use client"

import { useId, useState } from "react"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Checkbox } from "@/app/components/ui/checkbox"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { SectionCard, SectionCardHeader, SectionCardContent } from "@/app/components/ui/section-card"
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import type { SupplierContact } from "../schema"

export function SupplierContacts({ contacts, disabled, onChange }: {
  contacts: SupplierContact[]; disabled: boolean; onChange: (contacts: SupplierContact[]) => void
}) {
  const id = useId()
  const [editing, setEditing] = useState<{ index: number; contact: SupplierContact } | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const commit = () => {
    if (!editing || disabled) return
    const next = contacts.map((contact, index) => index === editing.index ? editing.contact
      : editing.contact.is_primary ? { ...contact, is_primary: false } : contact)
    if (editing.index === contacts.length) next.push(editing.contact)
    onChange(next)
    setEditing(null)
  }
  return <SectionCard>
    <SectionCardHeader title="Contacts" description="Private relationship contacts, not account representatives. Save supplier changes to persist edits."
      actions={<Button type="button" variant="outline" size="sm" disabled={disabled || contacts.length >= 50} onClick={() => setEditing({ index: contacts.length, contact: { name: "", email: "", phone: "", role: "", is_primary: contacts.length === 0 } })}>Add contact</Button>} />
    <SectionCardContent>
      {!contacts.length && <p className="py-6 text-center text-sm text-muted-foreground">No contacts added.</p>}
      <ul className="divide-y divide-border/60">{contacts.map((contact, index) => <li key={index} className="flex flex-wrap items-center gap-3 py-4">
        <EntityAvatar name={contact.name} />
        <div className="min-w-0 flex-1"><div className="text-sm font-medium">{contact.name || "Unnamed contact"} {contact.is_primary && <Badge variant="secondary" className="ml-2">Primary</Badge>}</div>
          <p className="text-xs text-muted-foreground">{[contact.role, contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details"}</p></div>
        {!disabled && <div className="flex gap-1"><Button type="button" variant="ghost" size="sm" aria-label={`Edit ${contact.name}`} onClick={() => setEditing({ index, contact: { ...contact } })}>Edit</Button>
          <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${contact.name}`} onClick={() => setRemoving(index)}>Remove</Button></div>}
      </li>)}</ul>
    </SectionCardContent>
    <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null) }}>
      <DialogContent size="md"><DialogForm onSubmit={event => { event.preventDefault(); commit() }}>
        <DialogHeader><DialogTitle>{editing?.index === contacts.length ? "Add contact" : "Edit contact"}</DialogTitle><DialogDescription>Contact details remain private to this workspace.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-4">{editing && <>
          {(["name", "email", "phone", "role"] as const).map(field => <div key={field} className="space-y-2">
            <label htmlFor={`${id}-${field}`} className="text-sm font-medium capitalize">{field === "role" ? "Relationship role" : field}</label>
            <Input id={`${id}-${field}`} required={field === "name"} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
              maxLength={{ name: 200, email: 254, phone: 60, role: 120 }[field]} value={editing.contact[field]}
              onChange={event => setEditing({ ...editing, contact: { ...editing.contact, [field]: event.target.value } })} />
          </div>)}
          <div className="flex items-center gap-2"><Checkbox id={`${id}-primary`} checked={editing.contact.is_primary} onCheckedChange={checked => setEditing({ ...editing, contact: { ...editing.contact, is_primary: checked === true } })} /><label htmlFor={`${id}-primary`} className="text-sm">Primary contact</label></div>
        </>}</DialogBody>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={disabled}>Apply contact</Button></DialogFooter>
      </DialogForm></DialogContent>
    </Dialog>
    <ConfirmDialog open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null) }} title="Remove this contact?" description="The contact will be removed when you save the supplier. Account representation is unchanged."
      confirmLabel="Remove contact" onConfirm={async () => { if (removing !== null && !disabled) onChange(contacts.filter((_, index) => index !== removing)); setRemoving(null) }} />
  </SectionCard>
}