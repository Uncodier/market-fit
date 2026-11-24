"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useFinanceWorkspace } from "@/app/finance/use-finance-workspace"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { Building as Building2, RotateCcw as History, ArrowUpRight } from "@/app/components/ui/icons"
import { buildPaymentBalanceHistory } from "./payment-balance-history"
import { paymentOperationDescription } from "./payment-operation-description"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogForm, DialogBody } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { WalletChart } from "./components/WalletChart"
import { SalesWithdrawalsChart } from "./components/SalesWithdrawalsChart"
import { usePaymentDashboardData } from "./use-payment-dashboard-data"

export default function PaymentsPage() {
  const workspace = useFinanceWorkspace()
  if (workspace.loading) return <div role="status" className="p-8 text-muted-foreground">Loading balances…</div>
  if (!workspace.ready || !workspace.siteId || !workspace.actorId) return <p role="status">Select a workspace to view balances.</p>
  return <PaymentsContent key={workspace.key} siteId={workspace.siteId} actorId={workspace.actorId} />
}

function PaymentsContent({ siteId, actorId }: { siteId: string; actorId: string }) {
  const router = useRouter()
  const { currentSite, refreshSites, refreshSiteBilling } = useSite()
  const [activeTab, setActiveTab] = useState("overview")
  const reads = usePaymentDashboardData(siteId, actorId)

  // Payout dialog state
  const [isPayoutOpen, setIsPayoutOpen] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const payoutIdempotencyKeyRef = useRef<string | null>(null)

  // Extract bank details from site settings
  const shopBankDetails = {
    accountName: currentSite?.settings?.shop?.bank_account_name || "",
    bankName: currentSite?.settings?.shop?.bank_name || "",
    routingNumber: currentSite?.settings?.shop?.bank_routing_number || "",
    accountNumber: currentSite?.settings?.shop?.bank_account_number || ""
  }

  const billing = currentSite?.billing_read_status === 'unavailable' ? undefined : currentSite?.billing
  const balance = billing?.account_balance
  const withdrawableBalance = typeof balance === 'number' && Number.isFinite(balance) ? balance : undefined

  // Listen for topbar payout requests
  useEffect(() => {
    const handleOpenPayout = () => {
      if (withdrawableBalance !== undefined && withdrawableBalance > 0) setIsPayoutOpen(true)
    }
    window.addEventListener("payouts:request-open", handleOpenPayout)
    return () => window.removeEventListener("payouts:request-open", handleOpenPayout)
  }, [withdrawableBalance])

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: "Balances" },
    })
    window.dispatchEvent(event)
  }, [])

  const payouts = reads.payouts.data?.rows
  const visibleOperations = reads.operations.data?.rows
  const allTransactions = reads.transactions.data?.rows
  const credits = billing?.credits_available
  const usableCredits = typeof credits === 'number' && Number.isFinite(credits) && withdrawableBalance !== undefined
    ? credits + withdrawableBalance : undefined
  const totalTransferredAmount = payouts?.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.requested_credits), 0)
  const chartData = usableCredits !== undefined && withdrawableBalance !== undefined && allTransactions && visibleOperations && payouts
    ? buildPaymentBalanceHistory({ usableCredits, withdrawableBalance, allTransactions, visibleOperations, payouts }) : null
  const required = activeTab === 'operations' ? [reads.operations] : activeTab === 'withdrawals' ? [reads.payouts] : Object.values(reads)
  const failed = required.filter(read => read.data?.failed || read.error)
  const loading = required.some(read => !read.data && !read.error)

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payoutAmount || isNaN(Number(payoutAmount)) || Number(payoutAmount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    
    if (withdrawableBalance === undefined || Number(payoutAmount) > withdrawableBalance) {
      toast.error("Insufficient withdrawable balance")
      return
    }

    if (!shopBankDetails.accountNumber || !shopBankDetails.routingNumber || !shopBankDetails.accountName || !shopBankDetails.bankName) {
      toast.error("Please fill in all bank details in the Settings tab before requesting a payout")
      return
    }

    setIsSubmitting(true)
    try {
      payoutIdempotencyKeyRef.current ??= crypto.randomUUID()
      const response = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          requestedCredits: Number(payoutAmount),
          idempotencyKey: payoutIdempotencyKeyRef.current
        })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to request payout")
      }

      toast.success("Payout requested successfully")
      payoutIdempotencyKeyRef.current = null
      setIsPayoutOpen(false)
      setPayoutAmount("")
      void reads.payouts.mutate()
      refreshSites() // Refetch site to update available credits
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request payout")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background relative">
      <StickyHeader>
        <div className="flex-1 flex items-center justify-between min-w-0 pr-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
              <TabsTrigger value="overview" className="text-xs rounded-full px-4 whitespace-nowrap">Overview</TabsTrigger>
              <TabsTrigger value="operations" className="text-xs rounded-full px-4 whitespace-nowrap">Operations</TabsTrigger>
              <TabsTrigger value="withdrawals" className="text-xs rounded-full px-4 whitespace-nowrap">Withdrawals</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </StickyHeader>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="p-4 lg:p-8 pt-6">
          {failed.length > 0 ? <div role="alert" className="space-y-2">
            <p>Payment history could not be loaded.</p>
            <Button variant="outline" onClick={() => failed.forEach(read => { void read.mutate() })}>Retry payment history</Button>
          </div> : loading ? <p role="status">Loading payment history…</p> : <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 duration-500 mt-0">
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                <BaseKpiWidget
                  title="Total Usable Credits"
                  value={usableCredits?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? 'Unavailable'}
                  changeText="System credits available"
                  isLoading={false}
                />
                <BaseKpiWidget
                  title="Withdrawable Balance"
                  value={withdrawableBalance === undefined ? 'Unavailable' : `$${withdrawableBalance.toFixed(2)}`}
                  changeText="From sales ready to withdraw"
                  isLoading={false}
                />
                <BaseKpiWidget
                  title="Total Operations"
                  value={visibleOperations?.length}
                  changeText="Total operations count"
                  isLoading={false}
                />
                <BaseKpiWidget
                  title="Total Withdrawals"
                  value={totalTransferredAmount === undefined ? 'Unavailable' : `$${totalTransferredAmount.toFixed(2)}`}
                  changeText="Total withdrawn amount"
                  isLoading={false}
                />
              </div>

              {chartData ? <>
                <WalletChart data={chartData} />
                <div className="mt-8"><SalesWithdrawalsChart data={chartData} /></div>
              </> : <div role="status" className="space-y-2">
                <p>Balance history requires the current billing balance.</p>
                <Button variant="outline" onClick={() => { void refreshSiteBilling(siteId).catch(() => toast.error('Billing balance unavailable')) }}>Retry billing balance</Button>
              </div>}
            </TabsContent>

            <TabsContent value="operations" className="animate-in fade-in-50 duration-500 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Operations</CardTitle>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  <div className="mt-6 overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Date</th>
                          <th className="px-4 py-3 text-left font-medium">Description</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                          <th className="px-4 py-3 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {visibleOperations && visibleOperations.length > 0 ? (
                          visibleOperations.map((op) => (
                            <tr key={op.id} className="hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground">
                                {new Date(op.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 font-medium flex items-center gap-2">
                                <ArrowUpRight className={`h-4 w-4 ${op.transaction_type === 'commission' ? 'text-red-500' : 'text-emerald-500'}`} />
                                {paymentOperationDescription(op)}
                              </td>
                              <td className={`px-4 py-3 text-right font-medium ${op.transaction_type === 'commission' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {op.transaction_type === 'commission' ? '-' : '+'}${Number(op.amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${
                                  op.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                  'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }`}>
                                  {op.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center">
                              <EmptyCard 
                                icon={<History />}
                                title="No operations yet"
                                description="When you generate sales, they will appear here."
                                className="border-none shadow-none bg-transparent"
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdrawals" className="animate-in fade-in-50 duration-500 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Withdrawals</CardTitle>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                {payouts && payouts.length > 0 ? (
                  <div className="mt-6 overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Date</th>
                          <th className="px-4 py-3 text-left font-medium">Description</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                          <th className="px-4 py-3 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {payouts.map((payout) => (
                          <tr key={payout.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(payout.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 font-medium flex items-center gap-2">
                              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                              Payout to bank account
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              -${Number(payout.requested_credits).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${
                                payout.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                payout.status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              }`}>
                                {payout.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyCard 
                    icon={<History />}
                    title="No recent withdrawals"
                    description="When you request payouts, they will appear here."
                    className="border-none shadow-none bg-transparent"
                  />
                )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>}
        </div>
      </div>

      <Dialog open={isPayoutOpen && withdrawableBalance !== undefined} onOpenChange={setIsPayoutOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Withdraw funds directly to your configured bank account.
            </DialogDescription>
          </DialogHeader>
          
          <DialogForm onSubmit={handleRequestPayout}>
            <DialogBody className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount to withdraw (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input 
                    id="amount" 
                    type="number"
                    min="1"
                    step="0.01"
                    max={withdrawableBalance}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00" 
                    className="pl-8 text-lg font-medium h-12"
                    required 
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                  <span>Available to withdraw: ${withdrawableBalance?.toFixed(2)}</span>
                  <button 
                    type="button" 
                    onClick={() => setPayoutAmount(withdrawableBalance?.toString() ?? '')}
                    className="text-primary hover:underline"
                  >
                    Withdraw maximum
                  </button>
                </div>
              </div>
              
              {!shopBankDetails.accountNumber && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-lg text-sm flex gap-3 items-start">
                  <Building2 className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="flex flex-col items-start">
                    <p className="font-medium mb-1 text-amber-900 dark:text-amber-200">Bank details missing</p>
                    <p className="text-amber-700 dark:text-amber-300">Please set up your bank account in the Settings tab before requesting a payout.</p>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="mt-3 bg-background text-foreground hover:bg-muted"
                      onClick={() => {
                        setIsPayoutOpen(false);
                        router.push('/settings?tab=marketplace');
                      }}
                    >
                      Go to Settings
                    </Button>
                  </div>
                </div>
              )}
            </DialogBody>
            
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsPayoutOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || withdrawableBalance === undefined || !shopBankDetails.accountNumber}>
                {isSubmitting ? "Processing..." : "Confirm Request"}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  )
}
