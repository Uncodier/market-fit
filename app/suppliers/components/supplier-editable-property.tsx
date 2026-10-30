"use client"

import type { ReactNode } from "react"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { PropertyRow } from "@/app/leads/components/PropertyRow"

/** Apply an inline edit to the versioned supplier draft, never directly to storage. */
export function SupplierEditableProperty({ label, value, onChange, disabled, icon, multiline = false, maxLength = 200, required = false, type = "text" }: {
  label: string; value: string; onChange: (value: string) => void; disabled: boolean
  icon: ReactNode; multiline?: boolean; maxLength?: number; required?: boolean; type?: string
}) {
  return <PropertyRow icon={icon} label={label} value={value || "—"} copyValue={value || undefined}
    readOnly={disabled} multiline={multiline} editValue={value}
    onCommit={async draft => { if (!disabled) onChange(draft.trim()) }}
    validate={draft => required && !draft.trim() ? "This field is required." : type === "email" && draft && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft) ? "Enter a valid email address." : null}
    editorLayout={multiline ? "stacked" : "inline"} saveOnEnter={!multiline}
    renderEditor={(draft, setDraft) => multiline
      ? <Textarea aria-label={label} value={draft} onChange={event => setDraft(event.target.value)} rows={5} maxLength={maxLength} className="text-sm" />
      : <Input aria-label={label} value={draft} onChange={event => setDraft(event.target.value)} type={type} maxLength={maxLength} className="h-8 text-sm" />}
  />
}