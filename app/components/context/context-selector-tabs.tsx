"use client"

import React, { useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { SelectedContextIds } from "@/app/components/simple-messages-view/types"
import { ContextCollection } from "./context-collections"

interface ContextSelectorTabsProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  enabledCollections: ContextCollection[]
  selectedContext: SelectedContextIds
  renderTabContent: (tabKey: string) => React.ReactNode
}

export function ContextSelectorTabs({ 
  activeTab, 
  setActiveTab, 
  enabledCollections, 
  selectedContext,
  renderTabContent
}: ContextSelectorTabsProps) {
  
  const tabCounts = useMemo(() => {
    return {
      leads: selectedContext.leads?.length || 0,
      contents: selectedContext.contents?.length || 0,
      requirements: selectedContext.requirements?.length || 0,
      tasks: selectedContext.tasks?.length || 0,
      campaigns: selectedContext.campaigns?.length || 0,
      quotations: selectedContext.quotations?.length || 0,
      deals: selectedContext.deals?.length || 0,
      records: selectedContext.records?.length || 0
    }
  }, [selectedContext])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col" style={{ rowGap: '0px' }}>
      <TabsList className="w-full flex overflow-x-auto no-scrollbar justify-start border-b rounded-none px-0 h-auto">
        {enabledCollections.map(collection => (
          <TabsTrigger 
            key={collection.key} 
            value={collection.key} 
            className="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none"
          >
            {collection.label}
            {tabCounts[collection.key] > 0 && (
              <Badge variant="outline" className="h-4 px-1.5 text-xs">
                {tabCounts[collection.key]}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex-1 overflow-hidden mt-4" style={{ rowGap: '0px' }}>
        {enabledCollections.map(collection => (
          <TabsContent key={collection.key} value={collection.key} className="h-full mt-0">
            {renderTabContent(collection.key)}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}
