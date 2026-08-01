"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listJournalEntries, deleteManualJournalEntry } from "../entries"
import { getAllAccounts, ensureChartOfAccounts } from "../chart"
import { AccountingAccount } from "@/app/types"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { JournalEntryDialog } from "./JournalEntryDialog"
import { SyncJournalEntriesDialog } from "./SyncJournalEntriesDialog"
import { Input } from "@/app/components/ui/input"
import { Trash2 } from "@/app/components/ui/icons"

export function JournalEntriesClient() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [entries, setEntries] = useState<any[]>([])
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [loading, setLoading] = useState(true)

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sourceType, setSourceType] = useState<string>("all")
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null)

  useEffect(() => {
    if (currentSite?.id) {
      loadData()
    }
  }, [currentSite?.id, fromDate, toDate, sourceType])

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.journalEntries') || 'Journal Entries' }
    });
    window.dispatchEvent(event);
  }, [t]);

  useEffect(() => {
    const handleCreateEvent = () => {
      setSelectedEntry(null)
      setIsDialogOpen(true)
    }
    const handleLoadEvent = () => {
      setIsSyncModalOpen(true)
    }
    
    window.addEventListener('journal:create', handleCreateEvent)
    window.addEventListener('journal:load', handleLoadEvent)
    
    return () => {
      window.removeEventListener('journal:create', handleCreateEvent)
      window.removeEventListener('journal:load', handleLoadEvent)
    }
  }, [])

  async function loadData() {
    if (!currentSite?.id) return
    setLoading(true)
    try {
      await ensureChartOfAccounts(currentSite.id)
      const accs = await getAllAccounts(currentSite.id)
      setAccounts(accs)

      const data = await listJournalEntries(currentSite.id, fromDate, toDate, sourceType)
      setEntries(data)
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorLoading') || "Failed to load journal entries")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(entryId: string) {
    if (!currentSite?.id) return
    if (!confirm(t('common.confirmDelete') || "Are you sure you want to delete this?")) return
    
    try {
      await deleteManualJournalEntry(currentSite.id, entryId)
      toast.success(t('accounting.entryDeleted') || "Entry deleted")
      loadData()
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorDeleting') || "Failed to delete entry")
    }
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentSite?.settings?.currency || 'USD' }).format(val)

  const getSourceBadgeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
      case 'expense': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
      case 'opening': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
      case 'manual': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <Tabs value={sourceType} onValueChange={setSourceType} className="w-full md:w-auto">
            <TabsList className="h-9 p-1 bg-muted/50 rounded-lg flex w-full sm:w-auto overflow-x-auto justify-start hide-scrollbar">
              <TabsTrigger value="all" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.all') || "All"}</TabsTrigger>
              <TabsTrigger value="sale" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.sale') || "Sale"}</TabsTrigger>
              <TabsTrigger value="expense" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.expense') || "Expense"}</TabsTrigger>
              <TabsTrigger value="opening" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.opening') || "Opening"}</TabsTrigger>
              <TabsTrigger value="manual" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.manual') || "Manual"}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-1.5 shadow-sm w-full sm:w-auto ml-auto">
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-7 text-xs border-0 p-0 w-[110px] focus-visible:ring-0 shadow-none bg-transparent" />
            <span className="text-muted-foreground text-xs font-medium px-1">to</span>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-7 text-xs border-0 p-0 w-[110px] focus-visible:ring-0 shadow-none bg-transparent" />
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 md:px-8 overflow-auto max-w-[1400px] mx-auto w-full">
        <div className="flex flex-col gap-6">
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">{t('accounting.date') || "Date"}</TableHead>
                    <TableHead>{t('accounting.memo') || "Memo"}</TableHead>
                    <TableHead className="w-[120px]">{t('accounting.source') || "Source"}</TableHead>
                    <TableHead className="text-right w-[150px]">{t('accounting.debit') || "Debit"}</TableHead>
                    <TableHead className="text-right w-[150px]">{t('accounting.credit') || "Credit"}</TableHead>
                    <TableHead className="text-right w-[80px]">{t('accounting.actions') || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        {t('accounting.noEntries') || "No journal entries found in this period."}
                      </TableCell>
                    </TableRow>
                  ) : entries.map(entry => {
                    const totalDebit = (entry.journal_lines || []).reduce((sum: number, l: any) => sum + Number(l.debit), 0)
                    const totalCredit = (entry.journal_lines || []).reduce((sum: number, l: any) => sum + Number(l.credit), 0)
                    
                    return (
                      <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => {
                        setSelectedEntry(entry)
                        setIsDialogOpen(true)
                      }}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {new Date(entry.entry_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={entry.memo || ""}>
                          {entry.memo || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${getSourceBadgeColor(entry.source_type)}`}>
                            {t(`accounting.filter.${entry.source_type}`) || entry.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCurrency(totalDebit)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCurrency(totalCredit)}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          {entry.source_type === 'manual' ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleDelete(entry.id)}
                              title={t('common.delete') || "Delete"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            <div className="w-8 h-8" />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      <JournalEntryDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        entry={selectedEntry}
        accounts={accounts}
        onSaved={loadData}
      />
      
      <SyncJournalEntriesDialog 
        open={isSyncModalOpen}
        onOpenChange={setIsSyncModalOpen}
        onSynced={loadData}
      />
    </div>
  )
}
