"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { listLocations } from "@/app/inventory/actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection, FilterSeparator } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Repeat } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { listInventoryMovements } from "../actions"
import { demoLocations, demoMovements } from "../demo-data"
import { MovementsTable, MovementsTableSkeleton } from "./MovementsTable"
import { CreateMovementDialog } from "./CreateMovementDialog"
import { pendingMovementKey } from "../pending-movement"

function subscribePending(listener: () => void) {
  window.addEventListener("storage", listener)
  window.addEventListener("inventory:pending-change", listener)
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("inventory:pending-change", listener) }
}

export function InventoryMovementsPage({ demo, initialSort }: { demo: boolean; initialSort: string }) {
  const { currentSite } = useSite()
  const { user } = useAuthContext()
  const siteId = currentSite?.id
  const demoMode = demo || !!siteId?.startsWith("demo-")
  return <MovementsWorkspace key={`${user?.id || "none"}-${siteId || "none"}-${demoMode}`} actorId={user?.id} siteId={siteId} demo={demoMode} initialSort={initialSort} />
}

function MovementsWorkspace({ demo, initialSort, siteId, actorId }: { demo: boolean; initialSort: string; siteId?: string; actorId?: string }) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState("all")
  const [location, setLocation] = useState("all")
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const hasRecovery = () => {
    if (demo || !actorId || !siteId) return false
    try { return !!sessionStorage.getItem(pendingMovementKey(actorId, siteId)) }
    catch { return true }
  }
  const recovery = useSyncExternalStore(subscribePending, hasRecovery, () => false)
  const pageSize = 50
  const { data, error, isLoading, mutate } = useSWR(!demo && siteId ? ["inventory-movements", siteId] : null, async () => {
    const result = await listInventoryMovements(siteId!)
    if (result.error) throw new Error(result.error)
    return result.data
  })
  const { data: locationsData, error: locationsFetchError } = useSWR(!demo && siteId ? ["locations", siteId] : null, () => listLocations(siteId!))
  const locationsError = locationsData?.error || locationsFetchError?.message
  const locations = demo ? demoLocations : locationsError ? [] : locationsData?.data || []
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("breadcrumb:update", { detail: { title: "Inventory Ledger" } }))
    const create = () => setOpen(true)
    window.addEventListener("inventory-movements:create", create)
    return () => window.removeEventListener("inventory-movements:create", create)
  }, [])

  const query = search.trim().toLowerCase()
  const rows = (demo ? demoMovements : data || []).filter(row =>
    (kind === "all" || row.kind === kind) &&
    (location === "all" || row.from_location_id === location || row.to_location_id === location) &&
    (!query || [row.item_name, row.from_location_name, row.to_location_name, row.notes, row.receiving_user_name].some(value => value?.toLowerCase().includes(query)))
  ).sort((a, b) => (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * (sort === "oldest" ? 1 : -1))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))
  const locationSelect = <Select value={location} onValueChange={value => { setLocation(value); setPage(1) }}>
    <SelectTrigger aria-label="Filter by location" className="w-full md:w-[170px] h-10 md:h-8 text-sm md:text-xs bg-background md:bg-muted/30 border md:border-0 rounded-md md:rounded-full"><SelectValue placeholder="All Locations" /></SelectTrigger>
    <SelectContent><SelectItem value="all">All Locations</SelectItem>{locations.map(value => <SelectItem key={value.id} value={value.id}>{value.name}</SelectItem>)}</SelectContent>
  </Select>

  return <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
    <StickyHeader><div className="w-full pt-0"><div className="flex items-center justify-between gap-2 w-full">
      <MobileFiltersDrawer triggerText="Search & Filters">
        <FilterContainer>
          <FilterSection mobileOnly><SearchInput placeholder="Search movements..." value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} alwaysExpanded containerClassName="w-full" /></FilterSection>
          <FilterSection title="Type"><Tabs value={kind} onValueChange={value => { setKind(value); setPage(1) }}>
            <TabsList className="bg-transparent p-0 h-auto flex-wrap justify-start gap-2 md:bg-muted/30 md:rounded-full md:p-1">
              {[["all", "All"], ["transfer", "Legacy transfers"], ["dispatch", "Dispatches"], ["receive", "Transfer receipts"], ["return", "Returns"], ["writeoff", "Write-offs"], ["receipt", "Purchase receipts"], ["adjustment", "Adjustments"]].map(([value, label]) => <TabsTrigger key={value} value={value} className="w-auto rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:text-foreground whitespace-nowrap">{label}</TabsTrigger>)}
            </TabsList>
          </Tabs></FilterSection>
          <FilterSeparator />
          <FilterSection title="Location">{locationSelect}</FilterSection>
          <FilterSection desktopOnly><SearchInput placeholder="Search movements..." value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} containerClassName="w-full md:w-[240px]" /></FilterSection>
        </FilterContainer>
      </MobileFiltersDrawer>
      <div className="shrink-0 ml-4"><SortDropdown sortBy={sort} setSortBy={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} /></div>
    </div></div></StickyHeader>
    <div className="px-6 py-4 space-y-4">
      <Link href={`/inventory/transfers${demo ? "?demo=1" : ""}`} className="text-sm hover:underline">View transfer documents</Link>
      {recovery && <Button variant="outline" onClick={() => setOpen(true)}>Recover pending operation</Button>}
      <p className="text-xs text-muted-foreground">Effective stock movements, including receipts and adjustments. Transfer documents and their workflow activity are available in Transfers.</p>
      {!demo && <Link href="/inventory/movements?demo=1" className="inline-block text-xs text-muted-foreground underline underline-offset-4">View read-only demo preview</Link>}
      {!demo && data && data.length >= 1000 && <p className="text-xs text-muted-foreground">Showing the latest 1,000 movements. Search and filters apply to these loaded movements only.</p>}
      {!demo && !siteId ? <EmptyCard icon={<Repeat size={40} />} title="Select a site" description="Choose a workspace to view inventory movements." /> : isLoading ? <MovementsTableSkeleton /> : error ? <div role="alert" className="text-sm text-destructive">{error.message} <Button variant="outline" size="sm" onClick={() => void mutate()}>Retry</Button></div> : rows.length === 0 ?
        <EmptyCard icon={<Repeat size={40} className="text-muted-foreground" />} title={search || kind !== "all" || location !== "all" ? "No matching movements" : "No movements yet"} description="Track inventory transfers between your locations." /> :
        <MovementsTable rows={rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)} page={currentPage} pageSize={pageSize} count={rows.length} onPageChange={setPage} />}
      {locationsError && <p role="alert" className="text-sm text-destructive">Unable to load locations: {locationsError}</p>}
    </div>
    {open && <CreateMovementDialog key={`${siteId || "none"}-${demo}`} open={open} onOpenChange={value => { setOpen(value); window.dispatchEvent(new Event("inventory:pending-change")) }} siteId={siteId} demo={demo} locations={locations} locationsError={locationsError} onSuccess={() => void mutate()} />}
  </div>
}