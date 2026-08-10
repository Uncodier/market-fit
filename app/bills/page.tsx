"use client"

import React, { useEffect, useState } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listPurchases, deletePurchase } from "@/app/purchases/actions"
import { listLocations } from "@/app/inventory/actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { FileText, LayoutGrid, MoreHorizontal, Pencil, Trash2 } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { toast } from "sonner"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { CreatePurchaseDialog } from "./components/CreatePurchaseDialog"
import { Purchase } from "@/app/types"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

export default function BillsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: locationsData } = useSWR(
    currentSite?.id ? ['locations', currentSite.id] : null,
    () => listLocations(currentSite!.id)
  )
  const locations = locationsData?.data || []

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: t("layout.sidebar.bills") || "Bills" },
    })
    window.dispatchEvent(event)
  }, [t])

  useEffect(() => {
    const handleCreate = () => setIsDialogOpen(true)
    window.addEventListener("bills:create", handleCreate)
    return () => window.removeEventListener("bills:create", handleCreate)
  }, [])

  const fetcher = async (params: { siteId: string; page: number; pageSize: number; status: string; locationId: string; q: string }) => {
    const res = await listPurchases(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id
      ? { siteId: currentSite.id, page, pageSize, status: statusFilter, locationId: locationFilter, q: searchQuery }
      : null,
    fetcher
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  const handleDelete = async (id: string) => {
    if (!currentSite?.id) return
    if (!confirm(t("bills.confirmDelete") || "Delete this bill?")) return
    const res = await deletePurchase(currentSite.id, id)
    if (res.error) toast.error(res.error)
    else {
      toast.success(t("bills.success.deleted") || "Bill deleted")
      mutate()
    }
  }

  const rows = (data?.data || []) as Purchase[]

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{t("bills.filters.all") || "All"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <span className="tab-label">{t("bills.filters.pending") || "Pending"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <span className="tab-label">{t("bills.filters.completed") || "Completed"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <span className="tab-label">{t("bills.filters.draft") || "Draft"}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {locations.length > 0 && (
                <Select
                  value={locationFilter}
                  onValueChange={(val) => { setLocationFilter(val); setPage(1); }}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs bg-muted/30 border-0 rounded-full">
                    <SelectValue placeholder={t('allLocations') || 'All Locations'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allLocations') || 'All Locations'}</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2">
                <form onSubmit={handleSearch}>
                  <SearchInput 
                    placeholder={t('bills.search') || "Search bills..."} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                    alwaysExpanded={false}
                  />
                </form>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto md:ml-auto">
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="px-6 py-4 space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-destructive text-sm">{(error as Error).message}</div>
        ) : rows.length === 0 ? (
          <EmptyCard
            icon={<FileText size={40} className="text-muted-foreground" />}
            title={t("bills.empty.title") || "No bills yet"}
            description={t("bills.empty.description") || "Create a vendor bill to track payables and receive inventory."}
          />
        ) : (
          <>
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bills.field.title") || "Title"}</TableHead>
                    <TableHead>{t("bills.field.vendor") || "Vendor"}</TableHead>
                    <TableHead>{t("bills.field.date") || "Date"}</TableHead>
                    <TableHead>{t("bills.field.status") || "Status"}</TableHead>
                    <TableHead className="text-right">{t("bills.field.total") || "Total"}</TableHead>
                    <TableHead className="text-right">{t("bills.field.amountDue") || "Due"}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((purchase) => (
                    <TableRow
                      key={purchase.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/bills/${purchase.id}`)}
                    >
                      <TableCell className="font-medium">{purchase.title}</TableCell>
                      <TableCell>{purchase.vendorName || "—"}</TableCell>
                      <TableCell>
                        {purchase.purchaseDate
                          ? format(new Date(purchase.purchaseDate), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[purchase.status]}>
                          {t(`bills.status.${purchase.status}`) || purchase.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(purchase.amount)} {purchase.currency}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(purchase.amountDue)} {purchase.currency}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/bills/${purchase.id}`)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t("common.open") || "Open"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(purchase.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("common.delete") || "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil((data?.count ?? 0) / pageSize)}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <CreatePurchaseDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={(id) => {
          mutate()
          if (id) router.push(`/bills/${id}`)
        }}
      />
    </div>
  )
}
