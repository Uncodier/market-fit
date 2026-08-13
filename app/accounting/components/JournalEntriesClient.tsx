"use client"

import React, { useState, useEffect } from "react"
import { format, subMonths } from "date-fns"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listJournalEntries, deleteManualJournalEntry } from "../entries"
import { getAllAccounts, ensureChartOfAccounts } from "../chart"
import { AccountingAccount } from "@/app/types"
import { toast } from "sonner"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { JournalEntryDialog } from "./JournalEntryDialog"
import { SyncJournalEntriesDialog } from "./SyncJournalEntriesDialog"
import { JournalEntriesTable, JournalEntriesTableSkeleton } from "./JournalEntriesTable"
import { journalSourceHref } from "../journal-source"
import { useRouter } from "next/navigation"

export function JournalEntriesClient() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [entries, setEntries] = useState<any[]>([])
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [loading, setLoading] = useState(true)

  const [fromDate, setFromDate] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM-dd"))
  const [toDate, setToDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
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

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="flex items-center justify-between w-full">
          <Tabs value={sourceType} onValueChange={setSourceType} className="w-full md:w-auto">
            <TabsList className="h-9 p-1 bg-muted/50 rounded-lg flex w-full sm:w-auto overflow-x-auto justify-start hide-scrollbar">
              <TabsTrigger value="all" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.all') || "All"}</TabsTrigger>
              <TabsTrigger value="sale" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.sale') || "Sale"}</TabsTrigger>
              <TabsTrigger value="purchase" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.purchase') || "Purchase"}</TabsTrigger>
              <TabsTrigger value="expense" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.expense') || "Expense"}</TabsTrigger>
              <TabsTrigger value="opening" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.opening') || "Opening"}</TabsTrigger>
              <TabsTrigger value="manual" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.manual') || "Manual"}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 md:px-8 overflow-auto max-w-[1400px] mx-auto w-full">
        {loading ? (
          <JournalEntriesTableSkeleton />
        ) : (
          <JournalEntriesTable
            entries={entries}
            accounts={accounts}
            currency={currentSite?.settings?.currency || "USD"}
            onOpen={(entry) => {
              setSelectedEntry(entry)
              setIsDialogOpen(true)
            }}
            onOpenSource={(entry) => {
              const href = journalSourceHref(entry)
              if (href) router.push(href)
            }}
            onDelete={handleDelete}
          />
        )}
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
        onSynced={(from, to) => {
          if (from === fromDate && to === toDate) {
            loadData()
            return
          }
          setFromDate(from)
          setToDate(to)
        }}
      />
    </div>
  )
}
