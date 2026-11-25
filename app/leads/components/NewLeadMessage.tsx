"use client"

import { useId, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { ChannelSelector } from '@/app/components/chat/ChannelSelector'
import { sendTeamMemberIntervention } from '@/app/services/chat-send'
import { InterventionRequestError } from '@/app/services/mark-intervention-message-failed'
import { leadMessageMediaType, newLeadMessageChannels, newLeadMessageSchema, newSupplierMessageSchema } from '@/lib/chat/new-lead-message'
import { getChannelLabel, type SiteChannelSource } from '@/lib/site-channels'
import type { Lead } from '../types'
import { LeadMessageAttachment, type LeadMessageAsset } from './LeadMessageAttachment'
import { supplierMessageContacts, type SupplierMessageRecipient } from '@/app/suppliers/supplier-message-recipient'

export type LeadMessageRecipient = Pick<Lead, 'id' | 'name'> & Partial<Pick<Lead, 'email' | 'phone' | 'social_networks' | 'origin'>>
type Recipient = LeadMessageRecipient | SupplierMessageRecipient

export function NewLeadMessageDialog({ site, lead, open, onOpenChange, onCloseAutoFocus }: {
  site: SiteChannelSource & { id: string }; lead: Recipient
  open: boolean; onOpenChange: (open: boolean) => void; onCloseAutoFocus: (event: Event) => void
}) {
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)

  return (
    <Dialog open={open} onOpenChange={next => { if (!sending.current) onOpenChange(next) }}>
      <DialogContent size="md" flush busy={busy} onCloseAutoFocus={onCloseAutoFocus} className="sm:bottom-4 sm:left-auto sm:right-4 sm:top-auto sm:translate-x-0 sm:translate-y-0 sm:data-[state=closed]:slide-out-to-left-0 sm:data-[state=closed]:slide-out-to-top-0 sm:data-[state=open]:slide-in-from-left-0 sm:data-[state=open]:slide-in-from-top-0">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Send a message using an available channel for this contact.</DialogDescription>
        </DialogHeader>
        {open && <MessageFields site={site} lead={lead} onBusy={value => {
          sending.current = value
          setBusy(value)
        }} onAccepted={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function MessageFields({ site, lead: recipient, onBusy, onAccepted }: {
  site: SiteChannelSource & { id: string }; lead: Recipient
  onBusy: (busy: boolean) => void; onAccepted: () => void
}) {
  const id = useId()
  const supplier = 'contacts' in recipient ? recipient : undefined
  const supplierContacts = supplier && supplierMessageContacts(site, supplier)
  const channels = 'contacts' in recipient ? [...(supplierContacts?.keys() ?? [])] : newLeadMessageChannels(site, recipient)
  const [preferredChannel, setPreferredChannel] = useState('')
  const channel = channels.find(item => item === preferredChannel) ?? channels[0]
  const contact = channel && channel !== 'telegram' ? supplierContacts?.get(channel) : undefined
  const address = channel === 'email' ? contact?.email ?? ('email' in recipient ? recipient.email : undefined) : contact?.phone
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [asset, setAsset] = useState<LeadMessageAsset>()
  const incompatibleAttachment = Boolean(asset && (!channel || !leadMessageMediaType(channel, asset.file_type)))
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [failure, setFailure] = useState<{ text: string; conversationId?: string; blocked?: boolean }>()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!channel || (!message.trim() && !asset) || incompatibleAttachment || sending.current || failure?.blocked) return
    const fields = { channel, subject: channel === 'email' ? subject : undefined, asset_id: asset?.id }
    const leadDraft = !supplier && newLeadMessageSchema.safeParse({ lead_id: recipient.id, ...fields })
    const supplierDraft = supplier && newSupplierMessageSchema.safeParse({ supplier_id: supplier.id, version: supplier.version, ...fields })
    if (!(leadDraft && leadDraft.success) && !supplierDraft?.success) {
      setFailure({ text: 'Check the subject and channel before sending.' })
      return
    }
    sending.current = true
    setBusy(true)
    onBusy(true)
    setFailure(undefined)
    try {
      await sendTeamMemberIntervention(undefined, message.trim(), undefined, undefined, {
        site_id: site.id, response_format: 'text',
        ...(leadDraft && leadDraft.success ? { new_lead_message: leadDraft.data } : {}),
        ...(supplierDraft?.success ? { new_supplier_message: supplierDraft.data } : {}),
      })
      toast.success('Message accepted for sending.')
      onAccepted()
    } catch (error) {
      const known = error instanceof InterventionRequestError ? error : undefined
      setFailure({
        text: known?.message ?? 'Delivery could not be confirmed. Check Chats before sending again.',
        conversationId: known?.conversationId,
        blocked: known?.executionStarted !== false || Boolean(known?.conversationId),
      })
    } finally {
      sending.current = false
      setBusy(false)
      onBusy(false)
    }
  }

  return (
    <DialogForm onSubmit={submit}>
      <DialogBody className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">To</p>
        <p className="truncate text-sm">{recipient.name}{contact?.name ? ` · ${contact.name}` : ''}{address ? ` · ${address}` : ''}</p>
      </div>

      {channel ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Channel">
          <span className="text-sm font-medium">Via {getChannelLabel(channel)}</span>
          <ChannelSelector selectedChannel={channel} availableChannels={channels} onChannelChange={setPreferredChannel} isUpdating={busy} />
        </div>
      ) : <p role="status" className="text-sm text-muted-foreground">No connected messaging channel is available for this recipient.</p>}
      {channel === 'whatsapp' && <p className="text-xs text-muted-foreground">Starting a WhatsApp conversation may require an approved template.</p>}

      {channel === 'email' && <div className="space-y-1">
        <label htmlFor={`${id}-subject`} className="text-sm font-medium">Subject</label>
        <Input id={`${id}-subject`} value={subject} maxLength={200} required disabled={busy} onChange={event => setSubject(event.target.value)} />
      </div>}
      <div className="space-y-1">
        <label htmlFor={`${id}-message`} className="text-sm font-medium">Message</label>
        <Textarea id={`${id}-message`} value={message} maxLength={20_000} required={!asset} disabled={busy} rows={5} className="max-h-[35dvh] resize-y" onChange={event => setMessage(event.target.value)} />
      </div>
      {(channel || asset) && <LeadMessageAttachment siteId={site.id} channel={channel ?? ''} asset={asset} onChange={setAsset} disabled={busy} />}
      {incompatibleAttachment && <p role="status" className="text-sm text-muted-foreground">Remove the attachment or select a compatible channel before sending.</p>}
      {failure && <p role="alert" className="text-sm text-destructive">
        {failure.text} {failure.conversationId && <Link className="underline" href={`/chat?conversationId=${encodeURIComponent(failure.conversationId)}`}>Open conversation</Link>}
      </p>}
      </DialogBody>
      <DialogFooter>
        <Button type="submit" disabled={busy || !channel || (!message.trim() && !asset) || incompatibleAttachment || (channel === 'email' && !subject.trim()) || failure?.blocked}>
          {busy ? 'Sending…' : 'Send'}
        </Button>
      </DialogFooter>
    </DialogForm>
  )
}