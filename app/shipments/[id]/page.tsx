"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { getShipment, updateShipmentStatus, updateShipmentTracking } from "../actions"
import { ShipmentWithRelations } from "../types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { toast } from "sonner"
import { ChevronLeft, Save, Send, MapPin, User, Archive, ExternalLink, Calendar, CheckCircle2 } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { format } from "date-fns"
import Link from "next/link"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 hover:bg-gray-100 border-none",
  preparing: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  shipped: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
  in_transit: "bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200",
  delivered: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
  failed: "bg-red-100 text-red-800 hover:bg-red-100 border-red-300",
}

export default function ShipmentDetail({ params }: { params: { id: string } }) {
  const { currentSite } = useSite()
  const router = useRouter()
  
  const [shipment, setShipment] = useState<ShipmentWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [carrier, setCarrier] = useState("")
  const [tracking, setTracking] = useState("")
  const [savingTracking, setSavingTracking] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await getShipment(params.id)
      if (error) {
        toast.error("Failed to load shipment")
      } else if (data) {
        setShipment(data)
        setCarrier(data.carrier || "")
        setTracking(data.tracking_number || "")
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleStatusChange = async (newStatus: string) => {
    if (!currentSite || !shipment) return
    setUpdatingStatus(true)
    const { data, error } = await updateShipmentStatus(currentSite.id, shipment.id, newStatus)
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(`Status updated to ${newStatus}`)
      setShipment(prev => prev ? { ...prev, status: newStatus as any } : null)
    }
    setUpdatingStatus(false)
  }

  const handleSaveTracking = async () => {
    if (!currentSite || !shipment) return
    setSavingTracking(true)
    const { data, error } = await updateShipmentTracking(currentSite.id, shipment.id, {
      carrier,
      tracking_number: tracking
    })
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success("Tracking updated")
      setShipment(prev => prev ? { ...prev, carrier: data.carrier, tracking_number: data.tracking_number } : null)
    }
    setSavingTracking(false)
  }

  // Trigger breadcrumb update
  useEffect(() => {
    if (shipment) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: `Order ${shipment.sale_orders?.order_number || 'Shipment'}`,
          parent: {
            title: t('layout.sidebar.shipments') || 'Shipments',
            path: '/shipments'
          }
        }
      });
      window.dispatchEvent(event);
    }
  }, [shipment, t]);

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  }

  if (!shipment) return <div className="p-8">Shipment not found</div>

  const address = shipment.shipping_address as any || {}

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0 flex justify-end">
          <div className="flex items-center gap-2">
            {/* Next logical actions based on status */}
            {shipment.status === 'pending' && (
              <Button onClick={() => handleStatusChange('preparing')} disabled={updatingStatus}>
                Start Preparing
              </Button>
            )}
            {shipment.status === 'preparing' && (
              <Button onClick={() => handleStatusChange('shipped')} disabled={updatingStatus}>
                Mark as Shipped
              </Button>
            )}
            {shipment.status === 'shipped' && (
              <Button onClick={() => handleStatusChange('in_transit')} disabled={updatingStatus}>
                In Transit
              </Button>
            )}
            {shipment.status === 'in_transit' && (
              <Button onClick={() => handleStatusChange('delivered')} disabled={updatingStatus}>
                Mark Delivered
              </Button>
            )}
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="mx-auto max-w-[1000px] grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-gray-500"/> Tracking Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Carrier</Label>
                    <Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. UPS, FedEx" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tracking Number</Label>
                    <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking code" />
                  </div>
                </div>
                <Button onClick={handleSaveTracking} disabled={savingTracking || (carrier === shipment.carrier && tracking === shipment.tracking_number)}>
                  <Save className="h-4 w-4 mr-2" /> Save Tracking
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-gray-500"/> Destination Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  {Object.keys(address).length > 0 ? (
                    <>
                      <div className="font-medium">{address.contact_name || shipment.leads?.name}</div>
                      <div className="text-gray-600 mt-1">
                        {address.street}<br/>
                        {address.city}{address.city && address.region ? ', ' : ''}{address.region} {address.postal_code}<br/>
                        {address.country}
                      </div>
                      {(address.phone || address.email) && (
                        <div className="mt-3 text-sm text-gray-500 pt-3 border-t">
                          {address.phone && <div>Phone: {address.phone}</div>}
                          {address.email && <div>Email: {address.email}</div>}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500 italic">No shipping address recorded.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">CUSTOMER</div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <Link href={`/leads/${shipment.lead_id}?artifact=true`} className="font-medium hover:underline text-blue-600">
                      {shipment.leads?.name || 'View Customer'}
                    </Link>
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">ORIGIN LOCATION</div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{shipment.locations?.name || 'Unknown'}</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">ORDER</div>
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-gray-400" />
                    {shipment.sale_id ? (
                      <Link href={`/sales/${shipment.sale_id}?artifact=true`} className="font-medium hover:underline text-blue-600">
                        {shipment.sale_orders?.order_number}
                      </Link>
                    ) : (
                      <span>{shipment.sale_orders?.order_number}</span>
                    )}
                  </div>
                </div>
                
                {shipment.stock_decremented && (
                  <div className="pt-3 border-t">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Stock Decremented
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-medium">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y text-sm">
                  <div className="p-3 flex justify-between items-center bg-gray-50">
                    <span className="text-gray-600">Created</span>
                    <span className="font-medium">{format(new Date(shipment.created_at), 'MMM d, h:mm a')}</span>
                  </div>
                  {shipment.shipped_at && (
                    <div className="p-3 flex justify-between items-center">
                      <span className="text-gray-600">Shipped</span>
                      <span className="font-medium">{format(new Date(shipment.shipped_at), 'MMM d, h:mm a')}</span>
                    </div>
                  )}
                  {shipment.delivered_at && (
                    <div className="p-3 flex justify-between items-center bg-gray-50">
                      <span className="text-gray-600">Delivered</span>
                      <span className="font-medium">{format(new Date(shipment.delivered_at), 'MMM d, h:mm a')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
