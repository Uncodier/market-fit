"use client"

import React, { useEffect, useRef } from "react"
import { Loader } from "@/app/components/ui/icons"
import { useContextEntitiesSearch } from "@/app/hooks/use-context-entities-search"
import { SelectedContextIds } from "@/app/components/simple-messages-view/types"
import { Badge } from "@/app/components/ui/badge"
import { cn } from "@/lib/utils"

interface ContextMentionPickerProps {
  query: string
  onSelect: (type: keyof SelectedContextIds, id: string, name: string) => void
  onClose: () => void
}

export function ContextMentionPicker({ query, onSelect, onClose }: ContextMentionPickerProps) {
  const { searchResults, loading, searchAll, enabledCollections } = useContextEntitiesSearch()
  const searchAllRef = useRef(searchAll)
  searchAllRef.current = searchAll

  useEffect(() => {
    const delayDebounceFn = window.setTimeout(() => {
      searchAllRef.current(query)
    }, 300)
    return () => window.clearTimeout(delayDebounceFn)
  }, [query])

  const isEmpty = !loading && enabledCollections.every(c => (searchResults[c.key]?.length || 0) === 0)

  // Use a ref to catch Escape key to close the picker
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 w-80 max-h-80 overflow-hidden rounded-md border bg-popover shadow-md z-[60]"
    >
      <div className="w-full">
        <div className="max-h-80 overflow-y-auto overflow-x-hidden p-1">
          {loading && (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}
          {isEmpty && (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No results found.
            </div>
          )}
          {!loading && enabledCollections.map(collection => {
            const items = searchResults[collection.key]
            if (!items || items.length === 0) return null
            
            return (
              <div key={collection.key} className="overflow-hidden p-1 text-foreground">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {collection.label}
                </div>
                {items.slice(0, 5).map((item: any) => {
                  const title = item.title || item.name || `Item ${item.id.substring(0,8)}`
                  const Icon = collection.icon
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelect(collection.key, item.id, title)}
                      className="relative flex flex-col items-start cursor-pointer select-none rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <div className="flex items-center w-full gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1 text-sm">{title}</span>
                        {item.status && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                            {item.status}
                          </Badge>
                        )}
                      </div>
                      {(item.description || item.email || item.stage) && (
                        <span className="text-xs text-muted-foreground truncate w-full pl-6 mt-0.5">
                          {item.description || item.email || item.stage}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
