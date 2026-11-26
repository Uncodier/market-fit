import { useRef, useState, type FormEvent } from "react"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Plus } from "@/app/components/ui/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { recordFieldLabel } from "../lib/field-values"
import { validateTemplateFields, type ValidatedTemplateField } from "../lib/template-validation"
import type { RecordCategory } from "../actions"

const fieldTypes = {
  text: "Text", description: "Long text", number: "Number", date: "Date", select: "Select",
  boolean: "Checkbox", location: "Location", relation: "Relation", file: "File / URL", table: "Table",
}
const relationTargets = {
  lead: "Lead", company: "Company", supplier: "Supplier", sales_order: "Sales order", deal: "Deal",
  team_member: "Team member", campaign: "Campaign", catalog_item: "Catalog item", content: "Content",
  task: "Task", sale: "Sale", purchase: "Purchase", quotation: "Quotation", record: "Record", record_category: "Record category",
}
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm"

export type SaveTableProperty = (category: RecordCategory, field: ValidatedTemplateField) => Promise<{ error?: string; conflict?: boolean }>

export function RecordsTableProperties({ activeCategory, categories, onAdd, onManage, onViewCategory }: {
  activeCategory?: RecordCategory
  categories: RecordCategory[]
  onAdd: SaveTableProperty
  onManage: (category: RecordCategory) => void
  onViewCategory: (category: RecordCategory) => void
}) {
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState("")
  const [label, setLabel] = useState("")
  const [type, setType] = useState("text")
  const [options, setOptions] = useState("")
  const [relationTarget, setRelationTarget] = useState("lead")
  const [targetCategoryId, setTargetCategoryId] = useState("")
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const category = activeCategory ?? categories.find(item => item.id === categoryId)

  function changeOpen(next: boolean) {
    if (savingRef.current) return
    if (next) {
      setCategoryId("")
      setLabel("")
      setType("text")
      setOptions("")
      setRelationTarget("lead")
      setTargetCategoryId("")
      setError(undefined)
    }
    setOpen(next)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!category || savingRef.current) return
    const displayName = label.trim()
    if (!displayName) { setError("Enter a property name."); return }
    const fields: ValidatedTemplateField[] = category.template_fields ?? []
    if (fields.some(field => recordFieldLabel(field).toLowerCase() === displayName.toLowerCase())) {
      setError("A property with this name already exists.")
      return
    }
    // Use a fresh storage key so an old, removed property cannot be revived under a new label.
    const id = uuidv4()
    const field: ValidatedTemplateField = {
      id, name: `property_${id.replaceAll("-", "")}`, label: displayName, type,
      ...(type === "select" && { options: [...new Set(options.split("\n").map(option => option.trim()).filter(Boolean))] }),
      ...(type === "relation" && { relationTarget, ...(relationTarget === "record" && targetCategoryId && { targetCategoryId }) }),
    }
    const validation = validateTemplateFields([field])
    if (!validation.valid) {
      setError(type === "select" && !field.options?.length ? "Add at least one select option." : validation.error.replace(field.name, displayName))
      return
    }
    savingRef.current = true
    setSaving(true)
    setError(undefined)
    try {
      const result = await onAdd(category, field)
      if (result.error) setError(result.conflict ? "The category changed. Review its properties and try again." : result.error)
      else {
        setOpen(false)
        if (!activeCategory) onViewCategory(category)
      }
    } catch {
      setError("Unable to add this property. Please try again.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground" aria-label="Add property">
                <Plus className="size-4" aria-hidden />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add property</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" aria-label="Add property" className="max-h-[min(75dvh,36rem)] max-w-[calc(100vw-2rem)] overflow-auto p-3">
        <form onSubmit={submit}>
          <fieldset disabled={saving} className="min-w-0 space-y-3">
            <p className="text-sm font-semibold">New property</p>
            {!activeCategory && <label className="block space-y-1 text-xs font-medium">
              <span>Category</span>
              <select className={selectClass} value={categoryId} onChange={event => { setCategoryId(event.target.value); setError(undefined) }}>
                <option value="">Select a category</option>
                {categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>}
            {category && <>
              <label className="block space-y-1 text-xs font-medium"><span>Property name</span>
                <Input value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g., Due date" maxLength={240} required />
              </label>
              <label className="block space-y-1 text-xs font-medium"><span>Property type</span>
                <select className={selectClass} value={type} onChange={event => setType(event.target.value)}>
                  {Object.entries(fieldTypes).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
              </label>
              {type === "select" && <label className="block space-y-1 text-xs font-medium"><span>Options (one per line)</span>
                <Textarea value={options} onChange={event => setOptions(event.target.value)} rows={3} placeholder={"Open\nDone"} />
              </label>}
              {type === "relation" && <label className="block space-y-1 text-xs font-medium"><span>Relation target</span>
                <select className={selectClass} value={relationTarget} onChange={event => setRelationTarget(event.target.value)}>
                  {Object.entries(relationTargets).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
              </label>}
              {type === "relation" && relationTarget === "record" && <label className="block space-y-1 text-xs font-medium"><span>Target record category</span>
                <select className={selectClass} value={targetCategoryId} onChange={event => setTargetCategoryId(event.target.value)}>
                  <option value="">Any category</option>
                  {categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>}
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <Button variant="ghost" size="sm" type="button" className="px-2 text-xs" onClick={() => { setOpen(false); onManage(category) }}>Manage properties</Button>
                <Button size="sm" type="submit">{saving ? "Adding…" : "Add"}</Button>
              </div>
            </>}
          </fieldset>
        </form>
      </PopoverContent>
    </Popover>
  )
}