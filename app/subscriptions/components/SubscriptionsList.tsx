"use client"

import React, { useState } from "react"
import { Subscription } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, Play, Pause, Ban } from "@/app/components/ui/icons"
import { updateSubscriptionStatus } from "../actions"
import { toast } from "sonner"
import { format } from "date-fns"

interface SubscriptionsListProps {
  subscriptions: Subscription[]
  siteId: string
  onUpdate: () => void
}

export function SubscriptionsList({ subscriptions, siteId, onUpdate }: SubscriptionsListProps) {
  const [updating, setUpdating] = useState<string | null>(null)

  const handleStatusChange = async (id: string, status: Subscription['status']) => {
    setUpdating(id)
    const { error } = await updateSubscriptionStatus(siteId, id, status)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Subscription updated")
      onUpdate()
    }
    setUpdating(null)
  }

  // Group subscriptions by lead_id
  const grouped = subscriptions.reduce((acc, sub) => {
    if (!acc[sub.lead_id]) acc[sub.lead_id] = []
    acc[sub.lead_id].push(sub)
    return acc
  }, {} as Record<string, Subscription[]>)

  if (subscriptions.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground bg-card rounded-lg border border-dashed">
        No subscriptions found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([leadId, subs]) => {
        const lead = subs[0].lead
        return (
          <Card key={leadId} className="overflow-hidden">
            <div className="bg-muted/30 p-4 border-b">
              <h3 className="font-medium text-lg text-foreground">{lead?.name || 'Unknown Customer'}</h3>
              <p className="text-sm text-muted-foreground">{lead?.email || 'No email'}</p>
            </div>
            <div className="divide-y">
              {subs.map((sub) => (
                <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="font-medium text-sm text-foreground">{sub.catalog_item?.name || 'Unknown Item'}</p>
                      <p className="text-xs text-muted-foreground">${sub.amount} / billing cycle</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <Badge 
                        variant={sub.status === 'active' ? 'success' : sub.status === 'paused' ? 'warning' : 'destructive'}
                        className="capitalize"
                      >
                        {sub.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                      <p className="text-sm text-foreground">{format(new Date(sub.start_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Next Billing</p>
                      <p className="text-sm text-foreground">
                        {sub.next_billing_date ? format(new Date(sub.next_billing_date), 'MMM d, yyyy') : '-'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={updating === sub.id}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {sub.status !== 'active' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(sub.id, 'active')}>
                            <Play className="h-4 w-4 mr-2" /> Activate
                          </DropdownMenuItem>
                        )}
                        {sub.status === 'active' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(sub.id, 'paused')}>
                            <Pause className="h-4 w-4 mr-2" /> Pause
                          </DropdownMenuItem>
                        )}
                        {sub.status !== 'cancelled' && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(sub.id, 'cancelled')}
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
