import Image from "next/image"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { LayoutGrid } from "@/app/components/ui/icons"
import { resolveItemImage } from "@/app/lib/image-utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { Amount, BuyerOrderItem } from "../order-detail-display"

export function BuyerOrderItems({ orderItems, hasLines, formatCurrency, children }: {
  orderItems: BuyerOrderItem[]
  hasLines: boolean
  formatCurrency: (amount: Amount) => string
  children?: ReactNode
}) {
  const { t } = useLocalization()
  const parseItemName = (name: string, parentNameFromMeta?: string | null) => {
    if (parentNameFromMeta) return { parentName: parentNameFromMeta, variantName: name }
    const parts = name.split(' -> ')
    return parts.length > 1 ? { parentName: parts[0], variantName: parts.slice(1).join(' -> ') }
      : { parentName: null, variantName: name }
  }
  return (
        <Card className="overflow-hidden border border-border bg-card">
          <CardHeader className="p-4 md:px-6"><CardTitle className="text-base">{t("buyer.orders.detail.items")}</CardTitle></CardHeader>
          <div className="hidden md:flex items-center gap-6 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
            <div className="flex-1">{t('buyer.orders.detail.item') || 'Item'}</div>
            <div className="grid grid-cols-[4rem_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-6 shrink-0">
              <div className="text-right">{t('buyer.orders.detail.qty') || 'Qty'}</div>
              <div className="text-right">{t('buyer.orders.detail.price') || 'Price'}</div>
              <div className="text-right">{t('buyer.orders.detail.total') || 'Total'}</div>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {(() => {
                const parents = orderItems.filter((i: BuyerOrderItem) => !(i.metadata?.is_modifier || i.parent_sale_order_item_id));
                const children = orderItems.filter((i: BuyerOrderItem) => (i.metadata?.is_modifier || i.parent_sale_order_item_id));

                return parents.map((item: BuyerOrderItem, i: number) => {
                  const img = hasLines ? resolveItemImage({ ...item.catalog_item, name: item.name }) : null
                  const modifiers = children.filter((c: BuyerOrderItem) =>
                    (c.parent_sale_order_item_id && c.parent_sale_order_item_id === item.id) ||
                    (c.metadata?.parent_client_line_key && c.metadata.parent_client_line_key === item.metadata?.client_line_key)
                  );

                  return (
                    <div key={item.id || i} className="p-4 md:px-6">
                      <div className="flex flex-col md:flex-row md:items-center gap-6">
                        {hasLines && (
                          <div className="h-16 w-16 bg-muted rounded-md flex-shrink-0 overflow-hidden border">
                            {img ? (
                              <Image src={img} alt={item.name} width={64} height={64} unoptimized className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <LayoutGrid className="w-6 h-6 opacity-20" />
                              </div>
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1 flex flex-col">
                          <div className="font-medium text-foreground text-base break-words">
                            {parseItemName(item.name, item.metadata?.parent_name).parentName || item.name}
                          </div>
                          {parseItemName(item.name, item.metadata?.parent_name).parentName && (
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {parseItemName(item.name, item.metadata?.parent_name).variantName}
                            </div>
                          )}
                          {item.description && <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description}</div>}
                          <div className="flex items-center gap-3 mt-2 md:hidden text-sm text-muted-foreground">
                            <span>{item.quantity} × {formatCurrency(item.unitPrice ?? item.unit_price ?? 0)}</span>
                            <span className="font-medium text-foreground ml-auto">{formatCurrency(item.subtotal ?? (Number(item.unitPrice ?? item.unit_price ?? 0) * (item.quantity ?? 1)))}</span>
                          </div>
                        </div>

                        <div className="hidden md:grid grid-cols-[4rem_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-6 shrink-0 items-center tabular-nums">
                          <div className="text-right text-sm text-muted-foreground">
                            {item.quantity}
                          </div>
                          <div className="text-right font-medium text-sm text-muted-foreground whitespace-nowrap">
                            {formatCurrency(item.unitPrice ?? item.unit_price ?? 0)}
                          </div>
                          <div className="text-right font-medium text-sm whitespace-nowrap">
                            {formatCurrency(item.subtotal ?? (Number(item.unitPrice ?? item.unit_price ?? 0) * (item.quantity ?? 1)))}
                          </div>
                        </div>
                      </div>

                      {modifiers.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-dashed border-border/50 md:ml-[16px] lg:ml-[24px]">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('buyer.orders.detail.modifiers') || 'Extras'}</p>
                          <div className="space-y-3">
                            {modifiers.map((mod: BuyerOrderItem, idx: number) => (
                              <div key={mod.id || idx} className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-muted-foreground">+</span>
                                  <span className="text-sm">{mod.name}</span>
                                  {mod.description && <span className="text-xs hidden md:inline text-muted-foreground">- {mod.description}</span>}
                                </div>

                                <div className="hidden md:grid grid-cols-[4rem_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-6 shrink-0 items-center tabular-nums">
                                  <div className="text-right text-sm text-muted-foreground">
                                    {mod.quantity}
                                  </div>
                                  <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                                    {formatCurrency(mod.unitPrice ?? mod.unit_price ?? 0)}
                                  </div>
                                  <div className="text-right font-medium text-sm text-muted-foreground whitespace-nowrap">
                                    {formatCurrency(mod.subtotal ?? (Number(mod.unitPrice ?? mod.unit_price ?? 0) * (mod.quantity ?? 1)))}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between md:hidden pl-5 text-sm text-muted-foreground">
                                  <span>{mod.quantity} × {formatCurrency(mod.unitPrice ?? mod.unit_price ?? 0)}</span>
                                  <span className="font-medium text-foreground">{formatCurrency(mod.subtotal ?? (Number(mod.unitPrice ?? mod.unit_price ?? 0) * (mod.quantity ?? 1)))}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>

          </CardContent>
          {children}
        </Card>
  )
}
