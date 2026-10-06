"use client"

import { useFormContext } from "react-hook-form"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import { Badge } from "../ui/badge"
import { type SiteFormValues } from "./form-schema"
import { cn } from "../../lib/utils"
import { useEffect, useRef, useState } from "react"
import { NavigationLink } from "../navigation/NavigationLink"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { getOutreachTimezone, isValidOutreachTimezone, isOutreachActivity, OUTREACH_ACTIVITY_KEYS, normalizeOutreachSettings, validateOutreachSettings } from "@/lib/outreach-settings"
import { OutreachActivityFields } from "./OutreachActivityFields"
import { getUsableOutreachAccounts } from "./outreach-accounts"
import { useOutreachSegments } from "./use-outreach-segments"
import { IcpLeadGenerationFields } from "./IcpLeadGenerationFields"
import { icpLeadGenerationSettingsSchema } from "./icp-lead-generation-settings"
import { normalizeActivitySettings } from "./activity-settings"
import { DailyStandupFields } from "./DailyStandupFields"
import { dailyStandupSettingsSchema, normalizeDailyStandupSettings } from "./daily-standup-settings"
import { acknowledgeActivitySave, getActivityFormUpdates } from "./activity-form-state"
import { validatedActivityUpdates } from "./activity-settings"
import { TIMED_ACTIVITY_KEYS, displayedActivityTimeMode, type TimedActivityKey, type ActivityStartTimeMode } from "@/lib/activity-start-time"

interface ActivitiesSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => boolean | void | Promise<boolean | void>
  siteId?: string
}

type ActivityKey = keyof ReturnType<typeof normalizeActivitySettings>

const ACTIVITIES: { key: ActivityKey; title: string; description: string }[] = [
  {
    key: "daily_resume_and_stand_up",
    title: "Daily Resume and Stand Up",
    description: "Generate a summary and stand-up, highlighting progress, blockers and next steps. Choose the weekdays, start time and report sections below."
  },
  {
    key: "local_lead_generation",
    title: "Local Lead Generation",
    description: "Find and compile local prospects that match your service area and offerings. Runs according to your company's operating hours."
  },
  {
    key: "icp_lead_generation",
    title: "ICP Lead Generation",
    description: "Discover leads that match your Ideal Customer Profile using defined ICP attributes. Daily runs are distributed by site over 24 hours, independent of business hours and weekends. There is no configurable fixed start time."
  },
  {
    key: "leads_initial_cold_outreach",
    title: "Leads Initial Cold Outreach",
    description: "Reach contacts who have never written or replied, including repeat outreach after the reply-wait period. Choose business opening time or a custom time below."
  },
  {
    key: "leads_follow_up",
    title: "Leads Follow Up",
    description: "Follow up only with contacts who have previously written or replied. Choose the weekdays and start time below."
  },
  {
    key: "invoices_due",
    title: "Due Invoices",
    description: "Remind customers about unpaid invoices that are due or overdue. Choose sending accounts, repeat interval, weekdays and start time below. This activity does not prospect leads or mark contacts cold."
  },
  {
    key: "email_sync",
    title: "Email Sync",
    description: "Keep email conversations synchronized for context-aware automations and tracking. Runs according to your company's operating hours."
  },
  {
    key: "assign_leads_to_team",
    title: "Assign Leads to Team",
    description: "Assign key leads to the most suitable team member based on AI recommendations. Runs according to your company's operating hours."
  },
  {
    key: "notify_team_on_inbound_conversations",
    title: "Notify Team on Inbound Conversations",
    description: "Notify the team when any first comment comes in from a new conversation. Runs according to your company's operating hours."
  },
  {
    key: "supervise_conversations",
    title: "Supervise Conversations",
    description: "Automatic suggestions and improvements to agent answers for better conversation quality. Runs according to your company's operating hours."
  }
]

