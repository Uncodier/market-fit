import { useState } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
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
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-sm font-semibold">{t('sales.order.item') || 'Item'}</TableHead>
                  <TableHead className="text-sm font-semibold text-right">{t('sales.order.qty') || 'Qty'}</TableHead>
                  <TableHead className="text-sm font-semibold text-right">{t('sales.order.price') || 'Price'}</TableHead>
                  <TableHead className="text-sm font-semibold text-right">{t('sales.order.total') || 'Total'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleOrder.items && saleOrder.items.length > 0 ? (
                  saleOrder.items.map((item: SaleOrderItem) => (
                    <TableRow key={item.id} className="border-b border-gray-100">
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
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
                      {t('sales.order.noItems') || 'No items in this order'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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