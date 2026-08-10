"use client"

import Link from "next/link"
import { Sale, SaleOrder, SaleOrderItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Plus } from "@/app/components/ui/icons"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { useLocalization } from "@/app/context/LocalizationContext"

import { navigateToOrder } from "@/app/hooks/use-navigation-history"
import { useRouter } from "next/navigation"

const STATUS_STYLES = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  refunded: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
}

const SOURCE_STYLES = {
  retail: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  online: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200",
  pos: "bg-zinc-900 text-white hover:bg-zinc-800 border-zinc-900"
}

interface SaleInvoiceProps {
  sale: Sale
  saleOrder: SaleOrder | null
  segments: Array<{ id: string; name: string }>
  campaigns: Array<{ id: string; title: string }>
  siteName: string
  siteUrl: string
  onCreateOrder: () => void
}

export function SaleInvoice({
  sale,
  saleOrder,
  segments,
  campaigns,
  siteName,
  siteUrl,
  onCreateOrder,
}: SaleInvoiceProps) {
  const { t } = useLocalization()
  const router = useRouter()

  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return t('sales.noSegment') || "No Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || t('sales.unknownSegment') || "Unknown Segment"
  }

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return t('sales.detail.noCampaign') || "No Campaign"
    const campaign = campaigns.find(c => c.id === campaignId)
    return campaign?.title || t('sales.detail.unknownCampaign') || "Unknown Campaign"
  }

  const formatPaymentMethod = (method: string) => {
    if (!method) return t('sales.detail.notSpecified') || "Not specified"

    const methodMap: Record<string, string> = {
      credit_card: t('sales.paymentMethod.creditCard') || "Credit Card",
      debit_card: t('sales.paymentMethod.debitCard') || "Debit Card",
      paypal: "PayPal",
      bank_transfer: t('sales.paymentMethod.bankTransfer') || "Bank Transfer",
      cash: t('sales.paymentMethod.cash') || "Cash",
      check: t('sales.paymentMethod.check') || "Check",
      crypto: t('sales.paymentMethod.crypto') || "Cryptocurrency",
      wire_transfer: t('sales.paymentMethod.wireTransfer') || "Wire Transfer",
      stripe: "Stripe",
      apple_pay: "Apple Pay",
      google_pay: "Google Pay",
      venmo: "Venmo",
      zelle: "Zelle",
    }

    return methodMap[method.toLowerCase()] || method.replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  const statusLabel = (status: string) =>
    t(`sales.status.${status}`) || status

  const sourceLabel = (source: string) =>
    t(`sales.source.${source}`) || source

  return (
    <div className="bg-card dark:bg-card rounded-lg shadow-lg overflow-hidden border border-border dark:border-border" style={{
      boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
      background: "var(--card)"
    }}>
      <div className="p-6 border-b border-border dark:border-border bg-muted/50 dark:bg-muted/10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-foreground dark:text-foreground">{sale.title}</h2>
            {sale.description && (
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">{sale.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end">
            {sale.invoiceNumber && (
              <div className="text-right mb-2">
                <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                  {t('sales.detail.invoiceNumber') || "Invoice Number"}
                </div>
                <div className="text-lg font-semibold text-primary dark:text-primary">#{sale.invoiceNumber}</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                {t('sales.table.date') || "Date"}
              </div>
              <div className="text-base font-medium">{formatDate(sale.saleDate)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-border dark:border-border">
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">
            {t('sales.detail.from') || "From"}
          </h3>
          <div className="text-base font-medium">{siteName || (t('sales.detail.yourCompany') || "Your Company")}</div>
          <div className="text-sm text-muted-foreground dark:text-muted-foreground">
            {t('sales.detail.website') || "Website"}: {siteUrl || (t('sales.detail.unknownUrl') || "Unknown URL")}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">
            {t('sales.table.customer') || "Customer"}
          </h3>
          <div className="text-base font-medium">
            {sale.leadName || (t('sales.table.anonymousCustomer') || "Anonymous Customer")}
          </div>
          <div className="text-sm text-muted-foreground dark:text-muted-foreground">
            {t('sales.table.segment') || "Segment"}: {getSegmentName(sale.segmentId)}
          </div>
          {sale.campaignId && (
            <div className="text-sm text-muted-foreground dark:text-muted-foreground">
              {t('sales.detail.campaign') || "Campaign"}: {getCampaignName(sale.campaignId)}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-b border-border dark:border-border">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-4">
          {t('sales.detail.saleDetails') || "Sale Details"}
        </h3>

        <div className="bg-muted/50 dark:bg-muted/10 p-4 rounded-md mb-6">
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                {t('sales.table.amount') || "Amount"}
              </div>
              <div className="text-xl font-bold text-primary dark:text-primary">{formatCurrency(sale.amount)}</div>
              {sale.currency && <div className="text-xs text-muted-foreground dark:text-muted-foreground">{sale.currency}</div>}
            </div>
            <div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                {t('sales.table.status') || "Status"}
              </div>
              <div>
                <Badge className={`${STATUS_STYLES[sale.status]} mt-1`}>
                  {statusLabel(sale.status)}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                {t('sales.table.source') || "Source"}
              </div>
              <div>
                <Badge className={`${SOURCE_STYLES[sale.source as keyof typeof SOURCE_STYLES] || SOURCE_STYLES.online} mt-1`}>
                  {sourceLabel(sale.source)}
                </Badge>
              </div>
              {sale.channel && (
                <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                  {t('sales.detail.channel') || "Channel"}: {sale.channel}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
              {t('sales.detail.productInfo') || "Product Information"}
            </h4>
            <div className="border border-border dark:border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('sales.table.product') || "Product"}
                    </td>
                    <td className="py-2 px-3">{sale.productName || (t('common.na') || "N/A")}</td>
                  </tr>
                  {sale.productType && (
                    <tr className="border-b border-border dark:border-border">
                      <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                        {t('sales.detail.type') || "Type"}
                      </td>
                      <td className="py-2 px-3">{sale.productType}</td>
                    </tr>
                  )}
                  {sale.referenceCode && (
                    <tr className="border-b border-border dark:border-border">
                      <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                        {t('sales.detail.reference') || "Reference"}
                      </td>
                      <td className="py-2 px-3">{sale.referenceCode}</td>
                    </tr>
                  )}
                  {sale.externalId && (
                    <tr>
                      <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                        {t('sales.detail.externalId') || "External ID"}
                      </td>
                      <td className="py-2 px-3">{sale.externalId}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
              {t('sales.detail.paymentInfo') || "Payment Information"}
            </h4>
            <div className="border border-border dark:border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('sales.detail.method') || "Method"}
                    </td>
                    <td className="py-2 px-3">{formatPaymentMethod(sale.paymentMethod)}</td>
                  </tr>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('sales.table.date') || "Date"}
                    </td>
                    <td className="py-2 px-3">{formatDate(sale.saleDate)}</td>
                  </tr>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('sales.table.amount') || "Amount"}
                    </td>
                    <td className="py-2 px-3">{formatCurrency(sale.amount)} {sale.currency}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">
                      {t('sales.table.amountDue') || "Amount Due"}
                    </td>
                    <td className="py-2 px-3 font-medium text-primary dark:text-primary">
                      {formatCurrency(sale.amount_due)} {sale.currency}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {sale.payments && sale.payments.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
                  {t('sales.detail.paymentHistory') || "Payment History"}
                </h4>
                <div className="border border-border dark:border-border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 dark:bg-muted/10">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">{t('sales.table.date') || "Date"}</th>
                        <th className="py-2 px-3 text-right font-medium">{t('sales.table.amount') || "Amount"}</th>
                        <th className="py-2 px-3 text-left font-medium">{t('sales.detail.method') || "Method"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.payments.map((payment, index) => (
                        <tr key={payment.id || `payment-${index}`} className={index < sale.payments!.length - 1 ? "border-b border-border dark:border-border" : ""}>
                          <td className="py-2 px-3">{formatDate(payment.date)}</td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="py-2 px-3">{formatPaymentMethod(payment.method)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-border dark:border-border">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-4">
          {t('sales.detail.orderDetails') || "Order Details"}
        </h3>

        {saleOrder ? (
          <>
            <div className="mb-4 flex justify-between items-center">
              <div>
                <div className="text-base font-medium flex items-center gap-2">
                  {t('sales.detail.orderNumber') || "Order"} #{saleOrder.orderNumber}
                  <button onClick={() => navigateToOrder({ orderId: saleOrder.id, orderNumber: saleOrder.orderNumber, router })} className="text-xs font-normal text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 cursor-pointer">
                    {t('sales.detail.viewDetails') || "View Details"}
                  </button>
                </div>
                <div className="text-sm text-muted-foreground dark:text-muted-foreground mt-0.5">
                  {t('sales.detail.created') || "Created"}: {formatDate(saleOrder.createdAt)}
                </div>
              </div>
            </div>

            <div className="border border-border dark:border-border rounded-md overflow-hidden mb-6">
              <Table>
                <TableHeader className="bg-muted/50 dark:bg-muted/10">
                  <TableRow>
                    <TableHead className="text-sm font-semibold">{t('sales.detail.item') || "Item"}</TableHead>
                    <TableHead className="text-sm font-semibold text-right">{t('sales.detail.qty') || "Qty"}</TableHead>
                    <TableHead className="text-sm font-semibold text-right">{t('sales.detail.price') || "Price"}</TableHead>
                    <TableHead className="text-sm font-semibold text-right">{t('sales.table.total') || "Total"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleOrder.items && saleOrder.items.length > 0 ? (
                    saleOrder.items.map((item: SaleOrderItem, index: number) => (
                      <TableRow key={item.id || `item-${index}`} className="border-b border-border dark:border-border">
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground dark:text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6">
                        {t('sales.detail.noItems') || "No items in this order"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground dark:text-muted-foreground">
                    {t('sales.detail.subtotal') || "Subtotal"}:
                  </span>
                  <span>{formatCurrency(saleOrder.subtotal)}</span>
                </div>

                {saleOrder.taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground dark:text-muted-foreground">
                      {t('sales.detail.tax') || "Tax"}:
                    </span>
                    <span>{formatCurrency(saleOrder.taxTotal)}</span>
                  </div>
                )}

                {saleOrder.discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground dark:text-muted-foreground">
                      {t('sales.detail.discount') || "Discount"}:
                    </span>
                    <span className="text-green-600 dark:text-green-400">-{formatCurrency(saleOrder.discountTotal)}</span>
                  </div>
                )}

                <div className="flex justify-between font-semibold text-lg pt-3 mt-2 border-t border-border dark:border-border">
                  <span>{t('sales.table.total') || "Total"}:</span>
                  <span className="text-primary dark:text-primary">{formatCurrency(saleOrder.total)}</span>
                </div>
              </div>
            </div>

            {saleOrder.notes && (
              <div className="mt-6 pt-4 border-t border-border dark:border-border">
                <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
                  {t('sales.detail.orderNotes') || "Order Notes"}:
                </h4>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground p-3 bg-muted/50 dark:bg-muted/10 rounded-md italic">
                  {saleOrder.notes}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 bg-muted/50 dark:bg-muted/10 rounded-md">
            <p className="text-muted-foreground dark:text-muted-foreground text-center mb-4">
              {t('sales.detail.noOrder') || "There is no order information associated with this sale."}
            </p>
            <Button onClick={onCreateOrder}>
              <Plus className="h-4 w-4 mr-2" />
              {t('sales.detail.createOrder') || "Create Order"}
            </Button>
          </div>
        )}
      </div>

      {sale.notes && (
        <div className="p-6 border-b border-border dark:border-border">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">
            {t('sales.detail.notes') || "Notes"}
          </h3>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground p-3 bg-muted/50 dark:bg-muted/10 rounded-md italic">
            {sale.notes}
          </p>
        </div>
      )}

      {sale.tags && sale.tags.length > 0 && (
        <div className="p-6 border-b border-border dark:border-border">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">
            {t('sales.detail.tags') || "Tags"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {sale.tags.map((tag, index) => (
              <Badge key={index} variant="outline">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="p-6 bg-muted/50 dark:bg-muted/10 text-xs text-muted-foreground dark:text-muted-foreground">
        <div className="flex justify-between">
          <div>{t('sales.detail.saleId') || "Sale ID"}: {sale.id}</div>
          <div>{t('sales.detail.created') || "Created"}: {formatDate(sale.createdAt || '')}</div>
          <div>{t('sales.detail.lastUpdated') || "Last Updated"}: {formatDate(sale.updatedAt || '')}</div>
        </div>
      </div>
    </div>
  )
}
