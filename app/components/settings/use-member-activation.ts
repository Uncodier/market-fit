"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { siteMembersService, type SiteMember } from "@/app/services/site-members-service"
import { emitBillingLimit, isBillingUpgradeRequired } from "@/lib/billing-limit-errors"
import type { FormTeamMember } from "./team-types"

interface MemberActivationOptions {
  siteId?: string
  canManageTeam: boolean
  busy: boolean
  onMembersUpdated: (members: SiteMember[]) => void
  refreshLicense: () => Promise<void>
}

export function useMemberActivation({ siteId, canManageTeam, busy, onMembersUpdated, refreshLicense }: MemberActivationOptions) {
  const [isUpdatingMember, setIsUpdatingMember] = useState<string | null>(null)
  const inFlight = useRef(false)
  const currentSite = useRef(siteId)
  currentSite.current = siteId

  const handleSetMemberEnabled = async (member: FormTeamMember, enabled: boolean) => {
    if (!siteId || !member.id || !canManageTeam || busy || inFlight.current || member.originalRole === "owner" || member.is_primary_owner) return
    if (member.status !== "active" && member.status !== "pending") return
    inFlight.current = true
    setIsUpdatingMember(member.id)
    try {
      const updated = await siteMembersService.setMemberEnabled(siteId, member.id, enabled)
      if (currentSite.current !== siteId) return
      onMembersUpdated([updated])
      toast.success(enabled
        ? `${member.name || member.email} reactivated`
        : `${member.name || member.email} deactivated. Their records are preserved.`)

      // A freed seat can restore another automatically suspended member.
      const [members] = await Promise.allSettled([siteMembersService.getMembers(siteId), refreshLicense()])
      if (currentSite.current !== siteId) return
      if (members.status === "fulfilled") onMembersUpdated(members.value)
      else toast.error("Member updated, but the team list could not be refreshed. Reload to see the latest status.")
    } catch (error) {
      if (currentSite.current !== siteId) return
      if (isBillingUpgradeRequired(error)) {
        emitBillingLimit(error.payload)
        return
      }
      toast.error("Could not change member activation. Please try again.")
    } finally {
      inFlight.current = false
      setIsUpdatingMember(null)
    }
  }

  return { isUpdatingMember, handleSetMemberEnabled }
}