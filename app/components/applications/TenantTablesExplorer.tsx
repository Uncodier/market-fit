"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTheme } from "@/app/context/ThemeContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Search, ChevronLeft, ChevronRight, Database, X, Plus } from "@/app/components/ui/icons"
import { TableDataGrid } from "./TableDataGrid"
import { Input } from "@/app/components/ui/input"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"
import { IsEmpty } from "@/app/components/ui/empty-state"

import { SortToolbarButton } from "./SortToolbarButton"
import { FilterToolbarButton } from "./FilterToolbarButton"

export interface ForeignKeyReference {
  table: string
  column: string
}

export interface ColumnMetadata {
  name: string
  type: string
  nullable: boolean
  is_primary: boolean
  default: any
  foreign_key?: ForeignKeyReference
}

export interface TableMetadata {
  name: string
  schema: string
  columns: ColumnMetadata[]
  primaryKey: string | null
  count?: number
}

export function TenantTablesExplorer({ tenantId }: { tenantId: string }) {
  const { t } = useLocalization()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  
  const schemaParam = searchParams.get("schema")
  const tableParam = searchParams.get("table")

  const [schema, setSchema] = useState<string | null>(schemaParam)
  const [tables, setTables] = useState<TableMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isListCollapsed, setIsListCollapsed] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const { isDarkMode } = useTheme()

  const toggleList = useCallback(() => {
    setIsListCollapsed(!isListCollapsed)
  }, [isListCollapsed])

  // Fetch schema if not provided in URL
  useEffect(() => {
    async function resolveSchema() {
      if (schemaParam) {
        setSchema(schemaParam)
        return
      }
      
      try {
        const res = await fetch(`/api/applications/tenants?tenantId=${tenantId}`)
        if (!res.ok) throw new Error("Tenant schema not found.")
        
        const data = await res.json()
        setSchema(data.schema)
        
        // Update URL
        const params = new URLSearchParams(searchParams.toString())
        params.set("schema", data.schema)
        router.replace(`${pathname}?${params.toString()}`)
      } catch (err) {
        setError("Tenant schema not found.")
      }
    }
    
    resolveSchema()
  }, [tenantId, schemaParam, searchParams, pathname, router])

  // Fetch tables metadata
  useEffect(() => {
    if (!schema) return

    async function fetchTables() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/applications/tables?schema=${schema}`)
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || "Failed to fetch tables")
        }
        const data = await res.json()
        setTables(data)
      } catch (err: any) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchTables()
  }, [schema])

  const handleTableSelect = (tableName: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    // Clear any previous filters when switching tables
    const keysToDelete: string[] = []
    params.forEach((_, key) => {
      if (key.startsWith("filter_") || key.startsWith("f_") || key.startsWith("s_")) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => params.delete(key))
    
    params.set("table", tableName)
    router.push(`${pathname}?${params.toString()}`)
  }

  const filteredTables = tables.filter(t => 
    t.name !== "_meta" && t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedTableMeta = tables.find(t => t.name === tableParam)

  const [selectedRows, setSelectedRows] = useState<any[]>([])

  const handleSelectionChange = (newSelection: any[]) => {
    setSelectedRows(newSelection)
  }

  // Effect to update breadcrumb
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('breadcrumb:update', {
        detail: {
          title: selectedTableMeta ? selectedTableMeta.name : "Database Details"
        }
      }))
    }
  }, [selectedTableMeta?.name])

  if (error) {
    return (
      <div className="flex h-[calc(100vh-var(--topbar-height,64px))] w-full items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <X className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold">Could not load schema</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 w-full bg-background flex-row relative overflow-hidden">
      {/* Sidebar List */}
      <div className={cn(
        "h-full transition-all duration-300 ease-in-out z-[55] bg-background flex-shrink-0 border-r dark:border-white/5 border-black/5 absolute md:relative flex flex-col overflow-hidden",
        "top-0 bottom-0",
        tableParam ? "hidden md:flex" : "w-full",
        !tableParam && "md:w-[319px]",
        isListCollapsed
          ? "w-0 md:w-0 md:opacity-0 -translate-x-full md:translate-x-0 border-none pointer-events-none"
          : "w-full md:w-[319px] translate-x-0",
        !isListCollapsed && !tableParam && "w-full md:w-[319px]"
      )}>
        {!(searchParams.get("artifact") === "true") && (
          <div className="p-4 border-b h-[71px] min-h-[71px] flex items-center shrink-0">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tables..."
                className="pl-9 h-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-full text-left py-3 px-4 rounded-none border-b dark:border-white/5 border-black/5" style={{ boxSizing: 'border-box' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Skeleton className="h-4 w-[60%]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <IsEmpty 
                variant="fancy" 
                icon={<Database />}
                title={t("applications.tablesEmptyTitle") || "No tables found"}
                description={t("applications.tablesEmpty") || "Try adjusting your search terms"}
              />
            </div>
          ) : (
            filteredTables.map((table) => {
              const isSelected = tableParam === table.name;
              return (
                <div
                  key={table.name}
                  className={cn(
                    "w-full text-left py-3 px-4 rounded-none transition-colors border-b dark:border-white/5 border-black/5",
                    "hover:bg-accent/20 group",
                    isSelected && isDarkMode 
                      ? "bg-primary/15" 
                      : isSelected && "bg-primary/10"
                  )}
                  style={{ 
                    boxSizing: 'border-box',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleTableSelect(table.name)}
                >
                  <div
                    className="w-full text-left"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'block'
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={cn(
                          "font-medium text-sm truncate",
                          isSelected && "text-primary"
                        )}>
                          {table.name}
                        </span>
                      </div>
                      {table.count !== undefined && (
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {table.count.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out min-w-0 min-h-0 relative",
        !tableParam ? "hidden md:flex" : "flex"
      )} style={{ width: "100%", flex: "1" }}>
        
        {/* Toolbar Header */}
        <div className="w-full z-[50] flex-none border-b dark:border-white/5 border-black/5 h-[71px] flex items-center bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 pr-4">
          {/* Back Button for Mobile */}
          <div className="md:hidden absolute left-0 top-0 h-full flex items-center pl-2 z-[1000]">
            <Button variant="ghost" size="icon" onClick={() => {
              if (tableParam) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("table")
                router.push(`${pathname}?${params.toString()}`)
              } else {
                const isArtifact = searchParams.get("artifact") === "true"
                const robotInstanceId = searchParams.get("robotInstanceId")
                
                let backUrl = '/applications/database'
                if (isArtifact) {
                  backUrl += '?artifact=true'
                  if (robotInstanceId) {
                    backUrl += `&robotInstanceId=${robotInstanceId}`
                  }
                }
                router.push(backUrl)
              }
            }} className="h-8 w-8">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Toggle Button */}
          <div className="hidden md:flex shrink-0 items-stretch relative z-[60]">
            <div className="z-[1000] flex items-center gap-2 h-[71px] max-h-[71px] min-h-[71px] px-2 sm:px-3 transition-all duration-300 ease-in-out shrink-0 relative w-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleList}
                className="h-8 w-8 rounded-full font-inter font-bold bg-background transition-all duration-300 ease-in-out hover:bg-muted shrink-0"
                aria-label={isListCollapsed ? "Show tables" : "Hide tables"}
              >
                {isListCollapsed ? (
                  <ChevronRight className="h-4 w-4 transition-transform duration-200" />
                ) : (
                  <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
                )}
              </Button>
            </div>
          </div>

          {/* Title & Actions */}
          <div className="flex-1 min-w-0 flex items-center justify-between transition-all duration-300 ease-in-out pr-4 md:pr-0 pl-2">
            <div className="flex items-center gap-2 transition-opacity duration-300 ease-in-out min-w-0 overflow-x-auto no-scrollbar">
              {selectedRows.length > 0 ? (
                <>
                  <span className="text-sm font-medium text-foreground px-2">
                    {selectedRows.length} {selectedRows.length === 1 ? 'row' : 'rows'} selected
                  </span>
                  <div className="w-px h-4 bg-border mx-1 shrink-0" />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('table:clear-selection'))
                      }
                    }}
                  >
                    Clear
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('table:bulk-delete'))
                      }
                    }}
                  >
                    Delete Selected
                  </Button>
                </>
              ) : selectedTableMeta ? (
                <>
                  <FilterToolbarButton columns={selectedTableMeta.columns} />
                  <SortToolbarButton columns={selectedTableMeta.columns} />

                  {Array.from(searchParams.entries()).some(([key]) => key.startsWith("f_") || key.startsWith("filter_") || key.startsWith("s_")) && (
                    <div className="w-px h-4 bg-border mx-1 shrink-0" />
                  )}

                  {/* Active Filters Display */}
                  {Array.from(searchParams.entries())
                    .filter(([key]) => key.startsWith("f_") || key.startsWith("filter_") || key.startsWith("s_"))
                    .map(([key, val]) => {
                      if (key.startsWith("s_")) {
                        const column = key.replace("s_", "")
                        return (
                          <Button 
                            key={key}
                            variant="secondary" 
                            size="sm" 
                            className="h-8 gap-1.5 px-2.5 text-xs font-normal shrink-0 border border-transparent hover:border-border"
                            onClick={() => {
                              const params = new URLSearchParams(searchParams.toString())
                              params.delete(key)
                              router.push(`${pathname}?${params.toString()}`)
                            }}
                          >
                            <span className="font-medium text-foreground">{column}</span>
                            <span className="text-muted-foreground">{val === "asc" ? "Asc" : "Desc"}</span>
                            <X className="h-3 w-3 ml-0.5 text-muted-foreground" />
                          </Button>
                        )
                      }

                      const column = key.replace("f_", "").replace("filter_", "")
                      const parts = val.split(":")
                      const operator = parts.length >= 2 && key.startsWith("f_") ? parts[0] : "eq"
                      const value = parts.length >= 2 && key.startsWith("f_") ? parts.slice(1).join(":") : val
                      
                      return (
                        <Button 
                          key={key}
                          variant="secondary" 
                          size="sm" 
                          className="h-8 gap-1.5 px-2.5 text-xs font-normal shrink-0 border border-transparent hover:border-border"
                          onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.delete(key)
                            router.push(`${pathname}?${params.toString()}`)
                          }}
                        >
                          <span className="font-medium text-foreground">{column}</span>
                          <span className="text-muted-foreground">{operator}</span>
                          <span className="text-foreground">{value}</span>
                          <X className="h-3 w-3 ml-0.5 text-muted-foreground" />
                        </Button>
                      )
                    })}
                </>
              ) : null}
            </div>
            
            {selectedTableMeta && (
              <div className="flex items-center gap-2 pr-4 md:pr-0 shrink-0 ml-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-sm transition-all duration-300"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={selectedRows.length > 0}
                >
                  <Plus className="h-4 w-4 mr-1.5 text-primary" /> Add Row
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content (Data Grid) */}
        <div className="flex-1 overflow-hidden min-w-0 w-full relative flex flex-col">
          <div className="transition-all duration-300 ease-in-out flex-1 flex flex-col relative w-full h-full min-h-0">
            {!tableParam || !selectedTableMeta ? (
              <div className="flex-1 flex h-full items-center justify-center">
                <IsEmpty 
                  variant="fancy" 
                  icon={<Database />} 
                  title={t("applications.selectTableTitle") || "Select a Table"} 
                  description={t("applications.selectTablePrompt") || "Select a table from the sidebar to view its data"} 
                />
              </div>
            ) : (
              <TableDataGrid 
                schema={schema!} 
                table={selectedTableMeta} 
                isAddModalOpen={isAddModalOpen}
                onAddModalClose={() => setIsAddModalOpen(false)}
                selectedRows={selectedRows}
                onSelectedRowsChange={handleSelectionChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
