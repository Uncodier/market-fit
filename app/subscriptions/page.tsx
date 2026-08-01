"use client"

import React, { useEffect, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import useSWR from "swr"
import { getSubscriptions } from "./actions"
import { SubscriptionsList } from "./components/SubscriptionsList"
import { Button } from "@/app/components/ui/button"
import { Plus, Repeat } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { CreateSubscriptionDialog } from "./components/CreateSubscriptionDialog"

import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"

export default function SubscriptionsPage() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data, isLoading, mutate } = useSWR(
    currentSite?.id ? ['subscriptions', currentSite.id] : null,
    () => getSubscriptions(currentSite!.id)
  )

  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'paused'|'cancelled'|'expired'>('all')

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener('subscriptions:create', handleCreate)

    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: 'Subscriptions',
        parent: null
      }
    });
    window.dispatchEvent(event);

    return () => window.removeEventListener('subscriptions:create', handleCreate)
  }, []);

  const subscriptions = data?.data || []
  const filteredSubscriptions = subscriptions.filter(s => statusFilter === 'all' || s.status === statusFilter)

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="all" className="gap-2 text-xs rounded-full">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="active" className="gap-2 text-xs rounded-full">
                    Active
                  </TabsTrigger>
                  <TabsTrigger value="paused" className="gap-2 text-xs rounded-full">
                    Paused
                  </TabsTrigger>
                  <TabsTrigger value="cancelled" className="gap-2 text-xs rounded-full">
                    Cancelled
                  </TabsTrigger>
                  <TabsTrigger value="expired" className="gap-2 text-xs rounded-full">
                    Expired
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="w-full md:w-auto">
                <SearchInput 
                  placeholder="Search subscriptions..." 
                  value={""}
                  onChange={() => {}}
                  alwaysExpanded={false}
                />
              </div>
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-auto">
        <div className="flex flex-col gap-6">
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {!currentSite || isLoading ? (
              <div className="p-6 space-y-4">
                <div className="h-10 bg-muted/50 rounded-md w-full animate-pulse" />
                <div className="h-10 bg-muted/50 rounded-md w-full animate-pulse" />
                <div className="h-10 bg-muted/50 rounded-md w-full animate-pulse" />
              </div>
            ) : subscriptions.length === 0 ? (
              <SubscriptionsList 
                subscriptions={[]} 
                siteId={currentSite!.id} 
                onUpdate={mutate} 
              />
            ) : filteredSubscriptions.length === 0 ? (
              <SubscriptionsList 
                subscriptions={[]} 
                siteId={currentSite!.id} 
                onUpdate={mutate} 
              />
            ) : (
              <SubscriptionsList 
                subscriptions={filteredSubscriptions} 
                siteId={currentSite!.id} 
                onUpdate={mutate} 
              />
            )}
          </div>
        </div>
      </div>
      <CreateSubscriptionDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        onSuccess={mutate} 
      />
    </div>
  )
}
