"use client"

import { Badge } from "@/app/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import ReactMarkdown from "react-markdown"
import { markdownComponents } from "@/app/components/simple-messages-view/utils/markdownComponents"
import remarkGfm from "remark-gfm"
import {
  documentT,
  formatDocumentDate,
  formatDocumentMoney,
  resolveDocumentLocale,
} from "@/app/lib/i18n/document-t"
import {
  formatPdfLocationLines,
  resolveBillToLines,
} from "@/app/quotations/quotation-pdf-helpers"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-foreground border-border dark:bg-muted dark:text-foreground",
  sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  accepted: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  expired: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
}

export type PrintableQuotationProps = {
  quotation: any
  siteName: string
  siteUrl: string
  logoUrl?: string | null
  location?: {
    name?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    country?: string | null
  } | null
  locale?: string | null
  buyerLink?: string | null
}

export function PrintableQuotation({
  quotation,
  siteName,
  siteUrl,
  logoUrl,
  location,
  locale,
  buyerLink,
}: PrintableQuotationProps) {
  const documentLocale = resolveDocumentLocale(locale)
  const t = (key: string) => documentT(documentLocale, key)
  const money = (amount: number) =>
    formatDocumentMoney(amount || 0, quotation.currency || "USD", documentLocale)
  const billTo = resolveBillToLines(quotation.lead)
  const locationLines = formatPdfLocationLines(location)
  const quoteRef = String(quotation.id || "").substring(0, 8)
  const isLongNote = quotation.notes && (quotation.notes.length > 800 || quotation.notes.split('\n').length > 15)

  return (
    <div className="max-w-4xl mx-auto bg-white text-gray-900 dark:bg-[#0a0a0a] dark:text-gray-100 border border-black/5 dark:border-white/10 print:bg-white print:text-black print:shadow-none print:border-none">
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:text-black {
            color: #000 !important;
          }
          .print\\:bg-white {
            background-color: #fff !important;
          }
          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
        }

        @page {
          margin: 0.75in;
          size: A4;
        }
      `}</style>

      <div className="p-8 space-y-8 print:p-0 print:text-black print:bg-white">
        {/* Header — mirrors sales PrintableInvoice */}
        <div className="border-b border-border pb-6 print:border-gray-200 print:break-inside-avoid">
          <div className="flex justify-between items-start gap-6">
            <div className="flex items-start gap-4 min-w-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={siteName || "Logo"}
                  className="h-14 w-14 object-contain shrink-0"
                />
              ) : null}
              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-foreground mb-2 print:text-black">
                  {t("quotations.document.quote").toUpperCase()}
                </h1>
                <p className="text-lg text-muted-foreground print:text-gray-600">#{quoteRef}</p>
                {quotation.title ? (
                  <p className="text-sm text-muted-foreground mt-1 print:text-gray-500">{quotation.title}</p>
                ) : null}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm text-muted-foreground mb-1 print:text-gray-600">
                {t("quotations.document.created")}
              </div>
              <div className="text-lg font-semibold">
                {formatDocumentDate(quotation.created_at, documentLocale)}
              </div>
              <div className="text-sm text-muted-foreground mt-3 mb-1 print:text-gray-600">
                {t("quotations.document.validUntil")}
              </div>
              <div className="text-base font-medium">
                {formatDocumentDate(quotation.valid_until, documentLocale)}
              </div>
            </div>
          </div>
        </div>

        {/* From / Bill To */}
        <div className="grid grid-cols-2 gap-8 print:break-inside-avoid">
          <div>
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 print:text-gray-500">
              {t("quotations.document.from")}
            </h3>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-foreground print:text-black">
                {siteName || t("quotations.document.quote")}
              </div>
              {siteUrl ? (
                <div className="text-sm text-muted-foreground print:text-gray-600">
                  {siteUrl.replace(/^https?:\/\//, "")}
                </div>
              ) : null}
              {locationLines.map((line) => (
                <div key={line} className="text-sm text-muted-foreground print:text-gray-600">
                  {line}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 print:text-gray-500">
              {t("quotations.document.billTo")}
            </h3>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-foreground print:text-black">{billTo.primary}</div>
              {billTo.secondary ? (
                <div className="text-sm text-muted-foreground print:text-gray-600">{billTo.secondary}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-lg print:bg-gray-100 print:break-inside-avoid">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-sm text-muted-foreground mb-1 print:text-gray-600">
                {t("quotations.document.total")}
              </div>
              <div className="text-2xl font-bold text-foreground print:text-black">
                {money(quotation.total)}
              </div>
              {quotation.currency ? (
                <div className="text-xs text-muted-foreground print:text-gray-500">{quotation.currency}</div>
              ) : null}
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1 print:text-gray-600">Status</div>
              <div>
                <Badge
                  className={`${STATUS_STYLES[quotation.status] || STATUS_STYLES.draft} print:border print:bg-gray-100 uppercase`}
                >
                  {quotation.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1 print:text-gray-600">
                {t("quotations.document.validUntil")}
              </div>
              <div className="text-lg font-semibold text-foreground print:text-black">
                {formatDocumentDate(quotation.valid_until, documentLocale)}
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="print:break-inside-avoid">
          <h3 className="text-lg font-semibold text-foreground print:text-black mb-4">
            {documentT(documentLocale, "quotations.detail.items")}
          </h3>
          <div className="border border-border rounded-lg print:border-gray-200 overflow-hidden mb-6">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-white/5 print:bg-gray-50">
                <TableRow>
                  <TableHead className="text-sm font-semibold text-foreground/80 print:text-gray-700">
                    {t("quotations.document.item")}
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-foreground/80 print:text-gray-700 text-right">
                    {t("quotations.document.qty")}
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-foreground/80 print:text-gray-700 text-right">
                    {t("quotations.document.price")}
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-foreground/80 print:text-gray-700 text-right">
                    {t("quotations.document.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.items?.length ? (
                  quotation.items.map((item: any, index: number) => (
                    <TableRow
                      key={item.id || index}
                      className="border-b border-border print:border-gray-200"
                    >
                      <TableCell>
                        <p className="font-medium text-sm text-foreground print:text-black">{item.name}</p>
                      </TableCell>
                      <TableCell className="text-right text-foreground print:text-black">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right text-foreground print:text-black">
                        {money(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground print:text-black">
                        {money(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground print:text-gray-500">
                      —
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col md:flex-row justify-between gap-8 mt-6">
            <div className="flex-1">
              {quotation.notes && !isLongNote && (
                <div className="text-sm text-muted-foreground print:text-gray-600">
                  <h4 className="font-semibold text-foreground print:text-black mb-2">
                    {documentT(documentLocale, "quotations.detail.notes")}
                  </h4>
                  <div className="text-sm leading-relaxed print:text-black w-full overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{quotation.notes}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
            <div className="w-64 space-y-2 shrink-0">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground print:text-gray-600">{t("quotations.document.subtotal")}:</span>
                <span className="text-foreground print:text-black">{money(quotation.subtotal)}</span>
              </div>
              {(quotation.tax_total || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-600">{t("quotations.document.tax")}:</span>
                  <span className="text-foreground print:text-black">{money(quotation.tax_total)}</span>
                </div>
              )}
              {(quotation.discount_total || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-600">{t("quotations.document.discount")}:</span>
                  <span className="text-green-700 dark:text-green-400 print:text-green-600">-{money(quotation.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-3 mt-2 border-t border-border print:border-gray-200">
                <span className="text-foreground print:text-black">{t("quotations.document.total")}:</span>
                <span className="text-foreground print:text-black">{money(quotation.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {buyerLink ? (
          <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-lg print:bg-gray-100 print:break-inside-avoid">
            <div className="text-sm font-semibold text-foreground mb-1 print:text-black">
              {t("quotations.document.reviewOnline")}
            </div>
            <div className="text-sm text-muted-foreground print:text-gray-600 break-all">{buyerLink}</div>
          </div>
        ) : null}

            <div className="pt-6 border-t border-border print:border-gray-200 text-xs text-muted-foreground print:text-gray-500 print:break-inside-avoid">
          <div className="flex justify-between gap-4">
            <div>
              {siteName} · {t("quotations.document.quote")} #{quoteRef}
            </div>
            <div>
              {t("quotations.document.created")}:{" "}
              {formatDocumentDate(quotation.created_at, documentLocale)}
            </div>
          </div>
        </div>
      </div>

      {quotation.notes && isLongNote ? (
        <div className="p-8 print:p-0 print:break-before-page mt-8 print:mt-0 space-y-8">
          <div className="border-b border-border pb-6 print:border-gray-200 print:break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground print:text-black">
              {documentT(documentLocale, "quotations.detail.notes")}
            </h2>
            <p className="text-lg text-muted-foreground print:text-gray-600">#{quoteRef}</p>
          </div>
          <div className="text-sm leading-relaxed print:text-black w-full overflow-x-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{quotation.notes}</ReactMarkdown>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function PrintableQuotationSkeleton() {
  return (
    <div className="max-w-4xl mx-auto bg-card p-8 space-y-6 print:bg-white">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="h-5 w-36 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="h-5 w-36 bg-muted animate-pulse rounded" />
        </div>
      </div>
      <div className="h-64 w-full bg-muted animate-pulse rounded" />
    </div>
  )
}
