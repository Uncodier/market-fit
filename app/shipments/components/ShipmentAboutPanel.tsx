"use client"

import Link from "next/link"
import { format } from "date-fns"
import { PropertyRow } from "@/app/leads/components/PropertyRow"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Archive, Calendar, CheckCircle2, FileText, MapPin, User } from "@/app/components/ui/icons"
import { AssigneeCard } from "./AssigneeCard"
import { LocationMapCard } from "./LocationMapCard"
import type { ShipmentWithRelations } from "../types"

export function ShipmentAboutPanel({ shipment, external, canEdit, onAssign, onOpenOrder }: {
  shipment: ShipmentWithRelations
  external: boolean
  canEdit: boolean
  onAssign: (assignee: string | null, name: string | null) => void
  onOpenOrder: () => void
}) {
  return (
    <div className="w-full min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">About</p>
      <Tabs defaultValue="info" className="w-full min-w-0">
        <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full w-full justify-start overflow-x-auto mb-3">
          <TabsTrigger value="info" className="h-7 px-3 rounded-full text-xs font-medium">Info</TabsTrigger>
          {!external && <TabsTrigger value="courier" className="h-7 px-3 rounded-full text-xs font-medium">Courier</TabsTrigger>}
          <TabsTrigger value="notes" className="h-7 px-3 rounded-full text-xs font-medium">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-0 min-w-0">
          <PropertyRow icon={<User />} label="Customer" showEmpty empty={!shipment.leads?.name} value={
            shipment.lead_id ? <Link href={`/leads/${shipment.lead_id}`} className="hover:underline">{shipment.leads?.name}</Link> : shipment.leads?.name
          } />
          <PropertyRow icon={<MapPin />} label="Origin" value={shipment.locations?.name} empty={!shipment.locations?.name} showEmpty />
          <PropertyRow icon={<Archive />} label="Order" showEmpty empty={!shipment.sale_order_id} value={
            <button type="button" onClick={onOpenOrder} className="text-left hover:underline">{shipment.sale_orders?.order_number || "View order"}</button>
          } />
          <PropertyRow icon={<Calendar />} label="Delivery" value={shipment.estimated_delivery_at ? format(new Date(shipment.estimated_delivery_at), "MMM d, yyyy") : ""} empty={!shipment.estimated_delivery_at} showEmpty />
          <PropertyRow icon={<CheckCircle2 />} label="Inventory" value={shipment.stock_decremented ? "Stock decremented" : "Not decremented"} />
        </TabsContent>
        {!external && <TabsContent value="courier" className="mt-0 min-w-0 space-y-4">
          {canEdit ? <AssigneeCard shipmentId={shipment.id} initialAssignee={shipment.assigned_to} onUpdate={onAssign} /> : (
            <PropertyRow icon={<User />} label="Courier" value={shipment.assignee_profile?.name} empty={!shipment.assignee_profile?.name} showEmpty />
          )}
          <LocationMapCard shipmentId={shipment.id} lastLat={shipment.last_lat ?? null} lastLng={shipment.last_lng ?? null} lastLocatedAt={shipment.last_located_at ?? null} />
        </TabsContent>}
        <TabsContent value="notes" className="mt-0 min-w-0">
          <PropertyRow icon={<FileText />} label="Notes" value={shipment.notes} empty={!shipment.notes} showEmpty multiline />
        </TabsContent>
      </Tabs>
      <p className="text-[11px] text-muted-foreground mt-6">
        {format(new Date(shipment.created_at), "MMM d, yyyy")}
        {shipment.updated_at && ` · Updated ${format(new Date(shipment.updated_at), "MMM d, yyyy")}`}
      </p>
    </div>
  )
}