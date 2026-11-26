"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { RelationSelect, type RelationSelectOption, type RelationSelectValue } from "@/app/components/ui/relation-select"
import { Textarea } from "@/app/components/ui/textarea"
import { useLocalization } from "@/app/context/LocalizationContext"
import { sendTeamMemberIntervention } from "@/app/services/chat-send"
import { InterventionRequestError } from "@/app/services/mark-intervention-message-failed"
import { createCopyTemplate, findCopyTestRecipients } from "./actions"
import type { CopywritingItem } from "./copywriting-model"
import { copyTemplateSchema, copyTestSchema, WHATSAPP_TEMPLATE_TAG, type CopyTemplateKind } from "./template-model"

type Props = {
  siteId: string
  item: CopywritingItem
  kind: CopyTemplateKind
  onBack: () => void
  onSaved: (item: CopywritingItem) => void
}

export function CopyTemplateDialog({ siteId, item, kind, onBack, onSaved }: Props) {
  const { t } = useLocalization()
  const label = (key: string) => t(`copywriting.screen.template.${key}`)
  const id = useId()
  const whatsapp = kind === "whatsapp"
  const [title, setTitle] = useState(() => whatsapp && !item.tags?.includes(WHATSAPP_TEMPLATE_TAG)
    ? `${label("whatsapp")}: ${item.title}` : item.title)
  const [body, setBody] = useState(item.content)
  const [recipient, setRecipient] = useState<RelationSelectValue>(null)
  const [term, setTerm] = useState("")
  const [matches, setMatches] = useState<{ term: string; options: RelationSelectOption[]; failed: boolean }>()
  const [busy, setBusy] = useState<"save" | "test" | null>(null)
  const running = useRef(false)
  const [savedId, setSavedId] = useState<string>()
  const [receipt, setReceipt] = useState<{ state: "accepted" | "unknown"; conversation?: string }>()
  const [error, setError] = useState<string>()
  const query = term.trim()

  useEffect(() => {
    if (query.length < 2 || query.length > 100) return
    let active = true
    const timer = setTimeout(() => {
      void findCopyTestRecipients(siteId, query, kind).then(options => {
        if (active) setMatches({ term: query, options, failed: false })
      }).catch(() => {
        if (active) setMatches({ term: query, options: [], failed: true })
      })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [query, siteId, kind])

  const draft = copyTemplateSchema.safeParse({ kind, title, body })
  const test = copyTestSchema.safeParse({ copy_id: item.id, lead_id: recipient?.mode === "existing" ? recipient.id : null, draft: { kind, title, body } })
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.success || running.current || savedId) return
    running.current = true
    setBusy("save")
    setError(undefined)
    try {
      const saved = await createCopyTemplate(siteId, item.id, draft.data)
      setSavedId(saved.id)
      if (saved.item) onSaved(saved.item)
    } catch {
      setError("saveError")
    } finally {
      running.current = false
      setBusy(null)
    }
  }

  const send = async () => {
    if (!test.success || running.current || receipt) return
    running.current = true
    setBusy("test")
    setError(undefined)
    try {
      const result = await sendTeamMemberIntervention(undefined, "", undefined, undefined, { site_id: siteId, copy_test: test.data })
      setReceipt({ state: "accepted", conversation: result.data?.conversation_id ?? result.conversation_id })
    } catch (e) {
      if (e instanceof InterventionRequestError && e.executionStarted === false && !e.conversationId) setError("testError")
      else setReceipt({ state: "unknown", conversation: e instanceof InterventionRequestError ? e.conversationId : undefined })
    } finally {
      running.current = false
      setBusy(null)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !running.current) onBack() }}>
      <DialogContent size="lg" busy={!!busy} closeLabel={t("copywriting.screen.close")} onCloseAutoFocus={event => event.preventDefault()}>
        <DialogForm onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{label(kind)}</DialogTitle>
            <DialogDescription>{label(whatsapp ? "whatsappHelp" : "newsletterHelp")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-title`}>{label(whatsapp ? "name" : "subject")}</Label>
              <Input id={`${id}-title`} value={title} maxLength={193} required disabled={!!busy || !!savedId} onChange={event => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-body`}>{t("copywriting.screen.content")}</Label>
              <Textarea id={`${id}-body`} value={body} rows={6} maxLength={whatsapp ? 1024 : 20_000} required disabled={!!busy || !!savedId} onChange={event => setBody(event.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">{label(whatsapp ? "whatsappLimit" : "newsletterLimit")}</p>
            {!receipt && <RelationSelect
              options={matches?.term === query ? matches.options : []}
              value={recipient} onValueChange={setRecipient} onSearchChange={setTerm} onInputValueChange={() => setRecipient(null)}
              label={label("recipient")} placeholder={label("recipientHint")} searchPlaceholder={label("recipientHint")}
              emptyMessage={label(matches?.term === query ? matches.failed ? "searchError" : "noRecipients" : "recipientHint")}
              clearLabel={t("copywriting.screen.clearSearch")} allowCreate={false} disabled={!!busy}
            />}
            {savedId && <p role="status" className="text-sm">{label("saved")} {!whatsapp && <Link className="underline" href={`/content/${encodeURIComponent(savedId)}`}>{label("openDraft")}</Link>}</p>}
            {receipt && <p role={receipt.state === "unknown" ? "alert" : "status"} className="text-sm">
              {label(receipt.state)}{" "}
              {receipt.conversation && <Link className="underline" href={`/chat?conversationId=${encodeURIComponent(receipt.conversation)}`}>{label("openChat")}</Link>}
            </p>}
            {error && <p role="alert" className="text-sm text-destructive">{label(error)}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={!!busy} onClick={onBack}>{label("back")}</Button>
            <Button type="button" variant="outline" disabled={!test.success || !!busy || !!receipt} onClick={() => void send()}>{label(busy === "test" ? "sending" : "test")}</Button>
            <Button type="submit" disabled={!draft.success || !!busy || !!savedId}>{busy === "save" ? t("copywriting.screen.saving") : label("save")}</Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}