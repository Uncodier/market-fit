"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import useSWR from "swr"
import { getReservations } from "./actions"
import { ReservationsList } from "./components/ReservationsList"
import { Calendar as CalendarIcon, CalendarDays, List, Clock } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { ReservationsByDateList } from "./components/ReservationsByDateList"
import { SchedulesList } from "./components/SchedulesList"
import { ReservationCalendar } from "./components/ReservationCalendar"
import { ReservationsTableSkeleton } from "./components/reservation-table"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { reservationResourceLabel } from "@/app/visits/visit-helpers"
import { CreateReservationDialog } from "./components/CreateReservationDialog"
import { reservationCanEdit } from "./reservation-helpers"
import type { CalendarTimeSlot } from "./components/reservation-calendar-hour-select"
import type { Reservation } from "@/app/types"

export default function ReservationsPage() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [viewMode, setViewMode] = useState<"service" | "calendar" | "schedules">("service")
  const [viewType, setViewType] = useState<"list" | "calendar">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [createSlot, setCreateSlot] = useState<CalendarTimeSlot | null>(null)

  const { data, isLoading, mutate } = useSWR(
    currentSite?.id ? ["reservations", currentSite.id] : null,
    () => getReservations(currentSite!.id)
  )

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: t("layout.sidebar.reservations") || t("reservations.title") || "Reservations",
        parent: null,
      },
    })
    window.dispatchEvent(event)
  }, [t])

  const openCreate = (slot?: CalendarTimeSlot | null) => {
    setEditingReservation(null)
    setCreateSlot(slot ?? null)
    setIsFormOpen(true)
  }

  const openEdit = (reservation: Reservation) => {
    if (!reservationCanEdit(reservation)) return
    setCreateSlot(null)
    setEditingReservation(reservation)
    setIsFormOpen(true)
  }

  const handleFormOpenChange = (open: boolean) => {
    setIsFormOpen(open)
    if (!open) {
      setEditingReservation(null)
      setCreateSlot(null)
    }
  }

  useEffect(() => {
    const handleCreate = () => openCreate()
    window.addEventListener("reservations:create", handleCreate)
    return () => window.removeEventListener("reservations:create", handleCreate)
  }, [])

  const reservations = data?.data || []
  const filteredReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return reservations
    return reservations.filter((reservation) => {
      const service = reservationResourceLabel({
        resource_type: reservation.resource_type,
        catalog_item: reservation.catalog_item,
        location: reservation.location,
      })
      const haystack = [
        reservation.lead?.name,
        reservation.lead?.email,
        reservation.buyer_profile?.name,
        service,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [reservations, searchQuery])

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 flex-1 gap-2">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="service" className="gap-2 text-xs rounded-full">
                    <List className="h-4 w-4" /> <span className="hidden md:inline">{t("reservations.tabs.byService") || "By Service"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="gap-2 text-xs rounded-full">
                    <CalendarDays className="h-4 w-4" /> <span className="hidden md:inline">{t("reservations.tabs.byDate") || "By Date"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="schedules" className="gap-2 text-xs rounded-full">
                    <Clock className="h-4 w-4" /> <span className="hidden md:inline">{t("reservations.tabs.schedules") || "Schedules"}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <SearchInput
                placeholder={t("reservations.search.placeholder") || "Search reservations..."}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                alwaysExpanded={false}
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              {viewMode !== "schedules" && (
                <ToggleGroup
                  type="single"
                  value={viewType}
                  onValueChange={(value) => value && setViewType(value as "list" | "calendar")}
                >
                  <ToggleGroupItem value="list" className="h-7 px-2" aria-label={t("reservations.view.list")}>
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="calendar" className="h-7 px-2" aria-label={t("reservations.view.calendar")}>
                    <CalendarIcon className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-auto">
        {!currentSite || isLoading ? (
          <ReservationsTableSkeleton />
        ) : viewMode === "schedules" ? (
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <SchedulesList siteId={currentSite.id} />
          </div>
        ) : viewType === "calendar" ? (
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <ReservationCalendar
              reservations={filteredReservations}
              viewMode={viewMode}
              onReservationClick={openEdit}
              onCreateSlot={openCreate}
            />
          </div>
        ) : viewMode === "service" ? (
          <ReservationsList
            reservations={filteredReservations}
            siteId={currentSite.id}
            onUpdate={mutate}
            onEdit={openEdit}
          />
        ) : (
          <ReservationsByDateList
            reservations={filteredReservations}
            siteId={currentSite.id}
            onUpdate={mutate}
            onEdit={openEdit}
          />
        )}
      </div>
      <CreateReservationDialog
        open={isFormOpen}
        reservation={editingReservation}
        initialSlot={createSlot}
        onOpenChange={handleFormOpenChange}
        onSuccess={mutate}
      />
    </div>
  )
}
