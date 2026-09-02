"use client"

import React from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { OrderWithRelations } from "../types"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Save, ExternalLink, Calendar, Send, Clock } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { navigateToLead, navigateToSale, navigateToShipment } from "@/lib/navigation/navigation-helpers"
import { formatScheduledFor, scheduledForClassName } from "@/app/orders/format-scheduled-for"
import {
  ORDER_ROW_STATUS_STYLES,
  ORDER_LINE_STATUS_STYLES,
  paymentMethodLabel,
  displayPaymentMethod,
  orderSourceLabel,
  fulfillmentLabel,
  parseItemName,
} from "./order-invoice-helpers"

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
  const isPaid = !!order.sales && Number(order.sales.amount_due || 0) === 0 && order.sales.status !== 'cancelled'
  const scheduledLabel = formatScheduledFor(order.scheduled_for)
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(amount || 0)
  const methodLabel = (method?: string | null) => paymentMethodLabel(method, t)
  const sourceLabel = (source?: string | null) => orderSourceLabel(source, t)
  const fulfillment = (method?: string | null) => fulfillmentLabel(method, t)

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
                      <div className="flex flex-col gap-1 mt-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}
                        </div>
                        {scheduledLabel && (
                          <div className={cn("flex items-center gap-2 text-sm font-medium mt-0.5", scheduledForClassName(order.scheduled_for))}>
                            <Clock className="h-4 w-4" />
                            {t('orders.detail.scheduledFor') || 'Scheduled for'} {scheduledLabel}
                          </div>
                        )}
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
                              {methodLabel(displayPaymentMethod(order.sales))}
                            </td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="py-2 px-3 bg-muted/50 font-medium">
                              {t('orders.detail.source') || 'Source'}
                            </td>
                            <td className="py-2 px-3">{sourceLabel(order.sales?.source)}</td>
                          </tr>
                          {fulfillment(order.fulfillment_method) && (
                            <tr className={cn((order.scheduled_for || order.promotions || order.price_lists || order.sale_id) ? "border-b border-border" : "")}>
                              <td className="py-2 px-3 bg-muted/50 font-medium">
                                {t('orders.detail.fulfillment') || 'Fulfillment'}
                              </td>
                              <td className="py-2 px-3">{fulfillment(order.fulfillment_method)}</td>
                            </tr>
                          )}
                          {scheduledLabel && (
                            <tr className={cn((order.promotions || order.price_lists || order.sale_id) ? "border-b border-border" : "")}>
                              <td className="py-2 px-3 bg-muted/50 font-medium">
                                {t('orders.detail.scheduledFor') || 'Scheduled for'}
                              </td>
                              <td className={cn("py-2 px-3 font-medium", scheduledForClassName(order.scheduled_for))}>
                                {scheduledLabel}
                              </td>
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
                        {methodLabel(displayPaymentMethod(order.sales))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {t('orders.detail.fulfillment') || 'Fulfillment'}
                      </div>
                      <div className="text-sm font-semibold">
                        {fulfillment(order.fulfillment_method) || (t('common.na') || 'N/A')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line items */}
                <div className="p-6">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">
                    {t('orders.detail.lineItems') || 'Line Items'}
                  </h3>
                  <div className="border border-border rounded-md overflow-hidden bg-card">
                    <div className="hidden md:flex items-center gap-4 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                      <div className="flex-1">{t('orders.detail.item') || 'Item'}</div>
                      <div className="flex items-center">
                        <div className="w-[120px]">{t('orders.detail.status') || 'Status'}</div>
                        <div className="w-[120px] text-right">{t('orders.detail.qty') || 'Qty'}</div>
                        <div className="w-[80px] text-right">{t('orders.detail.unitPrice') || 'Price'}</div>
                        <div className="w-[80px] text-right">{t('orders.detail.total') || 'Total'}</div>
                        <div className="w-[100px] text-right">{t('orders.detail.shipment') || 'Shipment'}</div>
                      </div>
                    </div>
                    <div className="divide-y divide-border/50">
                      {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          {t('orders.detail.noItems') || 'No items found'}
                        </div>
                      ) : (() => {
                          const parents = items.filter(i => !(i.metadata?.is_modifier || i.parent_sale_order_item_id));
                          const children = items.filter(i => (i.metadata?.is_modifier || i.parent_sale_order_item_id));

                          return parents.map((item: any, idx: number) => {
                            const modifiers = children.filter(c => 
                              (c.parent_sale_order_item_id && c.parent_sale_order_item_id === item.id) ||
                              (c.metadata?.parent_client_line_key && c.metadata.parent_client_line_key === item.metadata?.client_line_key)
                            );

                            return (
                              <React.Fragment key={item.id || idx}>
                                <div className={cn("p-4 md:px-6", ORDER_ROW_STATUS_STYLES[item.status || 'draft'])}>
                                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="flex-1 flex flex-col">
                                      <div className="font-medium text-base text-foreground">
                                        {parseItemName(item.name, item.metadata?.parent_name).parentName || item.name}
                                      </div>
                                      {parseItemName(item.name, item.metadata?.parent_name).parentName && (
                                        <div className="text-sm text-muted-foreground mt-0.5">
                                          {parseItemName(item.name, item.metadata?.parent_name).variantName}
                                        </div>
                                      )}
                                      {item.description && (
                                        <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description}</div>
                                      )}
                                      <div className="flex items-center gap-2 mt-2 md:hidden">
                                        <Badge variant="outline" className={ORDER_LINE_STATUS_STYLES[item.status || 'draft']}>
                                          {t(`orders.status.${item.status || 'draft'}`) || item.status || 'Draft'}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">
                                          {item.quantity} × {formatMoney(item.unit_price || item.unitPrice || 0)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="hidden md:flex items-center">
                                      <div className="w-[120px]">
                                        <Select
                                          value={item.status || 'draft'}
                                          onValueChange={(val) => onLineStatusChange(item.id, val)}
                                          disabled={!item.id}
                                        >
                                          <SelectTrigger className={cn("h-8 text-[10px] uppercase tracking-wider w-full", ORDER_LINE_STATUS_STYLES[item.status || 'draft'])}>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="draft" className="text-xs">{t('orders.status.draft') || 'Draft'}</SelectItem>
                                            <SelectItem value="new" className="text-xs">{t('orders.status.new') || 'New'}</SelectItem>
                                            <SelectItem value="preparing" className="text-xs">{t('orders.status.preparing') || 'Preparing'}</SelectItem>
                                            <SelectItem value="completed" className="text-xs">{t('orders.status.completed') || 'Completed'}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      
                                  <div className="w-[120px] text-right text-sm text-muted-foreground">{item.quantity} ×</div>
                                  <div className="w-[80px] text-right text-sm text-muted-foreground">{formatMoney(item.unit_price || item.unitPrice || 0)}</div>
                                  <div className="w-[80px] text-right font-medium text-base">{formatMoney(item.subtotal || 0)}</div>

                                      <div className="w-[100px] flex justify-end">
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
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 mt-4 md:hidden">
                                    <Select
                                      value={item.status || 'draft'}
                                      onValueChange={(val) => onLineStatusChange(item.id, val)}
                                      disabled={!item.id}
                                    >
                                      <SelectTrigger className={cn("h-8 text-[10px] uppercase tracking-wider flex-1", ORDER_LINE_STATUS_STYLES[item.status || 'draft'])}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="draft" className="text-xs">{t('orders.status.draft') || 'Draft'}</SelectItem>
                                        <SelectItem value="new" className="text-xs">{t('orders.status.new') || 'New'}</SelectItem>
                                        <SelectItem value="preparing" className="text-xs">{t('orders.status.preparing') || 'Preparing'}</SelectItem>
                                        <SelectItem value="completed" className="text-xs">{t('orders.status.completed') || 'Completed'}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    
                                    <div className="flex-1 flex justify-end">
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
                                    </div>
                                    <div className="font-medium text-base ml-2">
                                      {formatMoney(item.subtotal || 0)}
                                    </div>
                                  </div>

                                  {modifiers.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-dashed border-border/50 md:ml-[16px] lg:ml-[24px]">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('pos.modifiers.title') || 'Extras'}</p>
                                      <div className="space-y-3">
                                        {modifiers.map((mod: any, mIdx: number) => (
                                          <div key={mod.id || mod.metadata?.client_line_key || mIdx} className="flex flex-col md:flex-row md:items-center gap-4">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className="text-muted-foreground">+</span>
                                              <span className="text-sm text-muted-foreground">{mod.name}</span>
                                              {mod.description && <span className="text-xs hidden md:inline text-muted-foreground">- {mod.description}</span>}
                                            </div>
                                            
                                            <div className="hidden md:flex items-center">
                                              {/* Spacer for status - only if needed to align with parent */}
                                              <div className="w-[120px]"></div>
                                              
                                              <div className="w-[120px] text-right text-sm text-muted-foreground">{mod.quantity} ×</div>
                                              <div className="w-[80px] text-right text-sm text-muted-foreground">{formatMoney(mod.unit_price || mod.unitPrice || 0)}</div>
                                              <div className="w-[80px] text-right font-medium text-sm text-muted-foreground">{formatMoney(mod.subtotal || 0)}</div>

                                              {/* Spacer for shipment - only if needed to align with parent */}
                                              <div className="w-[100px]"></div>
                                            </div>

                                            {/* Mobile view match */}
                                            <div className="flex items-center justify-between md:hidden pl-5 text-sm text-muted-foreground">
                                               <span>{mod.quantity} × {formatMoney(mod.unit_price || mod.unitPrice || 0)}</span>
                                               <span className="font-medium">{formatMoney(mod.subtotal || 0)}</span>
                                            </div>

                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </React.Fragment>
                            );
                          });
                        })()}
                    </div>
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
