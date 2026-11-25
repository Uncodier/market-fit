"use client"

import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal } from "@/app/components/ui/icons"
import type { LeadMessageRecipient } from "./NewLeadMessage"
import { useLeadMessageMenu } from "./use-lead-message-menu"

export function LeadCardOptions({ lead }: { lead: LeadMessageRecipient }) {
  const messageMenu = useLeadMessageMenu(lead)
  if (!messageMenu.available) return null

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id={messageMenu.triggerId} variant="ghost" size="icon" className="ml-1 h-8 w-8 shrink-0" aria-label={`Options for ${lead.name}`} title="Options"
          onClick={event => event.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={messageMenu.onMenuCloseAutoFocus}>
        {messageMenu.item}
      </DropdownMenuContent>
    </DropdownMenu>
    {messageMenu.dialog}
  </>
}