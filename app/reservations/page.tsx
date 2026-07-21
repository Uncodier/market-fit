"use client"

import React, { useEffect, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import useSWR from "swr"
import { getReservations } from "./actions"
import { ReservationsList } from "./components/ReservationsList"
import { Button } from "@/app/components/ui/button"
import { Calendar as CalendarIcon, CalendarDays, List, Plus } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { CreateReservationDialog } from "./components/CreateReservationDialog"

import { ReservationsByDateList } from "./components/ReservationsByDateList"

import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"

export default function ReservationsPage() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [viewMode, setViewMode] = useState<'service' | 'calendar'>('service')
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data, isLoading, mutate } = useSWR(
    currentSite?.id ? ['reservations', currentSite.id] : null,
    () => getReservations(currentSite!.id)
  )

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener('reservations:create', handleCreate)
    
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: 'Reservations',
        parent: null
      }
    });
    window.dispatchEvent(event);

    return () => window.removeEventListener('reservations:create', handleCreate)
  }, []);

  const reservations = data?.data || []

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="service" className="gap-2 text-xs rounded-full">
                    <List className="h-4 w-4" /> <span className="hidden md:inline">By Service</span>
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="gap-2 text-xs rounded-full">
                    <CalendarDays className="h-4 w-4" /> <span className="hidden md:inline">By Date</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
              <div className="w-full md:w-auto">
                <SearchInput 
                  placeholder="Search reservations..." 
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
        <div className="max-w-6xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading reservations...</p>
            </div>
          ) : reservations.length === 0 ? (
            <EmptyCard 
              icon={<CalendarIcon className="h-10 w-10" />}
              title="No reservations yet"
              description="When customers book your services, they will appear here."
              variant="fancy"
            />
          ) : viewMode === 'service' ? (
            <ReservationsList 
              reservations={reservations} 
              siteId={currentSite!.id} 
              onUpdate={mutate} 
            />
          ) : (
            <ReservationsByDateList 
              reservations={reservations} 
              siteId={currentSite!.id} 
              onUpdate={mutate} 
            />
          )}
        </div>
      </div>
      <CreateReservationDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        onSuccess={mutate} 
      />
    </div>
  )
}
