"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { getSaleById, getSaleOrderBySaleId, updateSale, deleteSale } from "@/app/sales/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { Sale, SaleOrder, SaleOrderItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { User, Tag, ShoppingCart, Plus, Pencil, Trash2, Printer, ChevronLeft, CreditCard } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { SaleOrderDetail } from "../components/SaleOrderDetail"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from "@/app/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { EditSaleDialog } from "../components/EditSaleDialog"
import { CreateSaleOrderDialog } from "../components/CreateSaleOrderDialog"
import { RegisterPaymentDialog } from "../components/RegisterPaymentDialog"
import { StatusBar } from "../components/StatusBar"

// Status colors for sales
const STATUS_STYLES = {
  draft: "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200",
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  refunded: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
}

// Source colors for sales
const SOURCE_STYLES = {
  retail: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  online: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
}

// Updated skeleton to match new integrated invoice
function SaleInvoiceSkeleton() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-card dark:bg-card rounded-lg shadow-lg overflow-hidden border border-border dark:border-border" style={{ 
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        background: "var(--card)"
      }}>
        {/* Skeleton Header */}
        <div className="p-6 border-b border-border dark:border-border bg-muted/50 dark:bg-muted/10">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        
        {/* Skeleton Company & Customer */}
        <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-border dark:border-border">
          <div>
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        
        {/* Skeleton Sale Details */}
        <div className="p-6 border-b border-border dark:border-border">
          <Skeleton className="h-4 w-32 mb-4" />
          
          <div className="bg-muted/50 dark:bg-muted/10 p-4 rounded-md mb-6">
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div>
                <Skeleton className="h-4 w-16 mx-auto mb-2" />
                <Skeleton className="h-6 w-24 mx-auto" />
              </div>
              <div>
                <Skeleton className="h-4 w-16 mx-auto mb-2" />
                <Skeleton className="h-6 w-24 mx-auto" />
              </div>
              <div>
                <Skeleton className="h-4 w-16 mx-auto mb-2" />
                <Skeleton className="h-6 w-24 mx-auto" />
              </div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Skeleton className="h-4 w-36 mb-2" />
              <div className="border border-border dark:border-border rounded-md p-4">
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
            <div>
              <Skeleton className="h-4 w-36 mb-2" />
              <div className="border border-border dark:border-border rounded-md p-4">
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Skeleton Order Details */}
        <div className="p-6 border-b border-border dark:border-border">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
        
        {/* Skeleton Footer */}
        <div className="p-6 bg-muted/50 dark:bg-muted/10">
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

