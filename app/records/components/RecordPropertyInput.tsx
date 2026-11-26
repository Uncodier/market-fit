import { useMemo } from "react"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { TableWidget } from "../[id]/components/TableWidget"
import { useRelationOptions } from "../hooks/useRelationOptions"
import { relationFieldTargetKey } from "../lib/relation-target"
import { recordFieldDate, serializeRecordFieldDate } from "../lib/field-values"
import type { ValidatedTemplateField } from "../lib/template-validation"
import type { RecordProperty } from "../lib/record-properties"

interface InputProps {
  property: RecordProperty
  value: unknown
  onChange: (value: unknown) => void
  siteId: string
  inline?: boolean
  onChoose?: (value: unknown) => void
}

function RelationInput({ field, value, label, siteId, onChange, inline }: {
  field: ValidatedTemplateField; value: string; label: string; siteId: string; onChange: InputProps["onChange"]; inline?: boolean
}) {
  const target = relationFieldTargetKey(field)
  const { relationOptions, relationErrors, handleSearchChange } = useRelationOptions([field], siteId, value ? [value] : [])
  const options = relationOptions[target] || []
  const selectedLabel = options.find(option => option.id === value)?.label
  const selected = useMemo(() => value ? { mode: "existing" as const, id: value, label: selectedLabel || "Linked record" } : null,
    [value, selectedLabel])
  return (
    <>
      <RelationSelect
        label={label}
        keepInputFocus={inline}
        openOnFocus={inline}
        className={inline ? "h-8" : undefined}
        value={selected}
        options={options}
        onValueChange={choice => { if (!choice || choice.mode === "existing") onChange(choice?.id ?? null) }}
        onSearchChange={query => handleSearchChange(target, query)}
        allowCreate={false}
        placeholder="Empty"
      />
      {relationErrors[target] && <p role="alert" className="text-xs text-destructive">{relationErrors[target]}</p>}
    </>
  )
}

export function RecordPropertyInput({ property, value, onChange, siteId, inline, onChoose }: InputProps) {
  const field = property.key === "field" ? property.field : undefined
  const type = field?.type ?? property.key
  const text = typeof value === "string" ? value : ""
  const label = property.label
  const inputClass = inline ? "h-8 px-2" : undefined

  if (type === "relation" && field) return <RelationInput {...{ field, label, siteId, inline }} onChange={onChoose ?? onChange} value={text} />
  if (type === "table") return <TableWidget value={Array.isArray(value) ? value : []} onChange={onChange} />
  if (type === "description") return <Textarea aria-label={label} value={text} onChange={event => onChange(event.target.value)} />
  if (type === "status" || type === "select" || type === "boolean") {
    const current = type === "boolean" ? (typeof value === "boolean" ? String(value) : "") : text
    const choices = type === "status" ? ["draft", "published", "archived"] : type === "boolean" ? ["true", "false"] : field?.options ?? []
    const options = [...new Set(current && !choices.includes(current) ? [current, ...choices] : choices)]
    if (inline) {
      const optionLabel = (option: string) => type === "boolean" ? option === "true" ? "Yes" : "No"
        : type === "status" ? option.charAt(0).toUpperCase() + option.slice(1) : option
      const menuOptions = options.map(option => ({ id: option, label: optionLabel(option) }))
      return <RelationSelect label={label} options={menuOptions} value={current ? { mode: "existing", id: current, label: optionLabel(current) } : null}
        openOnFocus keepInputFocus allowCreate={false} clearable={type !== "status"} placeholder="Search options…" className="h-8"
        onValueChange={choice => {
          if (!choice || choice.mode === "existing") (onChoose ?? onChange)(!choice ? null : type === "boolean" ? choice.id === "true" : choice.id)
        }} />
    }
    return (
      <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" aria-label={label} value={current}
        onChange={event => onChange(!event.target.value ? null : type === "boolean" ? event.target.value === "true" : event.target.value)}>
        <option value="" disabled={type === "status"}>Empty</option>
        {options.map(option => <option key={option} value={option}>{option === "true" && type === "boolean" ? "Yes" : option === "false" && type === "boolean" ? "No" : option}</option>)}
      </select>
    )
  }
  if (type === "number") {
    return <Input className={inputClass} aria-label={label} type="number" step="any" value={typeof value === "number" ? value : ""}
      onChange={event => onChange(Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : null)} />
  }
  if (type === "date") {
    return <Input className={inputClass} aria-label={label} type="date" value={serializeRecordFieldDate(recordFieldDate(value)) ?? ""}
      onChange={event => onChange(event.target.value || null)} />
  }
  return <Input className={inputClass} aria-label={label} value={text} placeholder={type === "file" ? "File URL" : "Empty"}
    maxLength={type === "title" ? 2000 : field?.maxLength} onChange={event => onChange(event.target.value)} />
}