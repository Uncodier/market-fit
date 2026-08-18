import React, { useState } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SaleOrder, SaleOrderItem } from "@/app/types"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Button } from "@/app/components/ui/button"
import { Plus } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

interface SaleOrderDetailProps {
  saleOrder: SaleOrder | null
  saleId: string
}

export function SaleOrderDetail({ saleOrder, saleId }: SaleOrderDetailProps) {
  const { t } = useLocalization()
  
  // Add a createOrder handler for when there is no saleOrder yet
  const handleCreateOrder = () => {
    // Will be implemented later
    console.log("Create new order for sale", saleId);
  };

  const parseItemName = (name: string, parentNameFromMeta?: string | null) => {
    if (parentNameFromMeta) {
      return { parentName: parentNameFromMeta, variantName: name };
    }
    if (name.includes(' -> ')) {
      const parts = name.split(' -> ');
      return { parentName: parts[0], variantName: parts.slice(1).join(' -> ') };
    }
    return { parentName: null, variantName: name };
  }

  if (!saleOrder) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ 
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        background: "linear-gradient(to bottom, #f9f9f9 0%, #ffffff 100%)"
      }}>
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="font-medium text-lg text-gray-800">{t('sales.order.title') || 'Order Details'}</h3>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
          <h3 className="font-medium text-xl mb-2">{t('sales.order.noDetails') || 'No Order Details'}</h3>
          <p className="text-muted-foreground text-center mb-4">
            {t('sales.order.noDetailsDesc') || 'There is no order information associated with this sale.'}
          </p>
          <Button onClick={handleCreateOrder}>
            <Plus className="h-4 w-4 mr-2" />
            {t('sales.order.createOrder') || 'Create Order'}
          </Button>
        </div>
      </div>
    );
  }

  // Calculate order summary
  const { subtotal, taxTotal, discountTotal, total } = saleOrder;
  const currency = "MXN" // Default to MXN for now
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ 
      boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
      background: "linear-gradient(to bottom, #f9f9f9 0%, #ffffff 100%)"
    }}>
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <h3 className="font-medium text-lg text-gray-800">{t('sales.order.orderNumber') || 'Order'} #{saleOrder.orderNumber}</h3>
      </div>
      
      <ScrollArea className="max-h-[400px]">
        <div className="p-6">
          <div className="border border-gray-200 rounded-md overflow-hidden bg-card">
            <div className="hidden sm:flex items-center gap-4 border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
              <div className="flex-1">{t('sales.order.item') || 'Item'}</div>
              <div className="flex items-center">
                <div className="w-[120px] text-right">{t('sales.order.qty') || 'Qty'}</div>
                <div className="w-[100px] text-right">{t('sales.order.price') || 'Price'}</div>
                <div className="w-[100px] text-right">{t('sales.order.total') || 'Total'}</div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {saleOrder.items && saleOrder.items.length > 0 ? (() => {
                const itemsList = saleOrder.items as any[];
                const parents = itemsList.filter(i => !(i.metadata?.is_modifier || i.parent_sale_order_item_id));
                const children = itemsList.filter(i => (i.metadata?.is_modifier || i.parent_sale_order_item_id));

                return parents.map((item: any) => {
                  const modifiers = children.filter(c => 
                    (c.parent_sale_order_item_id && c.parent_sale_order_item_id === item.id) ||
                    (c.metadata?.parent_client_line_key && c.metadata.parent_client_line_key === item.metadata?.client_line_key)
                  );

                  return (
                    <React.Fragment key={item.id || item.metadata?.client_line_key || Math.random()}>
                      <div className="p-4 sm:px-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex-1 flex flex-col">
                            <div className="font-medium text-base">
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
                            <div className="flex items-center gap-3 mt-2 sm:hidden text-sm text-muted-foreground">
                              <span>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                              <span className="font-medium text-foreground ml-auto">{formatCurrency(item.subtotal)}</span>
                            </div>
                          </div>
                          
                          <div className="hidden sm:flex items-center">
                            <div className="w-[120px] text-right text-sm text-muted-foreground">{item.quantity} ×</div>
                            <div className="w-[100px] text-right font-medium text-base text-muted-foreground">{formatCurrency(item.unitPrice)}</div>
                            <div className="w-[100px] text-right font-medium text-base">{formatCurrency(item.subtotal)}</div>
                          </div>
                        </div>

                        {modifiers.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 sm:ml-[16px] lg:ml-[24px]">{t('sales.order.modifiers') || 'Extras'}</p>
                            <div className="space-y-3">
                              {modifiers.map((mod: any, idx: number) => (
                                <div key={mod.id || mod.metadata?.client_line_key || idx} className="flex flex-col sm:flex-row sm:items-center gap-4">
                                  <div className="flex items-center gap-2 text-muted-foreground min-w-0 flex-1 sm:ml-[16px] lg:ml-[24px]">
                                    <span>+</span>
                                    <span className="text-sm">{mod.name}</span>
                                    {mod.description && <span className="hidden sm:inline text-xs">- {mod.description}</span>}
                                  </div>
                                  
                                  <div className="hidden sm:flex items-center">
                                    <div className="w-[120px] text-right text-sm text-muted-foreground">{mod.quantity} ×</div>
                                    <div className="w-[100px] text-right text-sm text-muted-foreground">{formatCurrency(mod.unitPrice)}</div>
                                    <div className="w-[100px] text-right font-medium text-sm text-muted-foreground">{formatCurrency(mod.subtotal)}</div>
                                  </div>

                                  <div className="flex items-center justify-between sm:hidden pl-5 text-sm text-muted-foreground">
                                    <span>{mod.quantity} × {formatCurrency(mod.unitPrice)}</span>
                                    <span className="font-medium text-foreground">{formatCurrency(mod.subtotal)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
              })() : (
                <div className="text-center py-8 text-muted-foreground">
                  {t('sales.order.noItems') || 'No items in this order'}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2 pt-4 border-t border-dashed border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('sales.order.subtotal') || 'Subtotal'}:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            
            {taxTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('sales.order.tax') || 'Tax'}:</span>
                <span>{formatCurrency(taxTotal)}</span>
              </div>
            )}
            
            {discountTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('sales.order.discount') || 'Discount'}:</span>
                <span className="text-green-600">-{formatCurrency(discountTotal)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-semibold text-lg pt-3 mt-3 border-t border-gray-200">
              <span>{t('sales.order.totalAmount') || 'Total'}:</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
          
          {saleOrder.notes && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-600 mb-2">{t('sales.order.notes') || 'Notes'}:</h4>
              <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-md italic">{saleOrder.notes}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 