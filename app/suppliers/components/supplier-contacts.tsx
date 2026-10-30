"use client"

import { useId, useState } from "react"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Users } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Checkbox } from "@/app/components/ui/checkbox"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { SectionCard, SectionCardHeader, SectionCardContent } from "@/app/components/ui/section-card"
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import type { SupplierContact } from "../schema"
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { SupplierContactActions } from "./supplier-contact-actions"

export function SupplierContacts({ contacts, disabled, onChange }: {
  contacts: SupplierContact[]; disabled: boolean; onChange: (contacts: SupplierContact[]) => void
}) {
  const { t } = useProcurementI18n()
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
  return <SectionCard className="min-w-0 overflow-visible rounded-none border-0 bg-transparent shadow-none">
    <SectionCardHeader className="px-0 pb-3 pt-0 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground" title={t('procurement.partners.contacts.title')} description={t('procurement.partners.contacts.description')} />
    <SectionCardContent className="px-0 pb-0">
      {!contacts.length && <EmptyCard icon={<Users size={24} />} title={t('procurement.partners.contacts.empty')}
        description="" showHint={false} showShadow={false} contentClassName="min-h-0 py-6" />}
      <ul className="divide-y divide-border/60">{contacts.map((contact, index) => <li key={index} className="flex flex-wrap items-center gap-3 py-4">
        <EntityAvatar name={contact.name} />
        <div className="min-w-0 flex-1"><div className="text-sm font-medium">{contact.name || t('procurement.partners.contacts.unnamed')} {contact.is_primary && <Badge variant="secondary" className="ml-2">{t('procurement.partners.contacts.primary')}</Badge>}</div>
          <p className="break-words text-xs text-muted-foreground">{[contact.role, contact.email, contact.phone].filter(Boolean).join(" · ") || t('procurement.partners.contacts.noDetails')}</p></div>
        <SupplierContactActions email={contact.email} phone={contact.phone} />
        {!disabled && <div className="flex gap-1"><Button type="button" variant="ghost" size="sm" aria-label={t('procurement.partners.actions.editNamed', { name: contact.name })} onClick={() => setEditing({ index, contact: { ...contact } })}>{t('procurement.partners.actions.edit')}</Button>
          <Button type="button" variant="ghost" size="sm" aria-label={t('procurement.partners.actions.removeNamed', { name: contact.name })} onClick={() => setRemoving(index)}>{t('procurement.partners.actions.remove')}</Button></div>}
      </li>)}</ul>
    </SectionCardContent>
    <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null) }}>
      <DialogContent size="md"><DialogForm onSubmit={event => { event.preventDefault(); commit() }}>
        <DialogHeader><DialogTitle>{t(editing?.index === contacts.length ? 'procurement.partners.contacts.add' : 'procurement.partners.contacts.edit')}</DialogTitle><DialogDescription>{t('procurement.partners.contacts.privateHint')}</DialogDescription></DialogHeader>
        <DialogBody className="space-y-4">{editing && <>
          {(["name", "email", "phone", "role"] as const).map(field => <div key={field} className="space-y-2">
            <label htmlFor={`${id}-${field}`} className="text-sm font-medium capitalize">{t(`procurement.partners.contacts.fields.${field}`)}</label>
            <Input id={`${id}-${field}`} required={field === "name"} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
              maxLength={{ name: 200, email: 254, phone: 60, role: 120 }[field]} value={editing.contact[field]}
              onChange={event => setEditing({ ...editing, contact: { ...editing.contact, [field]: event.target.value } })} />
          </div>)}
          <div className="flex items-center gap-2"><Checkbox id={`${id}-primary`} checked={editing.contact.is_primary} onCheckedChange={checked => setEditing({ ...editing, contact: { ...editing.contact, is_primary: checked === true } })} /><label htmlFor={`${id}-primary`} className="text-sm">{t('procurement.partners.contacts.primaryContact')}</label></div>
        </>}</DialogBody>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>{t('procurement.common.cancel')}</Button><Button type="submit" disabled={disabled}>{t('procurement.partners.contacts.apply')}</Button></DialogFooter>
      </DialogForm></DialogContent>
    </Dialog>
    <ConfirmDialog open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null) }} title={t('procurement.partners.contacts.removeTitle')} description={t('procurement.partners.contacts.removeHint')}
      confirmLabel={t('procurement.partners.contacts.remove')} cancelLabel={t('procurement.common.cancel')} onConfirm={async () => { if (removing !== null && !disabled) onChange(contacts.filter((_, index) => index !== removing)); setRemoving(null) }} />
  </SectionCard>
}