"use client"

import { Purchase } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { useLocalization } from "@/app/context/LocalizationContext"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
}

interface PurchaseInvoiceProps {
  purchase: Purchase
  siteName: string
}

export function PurchaseInvoice({ purchase, siteName }: PurchaseInvoiceProps) {
  const { t } = useLocalization()

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy")
    } catch {
      return dateString
    }
  }

  return (
    <div
      className="bg-card dark:bg-card rounded-lg shadow-lg overflow-hidden border border-border"
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        background: "var(--card)",
      }}
    >
      <div className="p-6 border-b border-border bg-muted/50">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{purchase.title}</h2>
            {purchase.notes && (
              <p className="text-sm text-muted-foreground mt-1">{purchase.notes}</p>
            )}
          </div>
          <div className="text-right space-y-2">
            <Badge
              variant="outline"
              className={STATUS_STYLES[purchase.status] || STATUS_STYLES.draft}
            >
              {t(`bills.status.${purchase.status}`) || purchase.status}
            </Badge>
            <div className="text-sm text-muted-foreground">
              {t("bills.field.billDate") || "Bill date"}: {formatDate(purchase.purchaseDate)}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-border">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            {t("bills.field.billTo") || "Bill to"}
          </div>
          <div className="font-medium">{siteName}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            {t("bills.field.vendor") || "Vendor"}
          </div>
          <div className="font-medium">
            {purchase.vendorName || t("bills.field.noVendor") || "No vendor"}
          </div>
        </div>
      </div>

      <div className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("bills.field.item") || "Item"}</TableHead>
              <TableHead className="text-right">{t("bills.field.qty") || "Qty"}</TableHead>
              <TableHead className="text-right">{t("bills.field.unitCost") || "Unit cost"}</TableHead>
              <TableHead className="text-right">{t("bills.field.subtotal") || "Subtotal"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(purchase.items || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  {item.catalogItemKind && (
                    <div className="text-xs text-muted-foreground capitalize">{item.catalogItemKind}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.unitCost)} {purchase.currency}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.subtotal)} {purchase.currency}
                </TableCell>
              </TableRow>
            ))}
            {(!purchase.items || purchase.items.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {t("bills.empty.lines") || "No line items"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-6 flex flex-col items-end gap-2">
          <div className="flex justify-between w-full max-w-xs text-sm">
            <span className="text-muted-foreground">{t("bills.field.total") || "Total"}</span>
            <span className="font-semibold">
              {formatCurrency(purchase.amount)} {purchase.currency}
            </span>
          </div>
          <div className="flex justify-between w-full max-w-xs text-sm">
            <span className="text-muted-foreground">{t("bills.field.amountDue") || "Amount due"}</span>
            <span className="font-semibold text-primary">
              {formatCurrency(purchase.amountDue)} {purchase.currency}
            </span>
          </div>
          <div className="flex justify-between w-full max-w-xs text-xs text-muted-foreground">
            <span>{t("bills.field.accounting") || "Accounting"}</span>
            <span>{purchase.accountingState}</span>
          </div>
          <div className="flex justify-between w-full max-w-xs text-xs text-muted-foreground">
            <span>{t("bills.field.stock") || "Stock"}</span>
            <span>
              {purchase.stockReceived
                ? (t("bills.stock.received") || "Received")
                : (t("bills.stock.notReceived") || "Not received")}
            </span>
          </div>
        </div>

        {purchase.payments && purchase.payments.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold mb-3">
              {t("bills.field.payments") || "Payments"}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("bills.field.date") || "Date"}</TableHead>
                  <TableHead>{t("bills.field.method") || "Method"}</TableHead>
                  <TableHead className="text-right">{t("bills.field.amount") || "Amount"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell className="capitalize">{payment.method.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payment.amount)} {purchase.currency}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
