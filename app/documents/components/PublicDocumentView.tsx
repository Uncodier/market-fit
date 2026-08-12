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
import { PublicDocumentShopNav } from "@/app/documents/components/PublicDocumentShopNav"
import {
  formatShippingAddressLines,
  translateFulfillmentMethod,
  translatePaymentMethod,
  type DocumentShippingAddress,
} from "@/app/documents/document-meta"

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
    status?: string | null
  }>
  party?: { name?: string | null; email?: string | null } | null
  siteId?: string | null
  siteName: string
  siteUrl?: string | null
  logoUrl?: string | null
  location?: any
  locale?: string | null
  statusKind?: DocumentStatusKind
  fulfillmentMethod?: string | null
  paymentMethod?: string | null
  shippingAddress?: DocumentShippingAddress | null
}

export function PublicDocumentView(props: PublicDocumentViewProps) {
  const locale = resolveDocumentLocale(props.locale)
  const t = (key: string) => documentT(locale, key)
  const money = (n: number) =>
    formatDocumentMoney(n || 0, props.currency || "USD", locale)
  const billTo = resolveBillToLines(props.party)
  const locationLines = formatPdfLocationLines(props.location)
  const showItemStatus =
    props.statusKind === "orders" ||
    props.items.some((item) => Boolean(item.status))
  const fulfillmentLabel = translateFulfillmentMethod(
    locale,
    props.fulfillmentMethod
  )
  const paymentLabel = translatePaymentMethod(locale, props.paymentMethod)
  const shippingLines = formatShippingAddressLines(props.shippingAddress)

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-[#030303] dark:text-gray-100 print:bg-white print:text-black">
      <PublicDocumentShopNav
        siteId={props.siteId}
        siteName={props.siteName}
        logoUrl={props.logoUrl}
        currency={props.currency}
      />
      <div className="py-8 print:py-0">
        <div className="max-w-4xl mx-auto bg-white text-gray-900 dark:bg-[#0a0a0a] dark:text-gray-100 p-8 space-y-8 shadow-sm border border-black/5 dark:border-white/10 print:shadow-none print:border-none print:bg-white print:text-black">
          <div className="border-b border-gray-200 dark:border-white/10 pb-6 flex justify-between gap-6 print:border-gray-200">
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
                <h1 className="text-3xl font-bold mb-2 print:text-black">
                  {props.kindLabel.toUpperCase()}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 print:text-gray-600">
                  #{props.docRef}
                </p>
                {props.title ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 print:text-gray-500">
                    {props.title}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 print:text-gray-600">
                {t("quotations.document.created")}
              </div>
              <div className="text-lg font-semibold print:text-black">
                {formatDocumentDate(props.createdAt, locale)}
              </div>
              {props.status ? (
                <div className="mt-3 text-sm uppercase text-gray-700 dark:text-gray-300 font-medium print:text-gray-700">
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
              <h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3 print:text-gray-500">
                {t("quotations.document.from")}
              </h3>
              <div className="text-lg font-semibold print:text-black">
                {props.siteName}
              </div>
              {props.siteUrl ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                  {props.siteUrl.replace(/^https?:\/\//, "")}
                </div>
              ) : null}
              {locationLines.map((line) => (
                <div
                  key={line}
                  className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600"
                >
                  {line}
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3 print:text-gray-500">
                {t("quotations.document.billTo")}
              </h3>
              <div className="text-lg font-semibold print:text-black">
                {billTo.primary}
              </div>
              {billTo.secondary ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                  {billTo.secondary}
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-lg print:bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 print:text-gray-600">
                  {t("quotations.document.total")}
                </div>
                <div className="text-2xl font-bold print:text-black">
                  {money(props.total || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 print:text-gray-600">
                  {t("quotations.document.fulfillment")}
                </div>
                <div className="text-lg font-semibold print:text-black">
                  {fulfillmentLabel || "—"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 print:text-gray-600">
                  {t("quotations.document.paymentMethod")}
                </div>
                <div className="text-lg font-semibold print:text-black">
                  {paymentLabel || "—"}
                </div>
              </div>
            </div>
            {shippingLines.length > 0 ? (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 print:border-gray-200">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 print:text-gray-500">
                  {t("quotations.document.shippingAddress")}
                </div>
                <div className="text-sm space-y-0.5 print:text-black">
                  {shippingLines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden print:border-gray-200">
            <table className="w-full text-sm print:text-black">
              <thead className="bg-gray-50 dark:bg-white/5 print:bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">
                    {t("quotations.document.item")}
                  </th>
                  {showItemStatus ? (
                    <th className="py-3 px-4 text-left font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">
                      {t("quotations.document.status")}
                    </th>
                  ) : null}
                  <th className="py-3 px-4 text-right font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">
                    {t("quotations.document.qty")}
                  </th>
                  <th className="py-3 px-4 text-right font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">
                    {t("quotations.document.price")}
                  </th>
                  <th className="py-3 px-4 text-right font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">
                    {t("quotations.document.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {props.items.map((item, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-200 dark:border-white/10 print:border-gray-200"
                  >
                    <td className="py-3 px-4 font-medium">{item.name}</td>
                    {showItemStatus ? (
                      <td className="py-3 px-4 text-gray-800 dark:text-gray-300">
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {item.status
                            ? translateDocumentStatus(
                                locale,
                                item.status,
                                props.statusKind || "orders"
                              )
                            : "—"}
                        </span>
                      </td>
                    ) : null}
                    <td className="py-3 px-4 text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {money(item.unit_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium tabular-nums">
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
                <span className="text-gray-600 dark:text-gray-400 print:text-gray-600">
                  {t("quotations.document.subtotal")}
                </span>
                <span className="tabular-nums">{money(props.subtotal || 0)}</span>
              </div>
              {(props.taxTotal || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 print:text-gray-600">
                    {t("quotations.document.tax")}
                  </span>
                  <span className="tabular-nums">{money(props.taxTotal || 0)}</span>
                </div>
              )}
              {(props.discountTotal || 0) > 0 && (
                <div className="flex justify-between text-sm text-green-700 dark:text-green-400 print:text-green-700">
                  <span>{t("quotations.document.discount")}</span>
                  <span className="tabular-nums">
                    -{money(props.discountTotal || 0)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-3 border-t border-gray-200 dark:border-white/10 print:border-gray-200">
                <span>{t("quotations.document.total")}</span>
                <span className="tabular-nums">{money(props.total || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
