"use client"

import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listExpenses, deleteExpense } from "./actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { LayoutGrid, CreditCard } from "@/app/components/ui/icons"
import { CreateExpenseDialog } from "./components/CreateExpenseDialog"
import { ExpensesTable, ExpensesTableSkeleton, ExpenseRow } from "./components/ExpensesTable"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { getActiveExpenseAccounts } from "@/app/accounting/chart"
import { AccountingAccount } from "@/app/types"
import { upsertPolizaForExpense, removePolizaForSource } from "@/app/accounting/ensure"
import { useRouter } from "next/navigation"

export default function TransactionsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  const [page, setPage] = useState(1)
  const pageSize = 50
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [campaignFilter, setCampaignFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<AccountingAccount[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<any | null>(null)

  const categoryLabels = Object.fromEntries(
    expenseAccounts.map((a) => [a.key || a.code, a.label])
  )

  useEffect(() => {
    async function loadFilters() {
      if (!currentSite?.id) return
      const supabase = createClient()

      const { data: campaignData } = await supabase
        .from("campaigns")
        .select("id, title")
        .eq("site_id", currentSite.id)
        .order("title")

      if (campaignData) setCampaigns(campaignData)

      const { data: locationData } = await supabase
        .from("locations")
        .select("id, name")
        .eq("site_id", currentSite.id)
        .order("name")

      if (locationData) setLocations(locationData)

      const accounts = await getActiveExpenseAccounts(currentSite.id)
      setExpenseAccounts(accounts)
    }
    loadFilters()
  }, [currentSite?.id])

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: t("layout.sidebar.transactions") || "Expenses" },
    })
    window.dispatchEvent(event)
  }, [t])

  useEffect(() => {
    const handleCreateEvent = () => handleCreate()
    window.addEventListener("transactions:create", handleCreateEvent)
    return () => window.removeEventListener("transactions:create", handleCreateEvent)
  }, [])

  const fetcher = async (params: any) => {
    const res = await listExpenses(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id
      ? { siteId: currentSite.id, page, pageSize, category: categoryFilter, campaignId: campaignFilter, locationId: locationFilter }
      : null,
    fetcher
  )

  const handleCreate = () => {
    setExpenseToEdit(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (expense: ExpenseRow) => {
    setExpenseToEdit(expense)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!currentSite?.id) return
    if (confirm(t("expenses.confirmDelete") || "Are you sure you want to delete this expense?")) {
      const res = await deleteExpense(id, currentSite.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t("expenses.success.deleted") || "Expense deleted successfully")
        mutate()
      }
    }
  }

  const handlePublish = async (expense: ExpenseRow) => {
    if (!currentSite?.id) return
    if ((expense.amount || 0) <= 0) {
      toast.error(t("expenses.error.publishAmount") || "Amount must be greater than zero to publish")
      return
    }
    try {
      await upsertPolizaForExpense(expense.id, currentSite.id)
      toast.success(t("expenses.success.published") || "Expense published to journal")
      mutate()
    } catch (e: any) {
      toast.error(e.message || (t("expenses.error.publish") || "Failed to publish"))
    }
  }

  const handleUnpublish = async (expense: ExpenseRow) => {
    if (!currentSite?.id) return
    try {
      await removePolizaForSource("expense", expense.id)
      toast.success(t("expenses.success.unpublished") || "Expense unpublished")
      mutate()
    } catch (e: any) {
      toast.error(e.message || (t("expenses.error.unpublish") || "Failed to unpublish"))
    }
  }

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyCard
          icon={<CreditCard size={40} className="text-muted-foreground" />}
          title={t("expenses.empty.selectSite") || "Select a project"}
          description={t("expenses.empty.selectSiteDesc") || "Please select a project to view its expenses."} />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1">{t('common.category') || 'Categoría'}</span>
                  <Tabs value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setPage(1); }}>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        <LayoutGrid size={13} className="md:!hidden" />
                        <span className="tab-label">{t("expenses.filters.all") || "All"}</span>
                      </TabsTrigger>
                      {expenseAccounts.slice(0, 4).map((acc) => (
                        <TabsTrigger
                          key={acc.key || acc.code}
                          value={acc.key || acc.code}
                          className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap"
                        >
                          <span className="tab-label">{acc.label}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {locations.length > 1 && (
                  <Select value={locationFilter} onValueChange={(val) => { setLocationFilter(val); setPage(1); }}>
                    <SelectTrigger className="w-full md:w-[180px] h-10 md:h-8 text-sm md:text-xs bg-background md:bg-muted/30 border md:border-0 rounded-md md:rounded-full">
                      <SelectValue placeholder={t("expenses.filters.allLocations") || "All Locations"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("expenses.filters.allLocations") || "All Locations"}</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                  <Select value={campaignFilter} onValueChange={(val) => { setCampaignFilter(val); setPage(1); }}>
                    <SelectTrigger className="w-full md:w-[200px] h-10 md:h-9">
                      <SelectValue placeholder={t("expenses.filters.allCampaigns") || "All Campaigns"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("expenses.filters.allCampaigns") || "All Campaigns"}</SelectItem>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </MobileFiltersDrawer>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        {isLoading ? (
          <ExpensesTableSkeleton />
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            {t("expenses.error.load") || "Failed to load expenses."} {error.message}
          </div>
        ) : (
          <ExpensesTable
            expenses={data?.data || []}
            categoryLabels={categoryLabels}
            page={page}
            pageSize={pageSize}
            totalCount={data?.count ?? 0}
            onPageChange={setPage}
            onOpen={(id) => router.push(`/transactions/${id}`)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish} />
        )}
      </div>

      <CreateExpenseDialog
        siteId={currentSite.id}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={() => mutate()}
        expenseToEdit={expenseToEdit} />
    </div>
  )
}
