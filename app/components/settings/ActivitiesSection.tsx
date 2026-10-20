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
import { Collapsible, CollapsibleContent } from "../ui/collapsible"
import { ChevronDown } from "../ui/icons"
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
import { dailyStandupSettingsSchema } from "./daily-standup-settings"
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
    description: "Remind customers about unpaid invoices that are due or overdue. Choose sending accounts, cooldown period, weekdays and start time below. The first reminder can be sent when the invoice is due."
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
  const [expandedSetups, setExpandedSetups] = useState<Record<string, boolean>>({})
  const { currentSite } = useSite()
  const activeSiteId = siteId || currentSite?.id
  const saveScope = useRef({ siteId: activeSiteId })
  useEffect(() => {
    saveScope.current = { siteId: activeSiteId }
    setSavingCard(null)
    setExpandedSetups({})
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

  const validate = (key: typeof OUTREACH_ACTIVITY_KEYS[number]) => {
    const value = normalizeOutreachSettings(form.getValues(`activities.${key}`), key)
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
    const invalidKeys = Object.keys(validation).filter(key => validation[key].length)
    if (invalidKeys.length) {
      setExpandedSetups(previous => ({ ...previous, ...Object.fromEntries(invalidKeys.map(key => [key, true])) }))
      return
    }
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
        <p className="text-sm text-muted-foreground mt-2">
          Activate an activity to configure its setup. Changes only take effect after saving.
        </p>
      </div>

      {/* Activity Cards */}
      {ACTIVITIES.map(({ key, title, description }) => {
        const status = form.watch(`activities.${key}.status` as const) as 'default' | 'inactive' | 'active' | undefined
        const isOutreach = isOutreachActivity(key)
        const isIcp = key === 'icp_lead_generation'
        
        // Check dependency for assign_leads_to_team
        const isAssignLeads = key === 'assign_leads_to_team'
        const isSuperviseConversations = key === 'supervise_conversations'
        const isDailyResumeAndStandUp = key === 'daily_resume_and_stand_up'
        const isOptIn = isAssignLeads || isSuperviseConversations || isDailyResumeAndStandUp || isOutreach
        const isDependencyInactive = isAssignLeads && coldOutreachStatus !== 'active'
        const isOptInInactive = isOutreach || isDailyResumeAndStandUp ? status !== 'active' : status === undefined
        const isInactive = !isIcp && (status === 'inactive' || (isOptIn && isOptInInactive) || isDependencyInactive)
        const hasSetup = isIcp || isOutreach || isDailyResumeAndStandUp
        const canToggleSetup = hasSetup && !isInactive
        const setupOpen = expandedSetups[key] === true
        const setupId = `activity-${key}-setup`
        const toggleSetup = () => setExpandedSetups(previous => ({ ...previous, [key]: !previous[key] }))
        
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
            <SectionCardHeader
              className={cn(canToggleSetup && "cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring")}
              role={canToggleSetup ? "button" : undefined}
              tabIndex={canToggleSetup ? 0 : undefined}
              aria-label={canToggleSetup ? `${setupOpen ? "Hide" : "Show"} setup for ${title}` : undefined}
              aria-expanded={canToggleSetup ? setupOpen : undefined}
              aria-controls={canToggleSetup ? setupId : undefined}
              onClick={canToggleSetup ? toggleSetup : undefined}
              onKeyDown={canToggleSetup ? event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  toggleSetup()
                }
              } : undefined}
            >
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
                {canToggleSetup && <ChevronDown aria-hidden={true} className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", setupOpen && "rotate-180")} />}
              </div>
            </SectionCardHeader>
            <SectionCardContent className={cn(isIcp && !setupOpen && !errors[key]?.length && "pb-0")}>
              {!isIcp && <FormField
                control={form.control}
                name={`activities.${key}.status` as const}
                render={({ field }) => {
                  const options = isOptIn ? [
                    {
                      value: "inactive",
                      title: "Inactive"
                    },
                    {
                      value: "active",
                      title: "Active"
                    }
                  ] : [
                    {
                      value: "default",
                      title: "Active"
                    },
                    {
                      value: "inactive",
                      title: "Inactive"
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
                          aria-label={`${title} status`}
                          onValueChange={next => {
                            setErrors(previous => ({ ...previous, [key]: [] }))
                            field.onChange(next)
                            setExpandedSetups(previous => ({ ...previous, [key]: next !== "inactive" }))
                          }}
                          disabled={isDependencyInactive}
                          className="flex flex-wrap gap-3"
                        >
                          {options.map((option) => {
                            const isSelected = currentValue === option.value
                            return (
                              <label
                                key={option.value}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                                  isSelected
                                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                                    : "border-gray-200 dark:border-gray-700 bg-background hover:bg-muted/50"
                                )}
                              >
                                <RadioGroupItem
                                  value={option.value}
                                  id={`${key}-${option.value}`}
                                  disabled={isDependencyInactive}
                                />
                                <div>
                                  <div className="flex items-center gap-2 min-h-[20px]">
                                    <span className="font-semibold text-sm block">{option.title}</span>
                                    {(option.value === "default" || (option.value === "inactive" && isOptIn)) ? (
                                      <Badge variant="secondary" className="text-xs">
                                        Default
                                      </Badge>
                                    ) : null}
                                  </div>
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
              {canToggleSetup && <Collapsible open={setupOpen}>
                <CollapsibleContent id={setupId} forceMount hidden={!setupOpen} className={cn(!setupOpen && "hidden")}>
                  {isIcp && <IcpLeadGenerationFields siteId={activeSiteId} />}
                  {isOutreach && <OutreachActivityFields activityKey={key} accounts={accounts} {...segments} timezone={timezone} />}
                  {isDailyResumeAndStandUp && <DailyStandupFields timezone={timezone} />}
                </CollapsibleContent>
              </Collapsible>}
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


