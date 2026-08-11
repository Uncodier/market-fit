"use client"

import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Plus, Trash2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import {
  formatDocumentDate,
  formatDocumentMoney,
  resolveDocumentLocale,
} from "@/app/lib/i18n/document-t"
import {
  formatPdfLocationLines,
  resolveBillToLines,
} from "@/app/quotations/quotation-pdf-helpers"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-50 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-orange-50 text-orange-700 border-orange-200",
}

interface QuotationInvoiceProps {
  quotation: any
  updating?: boolean
  onAddItem?: () => void
  onRemoveItem?: (itemId: string) => void
  onRetryItem?: (itemId: string) => void
}

export function QuotationInvoice({
  quotation,
  updating,
  onAddItem,
  onRemoveItem,
  onRetryItem,
}: QuotationInvoiceProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()

  const documentLocale = resolveDocumentLocale(
    currentSite?.settings?.default_locale || undefined
  )
  const siteName = quotation.site?.name || currentSite?.name || ""
  const siteUrl = quotation.site?.url || currentSite?.url || ""
  const locationLines = formatPdfLocationLines(
    currentSite?.settings?.locations?.[0] || null
  )
  const billTo = resolveBillToLines(quotation.lead)
  const isDraft = quotation.status === "draft"

  const formatMoney = (amount: number) =>
    formatDocumentMoney(amount || 0, quotation.currency || "USD", documentLocale)

  return (
    <div
      className="bg-card dark:bg-card rounded-lg shadow-lg overflow-hidden border border-border dark:border-border"
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        background: "var(--card)",
      }}
    >
      {/* Header — SaleInvoice pattern */}
      <div className="p-6 border-b border-border dark:border-border bg-muted/50 dark:bg-muted/10">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              {t("quotations.detail.breadcrumbQuote") || "Quote"}
            </div>
            <h2 className="text-2xl font-semibold text-foreground">
              #{quotation.id.substring(0, 8)}
            </h2>
            {quotation.title ? (
              <p className="text-sm text-muted-foreground mt-1">{quotation.title}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant="outline"
              className={cn("uppercase", STATUS_STYLES[quotation.status] || STATUS_STYLES.draft)}
            >
              {t(`status.${quotation.status}`) ||
                t(`quotations.status.${quotation.status}`) ||
                quotation.status}
            </Badge>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                {t("quotations.detail.created") || "Created"}
              </div>
              <div className="text-base font-medium">
                {formatDocumentDate(quotation.created_at, documentLocale)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                {t("quotations.detail.validUntil") || "Valid Until"}
              </div>
              <div className="text-base font-medium">
                {quotation.valid_until
                  ? formatDocumentDate(quotation.valid_until, documentLocale)
                  : t("quotations.detail.notSpecified") || "Not specified"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* From / Bill to */}
      <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-border dark:border-border">
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
            {t("from") || "From"}
          </h3>
          <div className="text-base font-medium">
            {siteName || t("quotations.detail.unknown") || "Unknown"}
          </div>
          {siteUrl ? (
            <div className="text-sm text-muted-foreground">
              {siteUrl.replace(/^https?:\/\//, "")}
            </div>
          ) : null}
          {locationLines.map((line) => (
            <div key={line} className="text-sm text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
            {t("billTo") || t("quotations.detail.client") || "Bill To"}
          </h3>
          <div className="text-base font-medium">{billTo.primary}</div>
          {billTo.secondary ? (
            <div className="text-sm text-muted-foreground">{billTo.secondary}</div>
          ) : null}
        </div>
      </div>

      {/* Key facts strip */}
      <div className="bg-muted/50 dark:bg-muted/10 p-4 border-b border-border dark:border-border">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {t("quotations.detail.total") || "Total"}
            </div>
            <div className="text-lg font-bold text-primary">
              {formatMoney(quotation.total)}
            </div>
            {quotation.currency ? (
              <div className="text-xs text-muted-foreground">{quotation.currency}</div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {t("sales.table.status") || "Status"}
            </div>
            <Badge
              className={cn(
                "mt-0.5 uppercase",
                STATUS_STYLES[quotation.status] || STATUS_STYLES.draft
              )}
            >
              {t(`status.${quotation.status}`) || quotation.status}
            </Badge>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {t("quotations.detail.validUntil") || "Valid Until"}
            </div>
            <div className="text-base font-semibold">
              {quotation.valid_until
                ? formatDocumentDate(quotation.valid_until, documentLocale)
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            {t("quotations.detail.items") || "Items"}
          </h3>
          {isDraft && onAddItem && (
            <Button size="sm" variant="outline" onClick={onAddItem}>
              <Plus className="w-4 h-4 mr-2" />
              {t("quotations.detail.addItem") || "Add Item"}
            </Button>
          )}
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("quotations.detail.table.item") || "Item"}</TableHead>
                <TableHead className="text-right">
                  {t("quotations.detail.table.qty") || "Qty"}
                </TableHead>
                <TableHead className="text-right">
                  {t("quotations.detail.table.price") || "Price"}
                </TableHead>
                <TableHead className="text-right">
                  {t("quotations.detail.table.subtotal") || "Subtotal"}
                </TableHead>
                {isDraft && <TableHead className="w-[90px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items?.map((item: any) => {
                const dq = item.metadata?.dynamic_quote
                const dqStatus = dq?.status as string | undefined
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div>{item.name}</div>
                        {dqStatus && (
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {dqStatus.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {dq?.error && (
                          <div className="text-xs text-destructive">{dq.error}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatMoney(item.unit_price)}</TableCell>
                    <TableCell className="text-right">{formatMoney(item.subtotal)}</TableCell>
                    {isDraft && (
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          {(dqStatus === "failed" || dqStatus === "processing") &&
                            onRetryItem && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRetryItem(item.id)}
                                disabled={updating}
                              >
                                Retry
                              </Button>
                            )}
                          {onRemoveItem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => onRemoveItem(item.id)}
                              disabled={updating}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
              {(!quotation.items || quotation.items.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={isDraft ? 5 : 4}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {t("quotations.detail.emptyItems") || "No items in this quotation yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("quotations.detail.subtotal") || "Subtotal"}
              </span>
              <span>{formatMoney(quotation.subtotal)}</span>
            </div>
            {quotation.discount_total > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>{t("quotations.detail.discount") || "Discount"}</span>
                <span>-{formatMoney(quotation.discount_total)}</span>
              </div>
            )}
            {(quotation.tax_total || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("quotations.detail.tax") || "Tax"}
                </span>
                <span>{formatMoney(quotation.tax_total)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>{t("quotations.detail.total") || "Total"}</span>
              <span>{formatMoney(quotation.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
