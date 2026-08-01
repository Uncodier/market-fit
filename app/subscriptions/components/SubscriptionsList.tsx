"use client"

import React, { useState } from "react"
import { Subscription } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, Play, Pause, Ban, Repeat } from "@/app/components/ui/icons"
import { updateSubscriptionStatus } from "../actions"
import { toast } from "sonner"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Next Billing</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-16"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="h-48 text-center">
              <EmptyCard 
                icon={<Repeat size={24} className="text-muted-foreground" />}
                title="No subscriptions found"
                description="When customers purchase recurring plans, they will appear here."
                className="border-0 shadow-none bg-transparent"
              />
            </TableCell>
          </TableRow>
        ) : (
          subscriptions.map((sub) => (
            <TableRow key={sub.id} className="hover:bg-muted/50 transition-colors">
              <TableCell>
                <p className="font-medium text-sm text-foreground">{sub.lead?.name || 'Unknown Customer'}</p>
                <p className="text-xs text-muted-foreground">{sub.lead?.email || 'No email'}</p>
              </TableCell>
              <TableCell>
                <span className="font-medium text-foreground">{sub.catalog_item?.name || 'Unknown Item'}</span>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={sub.status === 'active' ? 'success' : sub.status === 'paused' ? 'warning' : 'destructive'}
                  className="capitalize"
                >
                  {sub.status}
                </Badge>
              </TableCell>
              <TableCell>
                {sub.start_date && !isNaN(new Date(sub.start_date).getTime()) ? format(new Date(sub.start_date), 'MMM d, yyyy') : '-'}
              </TableCell>
              <TableCell>
                {sub.end_date && !isNaN(new Date(sub.end_date).getTime()) ? format(new Date(sub.end_date), 'MMM d, yyyy') : '-'}
              </TableCell>
              <TableCell>
                {sub.next_billing_date && !isNaN(new Date(sub.next_billing_date).getTime()) ? format(new Date(sub.next_billing_date), 'MMM d, yyyy') : '-'}
              </TableCell>
              <TableCell className="text-right font-medium">
                ${sub.amount} <span className="text-xs text-muted-foreground font-normal">/ billing cycle</span>
              </TableCell>
              <TableCell>
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
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
