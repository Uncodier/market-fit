"use client"

import { Badge } from "@/app/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { useLocalization } from "@/app/context/LocalizationContext"
import ReactMarkdown from "react-markdown"
import { markdownComponents } from "@/app/components/simple-messages-view/utils/markdownComponents"
import remarkGfm from "remark-gfm"
import { format } from "date-fns"
import { resolveBillToLines } from "@/app/quotations/quotation-pdf-helpers"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-muted dark:text-foreground",
  sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  accepted:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  expired:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
}

export function quoteStatusBadgeClass(status?: string | null) {
  return STATUS_STYLES[status || ""] || STATUS_STYLES.draft
}

type BuyerQuoteDocumentProps = {
  quotation: any
  isExpired?: boolean
}

/** Skeuomorphic quote paper — mirrors seller QuotationInvoice; notes first for buyers. */
export function BuyerQuoteDocument({ quotation, isExpired }: BuyerQuoteDocumentProps) {
  const { t } = useLocalization()
  const siteName = quotation.site?.name || ""
  const siteUrl = quotation.site?.url || ""
  const billTo = resolveBillToLines(quotation.lead)
  const statusLabel =
    (quotation.status &&
      (t(`status.${quotation.status.toLowerCase()}`) || quotation.status)) ||
    ""
  const money = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: quotation.currency || "USD",
    }).format(amount || 0)
  const formatDate = (value?: string | null) => {
    if (!value || isNaN(new Date(value).getTime())) return "—"
    return format(new Date(value), "MMM d, yyyy")
  }

  return (
    <div className="relative">
      <div
        className="bg-card rounded-lg shadow-lg overflow-hidden border border-border"
        style={{
          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
          background: "var(--card)",
        }}
      >
        <div className="p-6 border-b border-border bg-muted/50 dark:bg-muted/10">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                {t("buyer.quotes.detail.quote") || "Quote"}
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                #{quotation.id.substring(0, 8)}
              </h2>
              {quotation.title ? (
                <p className="text-sm text-muted-foreground mt-1">{quotation.title}</p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  {t("quotations.detail.created") || "Created"}
                </div>
                <div className="text-base font-medium">{formatDate(quotation.created_at)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  {t("quotations.detail.validUntil") || "Valid Until"}
                </div>
                <div className={cn("text-base font-medium", isExpired && "text-red-500")}>
                  {quotation.valid_until
                    ? formatDate(quotation.valid_until)
                    : t("quotations.detail.notSpecified") || "Not specified"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
              {t("from") || t("buyer.quotes.detail.from") || "From"}
            </h3>
            <div className="text-base font-medium">
              {siteName || t("quotations.detail.unknown") || "Unknown"}
            </div>
            {siteUrl ? (
              <div className="text-sm text-muted-foreground">
                {siteUrl.replace(/^https?:\/\//, "")}
              </div>
            ) : null}
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

        <div className="bg-muted/50 dark:bg-muted/10 p-4 border-b border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("buyer.quotes.detail.total") || "Total"}
              </div>
              <div className="text-lg font-bold text-primary">{money(quotation.total)}</div>
              {quotation.currency ? (
                <div className="text-xs text-muted-foreground">{quotation.currency}</div>
              ) : null}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("sales.table.status") || "Status"}
              </div>
              <Badge
                className={cn("mt-0.5 uppercase", quoteStatusBadgeClass(quotation.status))}
              >
                {statusLabel}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("quotations.detail.validUntil") || "Valid Until"}
              </div>
              <div className={cn("text-base font-semibold", isExpired && "text-red-500")}>
                {quotation.valid_until ? formatDate(quotation.valid_until) : "—"}
              </div>
            </div>
          </div>
        </div>

        {quotation.notes ? (
          <div className="p-6 border-b border-border">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">
              {t("quotations.detail.notes") || "Terms and Conditions"}
            </h3>
            <div className="text-sm leading-relaxed text-muted-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground [&_strong]:text-foreground [&_table]:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {quotation.notes}
              </ReactMarkdown>
            </div>
          </div>
        ) : quotation.description ? (
          <div className="p-6 border-b border-border">
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
              {quotation.description}
            </div>
          </div>
        ) : null}

        <div className="p-6">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">
            {t("quotations.detail.items") || t("buyer.quotes.detail.orderDetails") || "Items"}
          </h3>
          <div className="border border-border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("buyer.quotes.detail.item") || "Item"}</TableHead>
                  <TableHead className="text-center">
                    {t("buyer.quotes.detail.qty") || "Qty"}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("buyer.quotes.detail.price") || "Price"}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("buyer.quotes.detail.total") || "Total"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.items?.map((item: any, idx: number) => (
                  <TableRow key={item.id || idx}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{money(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {money(item.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-[300px] space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("buyer.quotes.detail.subtotal") || "Subtotal"}
                </span>
                <span>{money(quotation.subtotal)}</span>
              </div>
              {quotation.tax_total > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("buyer.quotes.detail.tax") || "Tax"}
                  </span>
                  <span>{money(quotation.tax_total)}</span>
                </div>
              ) : null}
              {quotation.discount_total > 0 ? (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{t("buyer.quotes.detail.discount") || "Discount"}</span>
                  <span>-{money(quotation.discount_total)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>{t("buyer.quotes.detail.total") || "Total"}</span>
                <span>{money(quotation.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 rounded-lg shadow-xl -z-10 transform translate-y-1 bg-card/50 dark:bg-card/10 opacity-50 dark:border dark:border-border/30" />
      <div className="absolute inset-0 rounded-lg shadow-md -z-20 transform translate-y-2 bg-card/30 dark:bg-card/5 opacity-30 dark:border dark:border-border/20" />
    </div>
  )
}
