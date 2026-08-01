"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getOrder, updateOrderStatus, updateOrderNotes, updateOrderItemStatus } from "../actions"
import { createShipment } from "@/app/shipments/actions"
import { listLocations } from "@/app/inventory/actions"
import { OrderWithRelations } from "../types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Badge } from "@/app/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { Save, User, ExternalLink, Calendar, CheckCircle2, ListOrdered, FileText, Send, DollarSign, Tag } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSite } from "@/app/context/SiteContext"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
}

const LINE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  new: "bg-amber-500 text-white",
  preparing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
}

export default function OrderDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [order, setOrder] = useState<OrderWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [modifiedLines, setModifiedLines] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data, error } = await getOrder(params.id)
      if (error) {
        toast.error("Failed to load order")
      } else if (data) {
        setOrder(data)
        setNotes(data.notes || "")
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleStatusChange = async (newStatus: string) => {
    if (!currentSite || !order) return
    setUpdatingStatus(true)
    const { data, error } = await updateOrderStatus(currentSite.id, order.id, newStatus)
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(`Status updated to ${newStatus}`)
      setOrder(prev => prev ? { 
        ...prev, 
        status: newStatus as any,
        sale_order_items: newStatus === 'completed'
          ? prev.sale_order_items?.map((item: any) => ({ ...item, status: 'completed' }))
          : prev.sale_order_items
      } : null)
    }
    setUpdatingStatus(false)
  }

  const handleLineStatusChange = (itemId: string, newStatus: string) => {
    setModifiedLines(prev => ({ ...prev, [itemId]: newStatus }))
    setOrder(prev => prev ? { 
      ...prev, 
      sale_order_items: prev.sale_order_items?.map((item: any) => 
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    } : null)
  }

  const handleSaveLineItems = async () => {
    if (!order || !currentSite) return
    const idsToUpdate = Object.keys(modifiedLines)
    if (idsToUpdate.length === 0) return

    setSavingLines(true)
    try {
      // Loop over the updates and perform them
      // Alternatively we can use Promise.all to run them concurrently
      await Promise.all(
        idsToUpdate.map(itemId => 
          updateOrderItemStatus(currentSite.id, itemId, order.id, modifiedLines[itemId])
        )
      )
      
      toast.success("Line items updated")
      setModifiedLines({})
    } catch (e: any) {
      toast.error(e.message || "Failed to save line items")
    } finally {
      setSavingLines(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!currentSite || !order) return
    setSavingNotes(true)
    const { data, error } = await updateOrderNotes(currentSite.id, order.id, notes)
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success("Notes updated")
      setOrder(prev => prev ? { ...prev, notes: data.notes } : null)
    }
    setSavingNotes(false)
  }

  const handleCreateShipment = async () => {
    if (!order || !currentSite) {
      toast.error("Required order info missing")
      return
    }

    try {
      const locationsRes = await listLocations(currentSite.id)
      const locations = locationsRes.data || []
      const defaultLocation =
        locations.find((l) => l.is_default) || locations[0]

      if (!defaultLocation?.id) {
        toast.error("No valid location found to ship from. Add one in Settings.")
        return
      }

      const res = await createShipment({
        siteId: currentSite.id,
        saleOrderId: order.id,
        saleId: order.sale_id || undefined,
        leadId: order.leads?.id || (order.sales as any)?.lead_id || undefined,
        originLocationId: defaultLocation.id,
        userId: order.user_id,
      })
      if (res.error) throw new Error(res.error)
      if (res.data) {
        toast.success("Shipment created")
        router.push(`/shipments/${res.data.id}`)
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create shipment")
    }
  }

  // Trigger breadcrumb update
  useEffect(() => {
    if (order) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: order.order_number,
          parent: {
            title: t('layout.sidebar.orders') || 'Orders',
            path: '/orders'
          }
        }
      });
      window.dispatchEvent(event);
    }
  }, [order, t]);

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  }

  if (!order) return <div className="p-8">Order not found</div>

  const hasShipments = order.shipments && order.shipments.length > 0;
  // Fallback to jsonb items if no normalized sale_order_items found
  const items = order.sale_order_items && order.sale_order_items.length > 0 ? order.sale_order_items : (order.items || []);

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <StickyHeader>
          <div className="w-full pt-0 flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="shipments">Shipments</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              {order.status === 'pending' && (
                <Button onClick={() => handleStatusChange('completed')} disabled={updatingStatus}>
                  Mark as Completed
                </Button>
              )}
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <TabsContent value="details" className="m-0 border-0 p-0">
            <div className="mx-auto max-w-[800px] space-y-6">
              
              {/* Top Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                      <Badge className={STATUS_STYLES[order.status] || ''}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Created At</Label>
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {format(new Date(order.created_at), 'PPP p')}
                      </div>
                    </div>
                    {order.promotions && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Promotion</Label>
                        <div className="flex items-center text-sm">
                          <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                          {order.promotions.name} ({order.promotions.code})
                        </div>
                      </div>
                    )}
                    {order.price_lists && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Price List</Label>
                        <div className="flex items-center text-sm">
                          <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                          {order.price_lists.name}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Card */}
                {order.leads && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><User className="h-4 w-4"/> Customer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="font-medium">{order.leads.name}</div>
                      {order.leads.email && <div className="text-sm text-muted-foreground">{order.leads.email}</div>}
                      {order.leads.phone && <div className="text-sm text-muted-foreground">{order.leads.phone}</div>}
                      <Link href={`/leads/${order.leads.id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-2 inline-flex">
                        View Customer <ExternalLink className="h-3 w-3" />
                      </Link>
                    </CardContent>
                  </Card>
                )}

                {/* Related Sale Card */}
                {order.sale_id && order.sales && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4"/> Related Sale</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Payment Status</Label>
                        <Badge variant="outline">{order.sales.status.toUpperCase()}</Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Source</Label>
                        <div className="text-sm capitalize">{order.sales.source}</div>
                      </div>
                      <Link href={`/sales/${order.sale_id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 inline-flex">
                        View Sale <ExternalLink className="h-3 w-3" />
                      </Link>
                    </CardContent>
                  </Card>
                )}
                
                {/* Shipments Card */}
                {hasShipments && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4"/> Shipments</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm font-medium">
                        {order.shipments!.length} shipment(s) associated
                      </div>
                      <div className="space-y-2">
                        {order.shipments!.slice(0, 3).map((s: any) => (
                          <div key={s.id} className="text-sm border-l-2 pl-2 border-border">
                            <div>{s.status.toUpperCase()}</div>
                            {s.tracking_number && <div className="text-muted-foreground text-xs font-mono">{s.tracking_number}</div>}
                            <Link href={`/shipments/${s.id}`} className="text-blue-600 hover:underline flex items-center gap-1 mt-1">
                              View <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Main Content */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ListOrdered size={20} className="text-muted-foreground"/> Line Items</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Shipment</TableHead>
                          <TableHead className="text-right"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No items found</TableCell>
                          </TableRow>
                        ) : items.map((item: any, idx: number) => (
                          <TableRow key={item.id || idx}>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              {item.description && <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>}
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={item.status || 'draft'} 
                                onValueChange={(val) => handleLineStatusChange(item.id, val)}
                                disabled={!item.id}
                              >
                                <SelectTrigger className={cn("h-8 text-[10px] uppercase tracking-wider w-[110px]", LINE_STATUS_STYLES[item.status || 'draft'])}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                                  <SelectItem value="new" className="text-xs">New</SelectItem>
                                  <SelectItem value="preparing" className="text-xs">Preparing</SelectItem>
                                  <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(item.unit_price || item.unitPrice || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(item.subtotal || 0)}
                            </TableCell>
                            <TableCell>
                              {item.shipment_id ? (
                                <Link href={`/shipments/${item.shipment_id}`} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
                                  <Send className="h-3 w-3" /> Assigned
                                </Link>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="border-t p-6 bg-muted/30 flex flex-col items-end space-y-2">
                      <div className="flex justify-between w-full max-w-xs text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(order.subtotal)}</span>
                      </div>
                      {order.discount_total > 0 && (
                        <div className="flex justify-between w-full max-w-xs text-sm text-green-600">
                          <span>Discount:</span>
                          <span>-{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(order.discount_total)}</span>
                        </div>
                      )}
                      {order.tax_total > 0 && (
                        <div className="flex justify-between w-full max-w-xs text-sm">
                          <span className="text-muted-foreground">Tax:</span>
                          <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(order.tax_total)}</span>
                        </div>
                      )}
                      <div className="flex justify-between w-full max-w-xs pt-2 border-t font-bold text-base">
                        <span>Total:</span>
                        <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(order.total)}</span>
                      </div>
                    </div>
                  </CardContent>
                  <ActionFooter>
                    <Button variant="outline" onClick={handleSaveLineItems} disabled={savingLines || Object.keys(modifiedLines).length === 0}>
                      <Save className="h-4 w-4 mr-2" /> Save Items Status
                    </Button>
                  </ActionFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-muted-foreground"/> Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      placeholder="Add internal notes about this order..." 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </CardContent>
                  <ActionFooter>
                    <Button variant="outline" onClick={handleSaveNotes} disabled={savingNotes || notes === (order.notes || "")}>
                      <Save className="h-4 w-4 mr-2" /> Save Notes
                    </Button>
                  </ActionFooter>
                </Card>
                
                {order.status === 'pending' && (
                  <div className="rounded-lg border-destructive/50 border bg-destructive/5 p-6">
                    <div className="flex flex-col gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-destructive mb-1">Danger Zone</h2>
                        <p className="text-sm text-muted-foreground">
                          Actions in this section cannot be undone
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium mb-1">Cancel Order</h3>
                          <p className="text-sm text-muted-foreground">
                            Cancel this order. This will not automatically reverse related sales or shipments.
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          type="button"
                          onClick={() => handleStatusChange('cancelled')}
                          disabled={updatingStatus}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Cancel Order
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shipments" className="m-0 border-0 p-0">
            <div className="mx-auto max-w-[800px] space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Associated Shipments</h3>
                <Button onClick={handleCreateShipment} size="sm" variant="secondary">
                  <Send className="h-4 w-4 mr-2" /> Create Shipment
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking / Carrier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!order.shipments || order.shipments.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            <Send className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            No shipments created for this order yet.
                          </TableCell>
                        </TableRow>
                      ) : order.shipments.map((shipment: any) => (
                        <TableRow key={shipment.id}>
                          <TableCell>
                            {shipment.tracking_number ? (
                              <div>
                                <div className="font-mono">{shipment.tracking_number}</div>
                                <div className="text-xs text-muted-foreground">{shipment.carrier || 'Unknown'}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{shipment.status.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>
                            <Link 
                              href={`/shipments/${shipment.id}`} 
                              className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