export function ActivitiesSection({ active, onSave, siteId }: ActivitiesSectionProps) {
  const { t } = useLocalization()
  const form = useFormContext<SiteFormValues>()
  const [savingCard, setSavingCard] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const { currentSite } = useSite()
  const activeSiteId = siteId || currentSite?.id
  const saveScope = useRef({ siteId: activeSiteId })
  useEffect(() => {
    saveScope.current = { siteId: activeSiteId }
    setSavingCard(null)
    return () => { saveScope.current = { siteId: undefined } }
  }, [activeSiteId])
  const segments = useOutreachSegments(active ? siteId || currentSite?.id : undefined)
  const accounts = getUsableOutreachAccounts(currentSite?.settings?.channels)
  const businessHours = form.watch("business_hours")
  const timezone = getOutreachTimezone(currentSite?.settings?.business_hours ?? businessHours)
  const coldOutreachStatus = form.watch("activities.leads_initial_cold_outreach.status")
  const assignStatus = form.watch("activities.assign_leads_to_team.status")
  useEffect(() => {
    if (coldOutreachStatus !== "active" && assignStatus !== "inactive") {
      form.setValue("activities.assign_leads_to_team.status", "inactive", { shouldDirty: true })
    }
  }, [coldOutreachStatus, assignStatus, form])
  useEffect(() => { setErrors({}) }, [siteId, currentSite?.id])
  const sectionTitle = t("settings.nav.activities") || "AI Activities"

  const validate = (key: typeof OUTREACH_ACTIVITY_KEYS[number], enabling = false) => {
    const value = normalizeOutreachSettings(form.getValues(`activities.${key}`), key)
    if (enabling) value.status = "active"
    const messages = validateOutreachSettings(value, key, accounts, segments.segments.map(segment => segment.id)).map(error => error.message)
    if (value.status === "active" && !isValidOutreachTimezone(timezone)) messages.push("Set a valid business-hours timezone in Context before enabling this activity.")
    if (key !== "invoices_due" && value.status === "active" && !value.all_segments && (segments.loading || segments.error)) messages.push("Wait for this site's segments to load successfully before enabling or saving.")
    return messages
  }

  const handleSave = async (id: string) => {
    if (!onSave || savingCard) return
    if ((TIMED_ACTIVITY_KEYS as readonly string[]).includes(id)) {
      const key = id as TimedActivityKey
      const timing = form.getValues(`activities.${key}`)
      if (timing?.start_time_mode === undefined) form.setValue(`activities.${key}.start_time_mode`,
        displayedActivityTimeMode(timing ?? {}) as ActivityStartTimeMode, { shouldDirty: true })
    }
    const scope = saveScope.current
    const validation = Object.fromEntries(OUTREACH_ACTIVITY_KEYS.map(key => [key, validate(key)]))
    const icp = icpLeadGenerationSettingsSchema.safeParse(form.getValues("activities.icp_lead_generation"))
    const standup = dailyStandupSettingsSchema.safeParse(form.getValues("activities.daily_resume_and_stand_up"))
    validation.daily_resume_and_stand_up = standup.success ? [] : standup.error.issues.map(issue => issue.message)
    validation.icp_lead_generation = icp.success ? [] : icp.error.issues.map(issue => issue.message)
    setErrors(validation)
    if (!icp.success || !standup.success || Object.values(validation).some(messages => messages.length)) return
    setSavingCard(id)
    try {
      const formData = form.getValues()
      const updates = validatedActivityUpdates(
        { ...formData.activities, icp_lead_generation: icp.data, daily_resume_and_stand_up: standup.data },
        getActivityFormUpdates(form),
      )
      formData.activities = updates as SiteFormValues["activities"]
      const saved = await onSave(formData)
      if (saved !== false && saveScope.current === scope) acknowledgeActivitySave(form, updates)
    } catch (error) {
      console.error("Error saving activities:", error)
    } finally {
      if (saveScope.current === scope) setSavingCard(null)
    }
  }

  if (!active) return null

  return (
    <div id="activities" className="space-y-6">
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-semibold">{sectionTitle}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Standup, Follow Up, Cold Outreach and Due Invoices use business opening time or a custom time. Standup, Follow Up and Due Invoices also use the selected weekdays. ICP runs are distributed by site over 24 hours, independent of business hours. Configure the site&apos;s timezone and business hours in
          {" "}
          <NavigationLink href="/context" className="text-primary underline underline-offset-4">Context</NavigationLink>
          {" "}
          for the activities that use them.
        </p>
      </div>

      {/* Activity Cards */}
      {ACTIVITIES.map(({ key, title, description }) => {
        const status = form.watch(`activities.${key}.status` as const) as 'default' | 'inactive' | 'active' | undefined
        const isOutreach = isOutreachActivity(key)
        const isIcp = key === 'icp_lead_generation'
        const isInactive = !isIcp && (status === 'inactive' || (isOutreach && status !== 'active'))
        
        // Check dependency for assign_leads_to_team
        const isAssignLeads = key === 'assign_leads_to_team'
        const isSuperviseConversations = key === 'supervise_conversations'
        const isDailyResumeAndStandUp = key === 'daily_resume_and_stand_up'
        const isOptIn = isAssignLeads || isSuperviseConversations || isDailyResumeAndStandUp || isOutreach
        const isDependencyInactive = isAssignLeads && coldOutreachStatus !== 'active'
        
        return (
          <SectionCard 
            key={key} 
            id={`activity-${key}`}
            className={cn(
              isInactive
                ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-600"
                : undefined
            )}
          >
            <SectionCardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <SectionCardTitle>{title}</SectionCardTitle>
                    {isIcp && <Badge variant="secondary" className="text-xs">Always active</Badge>}
                    {key === "supervise_conversations" && (
                      <Badge variant="secondary" className="text-xs">
                        Beta
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{description}</p>
                  {isDependencyInactive && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                      ⚠️ Requires &quot;Leads Initial Cold Outreach&quot; to be active
                    </p>
                  )}
                </div>
              </div>
            </SectionCardHeader>
            <SectionCardContent>
              {isIcp ? <IcpLeadGenerationFields siteId={siteId || currentSite?.id} /> : <FormField
                control={form.control}
                name={`activities.${key}.status` as const}
                render={({ field }) => {
                  const options = isOptIn ? [
                    {
                      value: "inactive",
                      title: "Inactive",
                      description: "This activity will not run automatically"
                    },
                    {
                      value: "active",
                      title: "Active",
                      description: "This activity will run according to its schedule"
                    }
                  ] : [
                    {
                      value: "default",
                      title: "Active",
                      description: "This activity will run according to its schedule"
                    },
                    {
                      value: "inactive",
                      title: "Inactive",
                      description: "This activity will not run automatically"
                    }
                  ]
                  
                  // Normalize "default" for special activities that don't support it
                  let normalizedValue = field.value
                  if (isOptIn && normalizedValue === "default") {
                    // For legacy opt-in activities, we might need to map them properly
                    // assign_leads_to_team and supervise_conversations mapped to active previously
                    // daily_resume_and_stand_up now maps to inactive since it's inactive by default
                    normalizedValue = isDailyResumeAndStandUp || isOutreach ? "inactive" : "active"
                  }
                  
                  const currentValue = normalizedValue || options[0].value
                  
                  return (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={currentValue}
                          onValueChange={next => {
                            if (isDailyResumeAndStandUp && next === "active") {
                              const result = dailyStandupSettingsSchema.safeParse({
                                ...normalizeDailyStandupSettings(form.getValues("activities.daily_resume_and_stand_up")), status: "active",
                              })
                              const messages = result.success ? [] : result.error.issues.map(issue => issue.message)
                              setErrors(previous => ({ ...previous, [key]: messages }))
                              if (messages.length) return
                            }
                            if (isOutreach && next === "active") {
                              const messages = validate(key, true)
                              setErrors(previous => ({ ...previous, [key]: messages }))
                              if (messages.length) return
                            } else setErrors(previous => ({ ...previous, [key]: [] }))
                            field.onChange(next)
                          }}
                          disabled={isDependencyInactive}
                          className="space-y-3"
                        >
                          {options.map((option) => {
                            const isSelected = currentValue === option.value
                            return (
                              <label
                                key={option.value}
                                className={cn(
                                  "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                                  isSelected
                                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                                    : "border-gray-200 dark:border-gray-700 bg-background hover:bg-muted/50"
                                )}
                              >
                                <RadioGroupItem
                                  value={option.value}
                                  id={`${key}-${option.value}`}
                                  className="mt-0.5"
                                  disabled={isDependencyInactive}
                                />
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2 min-h-[20px]">
                                    <span className="font-semibold text-sm block">{option.title}</span>
                                    {(option.value === "default" || (option.value === "inactive" && isOptIn)) ? (
                                      <Badge variant="secondary" className="text-xs">
                                        Default
                                      </Badge>
                                    ) : (
                                      <div className="h-5" />
                                    )}
                                  </div>
                                  <span className="text-sm text-muted-foreground leading-relaxed block">
                                    {option.description}
                                  </span>
                                </div>
                              </label>
                            )
                          })}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />}
              {isOutreach && <OutreachActivityFields activityKey={key} accounts={accounts} {...segments} timezone={timezone} />}
              {isDailyResumeAndStandUp && <DailyStandupFields timezone={timezone} />}
              {!!errors[key]?.length && <ul role="alert" className="mt-4 space-y-1 text-sm text-destructive">{errors[key].map(message => <li key={message}>{message}</li>)}</ul>}
            </SectionCardContent>
            <SectionCardFooter>
              <Button type="button" variant="outline" size="sm"
                onClick={() => handleSave(key)}
                disabled={savingCard !== null || (!form.formState.isDirty && !((TIMED_ACTIVITY_KEYS as readonly string[]).includes(key)
                  && form.getValues(`activities.${key as TimedActivityKey}.start_time_mode`) === undefined))}
              >
                {savingCard === key ? "Saving..." : "Save"}
              </Button>
            </SectionCardFooter>
          </SectionCard>
        )
      })}
    </div>
  )
}


