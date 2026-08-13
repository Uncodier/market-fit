"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { getShipment, updateShipmentStatus, setShipmentLineItems } from "../actions"
import { ShipmentWithRelations } from "../types"
import { ShipmentGpsTracker } from "../components/ShipmentGpsTracker"
import { LocationMapCard } from "../components/LocationMapCard"
import { TrackingCard } from "../components/TrackingCard"
import { AssigneeCard } from "../components/AssigneeCard"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Checkbox } from "@/app/components/ui/checkbox"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Badge } from "@/app/components/ui/badge"
import { toast } from "sonner"
import { Save, MapPin, User, Archive, CheckCircle2, ListOrdered } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { format } from "date-fns"
import Link from "next/link"
import { navigateToOrder } from "@/app/hooks/use-navigation-history"
import { useRouter } from "next/navigation"

export default function ShipmentDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  const [shipment, setShipment] = useState<ShipmentWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const [assignableLines, setAssignableLines] = useState<any[]>([])
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [savingLines, setSavingLines] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await getShipment(params.id)
      if (error) {
        toast.error("Failed to load shipment")
      } else if (data) {
        setShipment(data)

        const items = data.sale_orders?.sale_order_items || []
        const pool = items.filter(
          (item: any) =>
            item.status !== "completed" && (!item.shipment_id || item.shipment_id === params.id)
        )
        setAssignableLines(pool)

        const initialSelected = new Set<string>()
        pool.forEach((item: any) => {
          if (item.shipment_id === params.id) initialSelected.add(item.id)
        })
        setSelectedLines(initialSelected)
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
      setShipment((prev) => (prev ? { ...prev, status: newStatus as any } : null))
    }
    setUpdatingStatus(false)
  }

  const handleSaveLineItems = async () => {
    if (!currentSite || !shipment) return
    setSavingLines(true)
    const { error } = await setShipmentLineItems(
      currentSite.id,
      shipment.id,
      Array.from(selectedLines)
    )
    if (error) {
      toast.error(error)
    } else {
      toast.success("Shipment lines updated")
    }
    setSavingLines(false)
  }

  useEffect(() => {
    if (shipment) {
      const event = new CustomEvent("breadcrumb:update", {
        detail: {
          title: `Order ${shipment.sale_orders?.order_number || "Shipment"}`,
          parent: {
            title: t("layout.sidebar.shipments") || "Shipments",
            path: "/shipments",
          },
        },
      })
      window.dispatchEvent(event)
    }
  }, [shipment, t])

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!shipment) return <div className="p-8">Shipment not found</div>

  const address = (shipment.shipping_address as any) || {}

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <StickyHeader>
          <div className="w-full pt-0 flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <ShipmentGpsTracker
                shipmentId={shipment.id}
                assignedTo={shipment.assigned_to}
                status={shipment.status}
              />
              {shipment.status === "pending" && (
                <Button onClick={() => handleStatusChange("preparing")} disabled={updatingStatus}>
                  Start Preparing
                </Button>
              )}
              {shipment.status === "preparing" && (
                <Button onClick={() => handleStatusChange("shipped")} disabled={updatingStatus}>
                  Mark as Shipped
                </Button>
              )}
              {shipment.status === "shipped" && (
                <Button onClick={() => handleStatusChange("in_transit")} disabled={updatingStatus}>
                  In Transit
                </Button>
              )}
              {shipment.status === "in_transit" && (
                <Button onClick={() => handleStatusChange("delivered")} disabled={updatingStatus}>
                  Mark Delivered
                </Button>
              )}
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <TabsContent value="details" className="m-0 border-0 p-0">
            <div className="mx-auto max-w-[1000px] grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <TrackingCard
                  shipmentId={shipment.id}
                  initialCarrier={shipment.carrier || ""}
                  initialTracking={shipment.tracking_number || ""}
                  onUpdate={(carrier, tracking) =>
                    setShipment((prev) =>
                      prev ? { ...prev, carrier, tracking_number: tracking } : null
                    )
                  }
                />

                <SectionCard>
                  <SectionCardHeader>
                    <SectionCardTitle className="flex items-center gap-2">
                      <ListOrdered className="h-5 w-5 text-muted-foreground" /> Line Items
                    </SectionCardTitle>
                  </SectionCardHeader>
                  <SectionCardContent>
                    <div className="space-y-3">
                      {assignableLines.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No assignable lines found for this order.
                        </div>
                      ) : (
                        assignableLines.map((item) => (
                          <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`item-${item.id}`}
                              checked={selectedLines.has(item.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedLines)
                                if (checked) next.add(item.id)
                                else next.delete(item.id)
                                setSelectedLines(next)
                              }}
                            />
                            <label
                              htmlFor={`item-${item.id}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {item.quantity}x {item.name}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </SectionCardContent>
                  <ActionFooter>
                    <Button variant="outline"
                      onClick={handleSaveLineItems}
                      disabled={savingLines || assignableLines.length === 0} size="sm">
                      <Save className="h-4 w-4 mr-2" /> Save Items
                    </Button>
                  </ActionFooter>
                </SectionCard>

                <SectionCard>
                  <SectionCardHeader>
                    <SectionCardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-muted-foreground" /> Destination Address
                    </SectionCardTitle>
                  </SectionCardHeader>
                  <SectionCardContent>
                    <div className="bg-muted/30 rounded-lg border overflow-hidden">
                      {Object.keys(address).length > 0 ? (
                        <div className="p-4">
                          <div className="font-medium">
                            {address.contact_name || shipment.leads?.name}
                          </div>
                          <div className="text-muted-foreground mt-1">
                            {address.street}
                            <br />
                            {address.city}
                            {address.city && address.region ? ", " : ""}
                            {address.region} {address.postal_code}
                            <br />
                            {address.country}
                          </div>
                          {(address.phone || address.email) && (
                            <div className="mt-3 text-sm text-muted-foreground pt-3 border-t">
                              {address.phone && <div>Phone: {address.phone}</div>}
                              {address.email && <div>Email: {address.email}</div>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6">
                          <EmptyCard
                            icon={<MapPin className="h-10 w-10 text-muted-foreground" />}
                            title="No Address"
                            description="No shipping address recorded."
                            variant="fancy"
                            showShadow={false}
                          />
                        </div>
                      )}
                    </div>
                  </SectionCardContent>
                </SectionCard>

                {(shipment.status === "pending" || shipment.status === "preparing") && (
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
                          <h3 className="font-medium mb-1">Cancel Shipment</h3>
                          <p className="text-sm text-muted-foreground">
                            Cancel this shipment. This will stop the fulfillment process.
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          type="button"
                          onClick={() => handleStatusChange("cancelled")}
                          disabled={updatingStatus}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Cancel Shipment
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <AssigneeCard
                  shipmentId={shipment.id}
                  initialAssignee={shipment.assigned_to}
                  onUpdate={(assigned_to, name) =>
                    setShipment((prev) =>
                      prev
                        ? {
                            ...prev,
                            assigned_to,
                            assignee_profile: name ? { name } : null,
                          }
                        : null
                    )
                  }
                />

                <LocationMapCard
                  shipmentId={shipment.id}
                  lastLat={shipment.last_lat ?? null}
                  lastLng={shipment.last_lng ?? null}
                  lastLocatedAt={shipment.last_located_at ?? null}
                />

                <SectionCard>
                  <SectionCardContent className="p-4 space-y-4">
                    <div>
                      <div className="text-xs text-muted-foreground font-medium mb-1">CUSTOMER</div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <Link
                          href={`/leads/${shipment.lead_id}`}
                          className="font-medium hover:underline text-blue-600"
                        >
                          {shipment.leads?.name || "View Customer"}
                        </Link>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground font-medium mb-1">
                        ORIGIN LOCATION
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{shipment.locations?.name || "Unknown"}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground font-medium mb-1">ORDER</div>
                      <div className="flex items-center gap-2">
                        <Archive className="h-4 w-4 text-muted-foreground" />
                        {shipment.sale_order_id ? (
                          <button
                            onClick={() => navigateToOrder({ orderId: shipment.sale_order_id!, orderNumber: shipment.sale_orders?.order_number, router })}
                            className="font-medium hover:underline text-blue-600 text-left"
                          >
                            {shipment.sale_orders?.order_number}
                          </button>
                        ) : (
                          <span>{shipment.sale_orders?.order_number}</span>
                        )}
                      </div>
                    </div>

                    {shipment.stock_decremented && (
                      <div className="pt-3 border-t">
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Stock Decremented
                        </Badge>
                      </div>
                    )}
                  </SectionCardContent>
                </SectionCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="m-0 border-0 p-0 h-full">
            <div className="mx-auto max-w-[800px] mt-6">
              <SectionCard>
                <SectionCardHeader className="py-4 px-6 border-b">
                  <SectionCardTitle className="text-lg font-medium">Timeline</SectionCardTitle>
                </SectionCardHeader>
                <SectionCardContent className="p-0">
                  <div className="divide-y text-sm">
                    <div className="p-4 px-6 flex justify-between items-center bg-muted/30">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">
                        {format(new Date(shipment.created_at), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    {shipment.shipped_at && (
                      <div className="p-4 px-6 flex justify-between items-center">
                        <span className="text-muted-foreground">Shipped</span>
                        <span className="font-medium">
                          {format(new Date(shipment.shipped_at), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                    )}
                    {shipment.delivered_at && (
                      <div className="p-4 px-6 flex justify-between items-center bg-muted/30">
                        <span className="text-muted-foreground">Delivered</span>
                        <span className="font-medium">
                          {format(new Date(shipment.delivered_at), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                    )}
                    {shipment.last_located_at && (
                      <div className="p-4 px-6 flex justify-between items-center">
                        <span className="text-muted-foreground">Last GPS ping</span>
                        <span className="font-medium">
                          {format(new Date(shipment.last_located_at), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                    )}
                  </div>
                </SectionCardContent>
              </SectionCard>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
