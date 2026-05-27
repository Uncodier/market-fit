"use client"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Input } from "@/app/components/ui/input"
import { Filter, X, Plus } from "@/app/components/ui/icons"
import { ColumnMetadata } from "./TenantTablesExplorer"

const OPERATORS = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equal" },
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lte", label: "Less or equal" },
  { value: "ilike", label: "Contains" },
  { value: "is", label: "Is (null)" },
  { value: "in", label: "In (comma separated)" }
]

export function FilterToolbarButton({ columns }: { columns: ColumnMetadata[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isOpen, setIsOpen] = useState(false)
  const [newFilter, setNewFilter] = useState({ column: "", operator: "eq", value: "" })

  const activeFilters: { column: string; operator: string; value: string; key: string }[] = []
  searchParams.forEach((val, key) => {
    if (key.startsWith("f_")) {
      const parts = val.split(":")
      if (parts.length >= 2) {
        activeFilters.push({ 
          column: key.replace("f_", ""), 
          operator: parts[0], 
          value: parts.slice(1).join(":"),
          key 
        })
      } else {
        activeFilters.push({ 
          column: key.replace("f_", ""), 
          operator: "eq", 
          value: val,
          key 
        })
      }
    }
  })

  const addFilter = () => {
    if (!newFilter.column) return
    const params = new URLSearchParams(searchParams.toString())
    params.set(`f_${newFilter.column}`, `${newFilter.operator}:${newFilter.value}`)
    router.push(`${pathname}?${params.toString()}`)
    setNewFilter({ column: "", operator: "eq", value: "" })
    setIsOpen(false)
  }

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-sm transition-all duration-300">
          <Filter className="h-4 w-4 mr-1.5 text-primary" />
          Filter {activeFilters.length > 0 && `(${activeFilters.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Filter data</h4>
          
          {activeFilters.length > 0 && (
            <div className="space-y-2">
              {activeFilters.map((filter) => (
                <div key={filter.key} className="flex items-center justify-between bg-muted/50 p-2 rounded-md text-sm">
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="font-medium truncate">{filter.column}</span>
                    <span className="text-muted-foreground text-xs truncate">
                      {OPERATORS.find(o => o.value === filter.operator)?.label || filter.operator} {filter.value}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFilter(filter.key)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Select value={newFilter.column} onValueChange={(val) => setNewFilter(prev => ({ ...prev, column: val }))}>
              <SelectTrigger>
                <SelectValue placeholder="Column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newFilter.operator} onValueChange={(val) => setNewFilter(prev => ({ ...prev, operator: val }))}>
              <SelectTrigger>
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map(op => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input 
              placeholder="Value" 
              value={newFilter.value}
              onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addFilter()
              }}
            />

            <Button onClick={addFilter} disabled={!newFilter.column} className="w-full gap-2 mt-2">
              <Plus className="h-4 w-4" /> Apply Filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
