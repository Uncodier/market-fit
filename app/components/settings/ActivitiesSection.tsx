"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
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
    description: "Generate a daily summary and stand-up, highlighting progress, blockers and next steps."
  },
  {
    key: "local_lead_generation",
    title: "Local Lead Generation",
    description: "Find and compile local prospects that match your service area and offerings."
  },
  {
    key: "icp_lead_generation",
    title: "ICP Lead Generation",
    description: "Discover leads that match your Ideal Customer Profile using defined ICP attributes."
  },
  {
    key: "leads_initial_cold_outreach",
    title: "Leads Initial Cold Outreach",
    description: "Draft and send first-touch cold outreach tailored to the prospect and channel."
  },
  {
    key: "leads_follow_up",
    title: "Leads Follow Up",
    description: "Automate thoughtful follow-ups to increase reply rates and move deals forward."
  },
  {
    key: "email_sync",
    title: "Email Sync",
    description: "Keep email conversations synchronized for context-aware automations and tracking."
  },
  {
    key: "assign_leads_to_team",
    title: "Assign Leads to Team",
    description: "Assign key leads to the most suitable team member based on AI recommendations"
  },
  {
    key: "notify_team_on_inbound_conversations",
    title: "Notify Team on Inbound Conversations",
    description: "Notify the team when any first comment comes in from a new conversation."
  },
  {
    key: "supervise_conversations",
    title: "Supervise Conversations",
    description: "Automatic suggestions and improvements to agent answers for better conversation quality."
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
                  <CardTitle className="text-xl font-semibold">{title}</CardTitle>
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
                      title: "Default",
                      description: "Use the default schedule and settings for this activity"
                    },
                    {
                      value: "inactive",
                      title: "Inactive",
                      description: "This activity will not run automatically"
                    }
                  ]
                  
                  const selectedOption = options.find(opt => opt.value === field.value) || options[0]
                  
                  return (
                    <FormItem>
                      <FormLabel className="mb-3">Status</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value || options[0].value} 
                          onValueChange={field.onChange}
                          disabled={isDependencyInactive}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={selectedOption.title}>
                              {selectedOption.title}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="min-w-[300px]">
                            {options.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="py-3">
                                <div className="flex flex-col items-start gap-1 w-full">
                                  <span className="font-medium text-sm">{option.title}</span>
                                  <span className="text-xs text-muted-foreground leading-relaxed">{option.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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


