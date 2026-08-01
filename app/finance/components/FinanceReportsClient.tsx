"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ensureChartOfAccounts, getAllAccounts } from "@/app/accounting/chart"
import { getPnLReport, getBalanceSheetReport } from "../reports"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { AccountingAccount } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Skeleton } from "@/app/components/ui/skeleton"
import { SyncJournalEntriesDialog } from "@/app/accounting/components/SyncJournalEntriesDialog"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { Download, AlertTriangle, TrendingUp, TrendingDown, Building, ListOrdered, CheckCircle, RefreshCcw } from "@/app/components/ui/icons"

export function FinanceReportsClient() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Record<string, AccountingAccount>>({})
  
  // P&L State
  const [pnlFrom, setPnlFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]
  })
  const [pnlTo, setPnlTo] = useState(new Date().toISOString().split('T')[0])
  const [pnlData, setPnlData] = useState<Record<string, { debit: number, credit: number }>>({})
  
  // BS State
  const [bsAsOf, setBsAsOf] = useState(new Date().toISOString().split('T')[0])
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
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-1.5 shadow-sm">
              {activeTab === "pnl" ? (
                <>
                  <Input type="date" value={pnlFrom} onChange={e => setPnlFrom(e.target.value)} className="h-7 text-xs border-0 p-0 w-[110px] focus-visible:ring-0 shadow-none bg-transparent" />
                  <span className="text-muted-foreground text-xs font-medium px-1">to</span>
                  <Input type="date" value={pnlTo} onChange={e => setPnlTo(e.target.value)} className="h-7 text-xs border-0 p-0 w-[110px] focus-visible:ring-0 shadow-none bg-transparent" />
                </>
              ) : (
                <>
                  <span className="text-muted-foreground text-xs font-medium mr-1">As of</span>
                  <Input type="date" value={bsAsOf} onChange={e => setBsAsOf(e.target.value)} className="h-7 text-xs border-0 p-0 w-[110px] focus-visible:ring-0 shadow-none bg-transparent" />
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => exportReport()}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.export') || "Export"}</span>
              </Button>
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 md:px-8 overflow-auto max-w-[1400px] mx-auto w-full">
        <Tabs value={activeTab} className="w-full">
          {/* P&L Tab */}
          <TabsContent value="pnl" className="space-y-6 m-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BaseKpiWidget
                title={t('accounting.totalIncome') || "Total Income"}
                value={formatCurrency(totalRevenue)}
                changeText=""
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.totalExpenses') || "Total Expenses"}
                value={formatCurrency(totalExpense)}
                changeText=""
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.netIncome') || "Net Income"}
                value={formatCurrency(netIncomePnL)}
                changeText=""
                isLoading={loading}
                isPositiveChange={netIncomePnL >= 0}
                customStatus={
                  <div className={`text-xs font-medium flex items-center gap-1 ${netIncomePnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netIncomePnL >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {netIncomePnL >= 0 ? 'Profit' : 'Loss'}
                  </div>
                }
              />
            </div>

            <Card className="shadow-sm border-border/50">
              <CardHeader className="border-b bg-muted/10 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  {t('accounting.pnl') || "Profit & Loss Statement"}
                </CardTitle>
                <CardDescription>
                  For the period {pnlFrom} to {pnlTo}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {/* Income Section */}
                  <div className="p-6">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.income') || "Income"}</h3>
                    <Table>
                      <TableBody>
                        {Object.entries(pnlData)
                          .filter(([code]) => accounts[code]?.type === 'income')
                          .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                          .map(([code, amts]) => {
                          const acc = accounts[code]
                          const bal = amts.credit - amts.debit
                          if (bal === 0) return null
                          return (
                            <TableRow key={code} className="hover:bg-muted/30 border-b-0 transition-colors">
                              <TableCell className="w-[120px] font-mono text-xs text-muted-foreground">{code}</TableCell>
                              <TableCell className="font-medium">{acc.label}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">{formatCurrency(bal)}</TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                          <TableCell colSpan={2} className="font-semibold">{t('accounting.totalIncome') || "Total Income"}</TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(totalRevenue)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Expenses Section */}
                  <div className="p-6 bg-muted/5">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.expenses') || "Expenses"}</h3>
                    <Table>
                      <TableBody>
                        {Object.entries(pnlData)
                          .filter(([code]) => accounts[code]?.type === 'expense')
                          .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                          .map(([code, amts]) => {
                          const acc = accounts[code]
                          const bal = amts.debit - amts.credit
                          if (bal === 0) return null
                          return (
                            <TableRow key={code} className="hover:bg-muted/30 border-b-0 transition-colors">
                              <TableCell className="w-[120px] font-mono text-xs text-muted-foreground">{code}</TableCell>
                              <TableCell className="font-medium">{acc.label}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">{formatCurrency(bal)}</TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                          <TableCell colSpan={2} className="font-semibold">{t('accounting.totalExpenses') || "Total Expenses"}</TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(totalExpense)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Net Income Summary */}
                  <div className="p-6 bg-primary/5 flex items-center justify-between">
                    <span className="font-bold text-lg">{t('accounting.netIncome') || "Net Income"}</span>
                    <span className={`font-mono font-bold text-xl tabular-nums ${netIncomePnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(netIncomePnL)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Sheet Tab */}
          <TabsContent value="bs" className="space-y-6 m-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BaseKpiWidget
                title={t('accounting.totalAssets') || "Total Assets"}
                value={formatCurrency(totalAssets)}
                changeText=""
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.totalLiabilities') || "Total Liabilities"}
                value={formatCurrency(totalLiabilities)}
                changeText=""
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.totalEquity') || "Total Equity"}
                value={formatCurrency(totalEquity)}
                changeText=""
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

            <Card className="shadow-sm border-border/50">
              <CardHeader className="border-b bg-muted/10 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  {t('accounting.bs') || "Balance Sheet"}
                </CardTitle>
                <CardDescription>
                  As of {bsAsOf}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
                  {/* Left Column: Assets */}
                  <div className="divide-y">
                    <div className="p-6 h-full">
                      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.assets') || "Assets"}</h3>
                      <Table>
                        <TableBody>
                          {Object.entries(bsData)
                            .filter(([code]) => accounts[code]?.type === 'asset')
                            .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                            .map(([code, amts]) => {
                            const acc = accounts[code]
                            const bal = amts.debit - amts.credit
                            if (bal === 0) return null
                            return (
                              <TableRow key={code} className="hover:bg-muted/30 border-b-0 transition-colors">
                                <TableCell className="w-[100px] font-mono text-xs text-muted-foreground">{code}</TableCell>
                                <TableCell className="font-medium">{acc.label}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">{formatCurrency(bal)}</TableCell>
                              </TableRow>
                            )
                          })}
                          <TableRow className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={2} className="font-semibold">{t('accounting.totalAssets') || "Total Assets"}</TableCell>
                            <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(totalAssets)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Right Column: Liabilities & Equity */}
                  <div className="divide-y flex flex-col">
                    <div className="p-6">
                      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.filter.liability') || "Liabilities"}</h3>
                      <Table>
                        <TableBody>
                          {Object.entries(bsData)
                            .filter(([code]) => accounts[code]?.type === 'liability')
                            .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                            .map(([code, amts]) => {
                            const acc = accounts[code]
                            const bal = amts.credit - amts.debit
                            if (bal === 0) return null
                            return (
                              <TableRow key={code} className="hover:bg-muted/30 border-b-0 transition-colors">
                                <TableCell className="w-[100px] font-mono text-xs text-muted-foreground">{code}</TableCell>
                                <TableCell className="font-medium">{acc.label}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">{formatCurrency(bal)}</TableCell>
                              </TableRow>
                            )
                          })}
                          <TableRow className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={2} className="font-semibold">{t('accounting.totalLiabilities') || "Total Liabilities"}</TableCell>
                            <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(totalLiabilities)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div className="p-6 flex-1 bg-muted/5">
                      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.filter.equity') || "Equity"}</h3>
                      <Table>
                        <TableBody>
                          {Object.entries(bsData)
                            .filter(([code]) => accounts[code]?.type === 'equity')
                            .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                            .map(([code, amts]) => {
                            const acc = accounts[code]
                            const bal = amts.credit - amts.debit
                            if (bal === 0) return null
                            return (
                              <TableRow key={code} className="hover:bg-muted/30 border-b-0 transition-colors">
                                <TableCell className="w-[100px] font-mono text-xs text-muted-foreground">{code}</TableCell>
                                <TableCell className="font-medium">{acc.label}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">{formatCurrency(bal)}</TableCell>
                              </TableRow>
                            )
                          })}
                          <TableRow className="border-b-0">
                            <TableCell className="w-[100px] font-mono text-xs text-transparent">-</TableCell>
                            <TableCell className="text-muted-foreground flex items-center gap-1.5">
                              {t('accounting.retainedEarnings') || "Retained Earnings (Net Income)"}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(bsNetIncome)}</TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={2} className="font-semibold">{t('accounting.totalEquity') || "Total Equity"}</TableCell>
                            <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(totalEquity)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="p-6 bg-primary/5 flex items-center justify-between border-t mt-auto">
                      <span className="font-bold">{t('accounting.totalLiabAndEquity') || "Total Liabilities & Equity"}</span>
                      <span className="font-mono font-bold text-lg tabular-nums">
                        {formatCurrency(totalLiabilities + totalEquity)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Trial Balance Tab */}
          <TabsContent value="tb" className="space-y-6 m-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <BaseKpiWidget
                title={t('accounting.totalDebits') || "Total Debits"}
                value={formatCurrency(totalTBDebits)}
                changeText=""
                isLoading={loading}
              />
              <BaseKpiWidget
                title={t('accounting.totalCredits') || "Total Credits"}
                value={formatCurrency(totalTBCredits)}
                changeText=""
                isLoading={loading}
              />
              <Card className="h-[116.5px] lg:col-span-2 overflow-hidden relative">
                <div className={`absolute inset-0 opacity-10 ${isTbBalanced ? 'bg-green-500' : 'bg-red-500'}`} />
                <CardHeader className="pb-2 pt-4 relative">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                </CardHeader>
                <CardContent className="relative flex flex-col justify-center gap-1">
                  {isTbBalanced ? (
                    <>
                      <div className="flex items-center gap-2 text-green-600 font-bold text-xl">
                        <CheckCircle className="w-5 h-5" />
                        In Balance
                      </div>
                      <p className="text-xs text-muted-foreground">Debits and credits match perfectly.</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-red-600 font-bold text-xl">
                        <AlertTriangle className="w-5 h-5" />
                        Out of Balance
                      </div>
                      <p className="text-xs text-muted-foreground text-red-600/80 font-medium">
                        Difference of {formatCurrency(Math.abs(totalTBDebits - totalTBCredits))}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm border-border/50">
              <CardHeader className="border-b bg-muted/10 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  {t('accounting.tb') || "Trial Balance"}
                </CardTitle>
                <CardDescription>
                  As of {bsAsOf}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[120px]">{t('accounting.accountCode') || "Account Code"}</TableHead>
                      <TableHead>{t('accounting.accountName') || "Account Name"}</TableHead>
                      <TableHead className="w-[150px]">{t('accounting.type') || "Type"}</TableHead>
                      <TableHead className="text-right w-[150px]">{t('accounting.debitBalance') || "Debit Balance"}</TableHead>
                      <TableHead className="text-right w-[150px]">{t('accounting.creditBalance') || "Credit Balance"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(bsData)
                      .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
                      .map(([code, amts]) => {
                      const acc = accounts[code]
                      if (!acc) return null
                      const bal = amts.debit - amts.credit
                      if (bal === 0) return null
                      const isDebit = bal > 0
                      
                      return (
                        <TableRow key={code} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-mono text-xs text-muted-foreground">{code}</TableCell>
                          <TableCell className="font-medium">{acc.label}</TableCell>
                          <TableCell className="capitalize text-muted-foreground text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs">
                              {t(`accounting.filter.${acc.type}`) || acc.type}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{isDebit ? formatCurrency(bal) : ""}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{!isDebit ? formatCurrency(Math.abs(bal)) : ""}</TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="bg-muted/10 hover:bg-muted/10 border-t-2">
                      <TableCell colSpan={3} className="font-semibold text-right">{t('accounting.totals') || "Totals"}</TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(totalTBDebits)}</TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(totalTBCredits)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
