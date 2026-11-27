"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { RelationSelect, type RelationSelectOption, type RelationSelectValue } from "@/app/components/ui/relation-select"
import { useLocalization } from "@/app/context/LocalizationContext"
import { sendTeamMemberIntervention } from "@/app/services/chat-send"
import { InterventionRequestError } from "@/app/services/mark-intervention-message-failed"
import { findCopyTestRecipients } from "./actions"
import { copyTemplateVariables, copyTestSchema, hasTemplateMarkers, renderCopyTemplate, type CopyTemplateDraft, type CopyTemplateKind } from "./template-model"

type TestSource = Pick<CopyTemplateDraft, "title" | "body">
type Props = {
  siteId: string
  copyId: string
  email: TestSource
  whatsapp: TestSource
  usesLinkedDraft: boolean
  onBack: () => void
}

export function CopyTestDialog({ siteId, copyId, email, whatsapp, usesLinkedDraft, onBack }: Props) {
  const { t } = useLocalization()
  const label = (key: string) => t(`copywriting.screen.template.${key}`)
  const id = useId()
  const [kind, setKind] = useState<CopyTemplateKind>(usesLinkedDraft ? "whatsapp" : "newsletter")
  const [subject, setSubject] = useState(email.title)
  const [values, setValues] = useState<Record<string, string>>({})
  const [recipient, setRecipient] = useState<RelationSelectValue>(null)
  const [term, setTerm] = useState("")
  const [matches, setMatches] = useState<{ term: string; kind: CopyTemplateKind; options: RelationSelectOption[]; failed: boolean }>()
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [receipt, setReceipt] = useState<{ state: "accepted" | "unknown"; conversation?: string }>()
  const [error, setError] = useState(false)
  const query = term.trim()
  const isWhatsapp = kind === "whatsapp"
  const source = isWhatsapp ? whatsapp : email
  const variables = copyTemplateVariables(isWhatsapp ? "" : subject, source.body)
  const title = isWhatsapp ? "WhatsApp" : renderCopyTemplate(subject, values).trim()
  const body = renderCopyTemplate(source.body, values).trim()
  const unresolved = hasTemplateMarkers(`${title}\n${body}`)
  const test = copyTestSchema.safeParse({ copy_id: copyId, lead_id: recipient?.mode === "existing" ? recipient.id : null, draft: { kind, title, body } })

  useEffect(() => {
    if (query.length < 2 || query.length > 100) return
    let active = true
    const timer = setTimeout(() => {
      void findCopyTestRecipients(siteId, query, kind).then(options => {
        if (active) setMatches({ term: query, kind, options, failed: false })
      }).catch(() => {
        if (active) setMatches({ term: query, kind, options: [], failed: true })
      })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [query, siteId, kind])

  const changeChannel = (next: CopyTemplateKind) => {
    setKind(next)
    setRecipient(null)
    setTerm("")
    setMatches(undefined)
    setError(false)
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!test.success || running.current || receipt) return
    running.current = true
    setBusy(true)
    setError(false)
    try {
      const result = await sendTeamMemberIntervention(undefined, "", undefined, undefined, { site_id: siteId, copy_test: test.data })
      setReceipt({ state: "accepted", conversation: result.data?.conversation_id ?? result.conversation_id })
    } catch (e) {
      if (e instanceof InterventionRequestError && e.executionStarted === false && !e.conversationId) setError(true)
      else setReceipt({ state: "unknown", conversation: e instanceof InterventionRequestError ? e.conversationId : undefined })
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const disabled = busy || !!receipt
  const result = matches?.term === query && matches.kind === kind ? matches : undefined
  return (
    <Dialog open onOpenChange={open => { if (!open && !running.current) onBack() }}>
      <DialogContent size="lg" busy={busy} closeLabel={t("copywriting.screen.close")} onCloseAutoFocus={event => event.preventDefault()}>
        <DialogForm onSubmit={send}>
          <DialogHeader>
            <DialogTitle>{label("try")}</DialogTitle>
            <DialogDescription>{label("testHelp")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <fieldset disabled={disabled} className="space-y-2">
              <legend className="text-sm font-medium">{label("channel")}</legend>
              <div className="flex flex-wrap gap-4">
                {(["newsletter", "whatsapp"] as const).map(channel => <label key={channel} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={`${id}-channel`} checked={kind === channel} onChange={() => changeChannel(channel)} />
                  {channel === "whatsapp" ? "WhatsApp" : label("email")}
                </label>)}
              </div>
            </fieldset>
            {isWhatsapp && usesLinkedDraft && <p className="text-xs text-muted-foreground">{label("usingLinkedDraft")}</p>}
            {!isWhatsapp && <div className="space-y-1.5">
              <Label htmlFor={`${id}-subject`}>{label("subject")}</Label>
              <Input id={`${id}-subject`} value={subject} onChange={event => setSubject(event.target.value)} disabled={disabled} required />
            </div>}
            {!!variables.length && <fieldset disabled={disabled} className="space-y-2">
              <legend className="text-sm font-medium">{label("variables")}</legend>
              {variables.map((key, index) => <div key={key} className="space-y-1.5">
                <Label htmlFor={`${id}-var-${index}`}>{`{{${key}}}`}</Label>
                <Input id={`${id}-var-${index}`} value={Object.prototype.hasOwnProperty.call(values, key) ? values[key] : ""}
                  onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))} required />
              </div>)}
            </fieldset>}
            <section aria-label={label("preview")} className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <h3 className="font-medium">{label("preview")}</h3>
              {!isWhatsapp && <p className="break-words font-medium">[TEST] {title}</p>}
              <p className="whitespace-pre-wrap break-words">{isWhatsapp && "[TEST] "}{body}</p>
            </section>
            <p className="text-xs text-muted-foreground">{label(isWhatsapp ? "whatsappLimit" : "newsletterLimit")}</p>
            {unresolved && <p className="text-xs text-muted-foreground">{label("unresolved")}</p>}
            {!receipt && <RelationSelect key={kind}
              options={result?.options ?? []}
              value={recipient} onValueChange={setRecipient} onSearchChange={setTerm} onInputValueChange={() => setRecipient(null)}
              label={label("recipient")} placeholder={label("recipientHint")} searchPlaceholder={label("recipientHint")}
              emptyMessage={label(result ? result.failed ? "searchError" : "noRecipients" : "recipientHint")}
              clearLabel={t("copywriting.screen.clearSearch")} allowCreate={false} disabled={busy}
            />}
            {receipt && <p role={receipt.state === "unknown" ? "alert" : "status"} className="text-sm">
              {label(receipt.state)}{" "}
              {receipt.conversation && <Link className="underline" href={`/chat?conversationId=${encodeURIComponent(receipt.conversation)}`}>{label("openChat")}</Link>}
            </p>}
            {error && <p role="alert" className="text-sm text-destructive">{label("testError")}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onBack}>{label("back")}</Button>
            <Button type="submit" disabled={!test.success || disabled}>{label(busy ? "sending" : "test")}</Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}