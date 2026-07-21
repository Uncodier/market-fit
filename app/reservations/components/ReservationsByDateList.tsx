"use client"

import React, { useState } from "react"
import { Reservation } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, CalendarCheck, Ban, CheckCircle } from "@/app/components/ui/icons"
import { updateReservationStatus } from "../actions"
import { toast } from "sonner"
import { format, isSameDay } from "date-fns"

interface ReservationsByDateListProps {
  reservations: Reservation[]
  siteId: string
  onUpdate: () => void
}

export function ReservationsByDateList({ reservations, siteId, onUpdate }: ReservationsByDateListProps) {
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

  // Sort by start_time ascending
  const sorted = [...reservations].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  // Group by day string
  const grouped = sorted.reduce((acc, res) => {
    const dayStr = format(new Date(res.start_time), 'yyyy-MM-dd')
    if (!acc[dayStr]) acc[dayStr] = []
    acc[dayStr].push(res)
    return acc
  }, {} as Record<string, Reservation[]>)

  if (reservations.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground bg-card rounded-lg border border-dashed">
        No reservations found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([dayStr, resList]) => {
        const dateObj = new Date(resList[0].start_time)
        return (
          <div key={dayStr} className="space-y-4">
            <h3 className="font-semibold text-lg text-foreground border-b pb-2">
              {format(dateObj, 'EEEE, MMMM d, yyyy')}
            </h3>
            <div className="grid gap-4">
              {resList.map((res) => (
                <Card key={res.id} className="overflow-hidden">
                  <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="font-medium text-sm text-foreground">{format(new Date(res.start_time), 'h:mm a')} - {format(new Date(res.end_time), 'h:mm a')}</p>
                        <p className="text-xs text-muted-foreground">{res.catalog_item?.name || 'Unknown Service'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{res.lead?.name || 'Unknown Customer'}</p>
                        <p className="text-xs text-muted-foreground">{res.lead?.email || 'No email'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <Badge 
                          variant={res.status === 'confirmed' ? 'success' : res.status === 'completed' ? 'secondary' : res.status === 'pending' ? 'warning' : 'destructive'}
                          className="capitalize"
                        >
                          {res.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="ml-4">
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
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
