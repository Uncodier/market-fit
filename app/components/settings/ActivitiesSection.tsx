"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import { Badge } from "../ui/badge"
import { type SiteFormValues } from "./form-schema"
import { cn } from "../../lib/utils"
import { useState } from "react"
import { NavigationLink } from "../navigation/NavigationLink"

interface ActivitiesSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

type ActivityKey = keyof SiteFormValues["activities"]

const ACTIVITIES: { key: ActivityKey; title: string; description: string }[] = [
  {
    key: "daily_resume_and_stand_up",
    title: "Daily Resume and Stand Up",
    description: "Generate a daily summary and stand-up, highlighting progress, blockers and next steps. Runs Monday through Friday."
  },
  {
    key: "local_lead_generation",
    title: "Local Lead Generation",
    description: "Find and compile local prospects that match your service area and offerings. Runs according to your company's operating hours."
  },
  {
    key: "icp_lead_generation",
    title: "ICP Lead Generation",
    description: "Discover leads that match your Ideal Customer Profile using defined ICP attributes. Runs according to your company's operating hours."
  },
  {
    key: "leads_initial_cold_outreach",
    title: "Leads Initial Cold Outreach",
    description: "Draft and send first-touch cold outreach tailored to the prospect and channel. Runs according to your company's operating hours."
  },
  {
    key: "leads_follow_up",
    title: "Leads Follow Up",
    description: "Automate thoughtful follow-ups to increase reply rates and move deals forward. Runs Tuesday, Wednesday, and Thursday."
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

export function ActivitiesSection({ active, onSave }: ActivitiesSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving activities:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!active) return null

  return (
    <div id="activities" className="space-y-6">
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-semibold">Activities</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Activity schedules and days adapt to your company working days and industry best practices. Configure company business hours in 
          {" "}
          <NavigationLink href="/context" className="text-primary underline underline-offset-4">Context</NavigationLink>
          {" "}
          to fine-tune when activities run.
        </p>
      </div>

      {/* Activity Cards */}
      {ACTIVITIES.map(({ key, title, description }) => {
        const status = form.watch(`activities.${key}.status` as const) as 'default' | 'inactive' | 'active' | undefined
        const isInactive = status === 'inactive'
        
        // Check dependency for assign_leads_to_team
        const isAssignLeads = key === 'assign_leads_to_team'
        const isSuperviseConversations = key === 'supervise_conversations'
        const coldOutreachStatus = form.watch('activities.leads_initial_cold_outreach.status')
        const isDependencyInactive = isAssignLeads && coldOutreachStatus === 'inactive'
        
        return (
          <Card 
            key={key} 
            id={`activity-${key}`}
            className={cn(
              "border shadow-sm hover:shadow-md transition-shadow duration-200",
              isInactive 
                ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-600" 
                : "border-border"
            )}
          >
            <CardHeader className="px-8 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-semibold">{title}</CardTitle>
                    {key === "supervise_conversations" && (
                      <Badge variant="secondary" className="text-xs">
                        Beta
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{description}</p>
                  {isDependencyInactive && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                      ⚠️ Requires "Leads Initial Cold Outreach" to be active
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <FormField
                control={form.control}
                name={`activities.${key}.status` as const}
                render={({ field }) => {
                  // Auto-set to inactive if dependency is inactive
                  if (isDependencyInactive && field.value !== 'inactive') {
                    field.onChange('inactive')
                  }
                  
                  const options = (isAssignLeads || isSuperviseConversations) ? [
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
                  
                  // Normalize "default" to "active" for special activities that don't support "default"
                  let normalizedValue = field.value
                  if ((isAssignLeads || isSuperviseConversations) && normalizedValue === "default") {
                    normalizedValue = "active"
                    // Update the field value if it was "default"
                    if (field.value === "default") {
                      field.onChange("active")
                    }
                  }
                  
                  const currentValue = normalizedValue || options[0].value
                  
                  return (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={currentValue}
                          onValueChange={field.onChange}
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
                                    {(option.value === "default" || (option.value === "inactive" && (isAssignLeads || isSuperviseConversations))) ? (
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
              />
            </CardContent>
            <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
              <Button 
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}


