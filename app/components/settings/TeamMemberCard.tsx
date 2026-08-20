"use client"

import { useFormContext, type Control } from "react-hook-form"
import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { Trash2, Mail, CheckCircle2, Clock, Save, Loader } from "../ui/icons"
import { Badge } from "../ui/badge"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog"
import { MemberBlockedScreens } from "./MemberBlockedScreens"
import { Switch } from "../ui/switch"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  TEAM_ROLES,
  getMemberInitials,
  isPendingInvitation,
  isValidTeamEmail,
  type FormTeamMember,
  type TeamRole,
} from "./team-types"

interface MemberValidation {
  canChangeRole: (member: FormTeamMember) => boolean
  canDelete: (member: FormTeamMember) => boolean
  getDeleteTooltip: (member: FormTeamMember) => string
  getDeleteMessage: (member: FormTeamMember) => string
  getRoleChangeMessage: (member: FormTeamMember) => string
}

interface TeamMemberCardProps {
  member: FormTeamMember
  index: number
  canEditBlockedScreens: boolean
  canManageTeam: boolean
  isLoading: boolean
  isSaving: boolean
  isSavingThis: boolean
  isResendingThis: boolean
  hasChanges: boolean
  canSave: boolean
  validation: MemberValidation
  onUpdate: (field: keyof FormTeamMember, value: unknown) => void
  onSave: () => void
  onSaveInvite: () => void
  onRemove: () => void
  onResend: () => void
}

function MemberStatusBadge({ member }: { member: FormTeamMember }) {
  const { t } = useLocalization()
  if (member.status === "active") {
    return (
      <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
        <CheckCircle2 className="h-3 w-3 mr-1" /> {t("settings.team.active") || "Active"}
      </Badge>
    )
  }
  if (member.status === "pending") {
    return (
      <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
        <Clock className="h-3 w-3 mr-1" /> {t("settings.team.pending") || "Pending"}
      </Badge>
    )
  }
  return null
}

