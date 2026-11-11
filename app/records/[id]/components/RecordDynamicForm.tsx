import React, { useMemo } from "react"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelect } from "@/app/components/ui/relation-select"
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
} from "@/app/components/ui/icons"
import { AIFieldPreview } from "./AIFieldPreview"
import { TableWidget } from "./TableWidget"
import { useSite } from "@/app/context/SiteContext"
import { RecordItem } from "../../actions"
import { useRelationOptions } from "./use-relation-options"
import { relationFieldTargetKey } from "../../lib/relation-target"
import { recordFieldDate, recordFieldLabel, serializeRecordFieldDate } from "../../lib/field-values"

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
  const selectedRelationIds = useMemo(
    () => Object.values(relationsData).filter((value): value is string => typeof value === "string"),
    [relationsData],
  )
  const { relationOptions, relationErrors, handleSearchChange } = useRelationOptions(
    fields,
    record.site_id === currentSite?.id ? record.site_id : undefined,
    selectedRelationIds,
  )
  
  const renderField = (field: any) => {
    const commonInputClass = "bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:bg-transparent shadow-none px-2 h-8 rounded-md w-full"
    
    switch (field.type) {
      case "text":
        return (
          <div className="w-full">
            <Input 
              aria-label={recordFieldLabel(field)}
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
              aria-label={recordFieldLabel(field)}
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
            aria-label={recordFieldLabel(field)}
            value={formData[field.name] ?? ""}
            required={field.required}
            min={field.min}
            max={field.max}
            step="any"
            onChange={(e) => onChange(field.name, e.target.value ? Number(e.target.value) : null, "field")}
            placeholder="0"
            className={commonInputClass}
          />
        )

      case "location":
        return (
          <Input 
            aria-label={recordFieldLabel(field)}
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
              date={recordFieldDate(formData[field.name])}
              setDate={(date) => onChange(field.name, serializeRecordFieldDate(date), "field")}
              className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md w-full sm:w-auto min-w-[200px]"
              placeholder="Empty"
            />
          </div>
        )

      case "select":
        return (
          <div className="w-full flex items-center">
            <RelationSelect
              label={recordFieldLabel(field)}
              options={(field.options || []).map((opt: string) => ({ id: opt, label: opt }))}
              value={formData[field.name] ? { mode: "existing", id: formData[field.name], label: formData[field.name] } : null}
              onValueChange={(val) => {
                if (!val) {
                  onChange(field.name, null, "field")
                } else if (val.mode === "existing" && field.options?.includes(val.id)) {
                  onChange(field.name, val.id, "field")
                }
              }}
              allowCreate={false}
              placeholder="Empty"
              className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md w-full"
            />
          </div>
        )

      case "boolean":
        return (
          <Select
            value={formData[field.name] === true ? "true" : formData[field.name] === false ? "false" : "unset"}
            onValueChange={(value) => onChange(field.name, value === "unset" ? null : value === "true", "field")}
          >
            <SelectTrigger aria-label={recordFieldLabel(field)} className={commonInputClass}>
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset" disabled={field.required}>Not set</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        )

      case "relation":
        const target = relationFieldTargetKey(field)
        const options = relationOptions[target] || []
        const selectedId = relationsData[field.name]
        const selectedOption = options.find(o => o.id === selectedId)
        
        return (
          <div className="w-full flex flex-col">
            <RelationSelect
              label={recordFieldLabel(field)}
              options={options}
              value={selectedId ? { mode: "existing", id: selectedId, label: selectedOption?.label || selectedId } : null}
              onSearchChange={(q) => handleSearchChange(target, q)}
              onValueChange={(val) => {
                if (!val) {
                  onChange(field.name, null, "relation")
                  return
                }
                
                if (val.mode === "existing") {
                  onChange(field.name, val.id, "relation")
                  return
                }
              }}
              allowCreate={false}
              placeholder="Empty"
              className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md w-full"
            />
            {relationErrors[target] && <p role="alert" className="px-2 text-xs text-destructive">{relationErrors[target]}</p>}
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
            <SelectTrigger aria-label="Record status" className="bg-transparent border-0 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30 shadow-none px-2 h-8 rounded-md w-full sm:w-auto min-w-[200px]">
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
          <div key={field.id} role="group" aria-label={recordFieldLabel(field)} className="group flex flex-col sm:flex-row sm:items-start py-1 -mx-2 rounded-lg transition-colors">
            <div className="w-full sm:w-[200px] shrink-0 pt-1.5 px-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-muted-foreground/60">{getFieldIcon(field.type)}</span>
                {recordFieldLabel(field)}{field.required ? " *" : ""}
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