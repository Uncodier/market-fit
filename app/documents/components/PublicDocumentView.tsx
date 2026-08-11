"use client"

import {
  documentT,
  formatDocumentDate,
  formatDocumentMoney,
  resolveDocumentLocale,
  translateDocumentStatus,
  type DocumentStatusKind,
} from "@/app/lib/i18n/document-t"
import {
  formatPdfLocationLines,
  resolveBillToLines,
} from "@/app/quotations/quotation-pdf-helpers"

export type PublicDocumentViewProps = {
  kindLabel: string
  docRef: string
  title?: string | null
  status?: string | null
  currency?: string | null
  createdAt?: string | null
  subtotal?: number | null
  taxTotal?: number | null
  discountTotal?: number | null
  total?: number | null
  items: Array<{
    name: string
    quantity: number
    unit_price: number
    subtotal: number
  }>
  party?: { name?: string | null; email?: string | null } | null
  siteName: string
  siteUrl?: string | null
  logoUrl?: string | null
  location?: any
  locale?: string | null
  statusKind?: DocumentStatusKind
}

export function PublicDocumentView(props: PublicDocumentViewProps) {
  const locale = resolveDocumentLocale(props.locale)
  const t = (key: string) => documentT(locale, key)
  const money = (n: number) =>
    formatDocumentMoney(n || 0, props.currency || "USD", locale)
  const billTo = resolveBillToLines(props.party)
  const locationLines = formatPdfLocationLines(props.location)

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto bg-white p-8 space-y-8 shadow-sm print:shadow-none">
        <div className="border-b border-gray-200 pb-6 flex justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            {props.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.logoUrl}
                alt=""
                className="h-14 w-14 object-contain shrink-0"
              />
            ) : null}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {props.kindLabel.toUpperCase()}
              </h1>
              <p className="text-lg text-gray-600">#{props.docRef}</p>
              {props.title ? (
                <p className="text-sm text-gray-500 mt-1">{props.title}</p>
              ) : null}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm text-gray-600 mb-1">
              {t("quotations.document.created")}
            </div>
            <div className="text-lg font-semibold">
              {formatDocumentDate(props.createdAt, locale)}
            </div>
            {props.status ? (
              <div className="mt-3 text-sm uppercase text-gray-700 font-medium">
                {translateDocumentStatus(
                  locale,
                  props.status,
                  props.statusKind || "orders"
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">
              {t("quotations.document.from")}
            </h3>
            <div className="text-lg font-semibold text-gray-900">{props.siteName}</div>
            {props.siteUrl ? (
              <div className="text-sm text-gray-600">
                {props.siteUrl.replace(/^https?:\/\//, "")}
              </div>
            ) : null}
            {locationLines.map((line) => (
              <div key={line} className="text-sm text-gray-600">
                {line}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">
              {t("quotations.document.billTo")}
            </h3>
            <div className="text-lg font-semibold text-gray-900">{billTo.primary}</div>
            {billTo.secondary ? (
              <div className="text-sm text-gray-600">{billTo.secondary}</div>
            ) : null}
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">{t("quotations.document.total")}</div>
          <div className="text-2xl font-bold text-gray-900">{money(props.total || 0)}</div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left font-semibold text-gray-700">
                  {t("quotations.document.item")}
                </th>
                <th className="py-3 px-4 text-right font-semibold text-gray-700">
                  {t("quotations.document.qty")}
                </th>
                <th className="py-3 px-4 text-right font-semibold text-gray-700">
                  {t("quotations.document.price")}
                </th>
                <th className="py-3 px-4 text-right font-semibold text-gray-700">
                  {t("quotations.document.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                  <td className="py-3 px-4 text-right">{item.quantity}</td>
                  <td className="py-3 px-4 text-right">{money(item.unit_price)}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {money(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t("quotations.document.subtotal")}</span>
              <span>{money(props.subtotal || 0)}</span>
            </div>
            {(props.taxTotal || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t("quotations.document.tax")}</span>
                <span>{money(props.taxTotal || 0)}</span>
              </div>
            )}
            {(props.discountTotal || 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>{t("quotations.document.discount")}</span>
                <span>-{money(props.discountTotal || 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg pt-3 border-t border-gray-200">
              <span>{t("quotations.document.total")}</span>
              <span>{money(props.total || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
