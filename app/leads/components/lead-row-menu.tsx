"use client"

import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  CheckCircle2,
  Loader,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "@/app/components/ui/icons"
import { Lead } from "@/app/leads/types"
import { LeadActionKind } from "./use-lead-table-actions"

export function LeadRowMenu({
  lead,
  leadCount = 1,
  loading,
  success,
  onResearch,
  onFollowUp,
  onInvalidate,
  onEdit,
  onConversation,
  onDelete,
}: {
  lead: Lead
  leadCount?: number
  loading: LeadActionKind | null
  success: LeadActionKind | null
  onResearch: () => void
  onFollowUp: () => void
  onInvalidate: () => void
  onEdit: () => void
  onConversation: () => void
  onDelete?: () => void
}) {
  const bulk = leadCount > 1

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="sr-only">Open actions</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onResearch() }} disabled={loading === "research"}>
          {loading === "research" ? <Loader className="mr-2 h-4 w-4" /> : success === "research" ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : <Search className="mr-2 h-4 w-4" />}
          {bulk ? `Research all ${leadCount} leads` : "Lead Research"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onFollowUp() }} disabled={loading === "followup"}>
          {loading === "followup" ? <Loader className="mr-2 h-4 w-4" /> : success === "followup" ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : <Mail className="mr-2 h-4 w-4" />}
          {bulk ? `Follow-up all ${leadCount} leads` : "Lead Follow Up"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onInvalidate() }} disabled={loading === "invalidation"}>
          {loading === "invalidation" ? <Loader className="mr-2 h-4 w-4" /> : success === "invalidation" ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : <X className="mr-2 h-4 w-4" />}
          {bulk ? `Invalidate all ${leadCount} leads` : "Lead Invalidation"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onEdit() }}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Lead
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onConversation() }} disabled={loading === "newConversation"}>
          {loading === "newConversation" ? <Loader className="mr-2 h-4 w-4" /> : success === "newConversation" ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : <MessageSquare className="mr-2 h-4 w-4" />}
          New Conversation
        </DropdownMenuItem>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(event) => { event.stopPropagation(); onDelete() }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Lead
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
