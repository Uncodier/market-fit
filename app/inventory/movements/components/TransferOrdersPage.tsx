"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { listLocations } from "@/app/inventory/actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Repeat } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { listTransferOrders } from "../order-actions"
import { demoTransferOrders } from "../transfer-demo-data"
import { demoLocations } from "../demo-data"
import { transferLabel, transferStatuses } from "../transfer-presentation"
import { TransferOrdersTable } from "./TransferOrdersTable"
import { MovementsTableSkeleton } from "./MovementsTable"
import { CreateMovementDialog } from "./CreateMovementDialog"

export function TransferOrdersPage({ demo, initialSort }: { demo: boolean; initialSort: string }) {
  const { currentSite } = useSite()
  const { user } = useAuthContext()
  const preview = demo || !!currentSite?.id?.startsWith("demo-")
  return <TransferOrdersWorkspace key={`${user?.id}-${currentSite?.id}-${preview}`} demo={preview} siteId={currentSite?.id} initialSort={initialSort} />
}
function TransferOrdersWorkspace({ demo, siteId, initialSort }: { demo: boolean; siteId?: string; initialSort: string }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [location, setLocation] = useState("all")
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const pageSize = 50
  const orders = useSWR(!demo && siteId ? ["inventory-transfer-orders", siteId] : null, async () => {
    const result = await listTransferOrders(siteId!)
    if (result.error) throw new Error(result.error)
    return result.data
  })
  const { data, error } = useSWR(!demo && siteId ? ["locations", siteId] : null, () => listLocations(siteId!))
  const locationsError = data?.error || error?.message
  const locations = demo ? demoLocations : locationsError ? [] : data?.data || []
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("breadcrumb:update", { detail: { title: "Inventory Transfers" } }))
    const create = () => setOpen(true)
    window.addEventListener("inventory-transfers:create", create)
    return () => window.removeEventListener("inventory-transfers:create", create)
  }, [])
  const query = search.trim().toLowerCase()
  const rows = (demo ? demoTransferOrders : orders.data || []).filter(order =>
    (status === "all" || order.status === status) && (location === "all" || order.from_location_id === location || order.to_location_id === location) &&
    (!query || [order.id, order.from_location_name, order.to_location_name, order.notes, order.receiving_user_name].some(value => value?.toLowerCase().includes(query)))
  ).sort((a, b) => (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * (sort === "oldest" ? 1 : -1))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))
  return <div className="flex-1 flex flex-col bg-muted/30 min-h-screen"><StickyHeader><div className="flex items-center justify-between w-full gap-3 py-3"><MobileFiltersDrawer triggerText="Search & Filters"><FilterContainer>
    <FilterSection title="Status"><Select value={status} onValueChange={value => { setStatus(value); setPage(1) }}><SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{transferStatuses.map(value => <SelectItem key={value} value={value}>{transferLabel(value)}</SelectItem>)}</SelectContent></Select></FilterSection>
    <FilterSection title="Location"><Select value={location} onValueChange={value => { setLocation(value); setPage(1) }}><SelectTrigger aria-label="Filter by location"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Locations</SelectItem>{locations.map(location => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></FilterSection>
    <FilterSection><SearchInput placeholder="Search transfers..." value={search} alwaysExpanded onChange={event => { setSearch(event.target.value); setPage(1) }} /></FilterSection>
  </FilterContainer></MobileFiltersDrawer><SortDropdown sortBy={sort} setSortBy={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} /></div></StickyHeader>
    <div className="px-4 lg:px-8 py-6 space-y-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs text-muted-foreground">Transfer documents track requests, dispatch and receipt. Stock entries are available in the Inventory Ledger.</p><Link href={`/inventory/movements${demo ? "?demo=1" : ""}`} className="text-xs hover:underline">View Inventory Ledger</Link></div>
      {!demo && <Link href="/inventory/transfers?demo=1" className="text-xs text-muted-foreground underline">View read-only demo preview</Link>}
      {!demo && orders.data && orders.data.length >= 1000 && <p className="text-xs text-muted-foreground">Showing the latest 1,000 transfer orders. Filters apply to loaded documents only.</p>}
      {!demo && !siteId ? <EmptyCard icon={<Repeat size={40} />} title="Select a site" description="Choose a workspace to view transfers." /> : orders.isLoading ? <MovementsTableSkeleton /> : orders.error ? <div role="alert">{orders.error.message} <Button variant="outline" onClick={() => void orders.mutate()}>Retry</Button></div> : !rows.length ? <EmptyCard icon={<Repeat size={40} />} title="No transfers" description="Request a transfer to get started." /> : <TransferOrdersTable rows={rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)} demo={demo} page={currentPage} pageSize={pageSize} count={rows.length} onPageChange={setPage} />}
      {locationsError && <p role="alert" className="text-sm text-destructive">Unable to load locations: {locationsError}</p>}
    </div>
    {open && <CreateMovementDialog open onOpenChange={setOpen} demo={demo} siteId={siteId} locations={locations} locationsError={locationsError} onSuccess={() => void orders.mutate()} />}
  </div>
}