export function TeamMemberCard({
  member,
  index,
  canEditBlockedScreens,
  canManageTeam,
  isLoading,
  isSaving,
  isSavingThis,
  isResendingThis,
  hasChanges,
  canSave,
  validation,
  onUpdate,
  onSave,
  onSaveInvite,
  onRemove,
  onResend,
}: TeamMemberCardProps) {
  const { t } = useLocalization()
  const form = useFormContext<SiteFormValues>()
  const isExisting = !!member.id
  const isAdmin =
    member.role === "admin" ||
    member.originalRole === "owner" ||
    member.originalRole === "admin"
  const canChangeRole = canManageTeam && validation.canChangeRole(member)
  const selectedRole = TEAM_ROLES.find((role) => role.value === member.role)
  const displayName = member.name || member.email || (t("settings.team.newMember") || "New Member")
  const showResend = isPendingInvitation(member)
  const showEmailField = !isExisting || showResend
  const hasInvalidEmail = !!member.email && !isValidTeamEmail(member.email)

  return (
    <SectionCard id={`team-member-${index}`}>
      <SectionCardHeader className="border-b border-border/70">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {getMemberInitials(member.name, member.email)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SectionCardTitle className="truncate text-base">
                  {displayName}
                </SectionCardTitle>
                {hasChanges && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    title="Unsaved changes"
                  />
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {isExisting
                  ? member.email
                  : member.email || (t("settings.team.newInvitation") || "New invitation")}
              </p>
            </div>
          </div>
          <MemberStatusBadge member={member} />
        </div>
      </SectionCardHeader>

      <SectionCardContent className="pt-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MemberTextField
              control={form.control}
              name={`team_members.${index}.name`}
              label={t("settings.team.name") || "Name"}
              placeholder={t("settings.team.namePlaceholder") || "Full name"}
              value={member.name || ""}
              onChange={(value) => onUpdate("name", value)}
            />
            {showEmailField && (
              <MemberTextField
                control={form.control}
                name={`team_members.${index}.email`}
                label={t("settings.team.email") || "Email"}
                placeholder={t("settings.team.emailPlaceholder") || "Email address"}
                type="email"
                value={member.email}
                onChange={(value) => onUpdate("email", value)}
              />
            )}
            <MemberTextField
              control={form.control}
              name={`team_members.${index}.position`}
              label={t("settings.team.position") || "Position"}
              placeholder={t("settings.team.positionPlaceholder") || "Job title"}
              value={member.position || ""}
              onChange={(value) => onUpdate("position", value)}
            />
            <FormField
              control={form.control}
              name={`team_members.${index}.role`}
              defaultValue={member.role}
              render={({ field }) => (
                <RoleSelect
                  member={member}
                  field={field}
                  canChangeRole={canChangeRole}
                  selectedLabel={selectedRole?.label}
                  onUpdate={onUpdate}
                  getRoleChangeMessage={validation.getRoleChangeMessage}
                />
              )}
            />
          </div>
          {hasInvalidEmail && (
            <p className="text-xs text-destructive">
              {t("settings.team.invalidEmail") || "This invitation has an invalid email. Remove it and invite the member again."}
            </p>
          )}
          {isAdmin ? (
            <p className="text-xs text-muted-foreground">{t("settings.team.adminsAccessAll") || "Admins can access all apps."}</p>
          ) : (
            <div className="space-y-4">
              <MemberBlockedScreens
                blockedScreens={member.blocked_screens || []}
                disabled={!canEditBlockedScreens}
                onChange={(next) => onUpdate("blocked_screens", next)}
              />
              
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel className="text-xs">{t("settings.team.restrictData") || "Restrict to assigned data only"}</FormLabel>
                  <p className="text-[10px] text-muted-foreground">
                    {t("settings.team.restrictDataDesc") || "If active, this member will only see leads, deals, orders and tasks assigned to them or created by them."}
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={member.restrict_to_assigned_only || false}
                    onCheckedChange={(checked) => onUpdate("restrict_to_assigned_only", checked)}
                    disabled={!canManageTeam}
                  />
                </FormControl>
              </div>
            </div>
          )}
        </div>
      </SectionCardContent>

      <SectionCardFooter>
        <div className="flex w-full items-center justify-between gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={isLoading || !canManageTeam || !validation.canDelete(member)}
                title={validation.getDeleteTooltip(member)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                data-permission="allow"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.team.removeMemberConfirm") || "Remove Team Member"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {validation.getDeleteMessage(member)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel") || "Cancel"}</AlertDialogCancel>
                {validation.canDelete(member) && canManageTeam && (
                  <AlertDialogAction
                    onClick={onRemove}
                    className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                    data-permission="allow"
                  >
                    {t("remove") || "Remove Member"}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex items-center gap-2">
            {showResend && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResend}
                disabled={isLoading || isResendingThis || !isValidTeamEmail(member.email)}
              >
                {isResendingThis ? (
                  <Loader className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-1.5 h-4 w-4" />
                )}
                {t("settings.team.resendInvitation") || "Resend invite"}
              </Button>
            )}
            {isExisting ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSave}
                disabled={isLoading || isSavingThis || !hasChanges || !canSave || !canManageTeam}
                data-permission="allow"
              >
                {isSavingThis ? (
                  <>
                    <Loader className="mr-1.5 h-4 w-4 animate-spin" />
                    {t("saving") || "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-4 w-4" />
                    {t("save") || "Save"}
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={onSaveInvite}
                disabled={isSaving || isLoading || !member.email || !canManageTeam}
                data-permission="allow"
              >
                {isSaving ? (t("saving") || "Saving...") : (t("settings.team.saveAndInvite") || "Save & Invite")}
              </Button>
            )}
          </div>
        </div>
      </SectionCardFooter>
    </SectionCard>
  )
}

function MemberTextField({
  control,
  name,
  label,
  placeholder,
  value,
  type = "text",
  onChange,
}: {
  control: Control<SiteFormValues>
  name: `team_members.${number}.name` | `team_members.${number}.email` | `team_members.${number}.position`
  label: string
  placeholder: string
  value: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <FormField
      control={control}
      name={name}
      defaultValue={value}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs text-muted-foreground">{label}</FormLabel>
          <FormControl>
            <Input
              placeholder={placeholder}
              type={type}
              {...field}
              value={value}
              onChange={(e) => {
                field.onChange(e)
                onChange(e.target.value)
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function RoleSelect({
  member,
  field,
  canChangeRole,
  selectedLabel,
  onUpdate,
  getRoleChangeMessage,
}: {
  member: FormTeamMember
  field: { onChange: (value: string) => void }
  canChangeRole: boolean
  selectedLabel?: string
  onUpdate: (field: keyof FormTeamMember, value: unknown) => void
  getRoleChangeMessage: (member: FormTeamMember) => string
}) {
  const { t } = useLocalization()
  return (
    <FormItem className="col-span-1 md:col-span-2">
      <FormLabel className="text-xs text-muted-foreground">{t("settings.team.role") || "Role"}</FormLabel>
      <Tabs
        value={member.role}
        onValueChange={(value) => {
          if (canChangeRole) {
            field.onChange(value)
            onUpdate("role", value as TeamRole)
          } else {
            toast.error(getRoleChangeMessage(member))
          }
        }}
        className="w-full"
      >
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 h-auto sm:h-10">
          {TEAM_ROLES.map((role) => (
            <TabsTrigger 
              key={role.value} 
              value={role.value} 
              disabled={!canChangeRole}
              title={t(`settings.team.roles.${role.value}Desc`) || role.description}
            >
              {t(`settings.team.roles.${role.value}`) || role.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {!canChangeRole && (
        <p className="mt-1 text-xs text-muted-foreground">
          {getRoleChangeMessage(member)}
        </p>
      )}
      <FormMessage />
    </FormItem>
  )
}
