"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { updateShipmentStatus, setShipmentLineItems } from "../actions"
import { TrackingCard } from "../components/TrackingCard"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Checkbox } from "@/app/components/ui/checkbox"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { toast } from "sonner"
import { Save, MapPin, ListOrdered } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { format } from "date-fns"
import { navigateToOrder } from "@/lib/navigation/navigation-helpers"
import { useRouter } from "next/navigation"
import { marketplaceMetadata } from "@/lib/marketplace/presentation"
import { MarketplaceCourierCard } from "../components/MarketplaceCourierCard"
import { useShipmentDetailData } from "../hooks/use-shipment-detail-data"
import { useOptionalPermissions } from "@/app/context/PermissionContext"

import { ShipmentStatusBar } from "../components/ShipmentStatusBar"
import { ShipmentIdentityHeader } from "../components/ShipmentIdentityHeader"
import { ShipmentAboutPanel } from "../components/ShipmentAboutPanel"

export default function ShipmentDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  const { shipment, setShipment, loading, error, refresh } = useShipmentDetailData(params.id)
  const permissions = useOptionalPermissions()
  const external = Boolean(marketplaceMetadata(shipment?.metadata))
  const canEdit = !external && Boolean(permissions?.capabilities && permissions.can("update"))
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const assignableLines = shipment?.sale_orders?.sale_order_items?.filter(
    (item) => item.status !== "completed" && (!item.shipment_id || item.shipment_id === params.id),
  ) || []
  const [selectedDraft, setSelectedDraft] = useState<{ id: string; lines: Set<string> } | null>(null)
  const selectedLines = selectedDraft?.id === params.id ? selectedDraft.lines
    : new Set(assignableLines.filter((item) => item.shipment_id === params.id).map((item) => item.id))
  const setSelectedLines = (lines: Set<string>) => setSelectedDraft({ id: params.id, lines })
  const [savingLines, setSavingLines] = useState(false)

  useEffect(() => {
    if (error) toast.error("Failed to load shipment")
  }, [error])

  const handleStatusChange = async (newStatus: string) => {
    if (!currentSite || !shipment || !canEdit) return
    if (updatingStatus) return
    setUpdatingStatus(true)
    try {
      const { data, error } = await updateShipmentStatus(currentSite.id, shipment.id, newStatus)
      if (error) toast.error(error)
      else if (data) {
        toast.success(`Status updated to ${newStatus}`)
        await refresh()
      }
    } catch {
      toast.error("Failed to update shipment status")
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSaveLineItems = async () => {
    if (!currentSite || !shipment || !canEdit) return
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
          title: shipment.tracking_number || `Shipment ${shipment.sale_orders?.order_number || shipment.id}`,
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

  const address = (shipment.shipping_address || {}) as Record<string, string | undefined>

  const openOrder = () => {
    if (shipment.sale_order_id) navigateToOrder({
      orderId: shipment.sale_order_id,
      orderNumber: shipment.sale_orders?.order_number,
      router,
    })
  }

  return (
    <div className="flex-1 p-0 min-w-0">
      <Tabs defaultValue="details">
        <StickyHeader>
          <div className="pt-0 flex-1 w-full min-w-0">
            <div className="flex items-center justify-between w-full gap-4">
              <TabsList className="shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              <div className="flex items-center overflow-x-auto min-w-0">
                <ShipmentStatusBar currentStatus={shipment.status} onStatusChange={(status) => void handleStatusChange(status)} disabled={!canEdit || updatingStatus} />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-4 lg:px-8 py-5">
          <ShipmentIdentityHeader shipment={shipment} external={external} onOpenOrder={openOrder} />
          <div className="mt-5 flex flex-col lg:flex-row border-t border-border/50">
            <div className="w-full lg:min-w-0 lg:flex-1 pt-5 lg:pr-8">
              <TabsContent value="details" className="m-0 border-0 p-0 space-y-5">
                {external ? <MarketplaceCourierCard shipment={shipment} onRefresh={refresh} /> : <TrackingCard
                  shipmentId={shipment.id}
                  initialCarrier={shipment.carrier || ""}
                  initialTracking={shipment.tracking_number || ""}
                  readOnly={!canEdit}
                  onUpdate={(carrier, tracking) =>
                    setShipment((prev) =>
                      prev ? { ...prev, carrier, tracking_number: tracking } : null
                    )
                  }
                />}

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
                              disabled={!canEdit}
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
                      disabled={!canEdit || savingLines || assignableLines.length === 0} size="sm">
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

              </TabsContent>
              <TabsContent value="timeline" className="m-0 border-0 p-0">
                <div className="w-full">
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
            <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 pt-5 lg:pl-8 lg:border-l border-border/50">
              <div className="lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)] lg:max-h-[calc(100vh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto">
                <ShipmentAboutPanel shipment={shipment} external={external} canEdit={canEdit} onOpenOrder={openOrder} onAssign={(assigned_to, name) =>
                  setShipment((prev) => prev ? { ...prev, assigned_to, assignee_profile: name ? { name } : null } : null)
                } />
              </div>
            </aside>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
