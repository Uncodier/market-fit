"use client"

import { useState } from "react"
import { Eye } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Skeleton } from "@/app/components/ui/skeleton"
import { fetchTableData } from "@/app/applications/actions"

interface ForeignKeyPreviewButtonProps {
  schema: string
  tableName: string
  columnName: string
  value: any
}

export function ForeignKeyPreviewButton({ schema, tableName, columnName, value }: ForeignKeyPreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    if (data || loading) return
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await fetchTableData({
        schema,
        table: tableName,
        page: 0,
        pageSize: 1,
        primaryKey: null,
        filters: [{ column: columnName, operator: "eq", value }]
      })
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      if (result.data && result.data.length > 0) {
        setData(result.data[0])
      } else {
        setError("Record not found")
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (open) loadData()
    }}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5 ml-1 text-muted-foreground hover:text-foreground shrink-0" 
          onClick={(e) => e.stopPropagation()}
          title="Preview record"
        >
          <Eye className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <span className="text-muted-foreground">{tableName}</span>
            <span className="bg-muted px-1.5 py-0.5 rounded text-xs">{value}</span>
          </h4>
          
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : data ? (
            <div className="text-sm space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(data).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 border-b border-border/50 pb-1 last:border-0">
                  <span className="text-muted-foreground truncate" title={k}>{k}</span>
                  <span className="col-span-2 truncate" title={String(v)}>
                    {v === null ? (
                      <span className="text-muted-foreground/50 italic">null</span>
                    ) : typeof v === 'object' ? (
                      JSON.stringify(v)
                    ) : (
                      String(v)
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
