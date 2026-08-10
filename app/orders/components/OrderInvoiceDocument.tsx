"use client"

import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { OrderWithRelations } from "../types"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Save, ExternalLink, Calendar, Send } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { navigateToLead, navigateToSale, navigateToShipment } from "@/app/hooks/use-navigation-history"

const ROW_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-50/50",
  new: "bg-amber-50/50",
  preparing: "bg-blue-50/50",
  completed: "bg-green-50/50",
}

const LINE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-white text-gray-700 border-gray-200",
  new: "bg-white text-amber-700 border-amber-200",
  preparing: "bg-white text-blue-700 border-blue-200",
  completed: "bg-white text-green-700 border-green-200",
}

interface OrderInvoiceDocumentProps {
  order: OrderWithRelations
  items: any[]
  savingLines: boolean
  hasModifiedLines: boolean
  onLineStatusChange: (itemId: string, newStatus: string) => void
  onSaveLineItems: () => void
}

export function OrderInvoiceDocument({
  order,
  items,
  savingLines,
  hasModifiedLines,
  onLineStatusChange,
  onSaveLineItems,
}: OrderInvoiceDocumentProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const isPaid = !!order.sales && (order.sales.status === 'completed' || order.sales.amount_due === 0)
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(amount || 0)

  const paymentMethodLabel = (method?: string | null) => {
    if (!method) return t('common.na') || 'N/A'
    const key = method.toLowerCase()
    const map: Record<string, string> = {
      cash: t('sales.paymentMethod.cash') || 'Cash',
      credit_card: t('sales.paymentMethod.creditCard') || 'Credit Card',
      debit_card: t('sales.paymentMethod.debitCard') || 'Debit Card',
      bank_transfer: t('sales.paymentMethod.bankTransfer') || 'Bank Transfer',
      wire_transfer: t('sales.paymentMethod.wireTransfer') || 'Wire Transfer',
      check: t('sales.paymentMethod.check') || 'Check',
      crypto: t('sales.paymentMethod.crypto') || 'Cryptocurrency',
      card: t('sales.paymentMethod.creditCard') || 'Card',
      stripe: 'Stripe',
    }
    return map[key] || method.replace(/_/g, ' ')
  }

  const sourceLabel = (source?: string | null) => {
    if (!source) return t('common.na') || 'N/A'
    if (source === 'online' || source === 'shop' || source === 'marketplace') {
      return t('orders.kanban.sourceOnline') || t('sales.source.online') || 'Online'
    }
    if (source === 'retail') return t('sales.source.retail') || 'Retail'
    return t('orders.kanban.sourcePos') || t('sales.source.pos') || 'POS'
  }

  const fulfillmentLabel = (method?: string | null) => {
    if (!method || method === 'none') return null
    return t(`orders.kanban.fulfillment.${method}`) || method.replace(/_/g, ' ')
  }

  return (
              <div
                className="bg-card rounded-lg overflow-hidden border border-border"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)" }}
              >
                {/* Header */}
                <div className="p-6 border-b border-border bg-muted/50">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {t('orders.detail.orderNumber') || 'Order Number'}
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight">{order.order_number}</h2>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}
                      </div>
                    </div>
                    {order.sales && (
                      <Badge
                        variant="outline"
                        className={cn(
                          isPaid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        )}
                      >
                        {isPaid
                          ? (t('orders.kanban.paid') || 'Paid')
                          : (t('orders.kanban.unpaid') || 'Unpaid')}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Customer + payment meta */}
                <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
                      {t('orders.detail.customer') || 'Customer'}
                    </h3>
                    {order.leads ? (
                      <>
                        <div className="text-base font-medium">{order.leads.name}</div>
                        {order.leads.email && (
                          <div className="text-sm text-muted-foreground">{order.leads.email}</div>
                        )}
                        {order.leads.phone && (
                          <div className="text-sm text-muted-foreground">{order.leads.phone}</div>
                        )}
                        <button
                          type="button"
                          onClick={() => navigateToLead({ leadId: order.leads!.id, leadName: order.leads!.name, router })}
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-2 cursor-pointer"
                        >
                          {t('orders.detail.viewCustomer') || 'View Customer'} <ExternalLink className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {t('orders.kanban.unknownCustomer') || 'Unknown Customer'}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
                      {t('orders.detail.paymentInfo') || 'Payment'}
                    </h3>
                    <div className="border border-border rounded-md overflow-hidden text-sm">
                      <table className="w-full">
                        <tbody>
                          <tr className="border-b border-border">
                            <td className="py-2 px-3 bg-muted/50 font-medium w-1/2">
                              {t('orders.detail.paymentStatus') || 'Payment Status'}
                            </td>
                            <td className="py-2 px-3">
                              {order.sales
                                ? (isPaid
                                  ? (t('orders.kanban.paid') || 'Paid')
                                  : (t('orders.kanban.unpaid') || 'Unpaid'))
                                : (t('common.na') || 'N/A')}
                            </td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="py-2 px-3 bg-muted/50 font-medium">
                              {t('orders.detail.paymentMethod') || 'Payment Method'}
                            </td>
                            <td className="py-2 px-3">
                              {paymentMethodLabel(order.sales?.payment_method)}
                            </td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="py-2 px-3 bg-muted/50 font-medium">
                              {t('orders.detail.source') || 'Source'}
                            </td>
                            <td className="py-2 px-3">{sourceLabel(order.sales?.source)}</td>
                          </tr>
                          {fulfillmentLabel(order.fulfillment_method) && (
                            <tr className={cn((order.promotions || order.price_lists || order.sale_id) ? "border-b border-border" : "")}>
                              <td className="py-2 px-3 bg-muted/50 font-medium">
                                {t('orders.detail.fulfillment') || 'Fulfillment'}
                              </td>
                              <td className="py-2 px-3">{fulfillmentLabel(order.fulfillment_method)}</td>
                            </tr>
                          )}
                          {order.promotions && (
                            <tr className="border-b border-border">
                              <td className="py-2 px-3 bg-muted/50 font-medium">
                                {t('orders.detail.promotion') || 'Promotion'}
                              </td>
                              <td className="py-2 px-3">
                                {order.promotions.name}
                                {order.promotions.code ? ` (${order.promotions.code})` : ''}
                              </td>
                            </tr>
                          )}
                          {order.price_lists && (
                            <tr className={order.sale_id ? "border-b border-border" : ""}>
                              <td className="py-2 px-3 bg-muted/50 font-medium">
                                {t('orders.detail.priceList') || 'Price List'}
                              </td>
                              <td className="py-2 px-3">{order.price_lists.name}</td>
                            </tr>
                          )}
                          {order.sale_id && (
                            <tr>
                              <td className="py-2 px-3 bg-muted/50 font-medium">
                                {t('orders.detail.relatedSale') || 'Related Sale'}
                              </td>
                              <td className="py-2 px-3">
                                <button
                                  type="button"
                                  onClick={() => navigateToSale({ saleId: order.sale_id!, router })}
                                  className="text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  {t('orders.detail.viewSale') || 'View Sale'} <ExternalLink className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Key facts strip */}
                <div className="bg-muted/50 p-4 border-b border-border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {t('orders.detail.total') || 'Total'}
                      </div>
                      <div className="text-lg font-bold text-primary">{formatMoney(order.total)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {t('orders.detail.paymentStatus') || 'Payment Status'}
                      </div>
                      <div className={cn("text-sm font-semibold", isPaid ? "text-emerald-700" : "text-yellow-700")}>
                        {order.sales
                          ? (isPaid
                            ? (t('orders.kanban.paid') || 'Paid')
                            : (t('orders.kanban.unpaid') || 'Unpaid'))
                          : (t('common.na') || 'N/A')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {t('orders.detail.paymentMethod') || 'Payment Method'}
                      </div>
                      <div className="text-sm font-semibold">
                        {paymentMethodLabel(order.sales?.payment_method)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {t('orders.detail.fulfillment') || 'Fulfillment'}
                      </div>
                      <div className="text-sm font-semibold">
                        {fulfillmentLabel(order.fulfillment_method) || (t('common.na') || 'N/A')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line items */}
                <div className="p-6">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">
                    {t('orders.detail.lineItems') || 'Line Items'}
                  </h3>
                  <div className="border border-border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('orders.detail.item') || 'Item'}</TableHead>
                          <TableHead>{t('orders.detail.status') || 'Status'}</TableHead>
                          <TableHead className="text-right">{t('orders.detail.qty') || 'Qty'}</TableHead>
                          <TableHead className="text-right">{t('orders.detail.unitPrice') || 'Unit Price'}</TableHead>
                          <TableHead className="text-right">{t('orders.detail.total') || 'Total'}</TableHead>
                          <TableHead>{t('orders.detail.shipment') || 'Shipment'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                              {t('orders.detail.noItems') || 'No items found'}
                            </TableCell>
                          </TableRow>
                        ) : items.map((item: any, idx: number) => (
                          <TableRow key={item.id || idx} className={cn(ROW_STATUS_STYLES[item.status || 'draft'])}>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.status || 'draft'}
                                onValueChange={(val) => onLineStatusChange(item.id, val)}
                                disabled={!item.id}
                              >
                                <SelectTrigger className={cn("h-8 text-[10px] uppercase tracking-wider w-[110px]", LINE_STATUS_STYLES[item.status || 'draft'])}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft" className="text-xs">{t('orders.status.draft') || 'Draft'}</SelectItem>
                                  <SelectItem value="new" className="text-xs">{t('orders.status.new') || 'New'}</SelectItem>
                                  <SelectItem value="preparing" className="text-xs">{t('orders.status.preparing') || 'Preparing'}</SelectItem>
                                  <SelectItem value="completed" className="text-xs">{t('orders.status.completed') || 'Completed'}</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              {formatMoney(item.unit_price || item.unitPrice || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatMoney(item.subtotal || 0)}
                            </TableCell>
                            <TableCell>
                              {item.shipment_id ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToShipment({ shipmentId: item.shipment_id, router })}
                                  className="text-[10px] text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Send className="h-3 w-3" /> {t('orders.detail.assigned') || 'Assigned'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  {t('orders.detail.unassigned') || 'Unassigned'}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-6 space-y-2 pt-4 border-t border-dashed border-border flex flex-col items-end">
                    <div className="flex justify-between w-full max-w-xs text-sm">
                      <span className="text-muted-foreground">{t('orders.detail.subtotal') || 'Subtotal'}</span>
                      <span>{formatMoney(order.subtotal)}</span>
                    </div>
                    {order.discount_total > 0 && (
                      <div className="flex justify-between w-full max-w-xs text-sm text-green-600">
                        <span>{t('orders.detail.discount') || 'Discount'}</span>
                        <span>-{formatMoney(order.discount_total)}</span>
                      </div>
                    )}
                    {order.tax_total > 0 && (
                      <div className="flex justify-between w-full max-w-xs text-sm">
                        <span className="text-muted-foreground">{t('orders.detail.tax') || 'Tax'}</span>
                        <span>{formatMoney(order.tax_total)}</span>
                      </div>
                    )}
                    <div className="flex justify-between w-full max-w-xs pt-2 border-t border-border font-semibold text-base">
                      <span>{t('orders.detail.total') || 'Total'}</span>
                      <span className="text-primary">{formatMoney(order.total)}</span>
                    </div>
                  </div>
                </div>

                <ActionFooter>
                  <Button
                    variant="outline"
                    onClick={onSaveLineItems}
                    disabled={savingLines || !hasModifiedLines}
                  >
                    <Save className="h-4 w-4 mr-2" /> {t('orders.detail.saveItemsStatus') || 'Save Items Status'}
                  </Button>
                </ActionFooter>
              </div>
  )
}
