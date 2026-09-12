"use client"

import React, { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { Clock, Building2, History, ArrowUpRight } from "lucide-react"
import { format, subDays } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogForm, DialogBody } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { WalletChart } from "./components/WalletChart"
import { SalesWithdrawalsChart } from "./components/SalesWithdrawalsChart"
import { CreditUsageHistory } from "@/app/components/billing/credit-usage-history"

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground animate-pulse">Loading balances...</div>}>
      <PaymentsContent />
    </Suspense>
  )
}

function PaymentsContent() {
  const router = useRouter()
  const { currentSite, refreshSites } = useSite()
  const { t } = useLocalization()
  const [activeTab, setActiveTab] = useState("overview")
  const supabase = createClient()

  // Payout dialog state
  const [isPayoutOpen, setIsPayoutOpen] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Extract bank details from site settings
  const shopBankDetails = {
    accountName: currentSite?.shop?.bank_account_name || "",
    bankName: currentSite?.shop?.bank_name || "",
    routingNumber: currentSite?.shop?.bank_routing_number || "",
    accountNumber: currentSite?.shop?.bank_account_number || ""
  }

  // Listen for topbar payout requests
  useEffect(() => {
    const handleOpenPayout = () => {
      setIsPayoutOpen(true)
    }
    window.addEventListener("payouts:request-open", handleOpenPayout)
    return () => window.removeEventListener("payouts:request-open", handleOpenPayout)
  }, [])

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: "Balances" },
    })
    window.dispatchEvent(event)
  }, [])

  // Fetch payout requests
  const fetchPayouts = async () => {
    if (!currentSite?.id) return []
    const { data } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('site_id', currentSite.id)
      .order('created_at', { ascending: false })
    return data || []
  }

  const { data: payouts, mutate: mutatePayouts } = useSWR(
    currentSite?.id ? ['payouts', currentSite.id] : null,
    fetchPayouts
  )

  // Fetch operations (credits_purchases AND sales AND subscriptions AND commissions) to show in the table
  const fetchOperations = async () => {
    if (!currentSite?.id) return []
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('site_id', currentSite.id)
      .in('transaction_type', ['sale', 'commission', 'credits_purchase', 'subscription'])
      .order('created_at', { ascending: false })
    return data || []
  }

  const { data: operations } = useSWR(
    currentSite?.id ? ['operations', currentSite.id] : null,
    fetchOperations
  )

  // Fetch all credit transactions to build the accurate history chart (includes sales, purchases, usages, payouts)
  const fetchCreditTransactions = async () => {
    if (!currentSite?.id) return []
    const { data } = await supabase
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('site_id', currentSite.id)
      .order('created_at', { ascending: true })
    return data || []
  }

  const { data: allTransactions } = useSWR(
    currentSite?.id ? ['credit_transactions', currentSite.id] : null,
    fetchCreditTransactions
  )

  const usableCredits = (currentSite?.billing?.credits_available || 0) + (currentSite?.billing?.account_balance || 0)
  const withdrawableBalance = currentSite?.billing?.account_balance || 0
  const pendingAmount = payouts?.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + Number(p.requested_credits), 0) || 0
  
  // Only count visible operations for the payments dashboard table
  const visibleOperations = operations?.filter(op => ['sale', 'commission'].includes(op.transaction_type)) || []
  const totalOperationsCount = visibleOperations.length
  const totalWithdrawalsCount = payouts?.length || 0

  // Extract balance history
  const chartData = []
  
  // Calculate running balance for every day in the last 14 days backwards
  let runningBalance = usableCredits + withdrawableBalance

  if (allTransactions || visibleOperations || payouts) {
    for (let i = 0; i < 14; i++) {
      const date = subDays(new Date(), i)
      
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      
      // Filter transactions exactly on this date
      const txOnDate = (allTransactions || []).filter(tx => {
        const txDate = new Date(tx.created_at)
        return txDate >= startOfDay && txDate <= endOfDay
      })
      
      const salesOnDate = visibleOperations.filter(op => op.transaction_type === 'sale' && new Date(op.created_at) >= startOfDay && new Date(op.created_at) <= endOfDay)
      const commissionsOnDate = visibleOperations.filter(op => op.transaction_type === 'commission' && new Date(op.created_at) >= startOfDay && new Date(op.created_at) <= endOfDay)
      
      const payoutsOnDate = (payouts || []).filter(p => {
        const pDate = new Date(p.created_at)
        return pDate >= startOfDay && pDate <= endOfDay && p.status !== 'rejected'
      })
      
      const creditsAdded = txOnDate.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + Number(tx.amount), 0)
      const creditsConsumed = txOnDate.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)
      
      // Gross sales added to balance
      const balanceAdded = salesOnDate.reduce((sum, op) => sum + Number(op.amount), 0)
      
      // Commissions and withdrawals consumed from balance
      const commissionDeducted = commissionsOnDate.reduce((sum, op) => sum + Number(op.amount), 0)
      const balanceConsumed = payoutsOnDate.reduce((sum, p) => sum + Number(p.requested_credits), 0)
      
      const netBalanceAdded = balanceAdded - commissionDeducted
      
      const dailyOperations = creditsAdded + netBalanceAdded
      const dailyConsumed = creditsConsumed + balanceConsumed
        
      chartData.unshift({
        date: format(date, "MMM dd"),
        operations: Number(dailyOperations.toFixed(2)),
        consumed: Number(dailyConsumed.toFixed(2)),
        balance: Number(Math.max(0, runningBalance).toFixed(2)),
        sales: Number(netBalanceAdded.toFixed(2)),
        withdrawals: Number(balanceConsumed.toFixed(2))
      })
      
      runningBalance = runningBalance - dailyOperations + dailyConsumed
    }
  }

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payoutAmount || isNaN(Number(payoutAmount)) || Number(payoutAmount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    
    if (Number(payoutAmount) > withdrawableBalance) {
      toast.error("Insufficient withdrawable balance")
      return
    }

    if (!shopBankDetails.accountNumber || !shopBankDetails.routingNumber || !shopBankDetails.accountName || !shopBankDetails.bankName) {
      toast.error("Please fill in all bank details in the Settings tab before requesting a payout")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: currentSite?.id,
          requestedCredits: Number(payoutAmount),
          bankDetails: shopBankDetails
        })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to request payout")
      }

      toast.success("Payout requested successfully")
      setIsPayoutOpen(false)
      setPayoutAmount("")
      mutatePayouts()
      refreshSites() // Refetch site to update available credits
    } catch (err: any) {
      toast.error(err.message)
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 duration-500 mt-0">
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                <BaseKpiWidget
                  title="Total Usable Credits"
                  value={usableCredits.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  changeText="System credits available"
                  isLoading={false}
                />
                <BaseKpiWidget
                  title="Withdrawable Balance (USD)"
                  value={`$${withdrawableBalance.toFixed(2)}`}
                  changeText="From sales ready to withdraw"
                  isLoading={false}
                />
                <BaseKpiWidget
                  title="Total Operations"
                  value={`${totalOperationsCount}`}
                  changeText="Total operations count"
                  isLoading={false}
                />
                <BaseKpiWidget
                  title="Total Withdrawals"
                  value={`${totalWithdrawalsCount}`}
                  changeText="Total withdrawal requests"
                  isLoading={false}
                />
              </div>

              {/* Balance Chart */}
              <WalletChart data={chartData} />

              {/* Sales vs Withdrawals Area Chart */}
              <div className="mt-8">
                <SalesWithdrawalsChart data={chartData} />
              </div>
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
                          visibleOperations.map((op: any) => (
                            <tr key={op.id} className="hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground">
                                {new Date(op.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 font-medium flex items-center gap-2">
                                <ArrowUpRight className={`h-4 w-4 ${op.transaction_type === 'commission' ? 'text-red-500' : 'text-emerald-500'}`} />
                                {op.transaction_type === 'commission' 
                                  ? 'Platform Commission'
                                  : (op.details?.original_currency && op.details?.original_currency !== 'usd' 
                                      ? `Sale Revenue (Paid in ${op.details.original_currency.toUpperCase()})` 
                                      : 'Sale Revenue')
                                }
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
                        {payouts.map((payout: any) => (
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
          </Tabs>
        </div>
      </div>

      <Dialog open={isPayoutOpen} onOpenChange={setIsPayoutOpen}>
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
                  <span>Available to withdraw: ${withdrawableBalance.toFixed(2)}</span>
                  <button 
                    type="button" 
                    onClick={() => setPayoutAmount(withdrawableBalance.toString())}
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
              <Button type="submit" disabled={isSubmitting || !shopBankDetails.accountNumber}>
                {isSubmitting ? "Processing..." : "Confirm Request"}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  )
}
