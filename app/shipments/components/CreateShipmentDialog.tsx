"use client"

import { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogForm,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { listLocations } from "@/app/inventory/actions"
import { listOrders, getOrder } from "@/app/orders/actions"
import { createShipment, generateTrackingNumber } from "@/app/shipments/actions"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { Checkbox } from "@/app/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { listSiteCouriers, SiteCourier } from "../site-couriers"

export function CreateShipmentDialog() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [locations, setLocations] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [siteMembers, setSiteMembers] = useState<SiteCourier[]>([])

  const [orderValue, setOrderValue] = useState<RelationSelectValue>(null)
  const [selectedLocation, setSelectedLocation] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [carrier, setCarrier] = useState("")
  const [assignedTo, setAssignedTo] = useState("unassigned")

  const [orderItems, setOrderItems] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    const handleOpen = () => setOpen(true)
    window.addEventListener("shipments:create", handleOpen)
    return () => window.removeEventListener("shipments:create", handleOpen)
  }, [])

  useEffect(() => {
    if (open && currentSite) {
      listLocations(currentSite.id).then((res) => {
        if (res.data) {
          setLocations(res.data)
          const defaultLoc = res.data.find((l: any) => l.is_default) || res.data[0]
          if (defaultLoc) setSelectedLocation(defaultLoc.id)
        }
      })

      listOrders({ siteId: currentSite.id, pageSize: 100 }).then((res) => {
        if (res.data) setOrders(res.data)
      })

      listSiteCouriers(currentSite.id).then(setSiteMembers)
    } else if (!open) {
      setOrderValue(null)
      setTrackingNumber("")
      setCarrier("")
      setAssignedTo("unassigned")
      setOrderItems([])
      setSelectedItems(new Set())
    }
  }, [open, currentSite])

  useEffect(() => {
    if (!orderValue || orderValue.mode !== "existing" || !currentSite) {
      setOrderItems([])
      setSelectedItems(new Set())
      return
    }

    const fetchItems = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("sale_order_items")
        .select("id, name, quantity, shipment_id")
        .eq("sale_order_id", orderValue.id)
        .eq("site_id", currentSite.id)
        .is("shipment_id", null)

      if (data) {
        setOrderItems(data)
        setSelectedItems(new Set(data.map((i) => i.id)))
      }
    }
    fetchItems()
  }, [orderValue, currentSite])

  const handleGenerateTracking = async () => {
    if (!currentSite) return
    const num = await generateTrackingNumber(currentSite.id)
    setTrackingNumber(num)
  }

  const handleSave = async () => {
    if (!currentSite) return
    if (!selectedLocation) {
      toast.error(t("shipments.selectLocationError") || "Please select an origin location")
      return
    }
    if (!orderValue || orderValue.mode !== "existing") {
      toast.error(t("shipments.selectOrderError") || "Please select an order")
      return
    }

    setSaving(true)

    try {
      const orderRes = await getOrder(orderValue.id)
      if (orderRes.error || !orderRes.data) {
        throw new Error(orderRes.error || "Order not found")
      }
      const order = orderRes.data

      const supabase = createClient()
      const session = await supabase.auth.getSession()
      const userId = session.data.session?.user.id
      if (!userId) throw new Error("Not authenticated")

      const leadId =
        (order as any).leads?.id ||
        (order as any).sales?.lead_id ||
        undefined

      const res = await createShipment({
        siteId: currentSite.id,
        saleOrderId: orderValue.id,
        saleId: order.sale_id || undefined,
        leadId,
        originLocationId: selectedLocation,
        shippingAddress: order.shipping_address,
        carrier: carrier || undefined,
        trackingNumber: trackingNumber || undefined,
        assignedTo: assignedTo !== "unassigned" ? assignedTo : undefined,
        itemIds: Array.from(selectedItems),
        userId,
      })

      if (res.error) throw new Error(res.error)

      toast.success(t("shipments.created") || "Shipment created successfully")
      setOpen(false)
      if (res.data) {
        router.push(`/shipments/${res.data.id}`)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create shipment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="md" busy={saving}>
        <DialogForm onSubmit={(e) => { e.preventDefault(); void handleSave() }}>
        <DialogHeader>
          <DialogTitle>{t("shipments.createTitle") || "Create Shipment"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="space-y-2">
            <Label>{t("shipments.order") || "Order"}</Label>
            <RelationSelect
              options={orders.map((o) => ({
                id: o.id,
                label: o.order_number || o.id,
                searchText: `${o.order_number || ""} ${o.leads?.name || ""}`,
              }))}
              value={orderValue}
              onValueChange={setOrderValue}
              allowCreate={false}
              placeholder={t("shipments.selectOrder") || "Select an order..."}
              emptyMessage="No orders found"
            />
          </div>

          {orderItems.length > 0 && (
            <div className="space-y-2 border rounded-md p-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">
                {t("shipments.lineItems") || "Line Items"}
              </Label>
              <div className="space-y-2 mt-2">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`item-${item.id}`}
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedItems)
                        if (checked) next.add(item.id)
                        else next.delete(item.id)
                        setSelectedItems(next)
                      }}
                    />
                    <label
                      htmlFor={`item-${item.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {item.quantity}x {item.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("shipments.originLocation") || "Origin Location"}</Label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder={t("shipments.selectLocation") || "Select location..."} />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} {loc.is_default ? "(Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("shipments.assignedTo") || "Assign Courier"}</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder={t("shipments.unassigned") || "Unassigned"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  {t("shipments.unassigned") || "Unassigned"}
                </SelectItem>
                {siteMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border rounded-md p-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
              {t("shipments.trackingInfo") || "Tracking Info (Optional)"}
            </Label>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("shipments.carrier") || "Carrier"}</Label>
                <Input
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g. UPS, FedEx, Internal"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("shipments.trackingNumber") || "Tracking Number"}</Label>
                <div className="flex gap-2">
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Tracking code"
                  />
                  <Button type="button" variant="outline" onClick={handleGenerateTracking}>
                    {t("shipments.generate") || "Generate"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button type="submit" disabled={saving || !orderValue || !selectedLocation}>
            {saving ? t("common.saving") || "Saving..." : t("common.create") || "Create"}
          </Button>
        </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
