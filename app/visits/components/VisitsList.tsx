"use client"

import { format } from "date-fns"
import type { Reservation } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PenTool } from "@/app/components/ui/icons"
import { reservationResourceLabel } from "../visit-helpers"

export function VisitsList({
  visits,
  assigneeNames = {},
}: {
  visits: Reservation[]
  assigneeNames?: Record<string, string>
}) {
  if (visits.length === 0) {
    return (
      <div className="p-8">
        <EmptyCard
          icon={<PenTool className="h-10 w-10 text-muted-foreground" />}
          title="No visits registered"
          description="Register a visit to create a completed attendance record with Visit Terms."
          className="border-0 shadow-none bg-transparent"
        />
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Customer</TableHead>
          <TableHead>Resource</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>When</TableHead>
          <TableHead className="pr-6">Attestation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visits.map((visit) => {
          const label = reservationResourceLabel({
            resource_type: visit.resource_type,
            catalog_item: visit.catalog_item,
            location: visit.location,
            assignee_name: visit.assignee_user_id ? assigneeNames[visit.assignee_user_id] : null,
          })
          return (
            <TableRow key={visit.id}>
              <TableCell className="pl-6">
                <p className="font-medium text-sm">{visit.lead?.name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{visit.lead?.email || "—"}</p>
              </TableCell>
              <TableCell>
                <p className="text-sm">{label}</p>
                <p className="text-xs text-muted-foreground capitalize">{(visit.resource_type || "catalog_item").replace("_", " ")}</p>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {visit.channel || "physical"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {format(new Date(visit.start_time), "MMM d, yyyy h:mm a")}
              </TableCell>
              <TableCell className="pr-6">
                <div className="flex flex-wrap gap-1">
                  {visit.terms_accepted_at && <Badge variant="outline">Terms</Badge>}
                  {visit.signature_url && <Badge variant="outline">Signed</Badge>}
                  {visit.photo_url && <Badge variant="outline">Photo</Badge>}
                  {visit.id_url && <Badge variant="outline">ID</Badge>}
                  {!visit.terms_accepted_at &&
                    !visit.signature_url &&
                    !visit.photo_url &&
                    !visit.id_url && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
