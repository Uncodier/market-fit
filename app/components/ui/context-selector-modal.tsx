"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { InputWithIcon } from "@/app/components/ui/input-with-icon"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Search } from "@/app/components/ui/icons"
import { SearchInput } from "@/app/components/ui/search-input"
import { useContextEntitiesSearch } from "@/app/hooks/use-context-entities-search"
import {
  ContextLeadItem,
  ContextContentItem,
  ContextRequirementItem,
  ContextTaskItem
} from "@/app/components/context/context-items"

interface SelectedContext {
  leads: string[]
  contents: string[]
  requirements: string[]
  tasks: string[]
}

interface ContextSelectorModalProps {
  onContextChange: (context: SelectedContext) => void
  selectedContext: SelectedContext
}

export function ContextSelectorModal({ onContextChange, selectedContext }: ContextSelectorModalProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("leads")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedItemsNames, setSelectedItemsNames] = useState<{[key: string]: {name: string, type: string}}>({})
  // Use the new search hook for global database search
  const {
    searchResults,
    loading,
    error,
    searchAll,
    clearSearch,
    loadInitialData
  } = useContextEntitiesSearch()

  const totalSelected = Object.values(selectedContext).reduce((sum, arr) => sum + arr.length, 0)

  // Function to remove an item from selection
  const handleRemoveItem = (itemId: string) => {
    const newContext = { ...selectedContext }
    const newSelectedNames = { ...selectedItemsNames }
    
    // Find which category this item belongs to and remove it
    Object.keys(newContext).forEach(category => {
      newContext[category as keyof SelectedContext] = newContext[category as keyof SelectedContext].filter(id => id !== itemId)
    })
    
    // Remove from names storage
    delete newSelectedNames[itemId]
    
    setSelectedItemsNames(newSelectedNames)
    onContextChange(newContext)
  }

  // Get all selected items for chips (using stored names)
  const getAllSelectedItems = () => {
    const items: Array<{id: string, name: string, type: string}> = []
    
    // Use stored names when available, otherwise use search results or fallback
    Object.keys(selectedContext).forEach(category => {
      selectedContext[category as keyof SelectedContext].forEach(id => {
        if (selectedItemsNames[id]) {
          // Use stored name
          items.push({
            id,
            name: selectedItemsNames[id].name,
            type: selectedItemsNames[id].type
          })
        } else if (open && searchResults) {
          // Try to get from current search results
          const searchData = searchResults[category as keyof typeof searchResults] || []
          const foundItem = searchData.find((item: any) => item.id === id)
          if (foundItem) {
            const name = foundItem.name || foundItem.title || 'Unknown'
            items.push({id, name, type: category.slice(0, -1)})
          }
        } else {
          // Fallback to ID-based name
          items.push({
            id,
            name: `${category.slice(0, -1)} ${id.slice(0, 8)}...`,
            type: category.slice(0, -1)
          })
        }
      })
    })
    
    return items
  }

  const selectedItems = getAllSelectedItems()
  const displayItems = selectedItems.slice(0, 4)
  const extraCount = selectedItems.length - 4

  // Load initial data when modal opens
  useEffect(() => {
    if (open && !searchTerm.trim()) {
      console.log('Modal opened, loading initial data')
      loadInitialData()
    }
  }, [open, loadInitialData, searchTerm])

  // Debounced search effect
  useEffect(() => {
    if (!open) return
    
    const delayedSearch = setTimeout(() => {
      if (searchTerm.trim().length >= 1) {
        console.log('Executing search for:', searchTerm.trim())
        searchAll(searchTerm.trim())
      } else {
        // Load initial data when search is cleared
        console.log('Search cleared, loading initial data')
        loadInitialData()
      }
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchTerm, open, searchAll, loadInitialData])

  // Clear search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchTerm("")
      clearSearch()
    }
  }, [open, clearSearch])

  const handleSelectionChange = (tab: keyof SelectedContext, itemId: string, checked: boolean, itemName?: string) => {
    const newContext = { ...selectedContext }
    const newSelectedNames = { ...selectedItemsNames }
    
    if (checked) {
      newContext[tab] = [...newContext[tab], itemId]
      // Store the item name for later use
      if (itemName) {
        newSelectedNames[itemId] = { name: itemName, type: tab.slice(0, -1) } // Remove 's' from plural
      }
    } else {
      newContext[tab] = newContext[tab].filter(id => id !== itemId)
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

  const renderTabContent = (tabKey: string) => {
    const data = getTabData(tabKey)
    const isLoading = loading
    
    if (isLoading) {
      return (
        <div className="space-y-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0">
                  <LoadingSkeleton variant="inline" size="sm" />
                </div>
                <div className="flex-1 space-y-2">
                  <LoadingSkeleton variant="inline" className="h-4 w-3/4" />
                  <LoadingSkeleton variant="inline" className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex gap-2">
                <LoadingSkeleton variant="inline" className="h-6 w-16" />
                <LoadingSkeleton variant="inline" className="h-6 w-12" />
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

    if (data.length === 0 && !searchTerm.trim() && !loading) {
      const tableNames = {
        leads: 'leads or contacts',
        contents: 'content items',
        requirements: 'requirements',
        tasks: 'tasks'
      }
      
      return (
        <div className="text-center py-12 min-h-[300px] flex flex-col items-center justify-center">
          <Search className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-foreground mb-2">No {tableNames[tabKey as keyof typeof tableNames]} available</h3>
          <p className="text-xs text-muted-foreground">
            No {tableNames[tabKey as keyof typeof tableNames]} found in your site database
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            This feature will be available once you have {tableNames[tabKey as keyof typeof tableNames]} in your system
          </p>
        </div>
      )
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-12 min-h-[300px] flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No {tabKey} found matching "{searchTerm}"
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-2 max-h-96 min-h-[300px] overflow-y-auto">
        {        data.map((item: any) => {
          const isChecked = selectedContext[tabKey as keyof SelectedContext].includes(item.id)
          const handleCheck = (checked: boolean) => {
            const itemName = item.name || item.title || 'Unknown'
            handleSelectionChange(tabKey as keyof SelectedContext, item.id, checked, itemName)
          }

          switch (tabKey) {
            case 'leads':
              return (
                <ContextLeadItem
                  key={item.id}
                  lead={item}
                  checked={isChecked}
                  onCheckedChange={handleCheck}
                />
              )
            case 'contents':
              return (
                <ContextContentItem
                  key={item.id}
                  content={item}
                  checked={isChecked}
                  onCheckedChange={handleCheck}
                />
              )
            case 'requirements':
              return (
                <ContextRequirementItem
                  key={item.id}
                  requirement={item}
                  checked={isChecked}
                  onCheckedChange={handleCheck}
                />
              )
            case 'tasks':
              return (
                <ContextTaskItem
                  key={item.id}
                  task={item}
                  checked={isChecked}
                  onCheckedChange={handleCheck}
                />
              )
            default:
              return null
          }
        })}
      </div>
    )
  }

  const tabCounts = useMemo(() => {
    return {
      leads: selectedContext.leads.length,
      contents: selectedContext.contents.length,
      requirements: selectedContext.requirements.length,
      tasks: selectedContext.tasks.length
    }
  }, [selectedContext])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center gap-2 flex-wrap relative z-51">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 hover:bg-muted transition-colors duration-200 text-xs"
          >
            @ context
          </Button>
          
          {/* Show individual chips for selected items */}
          {displayItems.map(item => (
            <Badge key={item.id} variant="outline" className="h-6 px-2 text-xs flex items-center gap-1 group hover:bg-muted">
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
          
          {/* Show "+X" chip if more than 4 items */}
          {extraCount > 0 && (
            <Badge variant="outline" className="h-6 px-2 text-xs">
              +{extraCount}
            </Badge>
          )}
        </div>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] min-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Context</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Search and select data to provide context to the robot
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Global Search */}
          <div className="mb-6 p-1">
            <input
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 h-12"
              placeholder="Search leads, content, requirements, tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm.trim().length >= 1 ? (
              <p className="text-xs text-muted-foreground mt-2">
                Searching for "{searchTerm}" across all databases...
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                Showing recent items. Start typing to search specific content.
              </p>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="leads" className="flex items-center gap-2">
                👤 Leads
                {tabCounts.leads > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-xs">
                    {tabCounts.leads}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="contents" className="flex items-center gap-2">
                📄 Content
                {tabCounts.contents > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-xs">
                    {tabCounts.contents}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="requirements" className="flex items-center gap-2">
                📋 Requirements
                {tabCounts.requirements > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-xs">
                    {tabCounts.requirements}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                ⚡ Tasks
                {tabCounts.tasks > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-xs">
                    {tabCounts.tasks}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-4 overflow-hidden">
              <TabsContent value="leads" className="h-full mt-0">
                {renderTabContent('leads')}
              </TabsContent>
              <TabsContent value="contents" className="h-full mt-0">
                {renderTabContent('contents')}
              </TabsContent>
              <TabsContent value="requirements" className="h-full mt-0">
                {renderTabContent('requirements')}
              </TabsContent>
              <TabsContent value="tasks" className="h-full mt-0">
                {renderTabContent('tasks')}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex justify-between items-center relative z-51">
          <span className="text-sm text-muted-foreground">
            {totalSelected} item{totalSelected !== 1 ? 's' : ''} selected
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
                  tasks: []
                })
              }}
              disabled={totalSelected === 0}
            >
              Clear All
            </Button>
            <Button
              size="sm"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
