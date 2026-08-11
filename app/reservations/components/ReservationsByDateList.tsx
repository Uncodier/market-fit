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
import { reservationResourceLabel } from "@/app/visits/visit-helpers"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ReservationAttestationCell } from "./ReservationAttestationCell"
import { ReservationCustomerCell } from "./ReservationCustomerCell"
import { ReservationRowActions } from "./ReservationRowActions"

interface ReservationsByDateListProps {
  reservations: Reservation[]
  siteId: string
  onUpdate: () => void
}

export function ReservationsByDateList({ reservations, siteId, onUpdate }: ReservationsByDateListProps) {
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

  const sorted = [...reservations].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  const grouped = sorted.reduce((acc, res) => {
    const dayStr = format(new Date(res.start_time), 'yyyy-MM-dd')
    if (!acc[dayStr]) acc[dayStr] = []
    acc[dayStr].push(res)
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
      {Object.entries(grouped).map(([dayStr, resList]) => {
        const dateObj = new Date(resList[0].start_time)
        return (
          <div key={dayStr} className="flex flex-col border-b border-border last:border-0">
            <div className="px-6 py-3 bg-muted/30 border-b border-border flex items-center">
              <h3 className="font-medium text-sm text-foreground">
                {format(dateObj, 'EEEE, MMMM d, yyyy')}
              </h3>
              <Badge variant="secondary" className="ml-2 bg-background">{resList.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">{t("reservations.table.time")}</TableHead>
                  <TableHead>{t("reservations.table.service")}</TableHead>
                  <TableHead>{t("reservations.table.customer")}</TableHead>
                  <TableHead>{t("reservations.table.status")}</TableHead>
                  <TableHead>{t("reservations.table.attestation")}</TableHead>
                  <TableHead className="w-16 pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resList.map((res) => (
                  <TableRow key={res.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="pl-6">
                      <span className="font-medium text-foreground">{format(new Date(res.start_time), 'h:mm a')}</span> - {format(new Date(res.end_time), 'h:mm a')}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {reservationResourceLabel({
                          resource_type: res.resource_type,
                          catalog_item: res.catalog_item,
                          location: res.location,
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
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
        )
      })}
    </div>
  )
}
