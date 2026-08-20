"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { isInviteEmailError, siteMembersService } from "@/app/services/site-members-service"
import { useTeamMemberValidation } from "@/app/hooks/useTeamMemberValidation"
import { resendMagicLinkInvitation } from "@/app/services/magic-link-invitation-service"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { canManageTeamMembers } from "@/lib/auth/screen-access"
import {
  screensEqual,
  siteMemberToFormMember,
  formRoleToSiteMemberRole,
  formRoleToInvitationRole,
  membersToOriginalMap,
  isValidTeamEmail,
  type FormTeamMember,
  type TeamRole,
} from "./team-types"

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return (...args: Args) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

interface UseTeamMembersOptions {
  active: boolean
  siteId?: string
}

export function useTeamMembers({ active, siteId }: UseTeamMembersOptions) {
  const form = useFormContext<SiteFormValues>()
  const permissions = useOptionalPermissions()
  const canManageTeam = canManageTeamMembers(
    permissions?.capabilities?.is_owner,
    permissions?.capabilities?.role
  )
  const canEditBlockedScreens = canManageTeam
  const [teamList, setTeamList] = useState<FormTeamMember[]>(
    form.getValues("team_members") || []
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isResending, setIsResending] = useState<string | null>(null)
  const [isSavingMember, setIsSavingMember] = useState<string | null>(null)
  const [originalMembers, setOriginalMembers] = useState<Map<string, FormTeamMember>>(new Map())
  const debouncedUpdateRef = useRef<((newTeamList: FormTeamMember[]) => void) | null>(null)
  const validation = useTeamMemberValidation(teamList)

  const updateFormValues = useCallback((newTeamList: FormTeamMember[]) => {
    form.setValue("team_members", newTeamList, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    })
  }, [form])

  const applyMembers = useCallback((formattedMembers: FormTeamMember[]) => {
    setTeamList(formattedMembers)
    updateFormValues(formattedMembers)
    setOriginalMembers(membersToOriginalMap(formattedMembers))
  }, [updateFormValues])

  const applyMembersRef = useRef(applyMembers)
  applyMembersRef.current = applyMembers

  useEffect(() => {
    debouncedUpdateRef.current = debounce((newTeamList: FormTeamMember[]) => {
      updateFormValues(newTeamList)
    }, 300)
  }, [updateFormValues])

  useEffect(() => {
    if (active && teamList.length > 0) {
      window.dispatchEvent(new CustomEvent("teamMembersUpdated", {
        detail: teamList.map((member, index) => ({
          id: `team-member-${index}`,
          title: member.name || member.email || `Member ${index + 1}`,
        })),
      }))
    }
  }, [active, teamList])

  useEffect(() => {
    if (teamList.length === 0) return
    setOriginalMembers((prev) => {
      const next = new Map(prev)
      let hasUpdates = false
      teamList.forEach((member) => {
        if (member.id && !next.has(member.id)) {
          next.set(member.id, { ...member })
          hasUpdates = true
        }
      })
      return hasUpdates ? next : prev
    })
  }, [teamList])

  useEffect(() => {
    if (!active || !siteId || hasUnsavedChanges) return
    let isMounted = true

    const fetchSiteMembers = async () => {
      try {
        setIsLoading(true)
        const members = await siteMembersService.getMembers(siteId)
        if (!isMounted) return
        const formattedMembers = members.map(siteMemberToFormMember)
        if (formattedMembers.length > 0) {
          applyMembersRef.current(formattedMembers)
          return
        }
        applyMembersRef.current([])
      } catch (error) {
        if (!isMounted) return
        console.error("Error fetching site members:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to load team members"
        toast.error(errorMessage)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchSiteMembers()
    return () => {
      isMounted = false
    }
  }, [active, siteId, hasUnsavedChanges])

  const addTeamMember = useCallback(() => {
    if (isLoading) return
    const newTeamList = [{
      email: "",
      role: "view" as TeamRole,
      name: "",
      position: "",
      blocked_screens: [],
      restrict_to_assigned_only: false,
    }, ...teamList]
    setTeamList(newTeamList)
    setHasUnsavedChanges(true)
    debouncedUpdateRef.current?.(newTeamList)
  }, [isLoading, teamList])

  const removeTeamMember = async (index: number) => {
    if (isLoading) return
    const memberToRemove = teamList[index]

    if (siteId && memberToRemove.id) {
      try {
        setIsLoading(true)
        await siteMembersService.removeMember(siteId, memberToRemove.id)
        toast.success(`${memberToRemove.name || memberToRemove.email} removed from team`)
        const members = await siteMembersService.getMembers(siteId)
        applyMembers(members.map(siteMemberToFormMember))
        setHasUnsavedChanges(false)
        return
      } catch (error) {
        console.error("Error removing team member:", error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes("Cannot delete the last admin or owner")) {
          toast.error("Cannot remove the last site admin. At least one admin must remain.")
        } else {
          toast.error("Failed to remove team member")
        }
        return
      } finally {
        setIsLoading(false)
      }
    }

    const newTeamList = teamList.filter((_, i) => i !== index)
    setTeamList(newTeamList)
    setHasUnsavedChanges(newTeamList.some((member) => !member.id && member.email.trim() !== ""))
    debouncedUpdateRef.current?.(newTeamList)
  }

  const updateLocalTeamMember = (index: number, field: keyof FormTeamMember, value: unknown) => {
    const newTeamList = [...teamList]
    newTeamList[index] = { ...newTeamList[index], [field]: value }
    setTeamList(newTeamList)
    setHasUnsavedChanges(true)
    debouncedUpdateRef.current?.(newTeamList)
  }

  const hasMemberChanges = (member: FormTeamMember): boolean => {
    if (!member.id) return false
    const original = originalMembers.get(member.id)
    if (!original) return false
    return (
      (member.name || "") !== (original.name || "") ||
      (member.position || "") !== (original.position || "") ||
      member.role !== original.role ||
      !screensEqual(member.blocked_screens, original.blocked_screens) ||
      (member.restrict_to_assigned_only || false) !== (original.restrict_to_assigned_only || false)
    )
  }

  const canSaveMember = (member: FormTeamMember): boolean => {
    if (!member.id || !hasMemberChanges(member)) return false
    const original = originalMembers.get(member.id)
    if (!original) return false
    if (member.role !== original.role) return validation.canChangeRole(member)
    return true
  }

  const handleSaveMember = async (member: FormTeamMember) => {
    if (!siteId || !member.id) {
      toast.error("Cannot save: member ID is required")
      return
    }
    if (!hasMemberChanges(member)) {
      toast.info("No changes to save")
      return
    }

    try {
      setIsSavingMember(member.id)
      const siteMemberRole = formRoleToSiteMemberRole(member.role)
      await siteMembersService.updateMember(siteId, member.id, {
        role: siteMemberRole,
        name: member.name,
        position: member.position,
        blocked_screens: siteMemberRole === "admin" ? [] : (member.blocked_screens || []),
        restrict_to_assigned_only: member.restrict_to_assigned_only || false,
      })
      toast.success(`${member.name || member.email} updated successfully`)
      const members = await siteMembersService.getMembers(siteId)
      applyMembers(members.map(siteMemberToFormMember))
    } catch (error) {
      console.error("Error saving team member:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      if (errorMessage.includes("Cannot change role of the last admin")) {
        toast.error("Cannot change role of the last admin or owner. At least one admin must remain.")
      } else {
        toast.error(`Failed to save changes: ${errorMessage}`)
      }
    } finally {
      setIsSavingMember(null)
    }
  }

  const handleSaveTeamMembers = async () => {
    if (!siteId) {
      toast.error("Site ID is required")
      return
    }

    try {
      setIsSaving(true)
      const newMembers = teamList.filter(
        (member) => isValidTeamEmail(member.email) && !member.id
      )
      const invalidEmails = teamList.filter(
        (member) => !member.id && member.email.trim() !== "" && !isValidTeamEmail(member.email)
      )
      if (invalidEmails.length > 0) {
        toast.error("Enter a valid email before sending an invitation")
      }
      if (newMembers.length === 0) {
        if (invalidEmails.length === 0) toast.info("No new members to save")
        setHasUnsavedChanges(false)
        return
      }

      const savedMembers = []
      for (const member of newMembers) {
        try {
          savedMembers.push(await siteMembersService.addMember(
            siteId,
            {
              email: member.email,
              role: formRoleToSiteMemberRole(member.role),
              name: member.name,
              position: member.position,
              blocked_screens: member.blocked_screens || [],
              restrict_to_assigned_only: member.restrict_to_assigned_only || false,
            },
            form.getValues().name || "Your Site"
          ))
        } catch (memberError) {
          if (isInviteEmailError(memberError)) {
            savedMembers.push(memberError.member)
            toast.error(`Member added but invitation failed for ${member.email}: ${memberError.message}`)
            continue
          }
          console.error(`Failed to save ${member.email}:`, memberError)
          const errorMessage = memberError instanceof Error ? memberError.message : "Unknown error"
          toast.error(`Failed to save ${member.email}: ${errorMessage}`)
        }
      }

      if (savedMembers.length > 0) {
        toast.success(`Successfully added ${savedMembers.length} team member(s)!`)
        const members = await siteMembersService.getMembers(siteId)
        applyMembers(members.map(siteMemberToFormMember))
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error("Error saving team members:", error)
      toast.error("Failed to save team members")
    } finally {
      setIsSaving(false)
    }
  }

  const handleResendInvitation = async (member: FormTeamMember) => {
    if (!siteId || !member.email || !member.id) {
      toast.error("Cannot resend invitation: missing required information")
      return
    }

    try {
      setIsResending(member.id)
      const result = await resendMagicLinkInvitation({
        email: member.email,
        siteId,
        siteName: form.getValues().name || "Your Site",
        role: formRoleToInvitationRole(member.role),
        name: member.name,
        position: member.position,
      })
      if (result.success) {
        toast.success(`Magic link invitation resent to ${member.name || member.email}`)
        return
      }
      if (result.code === "RATE_LIMIT_EXCEEDED") {
        toast.error(`Rate limit exceeded. Please wait ${result.retryAfter || 60} seconds before resending to ${member.email}`)
      } else if (result.code === "SIGNUP_DISABLED") {
        toast.error("User registration is currently disabled. Please contact support.")
      } else {
        toast.error(result.error || "Failed to resend invitation")
      }
    } catch (error) {
      console.error("Error resending invitation:", error)
      toast.error("Failed to resend invitation")
    } finally {
      setIsResending(null)
    }
  }

  return {
    teamList,
    isLoading,
    isSaving,
    isResending,
    isSavingMember,
    canEditBlockedScreens,
    canManageTeam,
    validation,
    addTeamMember,
    removeTeamMember,
    updateLocalTeamMember,
    hasMemberChanges,
    canSaveMember,
    handleSaveMember,
    handleSaveTeamMembers,
    handleResendInvitation,
  }
}
