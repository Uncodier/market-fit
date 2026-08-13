"use client"

import React, { useState, useEffect } from "react"
import { format, parse, subMonths } from "date-fns"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ensureChartOfAccounts, getAllAccounts } from "@/app/accounting/chart"
import { getPnLReport, getBalanceSheetReport } from "../reports"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { AccountingAccount } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Skeleton } from "@/app/components/ui/skeleton"
import { SyncJournalEntriesDialog } from "@/app/accounting/components/SyncJournalEntriesDialog"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { AlertTriangle, TrendingUp, Building, ListOrdered } from "@/app/components/ui/icons"
import { PnlStatementCard, BalanceSheetCard } from "./FinanceReportStatements"
import { TrialBalanceTable } from "./TrialBalanceTable"

export function FinanceReportsClient() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Record<string, AccountingAccount>>({})
  
  // P&L State
  const [pnlFrom, setPnlFrom] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM-dd"))
  const [pnlTo, setPnlTo] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [pnlData, setPnlData] = useState<Record<string, { debit: number, credit: number }>>({})
  
  // BS State
  const [bsAsOf, setBsAsOf] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [bsData, setBsData] = useState<Record<string, { debit: number, credit: number }>>({})
  
  const [activeTab, setActiveTab] = useState("pnl")
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)

  useEffect(() => {
    if (currentSite?.id) {
      loadChart()
    }
  }, [currentSite?.id])

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.financeReports') || 'Finance Reports' }
    });
    window.dispatchEvent(event);
  }, [t]);

  useEffect(() => {
    const handleLoadReport = () => {
      setIsSyncModalOpen(true)
    };
    
    window.addEventListener('finance:loadReport', handleLoadReport);
    return () => window.removeEventListener('finance:loadReport', handleLoadReport);
  }, []);

  useEffect(() => {
    if (activeTab === 'pnl') {
      handleLoadPnL();
    } else {
      handleLoadBS();
    }
  }, [activeTab, pnlFrom, pnlTo, bsAsOf, currentSite?.id]);

  async function loadChart() {
    if (!currentSite?.id) return
    try {
      await ensureChartOfAccounts(currentSite.id)
      const accs = await getAllAccounts(currentSite.id)
      const map: Record<string, AccountingAccount> = {}
      accs.forEach(a => map[a.code] = a)
      setAccounts(map)
    } catch (e: any) {
      toast.error(t('accounting.errorLoading') || "Failed to load chart of accounts")
    }
  }

  async function handleLoadPnL() {
    if (!currentSite?.id) return
    setLoading(true)
    try {
      const data = await getPnLReport(currentSite.id, pnlFrom, pnlTo)
      setPnlData(data)
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorLoading') || "Failed to load P&L")
    } finally {
      setLoading(false)
    }
  }

  async function handleLoadBS() {
    if (!currentSite?.id) return
    setLoading(true)
    try {
      const data = await getBalanceSheetReport(currentSite.id, bsAsOf)
      setBsData(data)
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorLoading') || "Failed to load Balance Sheet")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentSite?.settings?.currency || 'USD' }).format(val)

  // Calculate P&L totals
  let totalRevenue = 0
  let totalExpense = 0
  
  Object.entries(pnlData).forEach(([code, amts]) => {
    const acc = accounts[code]
    if (!acc) return
    if (acc.type === 'income') totalRevenue += (amts.credit - amts.debit)
    if (acc.type === 'expense') totalExpense += (amts.debit - amts.credit)
  })
  
  const netIncomePnL = totalRevenue - totalExpense

  // Calculate BS totals
  let totalAssets = 0
  let totalLiabilities = 0
  let totalEquityExcludingNI = 0
  let bsNetIncome = 0

  Object.entries(bsData).forEach(([code, amts]) => {
    const acc = accounts[code]
    if (!acc) return
    if (acc.type === 'asset') totalAssets += (amts.debit - amts.credit)
    if (acc.type === 'liability') totalLiabilities += (amts.credit - amts.debit)
    if (acc.type === 'equity') totalEquityExcludingNI += (amts.credit - amts.debit)
    if (acc.type === 'income') bsNetIncome += (amts.credit - amts.debit)
    if (acc.type === 'expense') bsNetIncome -= (amts.debit - amts.credit)
  })

  const totalEquity = totalEquityExcludingNI + bsNetIncome

  // Calculate TB totals
  let totalTBDebits = 0
  let totalTBCredits = 0
  
  Object.entries(bsData).forEach(([code, amts]) => {
    const bal = amts.debit - amts.credit
    if (bal > 0) totalTBDebits += bal
    else totalTBCredits += Math.abs(bal)
  })

  useEffect(() => {
    const handleExportReport = () => {
      exportReport();
    };
    
    window.addEventListener('finance:exportReport', handleExportReport);
    return () => window.removeEventListener('finance:exportReport', handleExportReport);
  }, [activeTab, pnlData, bsData, accounts]);

  const exportReport = () => {
    if (activeTab === 'pnl') {
      if (Object.keys(pnlData).length === 0) return toast.error("No data to export")
      const rows = [["Account Code", "Account Name", "Type", "Balance"]]
      Object.entries(pnlData).forEach(([code, amts]) => {
        const acc = accounts[code]
        if (!acc) return
        let bal = 0
        if (acc.type === 'income') bal = amts.credit - amts.debit
        if (acc.type === 'expense') bal = amts.debit - amts.credit
        if (bal !== 0) {
          rows.push([code, acc.label, acc.type, bal.toString()])
        }
      })
      rows.push(["", "Net Income", "", netIncomePnL.toString()])
      
      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `pnl_${pnlFrom}_${pnlTo}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      // TB & BS use bsData
      if (Object.keys(bsData).length === 0) return toast.error("No data to export")
      const rows = [["Account Code", "Account Name", "Type", "Debit", "Credit", "Balance"]]
      Object.entries(bsData).forEach(([code, amts]) => {
        const acc = accounts[code]
        if (!acc) return
        const bal = amts.debit - amts.credit
        let displayBal = bal
        if (acc.type === 'liability' || acc.type === 'equity' || acc.type === 'income') {
          displayBal = -bal
        }
        if (bal !== 0) {
          const deb = bal > 0 ? bal : 0
          const cred = bal < 0 ? Math.abs(bal) : 0
          rows.push([code, acc.label, acc.type, deb.toString(), cred.toString(), displayBal.toString()])
        }
      })
      
      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `balances_${bsAsOf}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  if (loading && Object.keys(accounts).length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
        <StickyHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full hidden lg:flex">
                  <TabsTrigger value="pnl" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('accounting.pnl') || "Profit & Loss"}>
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="tab-label">{t('accounting.pnl') || "Profit & Loss"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="bs" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('accounting.bs') || "Balance Sheet"}>
                    <Building className="w-3.5 h-3.5" />
                    <span className="tab-label">{t('accounting.bs') || "Balance Sheet"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="tb" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('accounting.tb') || "Trial Balance"}>
                    <ListOrdered className="w-3.5 h-3.5" />
                    <span className="tab-label">{t('accounting.tb') || "Trial Balance"}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </StickyHeader>
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={`kpi-${i}`} className="h-[116.5px] w-full rounded-xl" />
              ))}
            </div>
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={`row-${i}`} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isBsBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= 0.01;
  const isTbBalanced = Math.abs(totalTBDebits - totalTBCredits) <= 0.01;
  const formatReportDate = (iso: string) => format(parse(iso, "yyyy-MM-dd", new Date()), "MMM d, yyyy")
  const selectedPeriodText = t('accounting.kpi.selectedPeriod')
  const asOfText = t('accounting.kpi.asOf', { date: formatReportDate(bsAsOf) })
  const netIncomeChangeText = `${netIncomePnL >= 0 ? t('accounting.profit') : t('accounting.loss')} ${t('accounting.kpi.thisPeriod')}`
  const tbDifference = Math.abs(totalTBDebits - totalTBCredits)

  const handleDateRangeChange = (start: Date, end: Date) => {
    setPnlFrom(format(start, "yyyy-MM-dd"))
    setPnlTo(format(end, "yyyy-MM-dd"))
    setBsAsOf(format(end, "yyyy-MM-dd"))
  }

  const periodPicker = (
    <CalendarDateRangePicker
      onRangeChange={handleDateRangeChange}
      initialStartDate={parse(pnlFrom, "yyyy-MM-dd", new Date())}
      initialEndDate={parse(pnlTo, "yyyy-MM-dd", new Date())}
    />
  )

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="h-9 p-1 bg-muted/50 rounded-lg flex w-full sm:w-auto">
              <TabsTrigger value="pnl" className="text-xs rounded-md flex-1 sm:flex-none items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title={t('accounting.pnl') || "Profit & Loss"}>
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="tab-label">{t('accounting.pnl') || "Profit & Loss"}</span>
              </TabsTrigger>
              <TabsTrigger value="bs" className="text-xs rounded-md flex-1 sm:flex-none items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title={t('accounting.bs') || "Balance Sheet"}>
                <Building className="w-3.5 h-3.5" />
                <span className="tab-label">{t('accounting.bs') || "Balance Sheet"}</span>
              </TabsTrigger>
              <TabsTrigger value="tb" className="text-xs rounded-md flex-1 sm:flex-none items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title={t('accounting.tb') || "Trial Balance"}>
                <ListOrdered className="w-3.5 h-3.5" />
                <span className="tab-label">{t('accounting.tb') || "Trial Balance"}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="ml-auto">
            {periodPicker}
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 md:px-8 overflow-auto max-w-[1400px] mx-auto w-full">
        <Tabs value={activeTab} className="w-full">
          {/* P&L Tab */}
          <TabsContent value="pnl" className="space-y-6 m-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BaseKpiWidget
                title={t('accounting.totalIncome')}
                value={formatCurrency(totalRevenue)}
                changeText={selectedPeriodText}
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.totalExpenses')}
                value={formatCurrency(totalExpense)}
                changeText={selectedPeriodText}
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.netIncome')}
                value={formatCurrency(netIncomePnL)}
                changeText={netIncomeChangeText}
                isPositiveChange={netIncomePnL >= 0}
                isLoading={loading}
              />
            </div>

            <PnlStatementCard
              accounts={accounts}
              pnlData={pnlData}
              totalRevenue={totalRevenue}
              totalExpense={totalExpense}
              netIncomePnL={netIncomePnL}
              pnlFrom={formatReportDate(pnlFrom)}
              pnlTo={formatReportDate(pnlTo)}
              formatCurrency={formatCurrency}
              t={t}
            />
          </TabsContent>

          {/* Balance Sheet Tab */}
          <TabsContent value="bs" className="space-y-6 m-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BaseKpiWidget
                title={t('accounting.totalAssets')}
                value={formatCurrency(totalAssets)}
                changeText={asOfText}
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.totalLiabilities')}
                value={formatCurrency(totalLiabilities)}
                changeText={asOfText}
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.totalEquity')}
                value={formatCurrency(totalEquity)}
                changeText={asOfText}
                isLoading={loading}
              />
            </div>

            {!isBsBalanced && (
              <div className="bg-red-50 text-red-900 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">{t('accounting.bsWarning') || "Balance Sheet is out of balance"}</h4>
                  <p className="text-sm mt-1">
                    Assets ({formatCurrency(totalAssets)}) do not equal Liabilities + Equity ({formatCurrency(totalLiabilities + totalEquity)}). Difference: {formatCurrency(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}
                  </p>
                </div>
              </div>
            )}

            <BalanceSheetCard
              accounts={accounts}
              bsData={bsData}
              totalAssets={totalAssets}
              totalLiabilities={totalLiabilities}
              totalEquity={totalEquity}
              bsNetIncome={bsNetIncome}
              bsAsOf={formatReportDate(bsAsOf)}
              formatCurrency={formatCurrency}
              t={t}
            />
          </TabsContent>
          
          {/* Trial Balance Tab */}
          <TabsContent value="tb" className="space-y-6 m-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BaseKpiWidget
                title={t('accounting.totalDebits')}
                value={formatCurrency(totalTBDebits)}
                changeText={asOfText}
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.totalCredits')}
                value={formatCurrency(totalTBCredits)}
                changeText={asOfText}
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.status')}
                value={isTbBalanced ? t('accounting.inBalance') : t('accounting.outOfBalance')}
                changeText={
                  isTbBalanced
                    ? t('accounting.debitsMatchCredits')
                    : t('accounting.kpi.differenceOf', { amount: formatCurrency(tbDifference) })
                }
                isPositiveChange={isTbBalanced}
                isLoading={loading}
              />
            </div>

            <TrialBalanceTable
              accounts={accounts}
              bsData={bsData}
              totalDebits={totalTBDebits}
              totalCredits={totalTBCredits}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      <SyncJournalEntriesDialog 
        open={isSyncModalOpen}
        onOpenChange={setIsSyncModalOpen}
        onSynced={() => {
          if (activeTab === 'pnl') handleLoadPnL()
          else handleLoadBS()
        }}
      />
    </div>
  )
}
