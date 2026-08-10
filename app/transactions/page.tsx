"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listExpenses, deleteExpense } from "./actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { LayoutGrid, Plus, MoreHorizontal, Pencil, Trash2, CreditCard } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { CreateExpenseDialog } from "./components/CreateExpenseDialog"
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
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<AccountingAccount[]>([])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<any | null>(null)

  const categoryLabels = Object.fromEntries(
    expenseAccounts.map(a => [a.key || a.code, a.label])
  )

  // Load campaigns & locations for filters
  useEffect(() => {
    async function loadFilters() {
      if (!currentSite?.id) return;
      const supabase = createClient()
      
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('id, title')
        .eq('site_id', currentSite.id)
        .order('title')
      
      if (campaignData) setCampaigns(campaignData)
      
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, name')
        .eq('site_id', currentSite.id)
        .order('name')
        
      if (locationData) setLocations(locationData)

      const accounts = await getActiveExpenseAccounts(currentSite.id)
      setExpenseAccounts(accounts)
    }
    loadFilters()
  }, [currentSite?.id])

  // Set breadcrumbs
  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.transactions') || 'Expenses' }
    });
    window.dispatchEvent(event);
  }, [t]);

  // Add listener for the topbar button event
  useEffect(() => {
    const handleCreateEvent = () => handleCreate();
    window.addEventListener('transactions:create', handleCreateEvent);
    return () => window.removeEventListener('transactions:create', handleCreateEvent);
  }, []);

  const fetcher = async (params: any) => {
    const res = await listExpenses(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? { siteId: currentSite.id, page, pageSize, category: categoryFilter, campaignId: campaignFilter, locationId: locationFilter } : null,
    fetcher
  )

  const handleCreate = () => {
    setExpenseToEdit(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (expense: any) => {
    setExpenseToEdit(expense)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!currentSite?.id) return;
    if (confirm(t('expenses.confirmDelete') || "Are you sure you want to delete this expense?")) {
      const res = await deleteExpense(id, currentSite.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t('expenses.success.deleted') || "Expense deleted successfully")
        mutate()
      }
    }
  }

  const handlePublish = async (expense: any) => {
    if (!currentSite?.id) return;
    if (expense.amount <= 0) {
      toast.error(t('expenses.error.publishAmount') || "Amount must be greater than zero to publish");
      return;
    }
    try {
      await upsertPolizaForExpense(expense.id, currentSite.id);
      toast.success(t('expenses.success.published') || "Expense published to journal");
      mutate();
    } catch (e: any) {
      toast.error(e.message || (t('expenses.error.publish') || "Failed to publish"));
    }
  };

  const handleUnpublish = async (expense: any) => {
    if (!currentSite?.id) return;
    try {
      await removePolizaForSource('expense', expense.id);
      toast.success(t('expenses.success.unpublished') || "Expense unpublished");
      mutate();
    } catch (e: any) {
      toast.error(e.message || (t('expenses.error.unpublish') || "Failed to unpublish"));
    }
  };

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyCard
          icon={<CreditCard size={40} className="text-muted-foreground" />}
          title={t('expenses.empty.selectSite') || "Select a project"}
          description={t('expenses.empty.selectSiteDesc') || "Please select a project to view its expenses."}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <Tabs value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setPage(1); }}>
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                    <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                      <LayoutGrid size={13} className="md:!hidden" />
                      <span className="tab-label">{t('expenses.filters.all') || 'All'}</span>
                    </TabsTrigger>
                    {expenseAccounts.slice(0, 4).map(acc => (
                      <TabsTrigger
                        key={acc.key || acc.code}
                        value={acc.key || acc.code}
                        className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5"
                      >
                        <span className="tab-label">{acc.label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                {locations.length > 1 && (
                  <Select value={locationFilter} onValueChange={(val) => { setLocationFilter(val); setPage(1); }}>
                    <SelectTrigger className="w-[180px] h-8 text-xs bg-muted/30 border-0 rounded-full">
                      <SelectValue placeholder={t('expenses.filters.allLocations') || "All Locations"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('expenses.filters.allLocations') || "All Locations"}</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto md:ml-auto">
                <Select value={campaignFilter} onValueChange={(val) => { setCampaignFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-[200px] h-9">
                    <SelectValue placeholder={t('expenses.filters.allCampaigns') || "All Campaigns"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('expenses.filters.allCampaigns') || "All Campaigns"}</SelectItem>
                    {campaigns.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="flex flex-col gap-6">
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">
                {t('expenses.error.load') || "Failed to load expenses."} {error.message}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('expenses.table.date') || 'Date'}</TableHead>
                      <TableHead>{t('expenses.table.category') || 'Category'}</TableHead>
                      <TableHead>{t('expenses.table.campaign') || 'Campaign'}</TableHead>
                      <TableHead>{t('expenses.table.type') || 'Type'}</TableHead>
                      <TableHead className="text-right">{t('expenses.table.amount') || 'Amount'}</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data && data.data.length > 0 ? (
                      data.data.map((expense: any) => (
                        <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/transactions/${expense.id}`)}>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {format(new Date(expense.date), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">
                              {categoryLabels[expense.category] || expense.category}
                            </div>
                            {expense.description && (
                              <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                                {expense.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {expense.campaign ? (
                              <Badge variant="outline" className="text-xs font-normal">
                                {expense.campaign.title}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {t(`expenses.type.${expense.type}`) || expense.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: expense.currency || 'USD' }).format(expense.amount)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(expense)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  {t('common.edit') || "Edit"}
                                </DropdownMenuItem>
                                {expense.accounting_state !== 'posted' && (
                                  <DropdownMenuItem onClick={() => handlePublish(expense)}>
                                    {t('common.publish') || "Publish"}
                                  </DropdownMenuItem>
                                )}
                                {expense.accounting_state === 'posted' && (
                                  <DropdownMenuItem onClick={() => handleUnpublish(expense)}>
                                    {t('common.cancel') || "Cancel"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(expense.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t('common.delete') || "Delete"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <EmptyCard
                            icon={<CreditCard size={24} className="text-muted-foreground" />}
                            title={t('expenses.empty.title') || "No expenses found"}
                            description={t('expenses.empty.description') || "Expenses will appear here once they are added."}
                            className="border-0 shadow-none bg-transparent"
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
                      totalPages={Math.ceil((data?.count ?? 0) / pageSize)}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <CreateExpenseDialog
        siteId={currentSite.id}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={() => mutate()}
        expenseToEdit={expenseToEdit}
      />
    </div>
  )
}
