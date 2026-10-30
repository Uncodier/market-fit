"use client"

import { format } from "date-fns"
import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Archive, User } from "@/app/components/ui/icons"
import { ShipmentGpsTracker } from "./ShipmentGpsTracker"
import type { ShipmentWithRelations } from "../types"

export function ShipmentIdentityHeader({ shipment, external, onOpenOrder }: {
  shipment: ShipmentWithRelations
  external: boolean
  onOpenOrder: () => void
}) {
  const title = shipment.tracking_number || `Shipment ${shipment.sale_orders?.order_number || shipment.id}`
  const subtitle = [shipment.leads?.name || "No customer", shipment.carrier || "No carrier"].join(" · ")

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <EntityAvatar name={title} className="h-11 w-11 text-sm" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight break-words">{title}</h1>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Created {format(new Date(shipment.created_at), "MMM d, yyyy")}
            {shipment.estimated_delivery_at && ` · Expected delivery ${format(new Date(shipment.estimated_delivery_at), "MMM d, yyyy")}`}
            {external && " · Managed by marketplace"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
        {shipment.sale_order_id && (
          <Button variant="ghost" size="sm" className="h-8" onClick={onOpenOrder}>
            <Archive className="h-3.5 w-3.5 mr-1.5" /> Order
          </Button>
        )}
        {shipment.lead_id && (
          <Button variant="ghost" size="sm" className="h-8" asChild>
            <Link href={`/leads/${shipment.lead_id}`}><User className="h-3.5 w-3.5 mr-1.5" /> Customer</Link>
          </Button>
        )}
        {!external && <ShipmentGpsTracker shipmentId={shipment.id} assignedTo={shipment.assigned_to} status={shipment.status} />}
      </div>
    </div>
  )
}