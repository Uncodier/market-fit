"use client"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/app/components/ui/select"
import { ArrowUp, ArrowDown, X } from "@/app/components/ui/icons"
import { ColumnMetadata } from "./TenantTablesExplorer"

export function SortToolbarButton({ columns }: { columns: ColumnMetadata[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isOpen, setIsOpen] = useState(false)

  const activeSorts: { column: string; ascending: boolean; key: string }[] = []
  searchParams.forEach((val, key) => {
    if (key.startsWith("s_")) {
      activeSorts.push({ column: key.replace("s_", ""), ascending: val === "asc", key })
    }
  })

  const addSort = (column: string, ascending: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(`s_${column}`, ascending ? "asc" : "desc")
    router.push(`${pathname}?${params.toString()}`)
    setIsOpen(false)
  }

  const removeSort = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-sm transition-all duration-300">
          <ArrowUp className="h-4 w-4 mr-1.5 text-primary" />
          Sort {activeSorts.length > 0 && `(${activeSorts.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Sort data</h4>
          
          {activeSorts.length > 0 && (
            <div className="space-y-2">
              {activeSorts.map((sort) => (
                <div key={sort.key} className="flex items-center justify-between bg-muted/50 p-2 rounded-md text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sort.column}</span>
                    <span className="text-muted-foreground text-xs">
                      {sort.ascending ? "Ascending" : "Descending"}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSort(sort.key)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2">
            <Select onValueChange={(val) => {
              const [col, order] = val.split(":")
              addSort(col, order === "asc")
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Add sort..." />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectGroup key={col.name}>
                    <SelectItem value={`${col.name}:asc`}>
                      {col.name} (Ascending)
                    </SelectItem>
                    <SelectItem value={`${col.name}:desc`}>
                      {col.name} (Descending)
                    </SelectItem>
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
