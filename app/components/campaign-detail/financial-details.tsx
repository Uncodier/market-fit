"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { getCampaignTransactions } from "@/app/campaigns/actions/transactions/read"
import { deleteTransaction } from "@/app/campaigns/actions/transactions/delete"
import { CreateExpenseDialog } from "@/app/transactions/components/CreateExpenseDialog"
import { Revenue, Budget } from "@/app/types"
import { useSite } from "@/app/context/SiteContext"
import { CampaignSales } from "./campaign-sales"
import { CampaignCostsTable } from "./campaign-costs-table"
import { formatCurrency } from "@/app/lib/formatters"
import { Plus } from "@/app/components/ui/icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"

interface FinancialDetailsProps {
  campaign: any
  onUpdateCampaign: (data: any) => void
}

function FinanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  )
}

export function FinancialDetails({ campaign }: FinancialDetailsProps) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [financialData, setFinancialData] = useState<{
    revenue: Revenue
    budget: Budget
    costs: { fixed: number; variable: number; total: number; currency: string }
  }>({
    revenue: { actual: 0, projected: 0, estimated: 0, currency: "USD" },
    budget: { allocated: 0, remaining: 0, currency: "USD" },
    costs: { fixed: 0, variable: 0, total: 0, currency: "USD" },
  })
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null)
  const { currentSite } = useSite()

  const loadTransactions = async () => {
    if (!campaign?.id) return
    try {
      setLoadingTransactions(true)
      const result = await getCampaignTransactions(campaign.id)
      if (result.error) {
        toast.error("Failed to load expense data")
        return
      }

      const formattedTransactions = result.data?.map((transaction) => ({
        ...transaction,
        id: transaction.id,
        category: transaction.category,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
        campaignId: transaction.campaignId,
        campaign_id: transaction.campaignId,
        locationId: transaction.locationId,
        location_id: transaction.locationId,
        leadId: transaction.leadId,
        lead_id: transaction.leadId,
        catalogItemId: transaction.catalogItemId,
        catalog_item_id: transaction.catalogItemId,
        catalogCategoryId: transaction.catalogCategoryId,
        catalog_category_id: transaction.catalogCategoryId,
        accountingState: transaction.accountingState,
        accounting_state: transaction.accountingState,
        description: transaction.description,
      })) || []

      setTransactions(formattedTransactions)

      if (formattedTransactions.length > 0) {
        let fixedCosts = 0
        let variableCosts = 0
        formattedTransactions.forEach((transaction) => {
          if (transaction.type === "fixed") fixedCosts += Number(transaction.amount)
          else if (transaction.type === "variable") variableCosts += Number(transaction.amount)
        })
        const totalCosts = fixedCosts + variableCosts
        setFinancialData((previous) => ({
          ...previous,
          costs: { fixed: fixedCosts, variable: variableCosts, total: totalCosts, currency: previous.costs.currency },
          budget: { ...previous.budget, remaining: (previous.budget.allocated || 0) - totalCosts },
        }))
      }
    } catch (error) {
      console.error("Error in loadTransactions:", error)
      toast.error("Failed to load expense data")
    } finally {
      setLoadingTransactions(false)
    }
  }

  useEffect(() => {
    if (!campaign) return
    setFinancialData({
      revenue: {
        actual: campaign.revenue?.actual || 0,
        projected: campaign.revenue?.projected || 0,
        estimated: campaign.revenue?.estimated || 0,
        currency: campaign.revenue?.currency || "USD",
      },
      budget: {
        allocated: campaign.budget?.allocated || 0,
        remaining: campaign.budget?.remaining || 0,
        currency: campaign.budget?.currency || "USD",
      },
      costs: {
        fixed: 0,
        variable: 0,
        total:
          campaign.budget?.allocated && campaign.budget?.remaining
            ? campaign.budget.allocated - campaign.budget.remaining
            : 0,
        currency: campaign.budget?.currency || "USD",
      },
    })
    void loadTransactions()
  }, [campaign])

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) {
      toast.error("Expense ID is missing")
      return
    }
    try {
      const result = await deleteTransaction(transactionToDelete)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Expense deleted successfully")
      setIsDeletingTransaction(false)
      setTransactionToDelete(null)
      void loadTransactions()
    } catch (error) {
      console.error("Error deleting transaction:", error)
      toast.error("Failed to delete expense")
    }
  }

  const currency = financialData.budget.currency || financialData.revenue.currency || "USD"
  const revenue = financialData.revenue.actual || financialData.revenue.projected || financialData.revenue.estimated || 0
  const spent = financialData.costs.total || 0
  const roi = spent ? ((revenue - spent) / spent) * 100 : null
  const transactionsTotal = transactions.reduce((sum, cost) => sum + Number(cost.amount), 0)

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-medium mb-1">Summary</h3>
        <FinanceRow label="Budget" value={formatCurrency(financialData.budget.allocated || 0, currency)} />
        <FinanceRow label="Spent" value={formatCurrency(spent, currency)} />
        <FinanceRow label="Revenue" value={formatCurrency(revenue, currency)} />
        <FinanceRow label="ROI" value={roi === null ? "—" : `${Math.round(roi)}%`} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium">Costs</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setEditingTransaction({ campaign_id: campaign.id, campaignId: campaign.id })
              setIsExpenseDialogOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Expense
          </Button>
        </div>
        <CampaignCostsTable
          transactions={transactions}
          loading={loadingTransactions}
          total={transactionsTotal}
          onEdit={(transaction) => {
            setEditingTransaction(transaction)
            setIsExpenseDialogOpen(true)
          }}
          onDelete={(id) => {
            setTransactionToDelete(id)
            setIsDeletingTransaction(true)
          }}
        />
      </section>

      <CampaignSales campaign={campaign} />

      {currentSite?.id && (
        <CreateExpenseDialog
          siteId={currentSite.id}
          open={isExpenseDialogOpen}
          onOpenChange={setIsExpenseDialogOpen}
          onSuccess={loadTransactions}
          expenseToEdit={editingTransaction}
        />
      )}

      <AlertDialog open={isDeletingTransaction} onOpenChange={setIsDeletingTransaction}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteTransaction()}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
