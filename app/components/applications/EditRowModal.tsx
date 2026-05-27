"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Textarea } from "@/app/components/ui/textarea"
import { JsonEditor } from "./JsonEditor"
import { ArrayInput } from "./ArrayInput"
import { TableMetadata, ColumnMetadata } from "./TenantTablesExplorer"
import { updateTableRow, insertTableRow } from "@/app/applications/actions"

interface EditRowModalProps {
  schema: string
  table: TableMetadata
  row: Record<string, any> | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditRowModal({
  schema,
  table,
  row,
  isOpen,
  onClose,
  onSuccess
}: EditRowModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (row) {
        setFormData({ ...row })
      } else {
        setFormData({})
      }
      setError(null)
    }
  }, [row, isOpen])

  const handleInputChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (row && !table.primaryKey) return

    setLoading(true)
    setError(null)
    
    // For inserts, we don't extract primaryKeyValue unless it's provided. 
    // Usually PK is auto-generated, so we just pass formData.
    const updateData = { ...formData }
    const primaryKeyValue = row && table.primaryKey ? formData[table.primaryKey] : undefined
    
    if (row && table.primaryKey && primaryKeyValue !== undefined) {
      delete updateData[table.primaryKey]
    }

    try {
      // Parse some types back from strings before sending if necessary
      const parsedUpdateData = { ...updateData }
      table.columns.forEach(col => {
        // If updating, skip primary key
        if (row && col.name === table.primaryKey) return
        
        const type = col.type.toLowerCase()
        let val = parsedUpdateData[col.name]
        
        if (val === "" && col.nullable) {
          parsedUpdateData[col.name] = null
          return
        }

        if (val !== null && val !== undefined) {
          if (type.includes("json") && typeof val === "string") {
            try {
              parsedUpdateData[col.name] = JSON.parse(val)
            } catch (e) {
              // Ignore invalid JSON parsing here
            }
          } else if ((type.includes("int") || type.includes("numeric") || type.includes("real") || type.includes("double")) && typeof val === "string" && val !== "") {
            parsedUpdateData[col.name] = Number(val)
          }
        }
      })

      let result
      if (row) {
        result = await updateTableRow({
          schema,
          table: table.name,
          primaryKey: table.primaryKey,
          primaryKeyValue,
          data: parsedUpdateData
        })
      } else {
        result = await insertTableRow({
          schema,
          table: table.name,
          data: parsedUpdateData
        })
      }

      if (result.error) {
        throw new Error(result.error)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || (row ? "Failed to update row" : "Failed to add row"))
    } finally {
      setLoading(false)
    }
  }

  // Remove the 'if (!row) return null' since we want to support adding rows
  const renderInputForColumn = (col: ColumnMetadata, isPrimaryKey: boolean) => {
    const type = col.type.toLowerCase()
    let value = formData[col.name]
    
    // Disable primary key editing only if we are updating an existing row
    const isDisabled = (isPrimaryKey && !!row) || loading

    if (type.includes("boolean")) {
      return (
        <Switch
          id={col.name}
          checked={Boolean(value)}
          onCheckedChange={(checked) => handleInputChange(col.name, checked)}
          disabled={isDisabled}
        />
      )
    }

    if (type.includes("json")) {
      return (
        <JsonEditor
          value={value}
          onChange={(val) => handleInputChange(col.name, val)}
          disabled={isDisabled}
          className="h-32"
        />
      )
    }

    if (type.includes("[]") || type === "array" || type.includes("array")) {
      const arrayValue = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',').filter(Boolean) : [])
      return (
        <ArrayInput
          value={arrayValue}
          onChange={(val) => handleInputChange(col.name, val)}
          disabled={isDisabled}
        />
      )
    }
    
    if (type.includes("timestamp") || type.includes("date")) {
      // Very basic date/time input mapping
      const inputType = type.includes("time") ? "datetime-local" : "date"
      
      // format datetime for input
      let formattedValue = ""
      if (value) {
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            formattedValue = date.toISOString().slice(0, 16)
          } else {
            formattedValue = String(value)
          }
        } catch {
          formattedValue = String(value)
        }
      }

      return (
        <Input
          id={col.name}
          type={inputType}
          value={formattedValue}
          onChange={(e) => handleInputChange(col.name, e.target.value)}
          disabled={isDisabled}
        />
      )
    }

    if (type.includes("int") || type.includes("numeric") || type.includes("real") || type.includes("double")) {
      return (
        <Input
          id={col.name}
          type="number"
          value={value === null || value === undefined ? "" : value}
          onChange={(e) => handleInputChange(col.name, e.target.value)}
          disabled={isDisabled}
        />
      )
    }
    
    if (type.includes("text") || type === "character varying") {
      return (
        <Textarea
          id={col.name}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => handleInputChange(col.name, e.target.value)}
          disabled={isDisabled}
          className="h-20"
        />
      )
    }

    // Default Fallback
    return (
      <Input
        id={col.name}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => handleInputChange(col.name, e.target.value)}
        disabled={isDisabled}
      />
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{row ? "Edit Row" : "Add Row"} - {table.name}</DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 space-y-4 px-1">
          {table.columns.map(col => {
            const isPrimaryKey = col.name === table.primaryKey
            const isBoolean = col.type.toLowerCase().includes("boolean")
            
            return (
              <div key={col.name} className={`space-y-1.5 ${isBoolean ? 'flex items-center space-y-0 gap-3' : ''}`}>
                <Label htmlFor={col.name} className={`flex items-center gap-2 ${isBoolean ? 'min-w-[100px]' : ''}`}>
                  {col.name}
                  {isPrimaryKey && <span className="text-[10px] text-primary bg-primary/10 px-1 py-0.5 rounded">PK</span>}
                  <span className="text-[10px] text-muted-foreground ml-auto">{col.type}</span>
                </Label>
                {renderInputForColumn(col, isPrimaryKey)}
              </div>
            )
          })}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || (!!row && !table.primaryKey)}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
