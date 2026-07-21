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
import { format } from "date-fns"

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

  // Group reservations by catalog_item_id
  const grouped = reservations.reduce((acc, res) => {
    if (!acc[res.catalog_item_id]) acc[res.catalog_item_id] = []
    acc[res.catalog_item_id].push(res)
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
      {Object.entries(grouped).map(([itemId, resList]) => {
        const item = resList[0].catalog_item
        return (
          <Card key={itemId} className="overflow-hidden">
            <div className="bg-muted/30 p-4 border-b">
              <h3 className="font-medium text-lg text-foreground">{item?.name || 'Unknown Service'}</h3>
            </div>
            <div className="divide-y">
              {resList.map((res) => (
                <div key={res.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Start</p>
                      <p className="text-sm text-foreground">{format(new Date(res.start_time), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">End</p>
                      <p className="text-sm text-foreground">{format(new Date(res.end_time), 'MMM d, yyyy h:mm a')}</p>
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
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
