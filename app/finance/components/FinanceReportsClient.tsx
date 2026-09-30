"use client"

import { useState, useEffect, useCallback } from 'react'
import { format, parse, subMonths } from 'date-fns'
import { useSite } from '@/app/context/SiteContext'
import { useLocalization } from '@/app/context/LocalizationContext'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { Skeleton } from '@/app/components/ui/skeleton'
import { SyncJournalEntriesDialog } from '@/app/accounting/components/SyncJournalEntriesDialog'
import { CalendarDateRangePicker } from '@/app/components/ui/date-range-picker'
import { TrendingUp, Building, ListOrdered, Download } from '@/app/components/ui/icons'
import { ReportCurrencySelect } from '@/app/components/dashboard/report-currency-select'
import { REPORT_CURRENCIES, reportCurrency } from '../report-currency'
import { downloadFinanceReport, financeReportCsv } from '../report-export'
import type { FinanceReportTab } from '../report-types'
import { FinanceReportContent } from './FinanceReportContent'
import { useFinanceReport } from './useFinanceReport'

export function FinanceReportsClient() {
  const { currentSite } = useSite()
  // Remount site-scoped preferences and outstanding request generations together.
  return <SiteFinanceReports key={currentSite?.id ?? 'no-site'} siteId={currentSite?.id}
    defaultCurrency={currentSite?.settings?.currency} />
}

function SiteFinanceReports({ siteId, defaultCurrency }: { siteId?: string; defaultCurrency?: string }) {
  const { t } = useLocalization()
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null)
  const currency = chosenCurrency ?? reportCurrency(defaultCurrency) ?? ''
  const [from, setFrom] = useState(() => format(subMonths(
    parse(new Date().toISOString().slice(0, 10), 'yyyy-MM-dd', new Date()), 1,
  ), 'yyyy-MM-dd'))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState<FinanceReportTab>('pnl')
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const report = useFinanceReport({ siteId, currency, tab, from, to, asOf: to })

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.financeReports') || 'Finance Reports' },
    }))
  }, [t])

  useEffect(() => {
    const openSync = () => setIsSyncModalOpen(true)
    window.addEventListener('finance:loadReport', openSync)
    return () => window.removeEventListener('finance:loadReport', openSync)
  }, [])

  const exportReport = useCallback(() => {
    if (!report.data) return toast.error('Load a complete report before exporting')
    try {
      const csv = financeReportCsv({ tab, currency, ...report.data })
      downloadFinanceReport(csv, `${tab}_${currency}_${tab === 'pnl' ? `${from}_${to}` : to}.csv`)
    } catch {
      toast.error('Could not export the report. Please try again.')
    }
  }, [report.data, tab, currency, from, to])

  useEffect(() => {
    window.addEventListener('finance:exportReport', exportReport)
    return () => window.removeEventListener('finance:exportReport', exportReport)
  }, [exportReport])

  return (
    <Tabs value={tab} onValueChange={value => setTab(value as FinanceReportTab)}
      className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
          <div className="w-full md:w-auto">
            <TabsList className="h-9 p-1 bg-muted/50 rounded-lg flex w-full sm:w-auto">
              <TabsTrigger value="pnl" className="text-xs gap-1.5" title={t('accounting.pnl') || 'Profit & Loss'}>
                <TrendingUp className="w-3.5 h-3.5" />{t('accounting.pnl') || 'Profit & Loss'}
              </TabsTrigger>
              <TabsTrigger value="bs" className="text-xs gap-1.5" title={t('accounting.bs') || 'Balance Sheet'}>
                <Building className="w-3.5 h-3.5" />{t('accounting.bs') || 'Balance Sheet'}
              </TabsTrigger>
              <TabsTrigger value="tb" className="text-xs gap-1.5" title={t('accounting.tb') || 'Trial Balance'}>
                <ListOrdered className="w-3.5 h-3.5" />{t('accounting.tb') || 'Trial Balance'}
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ReportCurrencySelect label="Report currency" value={currency} currencies={REPORT_CURRENCIES} onChange={setChosenCurrency} />
            <Button variant="ghost" size="sm" onClick={report.refresh} disabled={!siteId || !currency}>Refresh</Button>
            <Button variant="ghost" size="sm" className="flex items-center gap-1" onClick={exportReport}
              aria-label="Export report" disabled={!report.data}>
              <Download className="h-4 w-4" /><span className="hidden sm:inline">Export</span>
            </Button>
            <CalendarDateRangePicker
              onRangeChange={(start, end) => { setFrom(format(start, 'yyyy-MM-dd')); setTo(format(end, 'yyyy-MM-dd')) }}
              initialStartDate={parse(from, 'yyyy-MM-dd', new Date())}
              initialEndDate={parse(to, 'yyyy-MM-dd', new Date())} />
          </div>
        </div>
      </StickyHeader>
      <TabsContent value={tab} className="flex-1 m-0 p-4 md:p-6 md:px-8 overflow-auto max-w-[1400px] mx-auto w-full space-y-6">
        <p className="text-sm text-muted-foreground">
          {currency ? `${currency} entries only. No currency conversion. ` : 'Choose a report currency. '}
          Accounting dates use UTC; the end date includes the entire UTC day.
        </p>
        {!siteId ? <p>Select a site to view finance reports.</p>
          : !currency ? <p>Select a valid currency to load this report.</p>
          : report.error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 p-6 space-y-3">
              <h2 className="font-semibold">Finance report unavailable</h2>
              <p>{report.errorMessage}</p>
              <Button variant="outline" onClick={report.refresh}>Try again</Button>
            </div>
          ) : report.loading ? (
            <div role="status" aria-label="Loading finance report" className="space-y-6">
              <span className="sr-only">Loading finance report</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[0, 1, 2].map(value => <Skeleton key={value} className="h-28 w-full rounded-xl" />)}
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : report.data ? <FinanceReportContent {...report.data} tab={tab} currency={currency} from={from} to={to} asOf={to} /> : null}
      </TabsContent>
      {siteId && <SyncJournalEntriesDialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen} onSynced={report.refresh} />}
    </Tabs>
  )
}