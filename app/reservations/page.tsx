"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import useSWR from "swr"
import { getReservations } from "./actions"
import { ReservationsList } from "./components/ReservationsList"
import { Calendar as CalendarIcon, CalendarDays, List, Clock, Filter, ListOrdered, Check, ChevronDown } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { Button } from "@/app/components/ui/button"
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
import { CreateCalendarBlockDialog } from "./components/CreateCalendarBlockDialog"
import { reservationCanEdit } from "./reservation-helpers"
import type { CalendarTimeSlot } from "./components/reservation-calendar-hour-select"
import type { Reservation } from "@/app/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"

export default function ReservationsPage() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [viewMode, setViewMode] = useState<"service" | "calendar" | "schedules">("service")
  const [viewType, setViewType] = useState<"list" | "calendar">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [createSlot, setCreateSlot] = useState<CalendarTimeSlot | null>(null)
  const [isBlockFormOpen, setIsBlockFormOpen] = useState(false)

  const { data, isLoading, mutate } = useSWR(
    currentSite?.id ? ["reservations", currentSite.id] : null,
    () => getReservations(currentSite!.id)
  )

  const { data: membersData } = useSWR(
    currentSite?.id ? ["site_members", currentSite.id] : null,
    async () => {
      const res = await fetch(`/api/site-members/${currentSite!.id}`)
      if (!res.ok) throw new Error("Failed to fetch members")
      return res.json()
    }
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
    const handleCreateBlock = () => setIsBlockFormOpen(true)
    window.addEventListener("reservations:create", handleCreate)
    window.addEventListener("calendarBlocks:create", handleCreateBlock)
    return () => {
      window.removeEventListener("reservations:create", handleCreate)
      window.removeEventListener("calendarBlocks:create", handleCreateBlock)
    }
  }, [])

  const reservations = data?.data || []
  const filteredReservations = useMemo(() => {
    let filtered = reservations
    if (selectedMember !== "all") {
      filtered = filtered.filter((r) => r.assignee_user_id === selectedMember)
    }

    const sorted = filtered.sort((a, b) => {
      const dateA = new Date(a.start_time).getTime()
      const dateB = new Date(b.start_time).getTime()
      if (sortBy === "oldest") return dateA - dateB
      return dateB - dateA // newest first
    })

    const query = searchQuery.trim().toLowerCase()
    if (!query) return sorted

    return sorted.filter((reservation) => {
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
  }, [reservations, searchQuery, selectedMember])

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
              {viewType === "list" && viewMode !== "schedules" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 font-medium gap-2 hidden md:flex">
                      <ListOrdered className="h-4 w-4" />
                      {sortBy === "newest" ? "Newest First" : "Oldest First"}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuItem onClick={() => setSortBy("newest")} className="justify-between">
                      Newest First
                      {sortBy === "newest" && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy("oldest")} className="justify-between">
                      Oldest First
                      {sortBy === "oldest" && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div className="w-[180px]">
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {(membersData?.members || []).map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
      <CreateCalendarBlockDialog
        open={isBlockFormOpen}
        onOpenChange={setIsBlockFormOpen}
        onSuccess={mutate}
      />
    </div>
  )
}
