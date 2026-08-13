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
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { SaveIcon, AlertTriangle } from "@/app/components/ui/icons"
import { ChartOfAccountsTable, ChartOfAccountsTableSkeleton } from "./ChartOfAccountsTable"

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
  const [editingAccount, setEditingAccount] = useState<AccountingAccount | null>(null)
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

  function resetAccountForm() {
    setEditingAccount(null)
    setNewLabel("")
    setNewCode("")
    setNewKey("")
  }

  function openCreateAccount() {
    resetAccountForm()
    setIsAddAccountOpen(true)
  }

  function openEditAccount(account: AccountingAccount) {
    setEditingAccount(account)
    setNewLabel(account.label)
    setNewCode(account.code)
    setNewKey(account.key || "")
    setIsAddAccountOpen(true)
  }

  // Handle global action
  useEffect(() => {
    const handleAddEvent = () => openCreateAccount();
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
      resetAccountForm()
      toast.success(t('accounting.accountAdded') || "Account added")
      setIsAddAccountOpen(false)
    }
  }

  async function handleSaveAccount() {
    if (editingAccount) {
      if (!currentSite?.id || !newLabel.trim()) return
      const success = await updateAccountLabel(currentSite.id, editingAccount.id, newLabel.trim())
      if (success) {
        setAccounts(accounts.map(a => a.id === editingAccount.id ? { ...a, label: newLabel.trim() } : a))
        toast.success(t('accounting.accountUpdated') || "Account updated")
        resetAccountForm()
        setIsAddAccountOpen(false)
      } else {
        toast.error(t('accounting.errorSaving') || "Failed to save account")
      }
      return
    }
    await handleAddExpense()
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
        <div className="flex items-center justify-between w-full">
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
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 md:px-8 overflow-auto max-w-[1200px] mx-auto w-full">
        {loading ? (
          <ChartOfAccountsTableSkeleton />
        ) : (
          <ChartOfAccountsTable
            accounts={filteredAccounts}
            onEdit={openEditAccount}
            onToggleActive={handleToggleActive}
          />
        )}
      </div>

      <Dialog open={isAddAccountOpen} onOpenChange={(open) => {
        setIsAddAccountOpen(open)
        if (!open) resetAccountForm()
      }}>
        <DialogContent size="md">
          <DialogForm onSubmit={(e) => { e.preventDefault(); void handleSaveAccount() }}>
            <DialogHeader>
              <DialogTitle>
                {editingAccount
                  ? (t('accounting.editAccount') || "Edit Account")
                  : (t('accounting.addExpenseAccount') || "Add Custom Expense Account")}
              </DialogTitle>
              <DialogDescription>
                {editingAccount
                  ? (t('accounting.editAccountDesc') || "Update the display name for this account. The account code cannot be changed.")
                  : (t('accounting.addExpenseDesc') || "Create a new expense account in the 6xxxx range for tracking custom expenses.")}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="space-y-2">
                <label htmlFor="label" className="text-sm font-medium">
                  {t('accounting.accountName') || "Name"}
                </label>
                <Input
                  id="label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Marketing Software"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium">
                  {t('accounting.accountCode') || "Code"}
                </label>
                <Input
                  id="code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="font-mono"
                  placeholder="e.g. 62000"
                  disabled={Boolean(editingAccount)}
                />
              </div>
              {!editingAccount ? (
                <div className="space-y-2">
                  <label htmlFor="key" className="text-sm font-medium">
                    {t('accounting.accountKey') || "Unique Key"}
                  </label>
                  <Input
                    id="key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="font-mono"
                    placeholder="e.g. EXPENSE_MARKETING_SW"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('accounting.type') || "Type"}</label>
                  <Input
                    value={t(`accounting.filter.${editingAccount.type}`) || editingAccount.type}
                    disabled
                  />
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                resetAccountForm()
                setIsAddAccountOpen(false)
              }}>{t('common.cancel') || "Cancel"}</Button>
              <Button type="submit">{t('common.save') || "Save"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpeningsOpen} onOpenChange={setIsOpeningsOpen}>
        <DialogContent size="xl" busy={savingOpenings}>
          <DialogForm onSubmit={(e) => { e.preventDefault(); void handleSaveOpenings() }}>
            <DialogHeader>
              <DialogTitle>{t('accounting.openingBalances') || "Opening Balances"}</DialogTitle>
              <DialogDescription>
                {t('accounting.openingBalancesDesc') || "Set initial balances for your accounts. Any difference will be plugged to Retained Earnings."}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
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
            </DialogBody>
            <DialogFooter className="sm:justify-between sm:items-center">
              <div className="flex w-full flex-col gap-2 font-mono text-sm sm:w-auto sm:flex-row sm:items-center sm:gap-8">
                <div>Total Debits: <span className="font-bold ml-2">{formatCurrency(totalOpeningDebits)}</span></div>
                <div>Total Credits: <span className="font-bold ml-2">{formatCurrency(totalOpeningCredits)}</span></div>
                <div className={totalOpeningDebits !== totalOpeningCredits ? "text-red-600 font-bold flex items-center gap-1.5" : "text-green-600 font-bold flex items-center gap-1.5"}>
                  {totalOpeningDebits !== totalOpeningCredits ? <AlertTriangle className="w-4 h-4" /> : null}
                  Difference: {formatCurrency(Math.abs(totalOpeningDebits - totalOpeningCredits))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpeningsOpen(false)}>{t('common.cancel') || "Cancel"}</Button>
                <Button type="submit" disabled={savingOpenings} className="gap-2">
                  <SaveIcon className="w-4 h-4" />
                  {savingOpenings ? "Saving..." : (t('common.save') || "Save")}
                </Button>
              </div>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  )
}
