"use client"

import { useState, useEffect, useRef } from "react"
import { resolveContextSearchAction } from "@/app/components/context/context-search-action"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Search } from "@/app/components/ui/icons"
import { useContextEntitiesSearch } from "@/app/hooks/use-context-entities-search"
import { SelectedContextIds } from "@/app/components/simple-messages-view/types"
import {
  ContextLeadItem,
  ContextContentItem,
  ContextRequirementItem,
  ContextTaskItem,
  ContextCampaignItem,
  ContextQuotationItem,
  ContextDealItem,
  ContextRecordItem
} from "@/app/components/context/context-items"

interface ContextSelectorModalProps {
  onContextChange: (context: SelectedContextIds) => void
  selectedContext: SelectedContextIds
  isBrowserVisible?: boolean
  hideChips?: boolean
}

export function ContextSelectorModal({ onContextChange, selectedContext, isBrowserVisible = false, hideChips = false }: ContextSelectorModalProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedItemsNames, setSelectedItemsNames] = useState<{[key: string]: {name: string, type: string}}>({})
  const searchInputRef = useRef<HTMLInputElement>(null)
  const {
    searchResults,
    loading,
    error,
    searchAll,
    clearSearch,
    loadInitialData,
    enabledCollections,
    hasInitialized
  } = useContextEntitiesSearch()

  const totalSelected = Object.values(selectedContext).reduce((sum, arr) => sum + ((arr as string[])?.length || 0), 0)

  const searchAllRef = useRef(searchAll)
  const loadInitialDataRef = useRef(loadInitialData)
  const clearSearchRef = useRef(clearSearch)
  searchAllRef.current = searchAll
  loadInitialDataRef.current = loadInitialData
  clearSearchRef.current = clearSearch

  // Cache names from searchResults so that pre-selected items or items that drop out of search results don't lose their names
  useEffect(() => {
    if (!searchResults) return

    let hasUpdates = false
    const newNames = { ...selectedItemsNames }

    Object.keys(selectedContext).forEach(category => {
      const ids = selectedContext[category as keyof SelectedContextIds]
      if (!Array.isArray(ids)) return
      
      const searchData = (searchResults as any)[category] || []
      ids.forEach(id => {
        if (!newNames[id]) {
          const found = searchData.find((item: any) => item.id === id)
          if (found) {
            newNames[id] = {
              name: found.name || found.title || 'Unknown',
              type: category.slice(0, -1)
            }
            hasUpdates = true
          }
        }
      })
    })

    if (hasUpdates) {
      setSelectedItemsNames(newNames)
    }
  }, [searchResults, selectedContext, selectedItemsNames])

  const prevOpenRef = useRef(open)
  const prevSearchTermRef = useRef(searchTerm)

  const handleRemoveItem = (itemId: string) => {
    const newContext = { ...selectedContext }
    const newSelectedNames = { ...selectedItemsNames }
    
    // Find which category this item belongs to and remove it
    Object.keys(newContext).forEach(category => {
      const categoryKey = category as keyof SelectedContextIds
      if (newContext[categoryKey]) {
        newContext[categoryKey] = (newContext[categoryKey] as string[]).filter(id => id !== itemId)
      }
    })
    
    // Remove from names storage
    delete newSelectedNames[itemId]
    
    setSelectedItemsNames(newSelectedNames)
    onContextChange(newContext)
  }

  const getAllSelectedItems = () => {
    const items: Array<{id: string, name: string, type: string}> = []
    
    // Use stored names when available, otherwise use search results or fallback
    Object.keys(selectedContext).forEach(category => {
      const ids = selectedContext[category as keyof SelectedContextIds]
      if (!Array.isArray(ids)) return
      ids.forEach(id => {
        if (selectedItemsNames[id]) {
          // Use stored name
          items.push({
            id,
            name: selectedItemsNames[id].name,
            type: selectedItemsNames[id].type
          })
        } else {
          let foundItem = null
          if (open && searchResults) {
            // Try to get from current search results
            const searchData = (searchResults as any)[category] || []
            foundItem = searchData.find((item: any) => item.id === id)
          }
          
          if (foundItem) {
            const name = foundItem.name || foundItem.title || 'Unknown'
            items.push({id, name, type: category.slice(0, -1)})
          } else {
            // Fallback to ID-based name
            items.push({
              id,
              name: `${category.slice(0, -1)} ${id.slice(0, 8)}...`,
              type: category.slice(0, -1)
            })
          }
        }
      })
    })
    
    return items
  }

  const selectedItems = getAllSelectedItems()
  const displayItems = selectedItems.slice(0, 4)
  const extraCount = selectedItems.length - 4

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    const prevTerm = prevSearchTermRef.current
    prevOpenRef.current = open
    prevSearchTermRef.current = searchTerm

    const action = resolveContextSearchAction({
      open,
      wasOpen,
      searchTerm,
      previousSearchTerm: prevTerm,
      hasInitialized
    })

    if (action === 'idle') return

    if (action === 'load-initial') {
      loadInitialDataRef.current()
      return
    }

    const delayedSearch = window.setTimeout(() => {
      searchAllRef.current(searchTerm.trim())
    }, 300)

    return () => window.clearTimeout(delayedSearch)
  }, [open, searchTerm, hasInitialized])

  useEffect(() => {
    if (!open) {
      setSearchTerm("")
      clearSearchRef.current()
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        if (open && searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleSelectionChange = (tab: keyof SelectedContextIds, itemId: string, checked: boolean, itemName?: string) => {
    const newContext = { ...selectedContext }
    const newSelectedNames = { ...selectedItemsNames }
    
    if (checked) {
      newContext[tab] = [...(newContext[tab] || []), itemId]
      // Store the item name for later use
      if (itemName) {
        newSelectedNames[itemId] = { name: itemName, type: String(tab).slice(0, -1) } // Remove 's' from plural
      }
    } else {
      newContext[tab] = (newContext[tab] || []).filter(id => id !== itemId)
      // Remove from names storage
      delete newSelectedNames[itemId]
    }
    
    setSelectedItemsNames(newSelectedNames)
    onContextChange(newContext)
  }

  const getTabData = (tabKey: string) => {
    // Always return the search results, which includes both search and initial data
    return searchResults[tabKey as keyof typeof searchResults] || []
  }

  const renderConsolidatedContent = () => {
    if (loading) {
      return (
        <div className="space-y-6 py-2">
          {Array.from({ length: 2 }).map((_, groupIndex) => (
            <div key={`skeleton-group-${groupIndex}`} className="space-y-2">
              {/* Group Header Skeleton */}
              <div className="py-2 border-b">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
              </div>
              {/* Items Skeleton */}
              <div className="grid gap-2">
                {Array.from({ length: 3 }).map((_, itemIndex) => (
                  <div key={`skeleton-item-${itemIndex}`} className="flex items-start space-x-3 p-3 rounded-lg border border-transparent">
                    <div className="flex items-center justify-center w-5 h-5 mt-0.5">
                      <Skeleton className="w-4 h-4 rounded" />
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-4 w-12 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (error && !error.includes('No searchable tables found')) {
      return (
        <div className="text-center py-12 min-h-[300px] flex flex-col items-center justify-center">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => searchTerm.trim() && searchAll(searchTerm.trim())}
          >
            Retry Search
          </Button>
        </div>
      )
    }

    const isEmpty = enabledCollections.every(c => ((searchResults as any)[c.key]?.length || 0) === 0)

    if (isEmpty && !searchTerm.trim() && !loading) {
      return (
        <div className="text-center py-12 min-h-[300px] flex flex-col items-center justify-center">
          <Search className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-foreground mb-2">No data available</h3>
          <p className="text-xs text-muted-foreground">
            No records were found in your site database
          </p>
        </div>
      )
    }

    if (isEmpty) {
      return (
        <div className="text-center py-12 min-h-[300px] flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No results matching "{searchTerm}"
          </p>
        </div>
      )
    }

    return (
      <div className="max-h-96 min-h-[300px] overflow-y-auto space-y-6 pr-2">
        {enabledCollections.map(collection => {
          const items = (searchResults as any)[collection.key] || []
          if (items.length === 0) return null

          return (
            <div key={collection.key} className="space-y-2">
              <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b">
                <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <collection.icon className="w-4 h-4" />
                  {collection.label}
                  <Badge variant="outline" className="text-[10px] px-1 h-4 font-normal">
                    {items.length}
                  </Badge>
                </h3>
              </div>
              <div className="space-y-1">
                {items.map((item: any) => {
                  const isChecked = (selectedContext[collection.key as keyof SelectedContextIds] || []).includes(item.id)
                  const handleCheck = (checked: boolean) => {
                    const itemName = item.name || item.title || 'Unknown'
                    handleSelectionChange(collection.key as keyof SelectedContextIds, item.id, checked, itemName)
                  }

                  switch (collection.key) {
                    case 'leads':
                      return <ContextLeadItem key={item.id} lead={item} checked={isChecked} onCheckedChange={handleCheck} />
                    case 'contents':
                      return <ContextContentItem key={item.id} content={item} checked={isChecked} onCheckedChange={handleCheck} />
                    case 'requirements':
                      return <ContextRequirementItem key={item.id} requirement={item} checked={isChecked} onCheckedChange={handleCheck} />
                    case 'tasks':
                      return <ContextTaskItem key={item.id} task={item} checked={isChecked} onCheckedChange={handleCheck} />
                    case 'campaigns':
                      return <ContextCampaignItem key={item.id} campaign={item} checked={isChecked} onCheckedChange={handleCheck} />
                    case 'quotations':
                      return <ContextQuotationItem key={item.id} quotation={item} checked={isChecked} onCheckedChange={handleCheck} />
                    case 'deals':
                      return <ContextDealItem key={item.id} deal={item} checked={isChecked} onCheckedChange={handleCheck} />
                    case 'records':
                      return <ContextRecordItem key={item.id} record={item} checked={isChecked} onCheckedChange={handleCheck} />
                    default:
                      return null
                  }
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center gap-2 flex-wrap relative z-51">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 hover:bg-secondary/80 transition-colors duration-200 px-3"
            title="Agregar contexto"
          >
            @
            <span className="ml-1">contexto</span>
            {hideChips && totalSelected > 0 && (
              <Badge variant="outline" className="ml-1.5 h-5 px-1.5 py-0 text-[10px] flex items-center justify-center">
                {totalSelected}
              </Badge>
            )}
          </Button>
          
          {!hideChips && displayItems.map(item => (
            <Badge key={item.id} variant="outline" className="h-6 px-2 text-xs flex items-center gap-1 group" interactive={true}>
              <span>{item.name.length > 15 ? `${item.name.substring(0, 15)}...` : item.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveItem(item.id)
                }}
                className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                ×
              </button>
            </Badge>
          ))}
          
          {!hideChips && extraCount > 0 && (
            <Badge variant="outline" className="h-6 px-2 text-xs">
              +{extraCount}
            </Badge>
          )}
        </div>
      </DialogTrigger>
      
      <DialogContent size="lg" className="min-h-[min(80vh,600px)]">
        <DialogHeader>
          <DialogTitle>Add context</DialogTitle>
          <DialogDescription>
            Search and select data to give the agent more context.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="overflow-hidden flex flex-col">
          <div className="mb-6 p-1">
            <div className="relative w-full">
              <Input
                ref={searchInputRef}
                data-command-k-input
                type="text"
                placeholder="Search leads, content, requirements, tasks, campaigns..."
                className="w-full h-12"
                icon={<Search className="h-3.5 w-3.5 text-muted-foreground" />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex z-[44]">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
            {searchTerm.trim().length >= 1 && (
              <p className="text-xs text-muted-foreground mt-2">
                Searching "{searchTerm}" across all records...
              </p>
            )}
          </div>

          <div className="flex-1 overflow-hidden" style={{ rowGap: '0px' }}>
            {renderConsolidatedContent()}
          </div>
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {totalSelected} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onContextChange({
                  leads: [],
                  contents: [],
                  requirements: [],
                  tasks: [],
                  campaigns: [],
                  quotations: [],
                  deals: [],
                  records: []
                })
              }}
              disabled={totalSelected === 0}
            >
              Clear all
            </Button>
            <Button
              size="sm"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
