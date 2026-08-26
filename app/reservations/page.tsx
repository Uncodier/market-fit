"use client"

import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"

import React, { useEffect, useMemo, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import useSWR from "swr"
import { getReservations } from "./actions"
import { getCalendarBlocks } from "./calendar-blocks-actions"
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
import { reservationCanEdit, sortReservations, type ReservationSortBy } from "./reservation-helpers"
import type { CalendarTimeSlot } from "./components/reservation-calendar-hour-select"
import type { CalendarBlock, Reservation } from "@/app/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { filterCalendarBlocks } from "./calendar-block-helpers"

export default function ReservationsPage() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [viewMode, setViewMode] = useState<"service" | "calendar" | "schedules">("calendar")
  const [viewType, setViewType] = useState<"list" | "calendar">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"active" | "cancelled">("active")
  const [sortBy, setSortBy] = useState<ReservationSortBy>("newest")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [createSlot, setCreateSlot] = useState<CalendarTimeSlot | null>(null)
  const [isBlockFormOpen, setIsBlockFormOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<CalendarBlock | null>(null)

  const { data, isLoading, mutate } = useSWR(
    currentSite?.id ? ["reservations", currentSite.id] : null,
    () => getReservations(currentSite!.id)
  )

  const { data: blocksData, isLoading: isLoadingBlocks, mutate: mutateBlocks } = useSWR(
    currentSite?.id ? ["calendar-blocks", currentSite.id] : null,
    () => getCalendarBlocks(currentSite!.id)
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

  const refresh = () => {
    mutate()
    mutateBlocks()
  }

  const openCreateBlock = () => {
    setEditingBlock(null)
    setIsBlockFormOpen(true)
  }

  const openEditBlock = (block: CalendarBlock) => {
    setEditingBlock(block)
    setIsBlockFormOpen(true)
  }

  const handleBlockFormOpenChange = (open: boolean) => {
    setIsBlockFormOpen(open)
    if (!open) setEditingBlock(null)
  }

  useEffect(() => {
    const handleCreate = () => openCreate()
    const handleCreateBlock = () => openCreateBlock()
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
    if (statusFilter === "cancelled") {
      filtered = filtered.filter((r) => r.status === "cancelled")
    } else {
      filtered = filtered.filter((r) => r.status !== "cancelled")
    }
    if (selectedMember !== "all") {
      filtered = filtered.filter((r) => r.assignee_user_id === selectedMember)
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter((reservation) => {
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
    }

    return sortReservations(filtered, sortBy)
  }, [reservations, searchQuery, selectedMember, sortBy, statusFilter])

  const calendarBlocks = filterCalendarBlocks(blocksData?.data || [], {
    query: searchQuery,
    selectedMember,
    statusFilter,
  })

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <div className="flex items-center justify-between gap-2 w-full">
            <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                <div className="md:hidden w-full">
                  <SearchInput  placeholder={t("reservations.search.placeholder") || "Search reservations..."} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.view') || 'Vista'}</span>
                  <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="calendar" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        <CalendarDays className="shrink-0 h-4 w-4 md:hidden" /> <span className="inline">{t("reservations.tabs.byDate") || "By Date"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="service" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        <List className="shrink-0 h-4 w-4 md:hidden" /> <span className="inline">{t("reservations.tabs.byService") || "By Service"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="schedules" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        <Clock className="shrink-0 h-4 w-4 md:hidden" /> <span className="inline">{t("reservations.tabs.schedules") || "Schedules"}</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {viewMode !== "schedules" && (
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.status') === 'common.status' ? 'Status' : t('common.status')}</span>
                    <Tabs
                      value={statusFilter}
                      onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
                      className="w-full md:w-auto flex-shrink-0"
                    >
                      <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                        <TabsTrigger value="active" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap">{t('status.active') || 'Active'}</TabsTrigger>
                        <TabsTrigger value="cancelled" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap">{t('status.cancelled') || 'Cancelled'}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                )}

                <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
                  <SearchInput  placeholder={t("reservations.search.placeholder") || "Search reservations..."} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}    className="w-full"  containerClassName="w-64" />
                </div>
              </div>
            </MobileFiltersDrawer>

            <div className="flex items-center gap-2 w-auto justify-end shrink-0">
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
        {!currentSite || isLoading || isLoadingBlocks ? (
          <ReservationsTableSkeleton />
        ) : viewMode === "schedules" ? (
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <SchedulesList siteId={currentSite.id} />
          </div>
        ) : viewType === "calendar" ? (
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <ReservationCalendar
              reservations={filteredReservations}
              blocks={calendarBlocks}
              viewMode={viewMode}
              onReservationClick={openEdit}
              onBlockClick={openEditBlock}
              onCreateSlot={openCreate} />
          </div>
        ) : viewMode === "service" ? (
          <ReservationsList
            reservations={filteredReservations}
            blocks={calendarBlocks}
            sortBy={sortBy}
            siteId={currentSite.id}
            onUpdate={refresh}
            onEdit={openEdit}
            onEditBlock={openEditBlock} />
        ) : (
          <ReservationsByDateList
            reservations={filteredReservations}
            blocks={calendarBlocks}
            sortBy={sortBy}
            siteId={currentSite.id}
            onUpdate={refresh}
            onEdit={openEdit}
            onEditBlock={openEditBlock} />
        )}
      </div>
      <CreateReservationDialog
        open={isFormOpen}
        reservation={editingReservation}
        initialSlot={createSlot}
        onOpenChange={handleFormOpenChange}
        onSuccess={refresh} />
      <CreateCalendarBlockDialog
        open={isBlockFormOpen}
        block={editingBlock}
        onOpenChange={handleBlockFormOpenChange}
        onSuccess={refresh} />
    </div>
  )
}
