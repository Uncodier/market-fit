"use client"

import React, { useState } from "react"
import { Reservation } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { Calendar as CalendarIcon } from "@/app/components/ui/icons"
import { updateReservationStatus } from "../actions"
import { toast } from "sonner"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ReservationAttestationCell } from "./ReservationAttestationCell"
import { ReservationCustomerCell } from "./ReservationCustomerCell"
import { ReservationRowActions } from "./ReservationRowActions"

interface ReservationsListProps {
  reservations: Reservation[]
  siteId: string
  onUpdate: () => void
}

export function ReservationsList({ reservations, siteId, onUpdate }: ReservationsListProps) {
  const { t } = useLocalization()
  const [updating, setUpdating] = useState<string | null>(null)

  const handleStatusChange = async (id: string, status: Reservation['status']) => {
    setUpdating(id)
    const { error } = await updateReservationStatus(siteId, id, status)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("reservations.toast.updated"))
      onUpdate()
    }
    setUpdating(null)
  }

  const grouped = reservations.reduce((acc, res) => {
    const type = res.resource_type || 'catalog_item'
    const serviceName =
      type === 'location'
        ? (res.location?.name || t("visits.resource.locationFallback"))
        : type === 'employee'
          ? t("visits.resource.teamFallback")
          : (res.catalog_item?.name || t("reservations.resource.unknownService"))
    if (!acc[serviceName]) acc[serviceName] = []
    acc[serviceName].push(res)
    return acc
  }, {} as Record<string, Reservation[]>)

  if (reservations.length === 0) {
    return (
      <div className="p-8">
        <EmptyCard 
          icon={<CalendarIcon className="h-10 w-10 text-muted-foreground" />}
          title={t("reservations.empty.title")}
          description={t("reservations.empty.description")}
          className="border-0 shadow-none bg-transparent"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {Object.entries(grouped).map(([serviceName, resList]) => (
        <div key={serviceName} className="flex flex-col border-b border-border last:border-0">
          <div className="px-6 py-3 bg-muted/30 border-b border-border flex items-center">
            <h3 className="font-medium text-sm text-foreground">{serviceName}</h3>
            <Badge variant="secondary" className="ml-2 bg-background">{resList.length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">{t("reservations.table.customer")}</TableHead>
                <TableHead>{t("reservations.table.status")}</TableHead>
                <TableHead>{t("reservations.table.attestation")}</TableHead>
                <TableHead>{t("reservations.table.date")}</TableHead>
                <TableHead>{t("reservations.table.time")}</TableHead>
                <TableHead className="w-16 pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resList.map((res) => (
                <TableRow key={res.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="pl-6">
                    <ReservationCustomerCell reservation={res} siteId={siteId} />
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={res.status === 'confirmed' ? 'success' : res.status === 'completed' ? 'secondary' : res.status === 'pending' ? 'warning' : 'destructive'}
                      className="capitalize"
                    >
                      {t(`reservations.status.${res.status}`) || res.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ReservationAttestationCell reservation={res} siteId={siteId} />
                  </TableCell>
                  <TableCell>
                    {format(new Date(res.start_time), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {format(new Date(res.start_time), 'h:mm a')} - {format(new Date(res.end_time), 'h:mm a')}
                  </TableCell>
                  <TableCell className="pr-6">
                    <ReservationRowActions
                      reservation={res}
                      siteId={siteId}
                      updating={updating === res.id}
                      onStatusChange={handleStatusChange}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}
