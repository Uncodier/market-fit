"use client"

import Link from "next/link"
import { useId, useRef, useState, type FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createCopyTemplate } from "./actions"
import type { CopywritingItem } from "./copywriting-model"
import { copyTemplateSchema, type CopyTemplateDraft } from "./template-model"

type Props = {
  siteId: string
  copyId: string
  initial: CopyTemplateDraft
  updating: boolean
  onBack: () => void
  onSaved: (item: CopywritingItem) => void
}

export function CopyTemplateDialog({ siteId, copyId, initial, updating, onBack, onSaved }: Props) {
  const { t } = useLocalization()
  const label = (key: string) => t(`copywriting.screen.template.${key}`)
  const id = useId()
  const { kind } = initial
  const whatsapp = kind === "whatsapp"
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.body)
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [savedId, setSavedId] = useState<string>()
  const [error, setError] = useState<string>()
  const draft = copyTemplateSchema.safeParse({ kind, title, body })
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.success || running.current || savedId) return
    running.current = true
    setBusy(true)
    setError(undefined)
    try {
      const saved = await createCopyTemplate(siteId, copyId, draft.data)
      setSavedId(saved.id)
      if (saved.item) onSaved(saved.item)
    } catch {
      setError("saveError")
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !running.current) onBack() }}>
      <DialogContent size="lg" busy={!!busy} closeLabel={t("copywriting.screen.close")} onCloseAutoFocus={event => event.preventDefault()}>
        <DialogForm onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{label(whatsapp ? updating ? "updateWhatsapp" : "createWhatsapp" : kind)}</DialogTitle>
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
            {savedId && <p role="status" className="text-sm">{label("saved")} {!whatsapp && <Link className="underline" href={`/content/${encodeURIComponent(savedId)}`}>{label("openDraft")}</Link>}</p>}
            {error && <p role="alert" className="text-sm text-destructive">{label(error)}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={!!busy} onClick={onBack}>{label("back")}</Button>
            <Button type="submit" disabled={!draft.success || busy || !!savedId}>{busy ? t("copywriting.screen.saving") : label(updating ? "updateDraft" : "save")}</Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}