import { useState } from "react"
import { RecordCategory } from "../actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Switch } from "@/app/components/ui/switch"
import { PlusCircle, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "@/app/components/ui/icons"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { EmojiPicker } from "@/app/components/ui/emoji-picker"
import { isEmojiIcon } from "./category-icon"
import { recordFieldLabel } from "../lib/field-values"
import { DeleteRecordCategory } from "./DeleteRecordCategory"

interface CategoryTemplateEditorProps {
  isOpen: boolean
  onClose: () => void
  category?: RecordCategory | null
  categories?: RecordCategory[]
  onSave: (data: any) => Promise<void>
  onDeleted?: () => void
}

export function CategoryTemplateEditor({ isOpen, onClose, category, categories = [], onSave, onDeleted }: CategoryTemplateEditorProps) {
  const [name, setName] = useState(category?.name || "")
  const [description, setDescription] = useState(category?.description || "")
  const [icon, setIcon] = useState(category?.icon || "")
  const [parentCategoryId, setParentCategoryId] = useState<string>(category?.parent_category_id || "none")
  const [fields, setFields] = useState<any[]>(category?.template_fields || [])
  const [isSaving, setIsSaving] = useState(false)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())

  const addField = () => {
    const newId = Math.random().toString(36).substr(2, 9)
    setFields([...fields, { 
      id: newId, 
      name: "", 
      type: "text",
      aiPreview: { enabled: false, promptTemplate: "" }
    }])
    setExpandedFields(new Set(expandedFields).add(newId))
  }

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
    if (expandedFields.has(id)) {
      const next = new Set(expandedFields)
      next.delete(id)
      setExpandedFields(next)
    }
  }

  const updateField = (index: number, updates: any) => {
    const newFields = [...fields]
    const existing = category?.template_fields?.find(field => field.id === newFields[index].id)
    const next = { ...newFields[index], ...updates, ...(existing ? { name: existing.name } : {}) }
    if (updates.type && updates.type !== newFields[index].type) {
      if (next.type !== "number") {
        delete next.min
        delete next.max
      }
      if (!["text", "description", "location", "file"].includes(next.type)) {
        delete next.minLength
        delete next.maxLength
      }
      if (next.type !== "select") delete next.options
      if (next.type !== "relation") {
        delete next.relationTarget
        delete next.targetCategoryId
      }
      if (!["text", "description"].includes(next.type)) delete next.aiPreview
    }
    if (next.relationTarget !== "record") delete next.targetCategoryId
    newFields[index] = next
    setFields(newFields)
  }
  
  const moveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newFields = [...fields]
      const temp = newFields[index - 1]
      newFields[index - 1] = newFields[index]
      newFields[index] = temp
      setFields(newFields)
    } else if (direction === 'down' && index < fields.length - 1) {
      const newFields = [...fields]
      const temp = newFields[index + 1]
      newFields[index + 1] = newFields[index]
      newFields[index] = temp
      setFields(newFields)
    }
  }

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedFields)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpandedFields(next)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const dataToSave = {
      name,
      description,
      icon,
      parent_category_id: parentCategoryId === "none" ? null : parentCategoryId,
      template_fields: fields
    }
    try {
      await onSave(dataToSave)
      onClose()
    } catch {
      // The parent displays the actionable error and the dialog remains open.
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category Template" : "New Category Template"}</DialogTitle>
          <DialogDescription>
            Define the structure and fields for records in this category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <div className="relative flex items-center">
                <div className="absolute left-1 flex items-center justify-center">
                  <EmojiPicker value={isEmojiIcon(icon) ? icon : ""} onChange={setIcon} />
                </div>
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g., Knowledge Base" 
                  className="pl-11"
                />
              </div>
            </div>
            
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Parent Category</Label>
                <Select 
                  value={parentCategoryId} 
                  onValueChange={setParentCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Root Category)</SelectItem>
                    {categories
                      .filter(c => c.id !== category?.id) // Prevent self-referencing
                      .map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are these records about?" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Template Fields</Label>
              <Button size="sm" variant="outline" onClick={addField}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Field
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                No custom fields defined. By default, records will just have a title and description (markdown editor).
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const isExpanded = expandedFields.has(field.id)
                  return (
                    <SectionCard key={field.id} id={`field-${field.id}`}>
                      <SectionCardHeader
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => toggleExpanded(field.id)}
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <SectionCardTitle className="truncate">
                                {recordFieldLabel(field) || "Unnamed Field"}
                              </SectionCardTitle>
                              <p className="text-sm text-muted-foreground mt-1 truncate">
                                {field.type}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={index === 0}
                              onClick={() => moveField(index, 'up')}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={index === fields.length - 1}
                              onClick={() => moveField(index, 'down')}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeField(field.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <div 
                              className="ml-2 cursor-pointer p-1" 
                              onClick={() => toggleExpanded(field.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      </SectionCardHeader>

                      {isExpanded && (
                        <SectionCardContent className="border-t border-border/70 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`field-name-${field.id}`}>Field Name (Storage Key)</Label>
                              <Input 
                                id={`field-name-${field.id}`}
                                value={field.name} 
                                disabled={category?.template_fields?.some(existing => existing.id === field.id)}
                                onChange={(e) => updateField(index, { name: e.target.value })} 
                                placeholder="e.g., Feature Status"
                              />
                              <p className="text-xs text-muted-foreground">Saved field names are immutable so existing records keep their values.</p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`field-label-${field.id}`}>Display Label (Optional)</Label>
                              <Input
                                id={`field-label-${field.id}`}
                                value={field.label ?? ""}
                                onChange={(e) => updateField(index, { label: e.target.value || undefined })}
                                placeholder={field.name || "Display label"}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Field Type</Label>
                              <Select 
                                value={field.type} 
                                onValueChange={(val) => updateField(index, { type: val })}
                              >
                                <SelectTrigger aria-label={`Field type for ${field.name || "new field"}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text (Single line)</SelectItem>
                                  <SelectItem value="description">Description (Rich Text)</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                                  <SelectItem value="boolean">Boolean (Yes / No)</SelectItem>
                                  <SelectItem value="location">Location</SelectItem>
                                  <SelectItem value="relation">Relation (Link entity)</SelectItem>
                                  <SelectItem value="file">File / Image</SelectItem>
                                  <SelectItem value="table">Table Widget</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4">
                            <Label htmlFor={`field-required-${field.id}`}>Required</Label>
                            <Switch
                              id={`field-required-${field.id}`}
                              checked={field.required ?? false}
                              onCheckedChange={(required) => updateField(index, { required })}
                            />
                          </div>
                          {["number", "text", "description", "location", "file"].includes(field.type) && (
                            <div className="grid grid-cols-2 gap-4 pt-4">
                              {(field.type === "number" ? ["min", "max"] : ["minLength", "maxLength"]).map(bound => (
                                <div key={bound} className="space-y-2">
                                  <Label htmlFor={`field-${bound}-${field.id}`}>
                                    {bound === "min" ? "Minimum" : bound === "max" ? "Maximum" : bound === "minLength" ? "Minimum Length" : "Maximum Length"}
                                  </Label>
                                  <Input
                                    id={`field-${bound}-${field.id}`}
                                    type="number" step={field.type === "number" ? "any" : 1}
                                    min={field.type === "number" ? undefined : 0}
                                    value={field[bound] ?? ""}
                                    onChange={(e) => updateField(index, { [bound]: e.target.value === "" ? undefined : Number(e.target.value) })}
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Relation specific options */}
                          {field.type === 'relation' && (
                            <div className="space-y-2 pt-4 border-t mt-4">
                              <Label>Relation Target</Label>
                              <Select 
                                value={field.relationTarget || "lead"} 
                                onValueChange={(val) => updateField(index, { relationTarget: val })}
                              >
                                <SelectTrigger aria-label={`Relation target for ${field.name || "new field"}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="lead">Lead</SelectItem>
                                  <SelectItem value="company">Company</SelectItem>
                                  <SelectItem value="supplier">Supplier</SelectItem>
                                  <SelectItem value="sales_order">Sales Order</SelectItem>
                                  <SelectItem value="deal">Deal</SelectItem>
                                  {field.relationTarget === "person" && (
                                    <SelectItem value="person" disabled>Contact / Person (Legacy)</SelectItem>
                                  )}
                                  <SelectItem value="team_member">Team Member</SelectItem>
                                  <SelectItem value="campaign">Campaign</SelectItem>
                                  <SelectItem value="catalog_item">Catalog Item</SelectItem>
                                  <SelectItem value="content">Content</SelectItem>
                                  <SelectItem value="task">Task</SelectItem>
                                  <SelectItem value="sale">Sale</SelectItem>
                                  <SelectItem value="purchase">Purchase</SelectItem>
                                  <SelectItem value="quotation">Quotation</SelectItem>
                                  <SelectItem value="record">Record (Item)</SelectItem>
                                  <SelectItem value="record_category">Record Category</SelectItem>
                                </SelectContent>
                              </Select>
                              {field.relationTarget === "record" && (
                                <div className="space-y-2 pt-2">
                                  <Label>Target Record Category</Label>
                                  <Select
                                    value={field.targetCategoryId || "any"}
                                    onValueChange={(value) => updateField(index, { targetCategoryId: value === "any" ? undefined : value })}
                                  >
                                    <SelectTrigger aria-label={`Target record category for ${field.name || "new field"}`}>
                                      <SelectValue placeholder="Any category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="any">Any category (Generic record)</SelectItem>
                                      {categories.map(targetCategory => (
                                        <SelectItem key={targetCategory.id} value={targetCategory.id}>{targetCategory.name}</SelectItem>
                                      ))}
                                      {field.targetCategoryId && !categories.some(targetCategory => targetCategory.id === field.targetCategoryId) && (
                                        <SelectItem value={field.targetCategoryId} disabled>Unavailable category</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Select specific options */}
                          {field.type === 'select' && (
                            <div className="space-y-2 pt-4 border-t mt-4">
                              <Label>Options (comma separated)</Label>
                              <Input 
                                value={field.options?.join(", ") || ""} 
                                onChange={(e) => updateField(index, { options: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} 
                                placeholder="Option 1, Option 2, Option 3"
                              />
                            </div>
                          )}

                          {/* AI Preview options for descriptions/text */}
                          {(field.type === 'description' || field.type === 'text') && (
                            <div className="space-y-3 pt-4 border-t mt-4">
                              <div className="flex items-center justify-between">
                                <Label className="cursor-pointer" htmlFor={`ai-preview-${field.id}`}>Enable AI Image Preview</Label>
                                <Switch 
                                  id={`ai-preview-${field.id}`}
                                  checked={field.aiPreview?.enabled} 
                                  onCheckedChange={(checked) => updateField(index, { aiPreview: { ...field.aiPreview, enabled: checked } })}
                                />
                              </div>
                              {field.aiPreview?.enabled && (
                                <div className="space-y-2">
                                  <Label>AI Prompt Template</Label>
                                  <Textarea 
                                    value={field.aiPreview?.promptTemplate || ""} 
                                    onChange={(e) => updateField(index, { aiPreview: { ...field.aiPreview, promptTemplate: e.target.value } })}
                                    placeholder="Generate an image showing {value}"
                                    className="text-xs font-mono h-20"
                                  />
                                  <p className="text-[10px] text-muted-foreground">
                                    Use <code>{'{value}'}</code> to inject the field&apos;s content into the prompt.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </SectionCardContent>
                      )}
                    </SectionCard>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {category && onDeleted && <DeleteRecordCategory category={category} disabled={isSaving} onDeleted={onDeleted} />}
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !name}>
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}