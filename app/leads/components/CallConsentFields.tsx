"use client"

import { useRef, useState } from "react"
import { format } from "date-fns"
import { useSWRConfig } from "swr"
import { toast } from "sonner"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { getVoiceCallBlock } from "@/lib/chat/voice-call-eligibility"
import { updateLeadCallConsent } from "../call-consent-actions"
import { UpdateCallConsentSchema, type CallConsentFields as ConsentFields, type SavedCallConsent } from "../call-consent-schema"
import type { Lead } from "../types"

const STATUS_LABELS = { unknown: "Unknown", granted: "Granted", revoked: "Revoked" }

type Props = {
  lead: Lead
  siteId: string
  onSaved: (lead: SavedCallConsent) => void
}

export function CallConsentFields({ lead, siteId, onSaved }: Props) {
  const permissions = useOptionalPermissions()
  const { mutate } = useSWRConfig()
  const [snapshot, setSnapshot] = useState<Lead | null>(null)
  const [status, setStatus] = useState<ConsentFields["voice_call_consent_status"]>("unknown")
  const [consentDate, setConsentDate] = useState("")
  const [doNotCall, setDoNotCall] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const loaded = lead.voice_call_consent_status !== undefined &&
    lead.voice_call_consent_at !== undefined && typeof lead.do_not_call === "boolean"
  const canEdit = loaded && permissions?.siteId === siteId &&
    !!permissions?.capabilities && permissions.can("update")
  const block = getVoiceCallBlock(lead)
  const validDate = lead.voice_call_consent_at && !Number.isNaN(Date.parse(lead.voice_call_consent_at))

  const openEditor = () => {
    setSnapshot(lead)
    setStatus(lead.voice_call_consent_status ?? "unknown")
    setConsentDate(validDate ? format(new Date(lead.voice_call_consent_at!), "yyyy-MM-dd'T'HH:mm:ss") : "")
    setDoNotCall(lead.do_not_call === true)
    setConfirmed(false)
    setError(null)
  }

  const save = async () => {
    if (!snapshot || !canEdit || inFlight.current) return
    const date = new Date(consentDate)
    // Keep the original instant/precision when only changing do-not-call,
    // including dates in the repeated hour at a daylight-saving transition.
    const originalDate = snapshot.voice_call_consent_at
    const unchangedDate = originalDate && !Number.isNaN(Date.parse(originalDate)) &&
      consentDate === format(new Date(originalDate), "yyyy-MM-dd'T'HH:mm:ss")
    const parsed = UpdateCallConsentSchema.safeParse({
      id: snapshot.id,
      site_id: siteId,
      voice_call_consent_status: status,
      voice_call_consent_at: status === "granted" && !Number.isNaN(date.getTime())
        ? (unchangedDate ? originalDate : date.toISOString()) : null,
      do_not_call: doNotCall,
      confirmed,
      expected: {
        voice_call_consent_status: snapshot.voice_call_consent_status,
        voice_call_consent_at: snapshot.voice_call_consent_at,
        do_not_call: snapshot.do_not_call,
        updated_at: snapshot.updated_at,
        phone: snapshot.phone,
      },
    })
    if (!parsed.success) {
      setError("Confirm the change and enter a valid, non-future consent date when granting consent.")
      return
    }
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      const result = await updateLeadCallConsent(parsed.data)
      if (result.error || !result.lead) {
        setError(result.error || "Could not save call consent.")
        return
      }
      onSaved(result.lead)
      setSnapshot(null)
      toast.success("Call consent updated")
      // Invalidate the site's cached chat eligibility, including inactive conversations.
      // Revalidation is not a second save and must never replay this mutation.
      void mutate((key) => Array.isArray(key) && key[0] === "lead-data" && key[2] === siteId, undefined, { revalidate: true })
        .catch(() => undefined)
    } catch {
      setError("Could not confirm whether the change was saved. Reload the lead before trying again.")
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <section aria-label="Outbound call consent" className="my-3 rounded-lg border border-border/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium">Outbound calls</h3>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" disabled={!canEdit} onClick={openEditor}>
          Edit call consent
        </Button>
      </div>
      <dl className="text-xs space-y-1">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Consent</dt><dd>{loaded ? STATUS_LABELS[lead.voice_call_consent_status!] : "Unavailable"}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Consent date</dt><dd>{validDate ? new Date(lead.voice_call_consent_at!).toLocaleString() : "Not recorded"}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Do not call</dt><dd>{loaded ? (lead.do_not_call ? "On — calls blocked" : "Off") : "Unavailable"}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">{loaded ? (block?.message ?? "This lead meets the phone and consent requirements for outbound calls.") : "Reload the lead to load its call consent settings."}</p>
      {!canEdit && <p className="text-xs text-muted-foreground">Editing requires update access to this site.</p>}

      <Dialog open={snapshot !== null} onOpenChange={(open) => { if (!open && !inFlight.current) setSnapshot(null) }}>
        <DialogContent size="md" busy={saving} showClose={!saving}>
          <DialogForm onSubmit={(event) => { event.preventDefault(); void save() }}>
            <DialogHeader>
              <DialogTitle>Edit call consent</DialogTitle>
              <DialogDescription>
                Record permission already obtained from {snapshot?.name || "this lead"}. Saving does not request consent or start a call.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <p className="text-sm text-muted-foreground">An inbound call or permission to store contact details does not grant consent for outbound calls.</p>
              <p className="text-sm">Phone: {snapshot?.phone || "Not recorded"}</p>
              <div className="space-y-2">
                <Label htmlFor="call-consent-status">Outbound-call consent</Label>
                <Select value={status} onValueChange={(value) => { setStatus(value as typeof status); setConfirmed(false) }} disabled={saving}>
                  <SelectTrigger id="call-consent-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown — not recorded</SelectItem>
                    <SelectItem value="granted">Granted — explicit consent obtained</SelectItem>
                    <SelectItem value="revoked">Revoked — consent withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {status === "granted" && <div className="space-y-2">
                <Label htmlFor="call-consent-date">Consent obtained at (your local time)</Label>
                <Input id="call-consent-date" type="datetime-local" step="1" required value={consentDate} disabled={saving}
                  onChange={(event) => { setConsentDate(event.target.value); setConfirmed(false) }} />
              </div>}
              {status !== "granted" && <p className="text-xs text-muted-foreground">
                Unknown or revoked consent blocks calls and clears the recorded grant date.
              </p>}
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="call-do-not-call">Do not call</Label>
                <Switch id="call-do-not-call" checked={doNotCall} disabled={saving} onCheckedChange={(value) => { setDoNotCall(value); setConfirmed(false) }} />
              </div>
              <p className="text-xs text-muted-foreground">Do not call blocks outbound calls even with granted consent. Turning it off does not grant consent.</p>
              <div className="flex items-start gap-2">
                <Checkbox id="call-consent-confirm" checked={confirmed} disabled={saving} onCheckedChange={(value) => setConfirmed(value === true)} />
                <Label htmlFor="call-consent-confirm" className="text-sm leading-relaxed">
                  {status === "granted"
                    ? "I confirm this lead explicitly agreed to outbound calls to this number on the date entered, and the do-not-call setting reflects their current preference."
                    : "I confirm these settings reflect the lead's current outbound-call consent and do-not-call preference."}
                </Label>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setSnapshot(null)}>Cancel</Button>
              <Button type="submit" disabled={saving || !confirmed || !canEdit}>{saving ? "Saving…" : "Save call consent"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </section>
  )
}