// Integrated invoice with order details
function SaleInvoice({ sale, saleOrder, segments, campaigns, siteName, siteUrl, onCreateOrder, onRegisterPayment }: { 
  sale: Sale, 
  saleOrder: SaleOrder | null, 
  segments: Array<{id: string, name: string}>,
  campaigns: Array<{id: string, title: string}>,
  siteName: string,
  siteUrl: string,
  onCreateOrder: () => void,
  onRegisterPayment: () => void
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
    
    // Map of snake_case or technical values to human-readable values
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
  
  // Create order handler 
  const handleCreateOrder = () => {
    onCreateOrder();
  };

  return (
    <div className="bg-card dark:bg-card rounded-lg shadow-lg overflow-hidden border border-border dark:border-border" style={{ 
      boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
      background: "var(--card)"
    }}>
      {/* Invoice Header */}
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
                <div className="text-sm text-muted-foreground dark:text-muted-foreground">Invoice Number</div>
                <div className="text-lg font-semibold text-primary dark:text-primary">#{sale.invoiceNumber}</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">Date</div>
              <div className="text-base font-medium">{formatDate(sale.saleDate)}</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Company & Customer Info */}
      <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-border dark:border-border">
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">From</h3>
          <div className="text-base font-medium">{siteName || "Your Company"}</div>
          <div className="text-sm text-muted-foreground dark:text-muted-foreground">Website: {siteUrl || "Unknown URL"}</div>
        </div>
        
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">Customer</h3>
          <div className="text-base font-medium">{sale.leadName || "Anonymous Customer"}</div>
          <div className="text-sm text-muted-foreground dark:text-muted-foreground">Segment: {getSegmentName(sale.segmentId)}</div>
          {sale.campaignId && <div className="text-sm text-muted-foreground dark:text-muted-foreground">Campaign: {getCampaignName(sale.campaignId)}</div>}
        </div>
      </div>
      
      {/* Sale Info */}
      <div className="p-6 border-b border-border dark:border-border">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-4">Sale Details</h3>
        
        <div className="bg-muted/50 dark:bg-muted/10 p-4 rounded-md mb-6">
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">Amount</div>
              <div className="text-xl font-bold text-primary dark:text-primary">{formatCurrency(sale.amount)}</div>
              {sale.currency && <div className="text-xs text-muted-foreground dark:text-muted-foreground">{sale.currency}</div>}
            </div>
            <div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">Status</div>
              <div>
                <Badge className={`${STATUS_STYLES[sale.status]} mt-1`}>
                  {sale.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">Source</div>
              <div>
                <Badge className={`${SOURCE_STYLES[sale.source]} mt-1`}>
                  {sale.source}
                </Badge>
              </div>
              {sale.channel && <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">Channel: {sale.channel}</div>}
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">Product Information</h4>
            <div className="border border-border dark:border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">Product</td>
                    <td className="py-2 px-3">{sale.productName || "N/A"}</td>
                  </tr>
                  {sale.productType && (
                    <tr className="border-b border-border dark:border-border">
                      <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">Type</td>
                      <td className="py-2 px-3">{sale.productType}</td>
                    </tr>
                  )}
                  {sale.referenceCode && (
                    <tr className="border-b border-border dark:border-border">
                      <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">Reference</td>
                      <td className="py-2 px-3">{sale.referenceCode}</td>
                    </tr>
                  )}
                  {sale.externalId && (
                    <tr>
                      <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">External ID</td>
                      <td className="py-2 px-3">{sale.externalId}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">Payment Information</h4>
            <div className="border border-border dark:border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">Method</td>
                    <td className="py-2 px-3">{formatPaymentMethod(sale.paymentMethod)}</td>
                  </tr>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">Date</td>
                    <td className="py-2 px-3">{formatDate(sale.saleDate)}</td>
                  </tr>
                  <tr className="border-b border-border dark:border-border">
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">Amount</td>
                    <td className="py-2 px-3">{formatCurrency(sale.amount)} {sale.currency}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 bg-muted/50 dark:bg-muted/10 font-medium">Amount Due</td>
                    <td className="py-2 px-3 font-medium text-primary dark:text-primary">{formatCurrency(sale.amount_due)} {sale.currency}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment History */}
            {sale.payments && sale.payments.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">Payment History</h4>
                <div className="border border-border dark:border-border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 dark:bg-muted/10">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">Date</th>
                        <th className="py-2 px-3 text-right font-medium">Amount</th>
                        <th className="py-2 px-3 text-left font-medium">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.payments.map((payment, index) => (
                        <tr key={payment.id} className={index < sale.payments!.length - 1 ? "border-b border-border dark:border-border" : ""}>
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
      
      {/* Order Details Section */}
      <div className="p-6 border-b border-border dark:border-border">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-4">Order Details</h3>
        
        {saleOrder ? (
          <>
            <div className="mb-4 flex justify-between items-center">
              <div className="text-base font-medium">Order #{saleOrder.orderNumber}</div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">Created: {formatDate(saleOrder.createdAt)}</div>
            </div>
            
            <div className="border border-border dark:border-border rounded-md overflow-hidden mb-6">
              <Table>
                <TableHeader className="bg-muted/50 dark:bg-muted/10">
                  <TableRow>
                    <TableHead className="text-sm font-semibold">Item</TableHead>
                    <TableHead className="text-sm font-semibold text-right">Qty</TableHead>
                    <TableHead className="text-sm font-semibold text-right">Price</TableHead>
                    <TableHead className="text-sm font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleOrder.items && saleOrder.items.length > 0 ? (
                    saleOrder.items.map((item: SaleOrderItem) => (
                      <TableRow key={item.id} className="border-b border-border dark:border-border">
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
                  <span className="text-muted-foreground dark:text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(saleOrder.subtotal)}</span>
                </div>
                
                {saleOrder.taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground dark:text-muted-foreground">Tax:</span>
                    <span>{formatCurrency(saleOrder.taxTotal)}</span>
                  </div>
                )}
                
                {saleOrder.discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground dark:text-muted-foreground">Discount:</span>
                    <span className="text-green-600 dark:text-green-400">-{formatCurrency(saleOrder.discountTotal)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-semibold text-lg pt-3 mt-2 border-t border-border dark:border-border">
                  <span>Total:</span>
                  <span className="text-primary dark:text-primary">{formatCurrency(saleOrder.total)}</span>
                </div>
              </div>
            </div>
            
            {saleOrder.notes && (
              <div className="mt-6 pt-4 border-t border-border dark:border-border">
                <h4 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">Order Notes:</h4>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground p-3 bg-muted/50 dark:bg-muted/10 rounded-md italic">{saleOrder.notes}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 bg-muted/50 dark:bg-muted/10 rounded-md">
            <p className="text-muted-foreground dark:text-muted-foreground text-center mb-4">
              There is no order information associated with this sale.
            </p>
            <Button onClick={handleCreateOrder}>
              <Plus className="h-4 w-4 mr-2" />
              Create Order
            </Button>
          </div>
        )}
      </div>
      
      {/* Additional Information */}
      {sale.notes && (
        <div className="p-6 border-b border-border dark:border-border">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">Notes</h3>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground p-3 bg-muted/50 dark:bg-muted/10 rounded-md italic">{sale.notes}</p>
        </div>
      )}
      
      {sale.tags && sale.tags.length > 0 && (
        <div className="p-6 border-b border-border dark:border-border">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground dark:text-muted-foreground mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {sale.tags.map((tag, index) => (
              <Badge key={index} variant="outline">{tag}</Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="p-6 bg-muted/50 dark:bg-muted/10 text-xs text-muted-foreground dark:text-muted-foreground">
        <div className="flex justify-between">
          <div>Sale ID: {sale.id}</div>
          <div>Created: {formatDate(sale.createdAt || '')}</div>
          <div>Last Updated: {formatDate(sale.updatedAt || '')}</div>
        </div>
      </div>
    </div>
  );
}

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentSite } = useSite();
  const [sale, setSale] = useState<Sale | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [isRegisterPaymentDialogOpen, setIsRegisterPaymentDialogOpen] = useState(false);
  
  // Load sale data
  useEffect(() => {
    async function loadSale() {
      if (!currentSite?.id || !params.id) return;
      
      // Reset title to default when component mounts and while loading
      document.title = 'Sales | Market Fit';
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: 'Sale Details',
          path: `/sales/${params.id}`,
          section: 'sales'
        }
      });
      window.dispatchEvent(resetEvent);
      
      setLoading(true);
      try {
        const saleId = String(params.id);
        
        // Load sale data
        const saleResult = await getSaleById(currentSite.id, saleId);
        if (saleResult.error) {
          toast.error(saleResult.error);
          return;
        }
        
        if (saleResult.sale) {
          setSale(saleResult.sale);
        }
        
        // Load sale order data
        const saleOrderResult = await getSaleOrderBySaleId(currentSite.id, saleId);
        if (saleOrderResult.error) {
          toast.error(saleOrderResult.error);
        } else if (saleOrderResult.saleOrder) {
          setSaleOrder(saleOrderResult.saleOrder);
        }
        
        // Load segments
        const segmentsResult = await getSegments(currentSite.id);
        if (segmentsResult.error) {
          console.error(segmentsResult.error);
        } else if (segmentsResult.segments) {
          setSegments(segmentsResult.segments.map(s => ({ id: s.id, name: s.name })));
        }
        
        // Load campaigns
        const campaignsResult = await getCampaigns(currentSite.id);
        if (campaignsResult.error) {
          console.error(campaignsResult.error);
        } else if (campaignsResult.data) {
          setCampaigns(campaignsResult.data.map(c => ({ id: c.id, title: c.title })));
        }
      } catch (error) {
        console.error("Error loading sale:", error);
        toast.error("Error loading sale data");
      } finally {
        setLoading(false);
      }
    }
    
    loadSale();
  }, [currentSite, params.id]);
  
  // Add effect to update the title in the topbar when sale is loaded
  useEffect(() => {
    if (sale) {
      // Update the page title for the browser tab
      document.title = `${sale.title} | Sales`;
      
      // Emit a custom event to update the breadcrumb with sale title
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: sale.title,
          path: `/sales/${sale.id}`,
          section: 'sales'
        }
      });
      
      // Ensure event is dispatched after DOM is updated
      setTimeout(() => {
        window.dispatchEvent(event);
        console.log('Breadcrumb update event dispatched:', sale.title);
      }, 0);
    }
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Sales | Market Fit';
    };
  }, [sale]);
  
  // Add effect for component mount/unmount to ensure clean state
  useEffect(() => {
    // When component mounts, set default title
    document.title = 'Sales | Market Fit';
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Sales | Market Fit';
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: null,
          path: null,
          section: 'sales'
        }
      });
      window.dispatchEvent(resetEvent);
    };
  }, []);
  
  // Handlers for toolbar actions
  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!currentSite?.id || !sale) return;
    
    try {
      const result = await deleteSale(currentSite.id, sale.id);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Sale deleted successfully");
        router.push("/sales");
      }
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast.error("Error deleting sale");
    }
  };
  
  const handlePrint = () => {
    if (sale) {
      // Open the print-friendly page in a new window
      window.open(`/invoice-pdf/${sale.id}`, '_blank');
    }
  };
  
  const handleStatusChange = async (newStatus: string) => {
    if (!currentSite?.id || !sale) return;
    
    try {
      const updatedSale: Sale = {
        ...sale,
        status: newStatus as "draft" | "pending" | "completed" | "cancelled" | "refunded"
      };
      
      const result = await updateSale(currentSite.id, updatedSale);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Status updated to ${newStatus}`);
        if (result.sale) {
          setSale(result.sale);
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error updating status");
    }
  };
  
  const handleEditSuccess = async () => {
    if (!currentSite?.id || !params.id) return;
    
    setLoading(true);
    try {
      const saleId = String(params.id);
      const saleResult = await getSaleById(currentSite.id, saleId);
      
      if (saleResult.error) {
        toast.error(saleResult.error);
      } else if (saleResult.sale) {
        setSale(saleResult.sale);
      }
    } catch (error) {
      console.error("Error reloading sale:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Create order handler
  const handleCreateOrder = () => {
    setIsCreateOrderDialogOpen(true);
  };
  
  // Handle order creation success
  const handleOrderCreationSuccess = async () => {
    if (!currentSite?.id || !params.id) return;
    
    try {
      // Refresh the sale order data
      const saleId = String(params.id);
      const saleOrderResult = await getSaleOrderBySaleId(currentSite.id, saleId);
      
      if (saleOrderResult.error) {
        toast.error(saleOrderResult.error);
      } else if (saleOrderResult.saleOrder !== undefined) {
        setSaleOrder(saleOrderResult.saleOrder);
      }
    } catch (error) {
      console.error("Error refreshing sale order:", error);
    }
  };
  
  // Register Payment handler
  const handleRegisterPayment = () => {
    setIsRegisterPaymentDialogOpen(true);
  };
  
  // Handle payment success
  const handlePaymentSuccess = async () => {
    if (!currentSite?.id || !params.id) return;
    
    try {
      // Refresh the sale data
      const saleId = String(params.id);
      const saleResult = await getSaleById(currentSite.id, saleId);
      
      if (saleResult.error) {
        toast.error(saleResult.error);
      } else if (saleResult.sale) {
        setSale(saleResult.sale);
      }
    } catch (error) {
      console.error("Error refreshing sale:", error);
    }
  };
  
  return (
    <div className="flex-1 p-0">
      <StickyHeader>
        <div className="flex flex-col w-full">
          {/* Main Title and Status Area */}
          <div className="px-16 pt-0">
            <div className="flex items-center justify-end">
              {/* Se eliminan los badges de estado */}
            </div>
          </div>
          
          {/* Toolbar Area */}
          <div className="px-16 flex items-center justify-between h-[50px]">
            {/* Left section - Action buttons */}
            <div className="flex items-center gap-1">
              {sale && sale.amount_due > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegisterPayment}
                    className="flex items-center gap-1 text-green-600 hover:bg-green-50 hover:text-green-700"
                  >
                    <CreditCard className="h-4 w-4" />
                    Register Payment
                  </Button>
                  
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="flex items-center gap-1"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              
              <div className="w-px h-6 bg-border mx-1" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrint}
                className="flex items-center gap-1"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              
              <div className="w-px h-6 bg-border mx-1" />
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Sale</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this sale? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            {/* Right section - Status Tabs */}
            <div className="flex items-center justify-end">
              {sale && (
                <StatusBar 
                  currentStatus={sale.status}
                  onStatusChange={handleStatusChange}
                />
              )}
            </div>
          </div>
        </div>
      </StickyHeader>
      
      <div className="px-16 py-8 bg-muted/50 dark:bg-background min-h-screen">
        {loading ? (
          <SaleInvoiceSkeleton />
        ) : sale ? (
          <div className="max-w-6xl mx-auto">
            <div className="relative">
              <SaleInvoice 
                sale={sale} 
                saleOrder={saleOrder} 
                segments={segments} 
                campaigns={campaigns} 
                siteName={currentSite?.name || ""} 
                siteUrl={currentSite?.url || ""} 
                onCreateOrder={handleCreateOrder}
                onRegisterPayment={handleRegisterPayment}
              />
              {/* Add subtle shadow effect to enhance the paper look */}
              <div className="absolute inset-0 rounded-lg shadow-xl -z-10 transform translate-y-1 bg-card/50 dark:bg-card/10 opacity-50 dark:border dark:border-border/30"></div>
              <div className="absolute inset-0 rounded-lg shadow-md -z-20 transform translate-y-2 bg-card/30 dark:bg-card/5 opacity-30 dark:border dark:border-border/20"></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Sale not found</p>
          </div>
        )}
      </div>
      
      {/* Edit Sale Dialog */}
      <EditSaleDialog 
        sale={sale}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
      />
      
      {/* Create Order Dialog */}
      <CreateSaleOrderDialog
        sale={sale}
        open={isCreateOrderDialogOpen}
        onOpenChange={setIsCreateOrderDialogOpen}
        onSuccess={handleOrderCreationSuccess}
      />
      
      {/* Register Payment Dialog */}
      <RegisterPaymentDialog
        sale={sale}
        open={isRegisterPaymentDialogOpen}
        onOpenChange={setIsRegisterPaymentDialogOpen}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
} 