"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { getSaleById, getSaleOrderBySaleId } from "@/app/sales/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { Sale, SaleOrder, SaleOrderItem } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"

// Status colors for sales
const STATUS_STYLES = {
  draft: "bg-gray-50 text-gray-700 border-gray-200",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  refunded: "bg-purple-50 text-purple-700 border-purple-200"
}

// Source colors for sales
const SOURCE_STYLES = {
  retail: "bg-blue-50 text-blue-700 border-blue-200",
  online: "bg-indigo-50 text-indigo-700 border-indigo-200"
}

// Print-optimized skeleton
function PrintInvoiceSkeleton() {
  return (
    <div className="max-w-4xl mx-auto bg-white">
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

// Print-optimized invoice component
function PrintableInvoice({ sale, saleOrder, segments, campaigns, siteName, siteUrl }: { 
  sale: Sale, 
  saleOrder: SaleOrder | null, 
  segments: Array<{id: string, name: string}>,
  campaigns: Array<{id: string, title: string}>,
  siteName: string,
  siteUrl: string
}) {
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment";
    const segment = segments.find(s => s.id === segmentId);
    return segment?.name || "Unknown Segment";
  };

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return "No Campaign";
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.title || "Unknown Campaign";
  };
  
  // Format payment method for display
  const formatPaymentMethod = (method: string) => {
    if (!method) return "Not specified";
    
    const methodMap: Record<string, string> = {
      "credit_card": "Credit Card",
      "debit_card": "Debit Card",
      "paypal": "PayPal",
      "bank_transfer": "Bank Transfer",
      "cash": "Cash",
      "check": "Check",
      "crypto": "Cryptocurrency",
      "wire_transfer": "Wire Transfer",
      "stripe": "Stripe",
      "apple_pay": "Apple Pay",
      "google_pay": "Google Pay",
      "venmo": "Venmo",
      "zelle": "Zelle"
    };
    
    return methodMap[method.toLowerCase()] || method.replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white print:shadow-none">
      <style jsx global>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:text-black { color: #000 !important; }
          .print\\:bg-white { background-color: #fff !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
          .print\\:break-after-page { break-after: page; }
        }
        
        @page {
          margin: 0.75in;
          size: A4;
        }
      `}</style>
      
      <div className="p-8 space-y-8 print:p-0 print:text-black print:bg-white">
        {/* Invoice Header */}
        <div className="border-b border-gray-200 pb-6 print:break-inside-avoid">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
              {sale.invoiceNumber && (
                <p className="text-lg text-gray-600">#{sale.invoiceNumber}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Invoice Date</div>
              <div className="text-lg font-semibold">{formatDate(sale.saleDate)}</div>
            </div>
          </div>
        </div>
        
        {/* Company & Customer Info */}
        <div className="grid grid-cols-2 gap-8 print:break-inside-avoid">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">From</h3>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-gray-900">{siteName || "Your Company"}</div>
              <div className="text-sm text-gray-600">{siteUrl || "www.yourcompany.com"}</div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Bill To</h3>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-gray-900">{sale.leadName || "Anonymous Customer"}</div>
              <div className="text-sm text-gray-600">Segment: {getSegmentName(sale.segmentId)}</div>
              {sale.campaignId && <div className="text-sm text-gray-600">Campaign: {getCampaignName(sale.campaignId)}</div>}
            </div>
          </div>
        </div>
        
        {/* Sale Summary */}
        <div className="bg-gray-50 p-6 rounded-lg print:bg-gray-100 print:break-inside-avoid">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Amount</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(sale.amount)}</div>
              {sale.currency && <div className="text-xs text-gray-500">{sale.currency}</div>}
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Status</div>
              <div>
                <Badge className={`${STATUS_STYLES[sale.status]} print:border print:bg-gray-100`}>
                  {sale.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Amount Due</div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(sale.amount_due)}</div>
              {sale.currency && <div className="text-xs text-gray-500">{sale.currency}</div>}
            </div>
          </div>
        </div>
        
        {/* Product & Payment Information */}
        <div className="grid grid-cols-2 gap-8 print:break-inside-avoid">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Product</td>
                    <td className="py-3 px-4 text-gray-900">{sale.productName || "N/A"}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Title</td>
                    <td className="py-3 px-4 text-gray-900">{sale.title}</td>
                  </tr>
                  {sale.productType && (
                    <tr className="border-b border-gray-200">
                      <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Type</td>
                      <td className="py-3 px-4 text-gray-900">{sale.productType}</td>
                    </tr>
                  )}
                  {sale.referenceCode && (
                    <tr className="border-b border-gray-200">
                      <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Reference</td>
                      <td className="py-3 px-4 text-gray-900">{sale.referenceCode}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Source</td>
                    <td className="py-3 px-4 text-gray-900">
                      <Badge className={`${SOURCE_STYLES[sale.source]} print:border print:bg-gray-100`}>
                        {sale.source}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Method</td>
                    <td className="py-3 px-4 text-gray-900">{formatPaymentMethod(sale.paymentMethod)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Date</td>
                    <td className="py-3 px-4 text-gray-900">{formatDate(sale.saleDate)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Total</td>
                    <td className="py-3 px-4 text-gray-900 font-semibold">{formatCurrency(sale.amount)} {sale.currency}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 bg-gray-50 font-medium text-gray-700">Amount Due</td>
                    <td className="py-3 px-4 text-red-600 font-semibold">{formatCurrency(sale.amount_due)} {sale.currency}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Payment History */}
        {sale.payments && sale.payments.length > 0 && (
          <div className="print:break-inside-avoid">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Date</th>
                    <th className="py-3 px-4 text-right font-semibold text-gray-700">Amount</th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.payments.map((payment, index) => (
                    <tr key={payment.id} className={index < sale.payments!.length - 1 ? "border-b border-gray-200" : ""}>
                      <td className="py-3 px-4 text-gray-900">{formatDate(payment.date)}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-semibold">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="py-3 px-4 text-gray-900">{formatPaymentMethod(payment.method)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Order Details Section */}
        {saleOrder && (
          <div className="print:break-inside-avoid">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h3>
            
            <div className="mb-4 flex justify-between items-center">
              <div className="text-base font-medium text-gray-900">Order #{saleOrder.orderNumber}</div>
              <div className="text-sm text-gray-600">Created: {formatDate(saleOrder.createdAt)}</div>
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="text-sm font-semibold text-gray-700">Item</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700 text-right">Qty</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700 text-right">Price</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleOrder.items && saleOrder.items.length > 0 ? (
                    saleOrder.items.map((item: SaleOrderItem) => (
                      <TableRow key={item.id} className="border-b border-gray-200">
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm text-gray-900">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-600">{item.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-gray-900">{item.quantity}</TableCell>
                        <TableCell className="text-right text-gray-900">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium text-gray-900">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                        No items in this order
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(saleOrder.subtotal)}</span>
                </div>
                
                {saleOrder.taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="text-gray-900">{formatCurrency(saleOrder.taxTotal)}</span>
                  </div>
                )}
                
                {saleOrder.discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="text-green-600">-{formatCurrency(saleOrder.discountTotal)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-semibold text-lg pt-3 mt-2 border-t border-gray-200">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-gray-900">{formatCurrency(saleOrder.total)}</span>
                </div>
              </div>
            </div>
            
            {saleOrder.notes && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Order Notes:</h4>
                <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-md italic">{saleOrder.notes}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Additional Information */}
        {sale.notes && (
          <div className="print:break-inside-avoid">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
            <p className="text-sm text-gray-600 p-4 bg-gray-50 rounded-md italic">{sale.notes}</p>
          </div>
        )}
        
        {sale.tags && sale.tags.length > 0 && (
          <div className="print:break-inside-avoid">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {sale.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="print:border print:bg-gray-100">{tag}</Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="pt-6 border-t border-gray-200 text-xs text-gray-500 print:break-inside-avoid">
          <div className="flex justify-between">
            <div>Sale ID: {sale.id}</div>
            <div>Created: {formatDate(sale.createdAt || '')}</div>
            <div>Last Updated: {formatDate(sale.updatedAt || '')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePdfPage() {
  const params = useParams();
  const { currentSite } = useSite();
  const [sale, setSale] = useState<Sale | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  
  // Load sale data
  useEffect(() => {
    async function loadSale() {
      if (!currentSite?.id || !params.id) return;
      
      setLoading(true);
      try {
        const saleId = String(params.id);
        
        // Load sale data
        const saleResult = await getSaleById(currentSite.id, saleId);
        if (saleResult.sale) {
          setSale(saleResult.sale);
        }
        
        // Load sale order data
        const saleOrderResult = await getSaleOrderBySaleId(currentSite.id, saleId);
        if (saleOrderResult.saleOrder) {
          setSaleOrder(saleOrderResult.saleOrder);
        }
        
        // Load segments
        const segmentsResult = await getSegments(currentSite.id);
        if (segmentsResult.segments) {
          setSegments(segmentsResult.segments.map(s => ({ id: s.id, name: s.name })));
        }
        
        // Load campaigns
        const campaignsResult = await getCampaigns(currentSite.id);
        if (campaignsResult.data) {
          setCampaigns(campaignsResult.data.map(c => ({ id: c.id, title: c.title })));
        }
      } catch (error) {
        console.error("Error loading sale:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadSale();
  }, [currentSite, params.id]);
  
  // Update page title for printing
  useEffect(() => {
    if (sale) {
      document.title = `Invoice - ${sale.title}`;
    }
    
    return () => {
      document.title = 'Sales | Market Fit';
    };
  }, [sale]);
  
  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {loading ? (
        <PrintInvoiceSkeleton />
      ) : sale ? (
        <PrintableInvoice 
          sale={sale} 
          saleOrder={saleOrder} 
          segments={segments} 
          campaigns={campaigns} 
          siteName={currentSite?.name || ""} 
          siteUrl={currentSite?.url || ""} 
        />
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Invoice not found</p>
        </div>
      )}
    </div>
  );
} 