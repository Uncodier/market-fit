"use client"

import React, { useEffect, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import useSWR from "swr"
import { getReservations } from "./actions"
import { ReservationsList } from "./components/ReservationsList"
import { Button } from "@/app/components/ui/button"
import { Calendar as CalendarIcon, CalendarDays, List, Plus, Clock } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { ReservationsByDateList } from "./components/ReservationsByDateList"
import { SchedulesList } from "./components/SchedulesList"
import { ReservationCalendar } from "./components/ReservationCalendar"

import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"

export default function ReservationsPage() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [viewMode, setViewMode] = useState<'service' | 'calendar' | 'schedules'>('service')
  const [viewType, setViewType] = useState<'list' | 'calendar'>('list')

  const { data, isLoading, mutate } = useSWR(
    currentSite?.id ? ['reservations', currentSite.id] : null,
    () => getReservations(currentSite!.id)
  )

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: 'Reservations',
        parent: null
      }
    });
    window.dispatchEvent(event);
  }, []);

  const reservations = data?.data || []

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 flex-1 gap-2">
            <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
              <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                <TabsTrigger value="service" className="gap-2 text-xs rounded-full">
                  <List className="h-4 w-4" /> <span className="hidden md:inline">{t('reservations.tabs.byService') || 'By Service'}</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2 text-xs rounded-full">
                  <CalendarDays className="h-4 w-4" /> <span className="hidden md:inline">{t('reservations.tabs.byDate') || 'By Date'}</span>
                </TabsTrigger>
                <TabsTrigger value="schedules" className="gap-2 text-xs rounded-full">
                  <Clock className="h-4 w-4" /> <span className="hidden md:inline">{t('reservations.tabs.schedules') || 'Schedules'}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="w-full md:w-auto">
              <SearchInput 
                placeholder="Search reservations..." 
                value={""}
                onChange={() => {}}
                alwaysExpanded={false}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {viewMode !== 'schedules' && (
              <ToggleGroup 
                type="single" 
                value={viewType} 
                onValueChange={(v) => v && setViewType(v as 'list' | 'calendar')}
              >
                <ToggleGroupItem value="list" className="h-7 px-2" aria-label="List view">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="calendar" className="h-7 px-2" aria-label="Calendar view">
                  <CalendarIcon className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            )}
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
            ) : reservations.length === 0 ? (
              <ReservationsList 
                reservations={[]} 
                siteId={currentSite!.id} 
                onUpdate={mutate} 
              />
            ) : viewMode === 'schedules' ? (
              <SchedulesList siteId={currentSite!.id} />
            ) : viewType === 'calendar' ? (
              <ReservationCalendar reservations={reservations} viewMode={viewMode} />
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
      </div>
    </div>
  )
}
