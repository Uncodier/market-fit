"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { fetchTableData, deleteTableRows } from "@/app/applications/actions"
import { TableMetadata } from "./TenantTablesExplorer"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { EditRowModal } from "./EditRowModal"
import { ForeignKeyPreviewButton } from "./ForeignKeyPreviewButton"
import { IsEmpty } from "@/app/components/ui/empty-state"
import { Database } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

import { Pagination } from "@/app/components/ui/pagination"

interface TableDataGridProps {
  schema: string
  table: TableMetadata
  refreshKey?: number
  isAddModalOpen?: boolean
  onAddModalClose?: () => void
  selectedRows?: any[]
  onSelectedRowsChange?: (rows: any[]) => void
}

export function TableDataGrid({ schema, table, refreshKey = 0, isAddModalOpen = false, onAddModalClose, selectedRows = [], onSelectedRowsChange }: TableDataGridProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [page, setPage] = useState(0)
  const pageSize = 50
  const [totalCount, setTotalCount] = useState(0)

  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Extract filters and sorts from URL
  const filters: { column: string; operator: string; value: any }[] = []
  const sorts: { column: string; ascending: boolean }[] = []
  
  searchParams.forEach((val, key) => {
    if (key.startsWith("f_")) {
      const column = key.replace("f_", "")
      const parts = val.split(":")
      if (parts.length >= 2) {
        const operator = parts[0]
        const value = parts.slice(1).join(":")
        filters.push({ column, operator, value })
      } else {
        filters.push({ column, operator: "eq", value: val })
      }
    } else if (key.startsWith("s_")) {
      const column = key.replace("s_", "")
      sorts.push({ column, ascending: val === "asc" })
    } else if (key.startsWith("filter_")) {
      // Legacy support
      filters.push({ column: key.replace("filter_", ""), operator: "eq", value: val })
    }
  })

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchTableData({
        schema,
        table: table.name,
        page,
        pageSize,
        primaryKey: table.primaryKey,
        filters,
        sorts
      })
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      setData(result.data || [])
      setTotalCount(result.count || 0)
      if (onSelectedRowsChange) onSelectedRowsChange([])
    } catch (err: any) {
      const errDetails = err?.message || err?.error_description || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error("Data grid error details:", errDetails, "Original error:", err);
      setError(errDetails || "Unknown error occurred while fetching data");
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [schema, table, page, searchParams, refreshKey])

  const handleNextPage = () => {
    if ((page + 1) * pageSize < totalCount) {
      setPage(page + 1)
    }
  }

  const handlePrevPage = () => {
    if (page > 0) {
      setPage(page - 1)
    }
  }

  const handleRowClick = (row: any) => {
    if (table.primaryKey) {
      setSelectedRow(row)
      setIsEditModalOpen(true)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (!table.primaryKey || !onSelectedRowsChange) return
    if (checked) {
      onSelectedRowsChange(data.map(r => r[table.primaryKey!]))
    } else {
      onSelectedRowsChange([])
    }
  }

  const handleSelectRow = (row: any, checked: boolean) => {
    if (!table.primaryKey || !onSelectedRowsChange) return
    const pkValue = row[table.primaryKey]
    if (checked) {
      onSelectedRowsChange([...selectedRows, pkValue])
    } else {
      onSelectedRowsChange(selectedRows.filter(v => v !== pkValue))
    }
  }

  // Handle bulk delete events from parent
  useEffect(() => {
    const handleBulkDeleteEvent = async () => {
      if (!table.primaryKey || selectedRows.length === 0) return
      
      if (!window.confirm(t("applications.confirmBulkDelete") || `Are you sure you want to delete ${selectedRows.length} rows?`)) {
        return
      }
      
      try {
        const result = await deleteTableRows({
          schema,
          table: table.name,
          primaryKey: table.primaryKey,
          primaryKeyValues: selectedRows
        })
        
        if (result.error) {
          throw new Error(result.error)
        }
        
        if (onSelectedRowsChange) onSelectedRowsChange([])
        loadData()
      } catch (err: any) {
        console.error("Bulk delete error:", err)
        setError(err.message || "Failed to delete rows")
      }
    }

    const handleClearSelectionEvent = () => {
      if (onSelectedRowsChange) onSelectedRowsChange([])
    }

    window.addEventListener('table:bulk-delete', handleBulkDeleteEvent)
    window.addEventListener('table:clear-selection', handleClearSelectionEvent)
    
    return () => {
      window.removeEventListener('table:bulk-delete', handleBulkDeleteEvent)
      window.removeEventListener('table:clear-selection', handleClearSelectionEvent)
    }
  }, [schema, table, selectedRows, onSelectedRowsChange, t])

  return (
    <div className="flex flex-col h-full w-full">
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto relative w-full">
        {loading && data.length === 0 ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted sticky top-0 z-20 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  {table.primaryKey && (
                    <th className="px-4 py-3 font-medium whitespace-nowrap w-[40px]">
                      <Checkbox 
                        checked={data.length > 0 && selectedRows.length === data.length}
                        onCheckedChange={(checked) => handleSelectAll(checked === true)}
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  {table.columns.map(col => (
                    <th key={col.name} className="px-4 py-3 font-medium whitespace-nowrap">
                      {col.name}
                      {col.is_primary && <span className="ml-1 text-[10px] text-primary">PK</span>}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={table.columns.length + (table.primaryKey ? 2 : 1)} className="px-4 py-8">
                      <div className="flex justify-center p-8">
                        <IsEmpty 
                          variant="fancy" 
                          icon={<Database />}
                          title={(t("applications.noRowsFound") || "No rows found in {table}").replace('{table}', table.name)}
                          description={t("applications.tableEmpty") || "This table is currently empty."}
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map((row, i) => {
                    const isSelected = table.primaryKey ? selectedRows.includes(row[table.primaryKey]) : false;
                    return (
                    <tr 
                      key={table.primaryKey ? row[table.primaryKey] : i} 
                      className={`hover:bg-muted/30 ${table.primaryKey ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : ''}`}
                      onClick={() => handleRowClick(row)}
                    >
                      {table.primaryKey && (
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectRow(row, checked === true)}
                            aria-label={`Select row`}
                          />
                        </td>
                      )}
                      {table.columns.map(col => (
                        <td key={col.name} className="px-4 py-2 max-w-[200px] truncate">
                          {row[col.name] === null ? (
                            <span className="text-muted-foreground/50 italic">null</span>
                          ) : typeof row[col.name] === 'object' ? (
                            JSON.stringify(row[col.name])
                          ) : col.foreign_key ? (
                            <div className="flex items-center">
                              <button
                                type="button"
                                className="text-primary hover:underline text-left truncate max-w-[160px]"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const params = new URLSearchParams(searchParams.toString())
                                  // clear previous filters and sorts
                                  const keysToDelete: string[] = []
                                  params.forEach((_, key) => {
                                    if (key.startsWith("filter_") || key.startsWith("f_") || key.startsWith("s_")) {
                                      keysToDelete.push(key)
                                    }
                                  })
                                  keysToDelete.forEach(key => params.delete(key))
                                  
                                  params.set("table", col.foreign_key!.table)
                                  params.set(`f_${col.foreign_key!.column}`, `eq:${String(row[col.name])}`)
                                  router.push(`${pathname}?${params.toString()}`)
                                }}
                                title={`View related row in ${col.foreign_key.table}`}
                              >
                                {String(row[col.name])}
                              </button>
                              <ForeignKeyPreviewButton 
                                schema={schema} 
                                tableName={col.foreign_key.table} 
                                columnName={col.foreign_key.column} 
                                value={row[col.name]} 
                              />
                            </div>
                          ) : (
                            String(row[col.name])
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs" 
                          disabled={!table.primaryKey}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRowClick(row)
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
        )}
      </div>
      
      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 border-t bg-background mt-auto flex-shrink-0">
        <div className="text-sm text-muted-foreground">
          Showing {data.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} rows
        </div>
        <Pagination 
          currentPage={page + 1}
          totalPages={Math.ceil(totalCount / pageSize)}
          onPageChange={(newPage) => setPage(newPage - 1)}
          disabled={loading}
        />
      </div>

      <EditRowModal
        schema={schema}
        table={table}
        row={selectedRow}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          loadData() // Refresh data after update
        }}
      />

      <EditRowModal
        schema={schema}
        table={table}
        row={null}
        isOpen={isAddModalOpen}
        onClose={() => onAddModalClose?.()}
        onSuccess={() => {
          loadData() // Refresh data after update
        }}
      />
    </div>
  )
}
