"use client"

import { useState } from "react"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { Lead } from "@/app/leads/types"
import { LeadPaymentDialog } from "./LeadPaymentDialog"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  CreditCard,
  Loader,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "@/app/components/ui/icons"

export type LeadDetailActionKind = "research" | "followup" | "invalidation" | "newConversation"

export function LeadActionsMenu({
  lead,
  loading,
  onResearch,
  onFollowUp,
  onInvalidate,
  onEdit,
  onConversation,
  onDelete,
}: {
  lead: Pick<Lead, "id" | "name">
  loading: LeadDetailActionKind | null
  onResearch: () => void
  onFollowUp: () => void
  onInvalidate: () => void
  onEdit: () => void
  onConversation: () => void
  onDelete?: () => void
}) {
  const [paymentOpen, setPaymentOpen] = useState(false)
  const permissions = useOptionalPermissions()
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onResearch} disabled={loading === "research"}>
          {loading === "research" ? <Loader className="mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
          Lead Research
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFollowUp} disabled={loading === "followup"}>
          {loading === "followup" ? <Loader className="mr-2 h-4 w-4" /> : <Mail className="mr-2 h-4 w-4" />}
          Lead Follow Up
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onInvalidate} disabled={loading === "invalidation"}>
          {loading === "invalidation" ? <Loader className="mr-2 h-4 w-4" /> : <X className="mr-2 h-4 w-4" />}
          Lead Invalidation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit fields
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { if (permissions?.can("update") ?? true) setPaymentOpen(true) }} disabled={!(permissions?.can("update") ?? true)}>
          <CreditCard className="mr-2 h-4 w-4" />
          Settle balance / Add payment
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onConversation} disabled={loading === "newConversation"}>
          {loading === "newConversation" ? (
            <Loader className="mr-2 h-4 w-4" />
          ) : (
            <MessageSquare className="mr-2 h-4 w-4" />
          )}
          New Conversation
        </DropdownMenuItem>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Lead
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <LeadPaymentDialog leadId={lead.id} leadName={lead.name} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </>
  )
}
