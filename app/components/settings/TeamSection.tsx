"use client"

import { PlusCircle, User } from "../ui/icons"
import { Button } from "../ui/button"
import { EmptyCard } from "../ui/empty-card"
import { TeamMemberCard } from "./TeamMemberCard"
import { useTeamMembers } from "./use-team-members"

interface TeamSectionProps {
  active: boolean
  siteId?: string
}

export function TeamSection({ active, siteId }: TeamSectionProps) {
  const {
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
  } = useTeamMembers({ active, siteId })

  if (!active) return null

  return (
    <div id="team-members" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Team Members</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Invite team members to collaborate on your site
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTeamMember}
          disabled={isLoading || !canManageTeam}
          data-permission="allow"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Invite New Member to Team
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
          title="No team members yet"
          description="Invite team members to collaborate on your site and manage operations."
          variant="fancy"
        />
      ) : (
        teamList.map((member, index) => (
          <TeamMemberCard
            key={member.id || `new-${index}`}
            member={member}
            index={index}
            canEditBlockedScreens={canEditBlockedScreens}
            canManageTeam={canManageTeam}
            isLoading={isLoading}
            isSaving={isSaving}
            isSavingThis={isSavingMember === member.id}
            isResendingThis={isResending === member.id}
            hasChanges={hasMemberChanges(member)}
            canSave={canSaveMember(member)}
            validation={validation}
            onUpdate={(field, value) => updateLocalTeamMember(index, field, value)}
            onSave={() => handleSaveMember(member)}
            onSaveInvite={handleSaveTeamMembers}
            onRemove={() => removeTeamMember(index)}
            onResend={() => handleResendInvitation(member)}
          />
        ))
      )}
    </div>
  )
}
