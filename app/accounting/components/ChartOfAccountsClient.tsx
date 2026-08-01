"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getAllAccounts, addExpenseAccount, updateAccountLabel, toggleAccountActive, ensureChartOfAccounts, getOpeningEntry, saveOpeningEntry } from "../chart"
import { AccountingAccount } from "@/app/types"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Plus, Settings, Edit, Play, Pause, SaveIcon, AlertTriangle } from "@/app/components/ui/icons"

export function ChartOfAccountsClient() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [loading, setLoading] = useState(true)

  const [newLabel, setNewLabel] = useState("")
  const [newCode, setNewCode] = useState("")
  const [newKey, setNewKey] = useState("")

  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0])
  const [openingBalances, setOpeningBalances] = useState<Record<string, { debit: number, credit: number }>>({})
  const [savingOpenings, setSavingOpenings] = useState(false)

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)
  const [isOpeningsOpen, setIsOpeningsOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>("all")

  useEffect(() => {
    if (currentSite?.id) {
      loadAccounts()
    }
  }, [currentSite?.id])

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.chartOfAccounts') || 'Chart of Accounts' }
    });
    window.dispatchEvent(event);
  }, [t]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'asset': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
      case 'liability': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800'
      case 'equity': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
      case 'income': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
      case 'expense': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  // Handle global action
  useEffect(() => {
    const handleAddEvent = () => setIsAddAccountOpen(true);
    const handleOpeningsEvent = () => setIsOpeningsOpen(true);
    window.addEventListener('accounting:create', handleAddEvent);
    window.addEventListener('accounting:openingBalances', handleOpeningsEvent);
    return () => {
      window.removeEventListener('accounting:create', handleAddEvent);
      window.removeEventListener('accounting:openingBalances', handleOpeningsEvent);
    }
  }, []);

  async function loadAccounts() {
    if (!currentSite?.id) return
    setLoading(true)
    try {
      await ensureChartOfAccounts(currentSite.id)
      const data = await getAllAccounts(currentSite.id)
      setAccounts(data)

      const openingEntry = await getOpeningEntry(currentSite.id)
      if (openingEntry) {
        setOpeningDate(openingEntry.entry_date.split('T')[0])
        const balances: Record<string, { debit: number, credit: number }> = {}
        for (const line of openingEntry.journal_lines || []) {
          balances[line.account_code] = { debit: line.debit, credit: line.credit }
        }
        setOpeningBalances(balances)
      }
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorLoading') || "Failed to load accounts")
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveOpenings() {
    if (!currentSite?.id) return
    setSavingOpenings(true)
    try {
      await saveOpeningEntry(currentSite.id, openingDate, openingBalances)
      toast.success(t('accounting.openingBalancesSaved') || "Opening balances saved")
      await loadAccounts() // Refresh to see equity plug
      setIsOpeningsOpen(false)
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorSavingOpening') || "Failed to save opening balances")
    } finally {
      setSavingOpenings(false)
    }
  }

  async function handleAddExpense() {
    if (!currentSite?.id || !newLabel || !newCode || !newKey) return
    
    // Check code/key uniqueness on client
    if (accounts.some(a => a.code === newCode)) {
      toast.error(t('accounting.errorAccountCodeExists') || "Account code already exists")
      return
    }
    if (accounts.some(a => a.key === newKey)) {
      toast.error(t('accounting.errorAccountKeyExists') || "Account key already exists")
      return
    }

    const account = await addExpenseAccount(currentSite.id, newLabel, newKey, newCode)
    if (account) {
      setAccounts([...accounts, account].sort((a, b) => a.code.localeCompare(b.code)))
      setNewLabel("")
      setNewCode("")
      setNewKey("")
      toast.success(t('accounting.accountAdded') || "Account added")
      setIsAddAccountOpen(false)
    }
  }

  async function handleToggleActive(account: AccountingAccount) {
    if (!currentSite?.id) return
    if (account.system) {
      toast.error(t('accounting.errorDeactivateSystem') || "Cannot deactivate system accounts")
      return
    }
    const success = await toggleAccountActive(currentSite.id, account.id, !account.active)
    if (success) {
      setAccounts(accounts.map(a => a.id === account.id ? { ...a, active: !a.active } : a))
      toast.success(account.active ? (t('accounting.accountDeactivated') || 'Account deactivated') : (t('accounting.accountActivated') || 'Account activated'))
    }
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentSite?.settings?.currency || 'USD' }).format(val)

  let totalOpeningDebits = 0
  let totalOpeningCredits = 0
  Object.values(openingBalances).forEach(b => {
    totalOpeningDebits += (b.debit || 0)
    totalOpeningCredits += (b.credit || 0)
  })

  const filteredAccounts = filterType === "all" ? accounts : accounts.filter(a => a.type === filterType)

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <Tabs value={filterType} onValueChange={setFilterType} className="w-full md:w-auto">
            <TabsList className="h-9 p-1 bg-muted/50 rounded-lg flex w-full sm:w-auto overflow-x-auto justify-start hide-scrollbar">
              <TabsTrigger value="all" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.all') || "All"}</TabsTrigger>
              <TabsTrigger value="asset" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.asset') || "Assets"}</TabsTrigger>
              <TabsTrigger value="liability" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.liability') || "Liabilities"}</TabsTrigger>
              <TabsTrigger value="equity" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.equity') || "Equity"}</TabsTrigger>
              <TabsTrigger value="income" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.income') || "Income"}</TabsTrigger>
              <TabsTrigger value="expense" className="text-xs rounded-md data-[state=active]:shadow-sm px-4">{t('accounting.filter.expense') || "Expenses"}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 ml-auto w-full md:w-auto">
            <Button variant="outline" size="sm" onClick={() => setIsOpeningsOpen(true)} className="h-9 gap-1.5 flex-1 md:flex-none">
              <Settings className="w-4 h-4" />
              <span className="truncate">{t('accounting.openingBalances') || "Opening Balances"}</span>
            </Button>
            <Button size="sm" onClick={() => setIsAddAccountOpen(true)} className="h-9 gap-1.5 flex-1 md:flex-none">
              <Plus className="w-4 h-4" />
              <span className="truncate">{t('common.add') || "Add Account"}</span>
            </Button>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 md:px-8 overflow-auto max-w-[1200px] mx-auto w-full">
        <div className="flex flex-col gap-6">
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">{t('accounting.accountCode') || "Account Code"}</TableHead>
                    <TableHead>{t('accounting.accountName') || "Account Name"}</TableHead>
                    <TableHead className="w-[150px]">{t('accounting.type') || "Type"}</TableHead>
                    <TableHead className="w-[150px]">{t('accounting.status') || "Status"}</TableHead>
                    <TableHead className="w-[80px] text-right">{t('accounting.actions') || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map(account => (
                    <TableRow key={account.id} className={`hover:bg-muted/30 transition-colors ${!account.active ? 'opacity-50' : ''}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{account.code}</TableCell>
                      <TableCell className="font-medium">
                        {account.label}
                        {account.system && (
                          <Badge variant="secondary" className="ml-2 text-[10px] uppercase tracking-wider py-0 opacity-70">System</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${getTypeColor(account.type)}`}>
                          {t(`accounting.filter.${account.type}`) || account.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {account.active ? (
                          <span className="text-xs font-medium text-green-600 flex items-center gap-1"><Play className="w-3 h-3" /> Active</span>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Pause className="w-3 h-3" /> Inactive</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!account.system && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleActive(account)}
                            title={account.active ? "Deactivate" : "Activate"}
                          >
                            {account.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        {t('accounting.noAccountsFound') || "No accounts found matching this filter."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('accounting.addExpenseAccount') || "Add Custom Expense Account"}</DialogTitle>
            <DialogDescription>
              {t('accounting.addExpenseDesc') || "Create a new expense account in the 6xxxx range for tracking custom expenses."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="label" className="text-right text-sm font-medium">
                {t('accounting.accountName') || "Name"}
              </label>
              <Input
                id="label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="col-span-3"
                placeholder="e.g. Marketing Software"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="code" className="text-right text-sm font-medium">
                {t('accounting.accountCode') || "Code"}
              </label>
              <Input
                id="code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="col-span-3 font-mono"
                placeholder="e.g. 62000"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="key" className="text-right text-sm font-medium">
                {t('accounting.accountKey') || "Unique Key"}
              </label>
              <Input
                id="key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="col-span-3 font-mono"
                placeholder="e.g. EXPENSE_MARKETING_SW"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>{t('common.cancel') || "Cancel"}</Button>
            <Button onClick={handleAddExpense}>{t('common.save') || "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpeningsOpen} onOpenChange={setIsOpeningsOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{t('accounting.openingBalances') || "Opening Balances"}</DialogTitle>
            <DialogDescription>
              {t('accounting.openingBalancesDesc') || "Set initial balances for your accounts. Any difference will be plugged to Retained Earnings."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex items-center gap-4 mb-6 bg-muted/30 p-4 rounded-lg">
              <label className="font-semibold text-sm">{t('accounting.openingDate') || "Opening Date"}</label>
              <Input 
                type="date" 
                value={openingDate} 
                onChange={e => setOpeningDate(e.target.value)} 
                className="w-auto h-9 bg-background"
              />
            </div>
            
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/10 sticky top-0 z-10 backdrop-blur-md">
                  <TableRow>
                    <TableHead className="w-[100px]">{t('accounting.accountCode') || "Code"}</TableHead>
                    <TableHead>{t('accounting.accountName') || "Name"}</TableHead>
                    <TableHead className="text-right w-[180px]">{t('accounting.debit') || "Debit"}</TableHead>
                    <TableHead className="text-right w-[180px]">{t('accounting.credit') || "Credit"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map(acc => (
                    <TableRow key={acc.code}>
                      <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                      <TableCell className="font-medium">{acc.label}</TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          className="h-8 text-right font-mono text-sm"
                          value={openingBalances[acc.code]?.debit || ""}
                          onChange={e => setOpeningBalances(prev => ({
                            ...prev, 
                            [acc.code]: { ...prev[acc.code], debit: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          className="h-8 text-right font-mono text-sm"
                          value={openingBalances[acc.code]?.credit || ""}
                          onChange={e => setOpeningBalances(prev => ({
                            ...prev, 
                            [acc.code]: { ...prev[acc.code], credit: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="border-t p-6 bg-muted/10">
            <div className="flex items-center justify-between font-mono mb-4 text-sm bg-background p-4 rounded-lg border shadow-sm">
              <div className="flex gap-8">
                <div>Total Debits: <span className="font-bold ml-2">{formatCurrency(totalOpeningDebits)}</span></div>
                <div>Total Credits: <span className="font-bold ml-2">{formatCurrency(totalOpeningCredits)}</span></div>
              </div>
              <div className={totalOpeningDebits !== totalOpeningCredits ? "text-red-600 font-bold flex items-center gap-1.5" : "text-green-600 font-bold flex items-center gap-1.5"}>
                {totalOpeningDebits !== totalOpeningCredits ? <AlertTriangle className="w-4 h-4" /> : null}
                Difference: {formatCurrency(Math.abs(totalOpeningDebits - totalOpeningCredits))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsOpeningsOpen(false)}>{t('common.cancel') || "Cancel"}</Button>
              <Button onClick={handleSaveOpenings} disabled={savingOpenings} className="gap-2">
                <SaveIcon className="w-4 h-4" />
                {savingOpenings ? "Saving..." : (t('common.save') || "Save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
