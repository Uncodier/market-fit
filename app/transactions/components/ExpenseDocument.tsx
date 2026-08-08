"use client"

import { Transaction } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useEffect, useState } from "react"
import { getActiveExpenseAccounts } from "@/app/accounting/chart"

const TYPE_STYLES = {
  fixed: "bg-blue-50 text-blue-700 border-blue-200",
  variable: "bg-orange-50 text-orange-700 border-orange-200"
}

interface ExpenseDocumentProps {
  expense: any // Extended Transaction with joins
  siteName: string
  siteUrl: string
}

export function ExpenseDocument({
  expense,
  siteName,
  siteUrl,
}: ExpenseDocumentProps) {
  const { t } = useLocalization()
  const [categoryLabel, setCategoryLabel] = useState(expense.category)

  useEffect(() => {
    async function fetchAccounts() {
      if (!expense.site_id) return
      const accounts = await getActiveExpenseAccounts(expense.site_id)
      const account = accounts.find(a => (a.key || a.code) === expense.category)
      if (account) setCategoryLabel(account.label)
    }
    fetchAccounts()
  }, [expense.category, expense.site_id])

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  const typeLabel = (type: string) =>
    t(`expenses.type.${type}`) || type

  return (
    <div className="bg-card dark:bg-card rounded-lg shadow-lg overflow-hidden border border-border dark:border-border" style={{
      boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
      background: "var(--card)"
    }}>
      <div className="p-6 border-b border-border dark:border-border bg-muted/50 dark:bg-muted/10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-foreground dark:text-foreground">{categoryLabel}</h2>
            {expense.description && (
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">{expense.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end">
            <div className="text-right mb-2">
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                {t('expenses.table.amount') || "Amount"}
              </div>
              <div className="text-lg font-semibold text-primary dark:text-primary">
                {formatCurrency(expense.amount)} {expense.currency}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                {t('expenses.table.date') || "Date"}
              </div>
              <div className="text-base font-medium">{formatDate(expense.date)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-border dark:border-border">
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">
            {t('expenses.detail.project') || "Project"}
          </h3>
          <div className="text-base font-medium">{siteName || (t('sales.detail.yourCompany') || "Your Company")}</div>
          <div className="text-sm text-muted-foreground dark:text-muted-foreground">
            {t('sales.detail.website') || "Website"}: {siteUrl || (t('sales.detail.unknownUrl') || "Unknown URL")}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">
            {t('expenses.field.attribution') || "Attribution"}
          </h3>
          {expense.campaign ? (
            <div className="text-sm text-muted-foreground dark:text-muted-foreground">
              <span className="font-medium text-foreground">{t('expenses.field.campaign') || "Campaign"}:</span> {expense.campaign.title}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground dark:text-muted-foreground">
              <span className="font-medium text-foreground">{t('expenses.field.campaign') || "Campaign"}:</span> —
            </div>
          )}
          {expense.location && (
            <div className="text-sm text-muted-foreground dark:text-muted-foreground">
              <span className="font-medium text-foreground">{t('expenses.field.location') || "Location"}:</span> {expense.location.name}
            </div>
          )}
          {expense.lead && (
            <div className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{t('expenses.field.client') || "Client"}:</span> {expense.lead.name || expense.lead.email}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-b border-border dark:border-border">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-4">
          {t('expenses.detail.expenseDetails') || "Expense Details"}
        </h3>

        <div className="bg-muted/50 dark:bg-muted/10 p-4 rounded-md mb-6">
          <div className="grid md:grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                {t('expenses.table.amount') || "Amount"}
              </div>
              <div className="text-xl font-bold text-primary dark:text-primary">{formatCurrency(expense.amount)}</div>
              {expense.currency && <div className="text-xs text-muted-foreground dark:text-muted-foreground">{expense.currency}</div>}
            </div>
            <div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                {t('expenses.table.type') || "Type"}
              </div>
              <div>
                <Badge className={`${TYPE_STYLES[expense.type as keyof typeof TYPE_STYLES] || TYPE_STYLES.fixed} mt-1`}>
                  {typeLabel(expense.type)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
              {t('expenses.detail.generalInfo') || "General Information"}
            </h4>
            <div className="border border-border dark:border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('expenses.field.category') || "Category"}
                    </td>
                    <td className="py-2 px-3">{categoryLabel}</td>
                  </tr>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('expenses.table.date') || "Date"}
                    </td>
                    <td className="py-2 px-3">{formatDate(expense.date)}</td>
                  </tr>
                  {expense.description && (
                    <tr>
                      <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium align-top">
                        {t('expenses.field.notes') || "Notes"}
                      </td>
                      <td className="py-2 px-3">{expense.description}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
              {t('expenses.detail.costingDims') || "Costing Dimensions"}
            </h4>
            <div className="border border-border dark:border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('expenses.field.catalogItem') || "Product / Service"}
                    </td>
                    <td className="py-2 px-3">{expense.catalogItem?.name || (t('common.na') || "N/A")}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('expenses.field.catalogCategory') || "Item Category"}
                    </td>
                    <td className="py-2 px-3">{expense.catalogCategory?.name || (t('common.na') || "N/A")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-muted/50 dark:bg-muted/10 text-xs text-muted-foreground dark:text-muted-foreground">
        <div className="flex justify-between">
          <div>
            {t('common.id') || "ID"}: {expense.id}
          </div>
          <div>
            {t('common.createdAt') || "Created at"}: {formatDate(expense.created_at)}
          </div>
        </div>
      </div>
    </div>
  )
}
