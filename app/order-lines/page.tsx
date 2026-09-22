"use client"

import { useEffect, useMemo, useState } from "react"
import { endOfDay, startOfDay, subDays } from "date-fns"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { usePermissions } from "@/app/context/PermissionContext"
import { listLocations } from "@/app/inventory/actions"
import { useOrdersRealtime } from "@/app/orders/hooks/useOrdersRealtime"
import { navigateToOrder } from "@/lib/navigation/navigation-helpers"
import { Button } from "@/app/components/ui/button"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import {
  FilterContainer,
  FilterSection,
  MobileFiltersDrawer,
} from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import {
  Ban,
  CheckCircle2,
  ListTodo,
  PlayCircle,
  RotateCcw,
  Sparkles,
  X,
} from "@/app/components/ui/icons"
import { listOrderLines } from "./actions"
import {
  isOrderLineFilter,
  type OrderLineFilter,
} from "./status"
import type { OrderLineParams, OrderLineRow } from "./types"
import { useOrderLineOperations } from "./use-order-line-operations"
import {
  OrderLinesTable,
  OrderLinesTableSkeleton,
} from "./components/OrderLinesTable"
import { useDebounce } from "use-debounce"

const PAGE_SIZE = 50

function defaultDateRange() {
  return {
    startDate: startOfDay(subDays(new Date(), 30)),
    endDate: endOfDay(new Date()),
  }
}

const statusTabs: Array<{
  value: OrderLineFilter
  label: string
  title: string
  Icon: typeof ListTodo
}> = [
  { value: "all", label: "All Lines", title: "All order lines", Icon: ListTodo },
  {
    value: "pending",
    label: "Pending",
    title: "Pending order lines",
    Icon: Sparkles,
  },
  {
    value: "preparing",
    label: "In Progress",
    title: "Order lines in progress",
    Icon: PlayCircle,
  },
  {
    value: "completed",
    label: "Ready",
    title: "Ready order lines",
    Icon: CheckCircle2,
  },
  {
    value: "returned",
    label: "Returned",
    title: "Returned order lines",
    Icon: RotateCcw,
  },
  {
    value: "cancelled",
    label: "Cancelled",
    title: "Cancelled order lines",
    Icon: Ban,
  },
]

