"use client"

import { useId, useRef, useState, type FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Textarea } from "@/app/components/ui/textarea"
import { useLocalization } from "@/app/context/LocalizationContext"
import { COPY_STATUSES, COPY_TYPES, copyFieldsSchema, initialCopyFields, type CopyFields, type CopyTab, type CopywritingItem } from "./copywriting-model"
import { WHATSAPP_TEMPLATE_TAG, type CopyTemplateKind } from "./template-model"
import { CopyTemplateDialog } from "./CopyTemplateDialog"
import { CopyTestDialog } from "./CopyTestDialog"

const extraFields = ["target_audience", "use_case", "notes"] as const

type Props = {
  siteId: string
  item?: CopywritingItem
  whatsappDraft?: CopywritingItem
  tab: CopyTab
  editing: boolean
  canWrite: boolean
  onEdit: () => void
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
  onSave: (fields: CopyFields) => Promise<void>
  onTemplateSaved: (item: CopywritingItem) => void
}

export function CopywritingDialog({ siteId, item, whatsappDraft, tab, editing, canWrite, onEdit, onClose, onCloseAutoFocus, onSave, onTemplateSaved }: Props) {
  const { t } = useLocalization()
  const prefix = useId()
  const [fields, setFields] = useState(() => initialCopyFields(item, tab))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [flow, setFlow] = useState<CopyTemplateKind | "test">()
  const previousFlow = useRef<typeof flow>(undefined)
  const contentRef = useRef<HTMLDivElement>(null)
  const text = (key: string) => t(`copywriting.screen.${key}`)
  const fieldId = (key: string) => `${prefix}-${key}`
  const setField = <K extends keyof CopyFields>(key: K, value: CopyFields[K]) => {
    setFields(previous => ({ ...previous, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || !canWrite) return
    const parsed = copyFieldsSchema.safeParse(fields)
    if (!parsed.success) { setError("required"); return }
    setSaving(true)
    setError("")
    try {
      await onSave(parsed.data)
    } catch {
      setError("saveError")
    } finally {
      setSaving(false)
    }
  }

  const current = editing ? fields : initialCopyFields(item, tab)
  const testEmail = { title: current.title, body: current.content }
  const linkedDraft = whatsappDraft && whatsappDraft.id !== item?.id ? whatsappDraft : undefined
  const testWhatsapp = linkedDraft ? { title: linkedDraft.title, body: linkedDraft.content } : testEmail
  const whatsappInitial = whatsappDraft ? testWhatsapp : {
    ...testWhatsapp, title: `${text("template.whatsapp")}: ${testWhatsapp.title}`.slice(0, 193),
  }
  const openFlow = (next: NonNullable<typeof flow>) => {
    previousFlow.current = next
    setFlow(next)
  }
  const actionLabel = whatsappDraft ? "updateWhatsapp" : "createWhatsapp"
  const templateActions = canWrite && <>
    <Button type="button" variant="outline" data-copy-flow="whatsapp" disabled={!item || saving} onClick={() => openFlow("whatsapp")}>{text(`template.${actionLabel}`)}</Button>
    <Button type="button" variant="outline" data-copy-flow="test" disabled={!item || saving} onClick={() => openFlow("test")}>{text("template.try")}</Button>
  </>

  if (item && flow === "test") return <CopyTestDialog siteId={siteId} copyId={item.id} email={testEmail} whatsapp={testWhatsapp}
    usesLinkedDraft={!!linkedDraft} onBack={() => setFlow(undefined)} />
  if (item && (flow === "whatsapp" || flow === "newsletter")) return <CopyTemplateDialog siteId={siteId} copyId={item.id}
    initial={{ kind: flow, ...(flow === "whatsapp" ? whatsappInitial : testEmail) }}
    updating={flow === "whatsapp" && !!whatsappDraft} onBack={() => setFlow(undefined)} onSaved={saved => {
      onTemplateSaved(saved)
      if (editing && saved.id === item.id) {
        setFields(previous => ({ ...previous, title: saved.title, content: saved.content }))
      }
    }} />

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
      <DialogContent ref={contentRef} size="lg" busy={saving} closeLabel={text("close")} onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={event => {
          const target = contentRef.current?.querySelector<HTMLButtonElement>(`[data-copy-flow="${previousFlow.current}"]`)
          previousFlow.current = undefined
          if (target) { event.preventDefault(); target.focus() }
        }}>
        {editing ? (
          <DialogForm onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{text(item ? "edit" : "new")}</DialogTitle>
              <DialogDescription>{text("formHelp")}</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor={fieldId("title")}>{text("title")}</Label>
                <Input id={fieldId("title")} value={fields.title} onChange={e => setField("title", e.target.value)} required disabled={saving} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor={fieldId("type")}>{text("type")}</Label>
                  <Select value={fields.copy_type} onValueChange={(value: CopyFields["copy_type"]) => setField("copy_type", value)} disabled={saving}>
                    <SelectTrigger id={fieldId("type")}><SelectValue /></SelectTrigger>
                    <SelectContent>{COPY_TYPES.map(type => <SelectItem key={type} value={type}>{text(`types.${type}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor={fieldId("status")}>{text("status")}</Label>
                  <Select value={fields.status} onValueChange={(value: CopyFields["status"]) => setField("status", value)} disabled={saving}>
                    <SelectTrigger id={fieldId("status")}><SelectValue /></SelectTrigger>
                    <SelectContent>{COPY_STATUSES.map(status => <SelectItem key={status} value={status}>{text(`statuses.${status}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={fieldId("content")}>{text("content")}</Label>
                <Textarea id={fieldId("content")} rows={8} value={fields.content} onChange={e => setField("content", e.target.value)} required disabled={saving} />
              </div>
              {extraFields.map(key => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={fieldId(key)}>{text(key)}</Label>
                  {key === "notes"
                    ? <Textarea id={fieldId(key)} value={fields[key]} onChange={e => setField(key, e.target.value)} disabled={saving} />
                    : <Input id={fieldId(key)} value={fields[key]} onChange={e => setField(key, e.target.value)} disabled={saving} />}
                </div>
              ))}
              {!item && <p className="text-xs text-muted-foreground">{text("template.saveFirst")}</p>}
              {error && <p role="alert" className="text-sm text-destructive">{text(error)}</p>}
            </DialogBody>
            <DialogFooter>
              {templateActions}
              <Button type="button" variant="outline" onClick={item ? onEdit : onClose} disabled={saving}>{text("cancel")}</Button>
              <Button type="submit" disabled={saving || !canWrite}>{text(saving ? "saving" : "save")}</Button>
            </DialogFooter>
          </DialogForm>
        ) : item ? (
          <>
            <DialogHeader>
              <DialogTitle className="break-words">{item.title}</DialogTitle>
              <DialogDescription>{text(item.tags?.includes(WHATSAPP_TEMPLATE_TAG) ? "template.whatsapp" : `types.${item.copy_type}`)} · {text(`statuses.${item.status ?? "draft"}`)}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.content}</p>
              {extraFields.map(key => item[key] && (
                <div key={key}>
                  <h3 className="text-xs font-medium text-muted-foreground">{text(key)}</h3>
                  <p className="whitespace-pre-wrap break-words text-sm">{item[key]}</p>
                </div>
              ))}
            </DialogBody>
            <DialogFooter>
              {templateActions}
              {canWrite && <Button variant="outline" data-copy-flow="newsletter" onClick={() => openFlow("newsletter")}>{text("template.newsletter")}</Button>}
              <Button variant="outline" onClick={onClose}>{text("close")}</Button>
              {canWrite && <Button onClick={onEdit}>{text("edit")}</Button>}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}