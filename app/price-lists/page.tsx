"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listPriceLists } from "./actions"
import { PriceListParams } from "./types"
import { PriceList } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Plus, Tag, Edit, MoreHorizontal, Eye } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { PriceListDialog } from "./components/PriceListDialog"
import { normalizePriceListChannels } from "./price-list-channels"

const CHANNEL_LABELS: Record<string, { key: string; fallback: string }> = {
  pos: { key: "priceLists.channels.pos", fallback: "POS" },
  shop: { key: "priceLists.channels.shop", fallback: "Shop" },
  marketplace: {
    key: "priceLists.channels.marketplace",
    fallback: "Marketplace",
  },
}

export default function PriceListsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  const [page, setPage] = useState(1)
  const pageSize = 50
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingList, setEditingList] = useState<PriceList | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all"
  )

  const fetcher = async (params: PriceListParams) => {
    const res = await listPriceLists(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? { siteId: currentSite.id, page, pageSize } : null,
    fetcher
  )

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: t("layout.sidebar.priceLists") || "Price Lists",
      },
    })
    window.dispatchEvent(event)
  }, [t])

  useEffect(() => {
    const handleCreate = () => {
      setEditingList(null)
      setIsCreateOpen(true)
    }
    window.addEventListener("price-lists:create", handleCreate)
    return () => window.removeEventListener("price-lists:create", handleCreate)
  }, [])

  const filteredLists =
    data?.data?.filter((list) => {
      if (statusFilter === "active" && !list.is_active) return false
      if (statusFilter === "inactive" && list.is_active) return false

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !list.name?.toLowerCase().includes(q) &&
          !list.code?.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    }) || []

  const openEdit = (list: PriceList) => {
    setEditingList(list)
    setIsCreateOpen(true)
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <Tabs
                  value={statusFilter}
                  onValueChange={(val) => {
                    setStatusFilter(val as any)
                    setPage(1)
                  }}
                  className="flex-shrink-0"
                >
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                    <TabsTrigger value="all" className="text-xs rounded-full">
                      {t("status.all") || "All"}
                    </TabsTrigger>
                    <TabsTrigger value="active" className="text-xs rounded-full">
                      {t("status.active") || "Active"}
                    </TabsTrigger>
                    <TabsTrigger
                      value="inactive"
                      className="text-xs rounded-full"
                    >
                      {t("status.inactive") || "Inactive"}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="w-full md:w-auto">
                  <SearchInput
                    placeholder={
                      t("priceLists.search") || "Search price lists..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    alwaysExpanded={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div>
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">
                Failed to load price lists. {error.message}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("priceLists.name") || "Name"}</TableHead>
                      <TableHead>{t("priceLists.code") || "Code"}</TableHead>
                      <TableHead>
                        {t("priceLists.currency") || "Currency"}
                      </TableHead>
                      <TableHead>
                        {t("priceLists.channels.title") || "Apply on"}
                      </TableHead>
                      <TableHead>
                        {t("priceLists.status") || "Status"}
                      </TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLists.length > 0 ? (
                      filteredLists.map((list) => {
                        const channels = normalizePriceListChannels(
                          list.channels
                        )
                        return (
                          <TableRow
                            key={list.id}
                            className={!list.is_active ? "opacity-60" : ""}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-muted-foreground" />
                                <Link
                                  href={`/price-lists/${list.id}`}
                                  className="font-medium text-foreground hover:underline"
                                >
                                  {list.name}
                                </Link>
                                {list.is_default && (
                                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none ml-2 text-[10px]">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {list.code ? (
                                <span className="font-mono text-sm text-muted-foreground">
                                  {list.code}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{list.currency}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {channels.map((channel) => {
                                  const meta = CHANNEL_LABELS[channel]
                                  return (
                                    <Badge
                                      key={channel}
                                      variant="outline"
                                      className="text-[10px] font-normal"
                                    >
                                      {t(meta.key) || meta.fallback}
                                    </Badge>
                                  )
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              {list.is_active ? (
                                <Badge
                                  variant="outline"
                                  className="border-green-200 text-green-700 bg-green-50"
                                >
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openEdit(list)}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    {t("priceLists.editAction") || "Edit list"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/price-lists/${list.id}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      {t("priceLists.managePrices") ||
                                        "Manage prices"}
                                    </Link>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <EmptyCard
                            icon={
                              <Tag className="h-6 w-6 text-muted-foreground" />
                            }
                            title={
                              t("priceLists.empty.title") || "No price lists"
                            }
                            description={
                              t("priceLists.empty.description") ||
                              "Create a price list to manage different pricing tiers."
                            }
                            className="border-0 shadow-none bg-transparent"
                            actionButton={
                              <Button
                                onClick={() => {
                                  setEditingList(null)
                                  setIsCreateOpen(true)
                                }}
                                variant="outline"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                {t("priceLists.addList") || "Create List"}
                              </Button>
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {(data?.count ?? 0) > pageSize && (
                  <div className="p-4 border-t flex justify-center bg-muted/30">
                    <Pagination
                      currentPage={page}
                      totalPages={Math.ceil(data.count / pageSize)}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <PriceListDialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) setEditingList(null)
          }}
          list={editingList}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  )
}
