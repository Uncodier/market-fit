import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/app/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { ArrowUpRight, ChevronDown, Pencil } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import type { RecordItem } from "../actions"
import { recordFieldDate, recordFieldLabel, serializeRecordFieldDate } from "../lib/field-values"
import { descriptionProperty, readRecordProperty, recordPropertyUpdate, type RecordProperty, type SaveRecordProperty } from "../lib/record-properties"
import { RecordPropertyInput } from "./RecordPropertyInput"

interface EditorProps {
  record: RecordItem
  onSave: SaveRecordProperty
  properties: RecordProperty[]
  trigger: ReactNode
}

function PropertyEditor({ record, onSave, properties, trigger }: EditorProps) {
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<{ record: RecordItem; property: RecordProperty; value: unknown } | null>(null)
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const inputRef = useRef<HTMLFieldSetElement>(null)
  const activeProperty = edit?.property

  useEffect(() => {
    if (activeProperty) inputRef.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus()
  }, [activeProperty, open])

  function select(property: RecordProperty) {
    setEdit({ record, property, value: readRecordProperty(record, property) })
    setError(undefined)
    setConflict(false)
  }

  function changeOpen(next: boolean) {
    if (savingRef.current) return
    setOpen(next)
    setEdit(null)
    if (next && properties.length === 1) select(properties[0])
  }

  async function save() {
    if (!edit || savingRef.current || conflict) return
    if (edit.property.key === "title" && !String(edit.value ?? "").trim()) {
      setError("Title is required.")
      return
    }
    if (Object.is(edit.value, readRecordProperty(edit.record, edit.property))) {
      changeOpen(false)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError(undefined)
    try {
      const result = await onSave(edit.record, recordPropertyUpdate(edit.record, edit.property, edit.value))
      if (result.error) {
        setError(result.error)
        setConflict(Boolean(result.conflict))
      } else {
        setOpen(false)
      }
    } catch {
      setError("Unable to save this property. Please try again.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" aria-label={edit ? `Edit ${edit.property.label}` : "Record properties"}
        className={cn("max-h-[min(70vh,36rem)] max-w-[calc(100vw-2rem)] space-y-3 overflow-auto p-3", edit?.property.key === "field" && edit.property.field.type === "table" && "w-[36rem]")}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement) || event.nativeEvent.isComposing) return
          const type = edit?.property.key === "field" ? edit.property.field.type : edit?.property.key
          if (type === "relation" || type === "table") return
          event.preventDefault()
          void save()
        }}>
        {edit ? (
          <>
            <p className="text-xs font-semibold text-muted-foreground">{edit.property.label}</p>
            <fieldset ref={inputRef} disabled={saving}>
              <RecordPropertyInput property={edit.property} value={edit.value} siteId={edit.record.site_id}
                onChange={value => setEdit({ ...edit, value })} />
            </fieldset>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => changeOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={saving || conflict} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </>
        ) : (
          <>
            <p className="px-2 text-xs font-semibold text-muted-foreground">Record properties</p>
            <div className="space-y-0.5">
              {properties.map(property => (
                <Button key={property.key === "field" ? property.field.id : property.key} size="sm" variant="ghost"
                  className="flex w-full justify-between gap-3" onClick={() => select(property)}>
                  <span className="truncate">{property.label}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{propertyText(record, property)}</span>
                </Button>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

function propertyText(record: RecordItem, property: RecordProperty, relationLabel?: string): string {
  const value = readRecordProperty(record, property)
  const type = property.key === "field" ? property.field.type : property.key
  if (value == null || value === "") return "Empty"
  if (type === "relation") return relationLabel || "Linked record"
  if (type === "date") return serializeRecordFieldDate(recordFieldDate(value)) || "Invalid date"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "row" : "rows"}`
  if (typeof value === "string" || typeof value === "number") return String(value)
  return "Invalid value"
}

export function RecordPropertyCell({ record, property, onSave, relationLabel, className, children }: {
  record: RecordItem; property: RecordProperty; onSave: SaveRecordProperty; relationLabel?: string; className?: string; children?: ReactNode
}) {
  const text = propertyText(record, property, relationLabel)
  const type = property.key === "field" ? property.field.type : property.key
  const [editing, setEditing] = useState(false)
  const CellIcon = ["select", "relation", "status", "boolean"].includes(type) ? ChevronDown : Pencil
  const [value, setValue] = useState<unknown>()
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<{ message: string; retry?: { record: RecordItem; value: unknown } }>()
  const session = useRef<{ record: RecordItem; value: unknown } | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const suppressFocus = useRef(false)

  useLayoutEffect(() => {
    if (editing) editorRef.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus()
    else if (returnFocus.current) {
      returnFocus.current = false
      suppressFocus.current = true
      triggerRef.current?.focus()
      suppressFocus.current = false
    }
  }, [editing])

  function begin() {
    if (suppressFocus.current || session.current || saving) return
    const draft = failure?.retry ?? { record, value: readRecordProperty(record, property) }
    session.current = draft
    setFailure(undefined)
    setValue(draft.value)
    setEditing(true)
  }

  function change(next: unknown) {
    if (!session.current) return
    session.current = { ...session.current, value: next }
    setValue(next)
  }

  async function finish({ cancel = false, keyboard = false }: { cancel?: boolean; keyboard?: boolean } = {}) {
    const draft = session.current
    if (!draft) return
    session.current = null
    returnFocus.current = keyboard
    setEditing(false)
    if (cancel || Object.is(draft.value, readRecordProperty(draft.record, property))) return
    if (property.key === "title" && !String(draft.value ?? "").trim()) {
      setFailure({ message: "Title is required.", retry: draft })
      return
    }
    setSaving(true)
    try {
      const result = await onSave(draft.record, recordPropertyUpdate(draft.record, property, draft.value))
      if (result.error) setFailure({ message: result.error, retry: result.conflict ? undefined : draft })
    } catch {
      setFailure({ message: "Unable to save this property. Focus the cell to retry.", retry: draft })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-w-0">
      {editing ? (
        <div ref={editorRef} className="min-w-0" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) void finish()
        }} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === "Escape") {
            event.preventDefault()
            void finish({ cancel: true, keyboard: true })
          } else if (event.key === "Enter" && !["relation", "table", "select", "status", "boolean"].includes(type)
            && (event.target instanceof HTMLInputElement || (event.target instanceof HTMLTextAreaElement && (event.metaKey || event.ctrlKey)))) {
            event.preventDefault()
            void finish({ keyboard: true })
          }
        }}>
          <RecordPropertyInput inline property={property} value={value} siteId={record.site_id} onChange={change}
            onChoose={next => { change(next); void finish({ keyboard: true }) }} />
        </div>
      ) : (
        <button ref={triggerRef} type="button" aria-label={`Edit ${property.label} for ${record.title}`} title={text} aria-busy={saving}
          onFocus={begin} onClick={begin}
          className={cn("group/cell flex min-h-8 w-full min-w-0 items-center gap-1 rounded px-2 text-left hover:bg-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary", className)}>
          <span className={cn("min-w-0 flex-1 truncate", text === "Empty" && "text-muted-foreground/65")}>{children ?? text}</span>
          {saving ? <span role="status" className="shrink-0 text-xs text-muted-foreground">Saving…</span>
            : <CellIcon aria-hidden className="size-3 shrink-0 text-muted-foreground transition-opacity [@media(hover:hover)]:opacity-0 group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100" />}
        </button>
      )}
      {failure && <p role="alert" className="px-2 text-xs text-destructive">{failure.message}</p>}
    </div>
  )
}

export function RecordPropertiesButton({ record, onSave, includeMetadata = false, compact = false }: {
  record: RecordItem; onSave: SaveRecordProperty; includeMetadata?: boolean; compact?: boolean
}) {
  const properties: RecordProperty[] = [descriptionProperty, ...(record.category?.template_fields ?? []).map(field => ({
    key: "field" as const, label: recordFieldLabel(field), field,
  }))]
  if (includeMetadata) properties.unshift({ key: "title", label: "Title" }, { key: "status", label: "Status" })
  return <PropertyEditor record={record} onSave={onSave} properties={properties} trigger={
    <Button size="sm" variant="ghost" aria-label={`Edit properties for ${record.title}`} title="Edit properties"
      className={cn("h-7 gap-1 px-2 text-xs font-medium text-muted-foreground transition-opacity [@media(hover:hover)]:opacity-0 group-hover/record:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100", compact && "size-6 shrink-0 p-0")}
      onClick={event => event.stopPropagation()}>
      <Pencil className="size-3" aria-hidden /> {!compact && "Properties"}
    </Button>
  } />
}

export function OpenRecordButton({ title, onOpen, alwaysVisible = false }: { title: string; onOpen: () => void; alwaysVisible?: boolean }) {
  return <Button size="sm" variant="outline" aria-label={`Open record: ${title}`} title="Open record"
    className={cn("h-7 shrink-0 gap-1 px-2 text-xs shadow-sm", !alwaysVisible && "[@media(hover:hover)]:opacity-0 group-hover/record:opacity-100 group-focus-within/record:opacity-100")}
    onClick={event => { event.stopPropagation(); onOpen() }}>
    <ArrowUpRight className="size-3" aria-hidden /> Open
  </Button>
}