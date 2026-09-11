"use client"

import React, { useEffect, useState, Suspense } from "react"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { WalletChart } from "./components/WalletChart"

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground animate-pulse">Loading balances...</div>}>
      <PaymentsContent />
    </Suspense>
  )
}

function PaymentsContent() {
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

  // Fetch operations
  const fetchOperations = async () => {
    if (!currentSite?.id) return []
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('site_id', currentSite.id)
      .eq('transaction_type', 'sale')
      .order('created_at', { ascending: false })
    return data || []
  }

  const { data: operations } = useSWR(
    currentSite?.id ? ['operations', currentSite.id] : null,
    fetchOperations
  )

  const availableBalance = currentSite?.billing?.account_balance || 0
  const pendingAmount = payouts?.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + Number(p.requested_credits), 0) || 0

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payoutAmount || isNaN(Number(payoutAmount)) || Number(payoutAmount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    
    if (Number(payoutAmount) > availableBalance) {
      toast.error("Insufficient balance available")
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
        <div className="max-w-6xl mx-auto p-4 lg:p-8 pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 duration-500 mt-0">
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                <BaseKpiWidget
                  title="Available Balance"
                  value={`$${availableBalance.toFixed(2)}`}
                  changeText="Balance ready to be withdrawn"
                  isLoading={false}
                />
                <BaseKpiWidget
                  title="Pending Payouts"
                  value={`$${pendingAmount.toFixed(2)}`}
                  changeText="Amount currently being processed"
                  isLoading={false}
                />
              </div>

              {/* Balance Chart */}
              <WalletChart currentBalance={availableBalance} />
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
                        {operations && operations.length > 0 ? (
                          operations.map((op: any) => (
                            <tr key={op.id} className="hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground">
                                {new Date(op.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 font-medium flex items-center gap-2">
                                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                                Sale Revenue
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                +${Number(op.amount).toFixed(2)}
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
          
          <form onSubmit={handleRequestPayout}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount to withdraw (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input 
                    id="amount" 
                    type="number"
                    min="1"
                    step="0.01"
                    max={availableBalance}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00" 
                    className="pl-8 text-lg font-medium h-12"
                    required 
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                  <span>Available: ${availableBalance.toFixed(2)}</span>
                  <button 
                    type="button" 
                    onClick={() => setPayoutAmount(availableBalance.toString())}
                    className="text-primary hover:underline"
                  >
                    Withdraw maximum
                  </button>
                </div>
              </div>
              
              {!shopBankDetails.accountNumber && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 p-4 rounded-lg text-sm flex gap-3 items-start">
                  <Building2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Bank details missing</p>
                    <p>Please set up your bank account in the Settings tab before requesting a payout.</p>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsPayoutOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !shopBankDetails.accountNumber}>
                {isSubmitting ? "Processing..." : "Confirm Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