export default function OrderLinesPage() {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const { t } = useLocalization()
  const { can } = usePermissions()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300)
  const [statusFilter, setStatusFilter] =
    useState<OrderLineFilter>("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest")
  const [dateRange, setDateRange] = useState<{
    startDate: Date
    endDate: Date
  } | null>(defaultDateRange)
  useEffect(() => {
    setPage(1)
    setLocationFilter("all")
    setDateRange(defaultDateRange())
  }, [currentSite?.id])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("breadcrumb:update", {
        detail: { title: t("layout.sidebar.orderLines") },
      }),
    )
  }, [t])

  const { data: locationsData } = useSWR(
    currentSite?.id ? ["locations", currentSite.id] : null,
    () => listLocations(currentSite!.id),
  )
  const locations = locationsData?.data || []
  const locationNames = useMemo(
    () =>
      Object.fromEntries(
        locations.map((location) => [location.id, location.name]),
      ),
    [locations],
  )

  const params: OrderLineParams | null = currentSite?.id
    ? {
        siteId: currentSite.id,
        page,
        pageSize: PAGE_SIZE,
        q: debouncedSearchQuery,
        status: statusFilter,
        locationId: locationFilter,
        startDate: dateRange?.startDate.toISOString(),
        endDate: dateRange?.endDate.toISOString(),
        sort: sortBy,
      }
    : null

  const { data, error, isLoading, mutate } = useSWR(
    params ? { resource: "order-lines", ...params } : null,
    async ({ resource: _resource, ...request }) => {
      const result = await listOrderLines(request)
      if (result.error) throw new Error(result.error)
      return result
    },
  )

  useOrdersRealtime(currentSite?.id, () => {
    void mutate()
  }, { includeUnits: true })
  const operations = useOrderLineOperations({
    siteId: currentSite?.id,
    user,
    refresh: mutate,
    t,
  })

  const openOrder = (line: OrderLineRow) => {
    navigateToOrder({
      orderId: line.order.id,
      orderNumber: line.order.orderNumber || undefined,
      router,
    })
  }

  const renderTable = () => {
    if (!currentSite || isLoading) return <OrderLinesTableSkeleton />
    if (error) {
      return (
        <div className="p-6 text-center text-sm text-destructive">
          {t("orderLines.error.loadFailed")} {error.message}
        </div>
      )
    }

    return (
      <OrderLinesTable
        lines={data?.data || []}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.count || 0}
        searchQuery={searchQuery}
        locationNames={locationNames}
        updatingLineId={operations.updatingLineId}
        updatingOrderId={operations.updatingOrderId}
        canUpdate={can("update")}
        assignees={operations.assignees}
        onPageChange={setPage}
        onOrderClick={openOrder}
        onAdvanceOrder={operations.advanceOrder}
        onAssigneeChange={operations.assignLines}
        onStatusChange={operations.updateStatus}
      />
    )
  }

  const clearDateRangeLabel = t("orderLines.filters.clearDateRange")

  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30 p-0">
      <Tabs
        value={statusFilter}
        onValueChange={(value) => {
          if (!isOrderLineFilter(value)) return
          setStatusFilter(value)
          setPage(1)
        }}
        className="flex h-full min-h-0 w-full flex-1 flex-col"
      >
        <StickyHeader className="min-h-[71px] border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="w-full pt-0">
            <div className="flex w-full items-center justify-between">
              <MobileFiltersDrawer
                triggerText={t("common.search")}
                results={searchQuery ? renderTable() : null}
              >
                <FilterContainer>
                  <FilterSection mobileOnly>
                    <SearchInput
                      placeholder={t("orderLines.search")}
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value)
                        setPage(1)
                      }}
                      alwaysExpanded
                      className="h-10 w-full md:h-9"
                      containerClassName="w-full"
                    />
                  </FilterSection>

                  <FilterSection title={t("common.status")}>
                    <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-2 overflow-y-visible rounded-none bg-transparent p-0 md:h-8 md:max-w-full md:flex-nowrap md:flex-row md:gap-0 md:overflow-x-auto md:rounded-full md:bg-muted/30 md:p-0.5">
                      {statusTabs.map(({ value, label, title, Icon }) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          title={title}
                          className="flex w-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border/50 px-3 py-1.5 text-sm text-foreground/80 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm md:border-transparent md:px-3 md:py-1 md:text-xs md:text-foreground md:data-[state=active]:bg-background md:data-[state=active]:text-foreground"
                        >
                          <Icon className="h-[13px] w-[13px] shrink-0 md:!hidden" />
                          <span>{label}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </FilterSection>

                  {locations.length > 0 ? (
                    <FilterSection title={t("common.location")}>
                      <Select
                        value={locationFilter}
                        onValueChange={(value) => {
                          setLocationFilter(value)
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="h-10 w-full rounded-md border bg-background text-sm md:h-8 md:w-[160px] md:rounded-full md:border-0 md:bg-muted/30 md:text-xs">
                          <SelectValue
                            placeholder={t("common.allLocations")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("common.allLocations")}
                          </SelectItem>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterSection>
                  ) : null}

                  <FilterSection
                    mobileOnly
                    title={t("common.dateRange")}
                  >
                    <DateRangeControl
                      dateRange={dateRange}
                      clearLabel={clearDateRangeLabel}
                      onChange={(startDate, endDate) => {
                        setDateRange({ startDate, endDate })
                        setPage(1)
                      }}
                      onClear={() => {
                        setDateRange(null)
                        setPage(1)
                      }}
                    />
                  </FilterSection>

                  <FilterSection desktopOnly>
                    <SearchInput
                      placeholder={t("orderLines.search")}
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value)
                        setPage(1)
                      }}
                      className="w-full border-border bg-background focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                      containerClassName="w-64"
                    />
                  </FilterSection>
                </FilterContainer>
              </MobileFiltersDrawer>

              <div className="ml-auto flex shrink-0 items-center gap-3">
                <div className="hidden md:block">
                  <DateRangeControl
                    dateRange={dateRange}
                    clearLabel={clearDateRangeLabel}
                    onChange={(startDate, endDate) => {
                      setDateRange({ startDate, endDate })
                      setPage(1)
                    }}
                    onClear={() => {
                      setDateRange(null)
                      setPage(1)
                    }}
                  />
                </div>
                <SortDropdown
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  options={[
                    { value: "newest", label: t("orderLines.sort.newest") },
                    { value: "oldest", label: t("orderLines.sort.oldest") },
                  ]}
                />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto bg-muted/30 p-4 md:p-8">
          {renderTable()}
        </div>
      </Tabs>
    </div>
  )
}

function DateRangeControl({
  dateRange,
  clearLabel,
  onChange,
  onClear,
}: {
  dateRange: { startDate: Date; endDate: Date } | null
  clearLabel: string
  onChange: (startDate: Date, endDate: Date) => void
  onClear: () => void
}) {
  return (
    <div className="relative w-full">
      <CalendarDateRangePicker
        className="w-full [&_button]:pr-10"
        onRangeChange={onChange}
        initialStartDate={dateRange?.startDate}
        initialEndDate={dateRange?.endDate}
      />
      {dateRange ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 z-10 h-7 w-7 -translate-y-1/2"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onClear()
          }}
          aria-label={clearLabel}
          title={clearLabel}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}
