"use client"

import { useId, useState, type FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Textarea } from "@/app/components/ui/textarea"
import { useLocalization } from "@/app/context/LocalizationContext"
import { COPY_STATUSES, COPY_TYPES, copyFieldsSchema, initialCopyFields, type CopyFields, type CopyTab, type CopywritingItem } from "./copywriting-model"
import { WHATSAPP_TEMPLATE_TAG, type CopyTemplateKind } from "./template-model"

const extraFields = ["target_audience", "use_case", "notes"] as const

type Props = {
  item?: CopywritingItem
  tab: CopyTab
  editing: boolean
  canWrite: boolean
  onEdit: () => void
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
  onSave: (fields: CopyFields) => Promise<void>
  onTemplate: (kind: CopyTemplateKind) => void
}

export function CopywritingDialog({ item, tab, editing, canWrite, onEdit, onClose, onCloseAutoFocus, onSave, onTemplate }: Props) {
  const { t } = useLocalization()
  const prefix = useId()
  const [fields, setFields] = useState(() => initialCopyFields(item, tab))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
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

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
      <DialogContent size="lg" busy={saving} closeLabel={text("close")} onCloseAutoFocus={onCloseAutoFocus}>
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
              {error && <p role="alert" className="text-sm text-destructive">{text(error)}</p>}
            </DialogBody>
            <DialogFooter>
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
              {canWrite && <>
                <Button variant="outline" onClick={() => onTemplate("whatsapp")}>{text("template.whatsapp")}</Button>
                <Button variant="outline" onClick={() => onTemplate("newsletter")}>{text("template.newsletter")}</Button>
              </>}
              <Button variant="outline" onClick={onClose}>{text("close")}</Button>
              {canWrite && <Button onClick={onEdit}>{text("edit")}</Button>}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}