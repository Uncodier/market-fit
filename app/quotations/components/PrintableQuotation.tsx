"use client"

import { Badge } from "@/app/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
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
  draft: "bg-gray-50 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-orange-50 text-orange-700 border-orange-200",
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

  return (
    <div className="max-w-4xl mx-auto bg-white print:shadow-none">
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
        <div className="border-b border-gray-200 pb-6 print:break-inside-avoid">
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {t("quotations.document.quote").toUpperCase()}
                </h1>
                <p className="text-lg text-gray-600">#{quoteRef}</p>
                {quotation.title ? (
                  <p className="text-sm text-gray-500 mt-1">{quotation.title}</p>
                ) : null}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm text-gray-600 mb-1">
                {t("quotations.document.created")}
              </div>
              <div className="text-lg font-semibold">
                {formatDocumentDate(quotation.created_at, documentLocale)}
              </div>
              <div className="text-sm text-gray-600 mt-3 mb-1">
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
            <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">
              {t("quotations.document.from")}
            </h3>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-gray-900">
                {siteName || t("quotations.document.quote")}
              </div>
              {siteUrl ? (
                <div className="text-sm text-gray-600">
                  {siteUrl.replace(/^https?:\/\//, "")}
                </div>
              ) : null}
              {locationLines.map((line) => (
                <div key={line} className="text-sm text-gray-600">
                  {line}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">
              {t("quotations.document.billTo")}
            </h3>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-gray-900">{billTo.primary}</div>
              {billTo.secondary ? (
                <div className="text-sm text-gray-600">{billTo.secondary}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="bg-gray-50 p-6 rounded-lg print:bg-gray-100 print:break-inside-avoid">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-sm text-gray-600 mb-1">
                {t("quotations.document.total")}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {money(quotation.total)}
              </div>
              {quotation.currency ? (
                <div className="text-xs text-gray-500">{quotation.currency}</div>
              ) : null}
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Status</div>
              <div>
                <Badge
                  className={`${STATUS_STYLES[quotation.status] || STATUS_STYLES.draft} print:border print:bg-gray-100 uppercase`}
                >
                  {quotation.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">
                {t("quotations.document.validUntil")}
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {formatDocumentDate(quotation.valid_until, documentLocale)}
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="print:break-inside-avoid">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {documentT(documentLocale, "quotations.detail.items")}
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-sm font-semibold text-gray-700">
                    {t("quotations.document.item")}
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-700 text-right">
                    {t("quotations.document.qty")}
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-700 text-right">
                    {t("quotations.document.price")}
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-700 text-right">
                    {t("quotations.document.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.items?.length ? (
                  quotation.items.map((item: any, index: number) => (
                    <TableRow
                      key={item.id || index}
                      className="border-b border-gray-200"
                    >
                      <TableCell>
                        <p className="font-medium text-sm text-gray-900">{item.name}</p>
                      </TableCell>
                      <TableCell className="text-right text-gray-900">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right text-gray-900">
                        {money(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-gray-900">
                        {money(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                      —
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t("quotations.document.subtotal")}:</span>
                <span className="text-gray-900">{money(quotation.subtotal)}</span>
              </div>
              {(quotation.tax_total || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("quotations.document.tax")}:</span>
                  <span className="text-gray-900">{money(quotation.tax_total)}</span>
                </div>
              )}
              {(quotation.discount_total || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t("quotations.document.discount")}:</span>
                  <span className="text-green-600">-{money(quotation.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-3 mt-2 border-t border-gray-200">
                <span className="text-gray-900">{t("quotations.document.total")}:</span>
                <span className="text-gray-900">{money(quotation.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {buyerLink ? (
          <div className="bg-gray-50 p-4 rounded-lg print:bg-gray-100 print:break-inside-avoid">
            <div className="text-sm font-semibold text-gray-900 mb-1">
              {t("quotations.document.reviewOnline")}
            </div>
            <div className="text-sm text-gray-600 break-all">{buyerLink}</div>
          </div>
        ) : null}

        <div className="pt-6 border-t border-gray-200 text-xs text-gray-500 print:break-inside-avoid">
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
    </div>
  )
}

export function PrintableQuotationSkeleton() {
  return (
    <div className="max-w-4xl mx-auto bg-white p-8 space-y-6">
      <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
          <div className="h-5 w-36 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
          <div className="h-5 w-36 bg-gray-200 animate-pulse rounded" />
        </div>
      </div>
      <div className="h-64 w-full bg-gray-100 animate-pulse rounded" />
    </div>
  )
}
