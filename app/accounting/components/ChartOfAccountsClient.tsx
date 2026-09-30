"use client"

import React, { useEffect, useRef, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ensureChartOfAccounts, toggleAccountActive } from "../chart"
import type { AccountingAccount } from "@/app/types"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Settings } from "@/app/components/ui/icons"
import { ChartOfAccountsTable, ChartOfAccountsTableSkeleton } from "./ChartOfAccountsTable"
import { OpeningBalancesDialog } from "./OpeningBalancesDialog"
import { AccountingAccountDialog } from "./AccountingAccountDialog"
import { useChartData } from "./use-chart-data"

const FILTERS = { all: "All", asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses" }

export function ChartOfAccountsClient() {
  const { currentSite } = useSite()
  return <SiteChart key={currentSite?.id || "none"} siteId={currentSite?.id || ""} currency={currentSite?.settings?.currency || "USD"} />
}

function SiteChart({ siteId, currency }: { siteId: string; currency: string }) {
  const { t } = useLocalization()
  const data = useChartData(siteId, currency)
  const [editingAccount, setEditingAccount] = useState<AccountingAccount | null>(null)
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)
  const [isOpeningsOpen, setIsOpeningsOpen] = useState(false)
  const [filterType, setFilterType] = useState("all")
  const [mutating, setMutating] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const ready = data.ready && !mutating
  const openingReady = ready && data.accounts.length > 0

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("breadcrumb:update", { detail: { title: t("layout.sidebar.chartOfAccounts") || "Chart of Accounts" } }))
  }, [t])

  useEffect(() => {
    const create = () => { if (ready) { setEditingAccount(null); setIsAddAccountOpen(true) } }
    const openings = () => { if (openingReady) setIsOpeningsOpen(true) }
    window.addEventListener("accounting:create", create)
    window.addEventListener("accounting:openingBalances", openings)
    return () => {
      window.removeEventListener("accounting:create", create)
      window.removeEventListener("accounting:openingBalances", openings)
    }
  }, [ready, openingReady])

  async function mutate(action: () => Promise<unknown>) {
    if (!ready) return
    setMutating(true)
    try {
      const result = await action()
      if (!mounted.current) return
      if (result === false) throw new Error("Failed to update account")
      await data.reload()
    } catch (error) {
      if (mounted.current) toast.error(error instanceof Error ? error.message : "Failed to update account")
    } finally {
      if (mounted.current) setMutating(false)
    }
  }

  const filteredAccounts = filterType === "all" ? data.accounts : data.accounts.filter((account) => account.type === filterType)
  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height,64px))] flex-1 flex-col bg-muted/30">
      <StickyHeader>
        <div className="flex w-full items-center justify-between gap-2">
          <Tabs value={filterType} onValueChange={setFilterType} className="w-full md:w-auto">
            <TabsList className="hide-scrollbar flex h-9 w-full justify-start overflow-x-auto rounded-lg bg-muted/50 p-1 sm:w-auto">
              {Object.entries(FILTERS).map(([value, label]) => <TabsTrigger type="button" key={value} value={value} className="rounded-md px-4 text-xs">{label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Button type="button" variant="ghost" size="sm" disabled={!openingReady} onClick={() => { if (openingReady) setIsOpeningsOpen(true) }} className="gap-1">
            <Settings className="h-4 w-4" /><span>Opening Balances</span>
          </Button>
        </div>
      </StickyHeader>
      <div className="mx-auto w-full max-w-[1200px] flex-1 overflow-auto p-4 md:p-6 md:px-8">
        {!siteId ? <p>Select a site to view accounting.</p> : data.status === "error" ? (
          <div role="alert" className="space-y-3"><p>{data.error}</p><Button type="button" variant="outline" onClick={() => void data.reload()}>Retry loading accounts</Button></div>
        ) : !ready ? <ChartOfAccountsTableSkeleton /> : data.accounts.length === 0 ? (
          <div className="space-y-3"><p>The chart of accounts has not been initialized.</p><Button type="button" onClick={() => void mutate(() => ensureChartOfAccounts(siteId))}>Initialize chart of accounts</Button></div>
        ) : (
          <ChartOfAccountsTable accounts={filteredAccounts} onEdit={(account) => { if (ready) { setEditingAccount(account); setIsAddAccountOpen(true) } }} onToggleActive={(account) => { if (!account.system) void mutate(() => toggleAccountActive(siteId, account.id, !account.active)) }} />
        )}
      </div>
      {isAddAccountOpen && ready ? <AccountingAccountDialog siteId={siteId} account={editingAccount} accounts={data.accounts} onClose={() => setIsAddAccountOpen(false)} onSaved={() => void data.reload()} /> : null}
      {isOpeningsOpen && openingReady && data.opening ? <OpeningBalancesDialog key={data.version} siteId={siteId} accounts={data.accounts} opening={data.opening} ready={openingReady} open={isOpeningsOpen} onOpenChange={setIsOpeningsOpen} onSaved={() => void data.reload()} /> : null}
    </div>
  )
}