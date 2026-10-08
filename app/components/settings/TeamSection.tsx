"use client"

import { PlusCircle, User } from "../ui/icons"
import { Button } from "../ui/button"
import { EmptyCard } from "../ui/empty-card"
import { TeamMemberCard } from "./TeamMemberCard"
import { useTeamMembers } from "./use-team-members"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Badge } from "../ui/badge"
import { licensePlanLabel } from "@/lib/license-entitlements"
import { teamMembersInDisplayOrder } from "./team-types"

interface TeamSectionProps {
  active: boolean
  siteId?: string
}

export function TeamSection({ active, siteId }: TeamSectionProps) {
  const { t } = useLocalization()
  const {
    teamList,
    license,
    licenseError,
    refreshLicense,
    isLoading,
    isSaving,
    isResending,
    isSavingMember,
    isUpdatingMember,
    handleSetMemberEnabled,
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
  } = useTeamMembers({ active, siteId })

  if (!active) return null

  return (
    <div id="team-members" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t("settings.nav.teamMembers") || "Team Members"}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("settings.team.description") || "Invite team members to collaborate on your site"}
          </p>
          {license && license.siteId === siteId && (
            <p className="text-xs text-muted-foreground mt-2" aria-label="Member license usage">
              {license.current} / {license.limit ?? ">10"} members · {licensePlanLabel(license.plan)} · per site<br />
              Includes the owner, active members, and pending invitations.
              {typeof license.total === "number" && license.total > license.current && <><br />{license.total} total members, including license-suspended members.</>}
            </p>
          )}
          {licenseError && <p className="text-xs text-destructive mt-2" role="status">Member license could not be loaded. Refresh before inviting members.</p>}
          <Button type="button" variant="ghost" size="sm" onClick={refreshLicense} disabled={isLoading || isSaving || !!isUpdatingMember}>
            Refresh member license
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTeamMember}
          disabled={isLoading || isSaving || !!isUpdatingMember || !canManageTeam || !license || license.siteId !== siteId}
          data-permission="allow"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("settings.team.inviteNew") || "Invite New Member to Team"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-muted/40 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : teamList.length === 0 ? (
        <EmptyCard
          icon={<User className="h-10 w-10" />}
          title={t("settings.team.emptyTitle") || "No team members yet"}
          description={t("settings.team.emptyDescription") || "Invite team members to collaborate on your site and manage operations."}
          variant="fancy"
        />
      ) : (
        teamMembersInDisplayOrder(teamList).map(({ member, index }) => (
          <div key={member.id || `new-${index}`} className="space-y-2">
            {member.manually_disabled ? (
              <Badge variant="outline">
                Deactivated · no member license used · records preserved · reactivate manually
              </Badge>
            ) : member.license_suspended && (
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                License suspended · {member.name || member.email} · access resumes when the site license has capacity
              </Badge>
            )}
            <TeamMemberCard
              member={member}
              index={index}
              canEditBlockedScreens={canEditBlockedScreens}
              canManageTeam={canManageTeam}
              isLoading={isLoading}
              isSaving={isSaving || !!isUpdatingMember}
              isSavingThis={isSavingMember === member.id}
              isResendingThis={isResending === member.id}
              isUpdatingStatus={isUpdatingMember === member.id}
              hasChanges={hasMemberChanges(member)}
              canSave={canSaveMember(member)}
              validation={validation}
              onUpdate={(field, value) => updateLocalTeamMember(index, field, value)}
              onSave={() => handleSaveMember(member)}
              onSaveInvite={handleSaveTeamMembers}
              onRemove={() => removeTeamMember(index)}
              onResend={() => handleResendInvitation(member)}
              onEnabledChange={(enabled) => handleSetMemberEnabled(member, enabled)}
            />
          </div>
        ))
      )}
    </div>
  )
}
