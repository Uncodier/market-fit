"use client"

import React, { useState } from "react"
import { Reservation } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, CalendarCheck, Ban, CheckCircle, Calendar as CalendarIcon } from "@/app/components/ui/icons"
import { updateReservationStatus } from "../actions"
import { toast } from "sonner"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"

interface ReservationsListProps {
  reservations: Reservation[]
  siteId: string
  onUpdate: () => void
}

export function ReservationsList({ reservations, siteId, onUpdate }: ReservationsListProps) {
  const [updating, setUpdating] = useState<string | null>(null)

  const handleStatusChange = async (id: string, status: Reservation['status']) => {
    setUpdating(id)
    const { error } = await updateReservationStatus(siteId, id, status)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Reservation updated")
      onUpdate()
    }
    setUpdating(null)
  }

  const grouped = reservations.reduce((acc, res) => {
    const serviceName = res.catalog_item?.name || 'Unknown Service'
    if (!acc[serviceName]) acc[serviceName] = []
    acc[serviceName].push(res)
    return acc
  }, {} as Record<string, Reservation[]>)

  if (reservations.length === 0) {
    return (
      <div className="p-8">
        <EmptyCard 
          icon={<CalendarIcon className="h-10 w-10 text-muted-foreground" />}
          title="No reservations found"
          description="When customers book your services, they will appear here."
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
                <TableHead className="pl-6">Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="w-16 pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resList.map((res) => (
                <TableRow key={res.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="pl-6">
                    <p className="font-medium text-sm text-foreground">{res.lead?.name || 'Unknown Customer'}</p>
                    <p className="text-xs text-muted-foreground">{res.lead?.email || 'No email'}</p>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={res.status === 'confirmed' ? 'success' : res.status === 'completed' ? 'secondary' : res.status === 'pending' ? 'warning' : 'destructive'}
                      className="capitalize"
                    >
                      {res.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(res.start_time), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {format(new Date(res.start_time), 'h:mm a')} - {format(new Date(res.end_time), 'h:mm a')}
                  </TableCell>
                  <TableCell className="pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={updating === res.id}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {res.status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(res.id, 'confirmed')}>
                            <CalendarCheck className="h-4 w-4 mr-2" /> Confirm
                          </DropdownMenuItem>
                        )}
                        {res.status === 'confirmed' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(res.id, 'completed')}>
                            <CheckCircle className="h-4 w-4 mr-2" /> Mark Completed
                          </DropdownMenuItem>
                        )}
                        {res.status !== 'cancelled' && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(res.id, 'cancelled')}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Ban className="h-4 w-4 mr-2" /> Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
