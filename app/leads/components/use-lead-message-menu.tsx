"use client"

import { useId, useState } from "react"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useSite } from "@/app/context/SiteContext"
import { DropdownMenuItem } from "@/app/components/ui/dropdown-menu"
import { Mail } from "@/app/components/ui/icons"
import { isRealSiteId } from "@/lib/demo-utils"
import { NewLeadMessageDialog, type LeadMessageRecipient } from "./NewLeadMessage"

export function useLeadMessageMenu(lead: LeadMessageRecipient, singleLead = true) {
  const { currentSite } = useSite()
  const permissions = useOptionalPermissions()
  const triggerId = useId()
  const [openFor, setOpenFor] = useState<string>()
  const scope = `${currentSite?.id}:${lead.id}`
  const open = openFor === scope
  const available = Boolean(singleLead && isRealSiteId(currentSite?.id) && (!permissions || permissions.can("insert")))

  return {
    available,
    triggerId,
    onMenuCloseAutoFocus: (event: Event) => { if (open && available) event.preventDefault() },
    item: available && <DropdownMenuItem onClick={event => event.stopPropagation()} onSelect={() => setOpenFor(scope)}>
      <Mail className="mr-2 h-4 w-4" /> New Message
    </DropdownMenuItem>,
    dialog: available && currentSite && <div className="contents" onClick={event => event.stopPropagation()}>
      <NewLeadMessageDialog key={scope} site={currentSite} lead={lead} open={open}
        onOpenChange={next => setOpenFor(next ? scope : undefined)} onCloseAutoFocus={event => {
          event.preventDefault()
          document.getElementById(triggerId)?.focus()
        }} />
    </div>,
  }
}