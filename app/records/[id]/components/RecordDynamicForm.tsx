import React, { useEffect, useState } from "react"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Switch } from "@/app/components/ui/switch"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelect, RelationSelectOption } from "@/app/components/ui/relation-select"
import { UploadAssetDialog } from "@/app/components/upload-asset-dialog"
import { Button } from "@/app/components/ui/button"
import { 
  ImageIcon, 
  Type, 
  AlignLeft, 
  Hash, 
  CalendarIcon, 
  List, 
  CheckSquare, 
  MapPin, 
  LinkIcon, 
  TableRows,
  Activity,
  Folder,
  Clock
} from "@/app/components/ui/icons"
import { AIFieldPreview } from "./AIFieldPreview"
import { TableWidget } from "./TableWidget"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { RecordItem } from "../../actions"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { toast } from "sonner"

interface RecordDynamicFormProps {
  fields: any[]
  formData: Record<string, any>
  relationsData: Record<string, any>
  status: string
  record: RecordItem
  onChange: (field: string, value: any, type: "field" | "relation") => void
  onStatusChange: (status: string) => void
}

export function RecordDynamicForm({ fields, formData, relationsData, status, record, onChange, onStatusChange }: RecordDynamicFormProps) {
  const { currentSite } = useSite()
  const [relationOptions, setRelationOptions] = useState<Record<string, RelationSelectOption[]>>({})
  const searchTimeouts = React.useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    if (!currentSite?.id || !fields.length) return

    const fetchRelations = async () => {
      const supabase = createClient()
      const optionsMap: Record<string, RelationSelectOption[]> = {}
      
      const relationFields = fields.filter((f: any) => f.type === "relation")
      
      for (const field of relationFields) {
        const target = field.relationTarget || "lead"
        if (optionsMap[target]) continue // already fetched this target

        let table = target
        let selectFields = "id"
        let nameField = "name"
        
        if (target === "lead") { table = "leads"; selectFields = "id, name, company"; nameField = "name" }
        else if (target === "company") { table = "companies"; selectFields = "id, name"; nameField = "name" }
        else if (target === "sales_order") { table = "orders"; selectFields = "id, order_number"; nameField = "order_number" }
        else if (target === "deal") { table = "deals"; selectFields = "id, title"; nameField = "title" }
        else if (target === "person") { table = "users"; selectFields = "id, name, email"; nameField = "name" }
        else if (target === "campaign") { table = "campaigns"; selectFields = "id, title"; nameField = "title" }
        else if (target === "catalog_item") { table = "products"; selectFields = "id, name"; nameField = "name" }
        else if (target === "content") { table = "content"; selectFields = "id, title"; nameField = "title" }
      else if (target === "task") { table = "tasks"; selectFields = "id, title"; nameField = "title" }
      else if (target === "sale") { table = "sales"; selectFields = "id, title"; nameField = "title" }
      else if (target === "purchase") { table = "purchases"; selectFields = "id, title"; nameField = "title" }
      else if (target === "quotation") { table = "quotations"; selectFields = "id, title"; nameField = "title" }
      else if (target === "record") { table = "records"; selectFields = "id, title"; nameField = "title" }
        else if (target === "record_category") { table = "record_categories"; selectFields = "id, name"; nameField = "name" }

        try {
          const { data } = await supabase
            .from(table)
            .select(selectFields)
            .eq("site_id", currentSite.id)
            .limit(100) // Load first 100 on initial mount

          if (data) {
            optionsMap[target] = data.map((item: any) => ({
              id: item.id,
              label: item[nameField] || item.id,
              searchText: Object.values(item).filter(Boolean).join(" ")
            }))
          }
        } catch (error) {
          console.error(`Error fetching options for ${target}:`, error)
          optionsMap[target] = []
        }
      }
      
      setRelationOptions(optionsMap)
    }

    fetchRelations()
  }, [fields, currentSite?.id])

  const handleSearchChange = (target: string, query: string) => {
    if (!currentSite?.id) return
    
    // Clear previous timeout
    if (searchTimeouts.current[target]) {
      clearTimeout(searchTimeouts.current[target])
    }
    
    // Only search if we have a reasonable query string
    if (!query || query.trim().length < 2) return

    searchTimeouts.current[target] = setTimeout(async () => {
      const supabase = createClient()
      
      let table = target
      let selectFields = "id"
      let nameField = "name"
      
      if (target === "lead") { table = "leads"; selectFields = "id, name, company"; nameField = "name" }
      else if (target === "company") { table = "companies"; selectFields = "id, name"; nameField = "name" }
      else if (target === "sales_order") { table = "orders"; selectFields = "id, order_number"; nameField = "order_number" }
      else if (target === "deal") { table = "deals"; selectFields = "id, title"; nameField = "title" }
      else if (target === "person") { table = "users"; selectFields = "id, name, email"; nameField = "name" }
      else if (target === "campaign") { table = "campaigns"; selectFields = "id, title"; nameField = "title" }
      else if (target === "catalog_item") { table = "products"; selectFields = "id, name"; nameField = "name" }
      else if (target === "content") { table = "content"; selectFields = "id, title"; nameField = "title" }
      else if (target === "task") { table = "tasks"; selectFields = "id, title"; nameField = "title" }
      else if (target === "sale") { table = "sales"; selectFields = "id, title"; nameField = "title" }
      else if (target === "purchase") { table = "purchases"; selectFields = "id, title"; nameField = "title" }
      else if (target === "quotation") { table = "quotations"; selectFields = "id, title"; nameField = "title" }
      else if (target === "record") { table = "records"; selectFields = "id, title"; nameField = "title" }
      else if (target === "record_category") { table = "record_categories"; selectFields = "id, name"; nameField = "name" }

      try {
        const { data } = await supabase
          .from(table)
          .select(selectFields)
          .eq("site_id", currentSite.id)
          .ilike(nameField, `%${query.trim()}%`)
          .limit(20)

        if (data && data.length > 0) {
          setRelationOptions(prev => {
            const currentOptions = prev[target] || []
            const newOptionsMap = new Map(currentOptions.map(opt => [opt.id, opt]))
            
            data.forEach((item: any) => {
              newOptionsMap.set(item.id, {
                id: item.id,
                label: item[nameField] || item.id,
                searchText: Object.values(item).filter(Boolean).join(" ")
              })
            })
            
            return {
              ...prev,
              [target]: Array.from(newOptionsMap.values())
            }
          })
        }
      } catch (error) {
        console.error(`Error searching options for ${target}:`, error)
      }
    }, 300)
  }
  
  const renderField = (field: any) => {
    const commonInputClass = "bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:bg-transparent shadow-none px-2 h-8 rounded-md w-full"
    
    switch (field.type) {
      case "text":
        return (
          <div className="w-full">
            <Input 
              value={formData[field.name] || ""} 
              onChange={(e) => onChange(field.name, e.target.value, "field")}
              placeholder="Empty"
              className={commonInputClass}
            />
            {field.aiPreview?.enabled && (
              <div className="flex flex-col gap-2 pt-1 px-2">
                <AIFieldPreview 
                  promptTemplate={field.aiPreview.promptTemplate}
                  value={formData[field.name]}
                  fieldName={field.name}
                />
              </div>
            )}
          </div>
        )
      
      case "description":
        return (
          <div className="w-full py-1">
            <Textarea 
              value={formData[field.name] || ""} 
              onChange={(e) => onChange(field.name, e.target.value, "field")}
              placeholder="Empty"
              className="min-h-[80px] bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:bg-transparent shadow-none px-2 rounded-md resize-y"
            />
            {field.aiPreview?.enabled && (
              <div className="flex flex-col gap-2 pt-1 px-2">
                <AIFieldPreview 
                  promptTemplate={field.aiPreview.promptTemplate}
                  value={formData[field.name]}
                  fieldName={field.name}
                />
              </div>
            )}
          </div>
        )
      
      case "number":
        return (
          <Input 
            type="number"
            value={formData[field.name] || ""} 
            onChange={(e) => onChange(field.name, e.target.value ? Number(e.target.value) : null, "field")}
            placeholder="0"
            className={commonInputClass}
          />
        )

      case "location":
        return (
          <Input 
            value={formData[field.name] || ""} 
            onChange={(e) => onChange(field.name, e.target.value, "field")}
            placeholder="Empty"
            className={commonInputClass}
          />
        )

      case "date":
        return (
          <div className="w-full flex items-center">
            <DatePicker 
              date={formData[field.name] ? new Date(formData[field.name]) : undefined} 
              setDate={(date) => onChange(field.name, date?.toISOString(), "field")}
              className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md w-full sm:w-auto min-w-[200px]"
              placeholder="Empty"
            />
          </div>
        )

      case "select":
        return (
          <div className="w-full flex items-center">
            <RelationSelect
              options={(field.options || []).map((opt: string) => ({ id: opt, label: opt }))}
              value={formData[field.name] ? { mode: "existing", id: formData[field.name], label: formData[field.name] } : null}
              onValueChange={(val) => {
                if (!val) {
                  onChange(field.name, "", "field")
                } else if (val.mode === "existing") {
                  onChange(field.name, val.id, "field")
                } else if (val.mode === "create") {
                  onChange(field.name, val.label, "field")
                }
              }}
              allowCreate={true}
              placeholder="Empty"
              className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md w-full"
            />
          </div>
        )

      case "boolean":
        return (
          <div className="flex items-center px-2 h-8">
            <Switch 
              checked={!!formData[field.name]}
              onCheckedChange={(checked) => onChange(field.name, checked, "field")}
              className="scale-75 origin-left"
            />
          </div>
        )

      case "relation":
        const target = field.relationTarget || "lead"
        const options = relationOptions[target] || []
        const selectedId = relationsData[field.name]
        const selectedOption = options.find(o => o.id === selectedId)
        
        return (
          <div className="w-full flex items-center">
            <RelationSelect
              options={options}
              value={selectedId ? { mode: "existing", id: selectedId, label: selectedOption?.label || selectedId } : null}
              onSearchChange={(q) => handleSearchChange(target, q)}
              onValueChange={async (val) => {
                if (!val) {
                  onChange(field.name, null, "relation")
                  return
                }
                
                if (val.mode === "existing") {
                  onChange(field.name, val.id, "relation")
                  return
                }
                
                if (val.mode === "create") {
                  if (!currentSite?.id) {
                    toast.error("Please select a site first")
                    return
                  }
                  
                  const toastId = toast.loading(`Creating ${target}...`)
                  try {
                    const { id, error } = await resolveRelationId(target as any, val, currentSite.id)
                    
                    if (error) throw new Error(error)
                    
                    if (id) {
                      onChange(field.name, id, "relation")
                      toast.success(`Created successfully`, { id: toastId })
                      
                      setRelationOptions(prev => {
                        const targetOptions = [...(prev[target] || [])]
                        targetOptions.push({ id, label: val.label, searchText: val.label })
                        return { ...prev, [target]: targetOptions }
                      })
                    }
                  } catch (error) {
                    console.error("Error resolving relation:", error)
                    toast.error(error instanceof Error ? error.message : "Failed to create", { id: toastId })
                  }
                }
              }}
              allowCreate={true}
              placeholder="Empty"
              className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md w-full"
            />
          </div>
        )
      
      case "file":
        return (
          <div className="flex items-center gap-2 px-2 py-1 w-full">
            {formData[field.name] ? (
              <div className="flex items-center gap-2 max-w-full">
                <a href={formData[field.name]} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline truncate">
                  {typeof formData[field.name] === 'string' ? formData[field.name].split('/').pop() : 'Attached file'}
                </a>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => onChange(field.name, "", "field")}>×</Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted/30" onClick={() => document.getElementById(`upload-${field.id}`)?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" /> Add file
                </Button>
                <Input 
                  placeholder="Or URL..." 
                  value={formData[field.name] || ""} 
                  onChange={(e) => onChange(field.name, e.target.value, "field")}
                  className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md flex-1 min-w-0"
                />
              </>
            )}
          </div>
        )
      
      case "table":
        return (
          <div className="w-full pt-1 px-2 pb-2">
            <TableWidget 
              value={formData[field.name] || []}
              onChange={(data) => onChange(field.name, data, "field")}
            />
          </div>
        )

      default:
        return null
    }
  }

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="h-3.5 w-3.5" />
      case 'description': return <AlignLeft className="h-3.5 w-3.5" />
      case 'number': return <Hash className="h-3.5 w-3.5" />
      case 'date': return <CalendarIcon className="h-3.5 w-3.5" />
      case 'select': return <List className="h-3.5 w-3.5" />
      case 'boolean': return <CheckSquare className="h-3.5 w-3.5" />
      case 'location': return <MapPin className="h-3.5 w-3.5" />
      case 'relation': return <LinkIcon className="h-3.5 w-3.5" />
      case 'file': return <ImageIcon className="h-3.5 w-3.5" />
      case 'table': return <TableRows className="h-3.5 w-3.5" />
      default: return <Type className="h-3.5 w-3.5" />
    }
  }

  return (
    <div className="flex flex-col gap-0.5 pb-4 border-b border-border/30">
      
      {/* Metadata fields */}
      <div className="group flex flex-col sm:flex-row sm:items-center py-1 -mx-2 rounded-lg transition-colors">
        <div className="w-full sm:w-[200px] shrink-0 pt-1 sm:pt-0 px-2">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="text-muted-foreground/60"><Activity className="h-3.5 w-3.5" /></span>
            Status
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md w-full sm:w-auto min-w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="my-3 border-t border-border/20 w-full" />

      {fields.map(field => {
        const isFullWidth = field.type === "description" || field.type === "table";
        return (
          <div key={field.id} className="group flex flex-col sm:flex-row sm:items-start py-1 -mx-2 rounded-lg transition-colors">
            <div className="w-full sm:w-[200px] shrink-0 pt-1.5 px-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-muted-foreground/60">{getFieldIcon(field.type)}</span>
                {field.name}
              </div>
            </div>
            <div className={`flex-1 min-w-0 ${isFullWidth ? "mt-1 sm:mt-0" : ""}`}>
              {renderField(field)}
            </div>
          </div>
        )
      })}
    </div>
  )
}