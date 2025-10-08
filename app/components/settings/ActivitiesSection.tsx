"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { type SiteFormValues } from "./form-schema"
import { cn } from "../../lib/utils"
import Link from "next/link"

interface ActivitiesSectionProps {
  active: boolean
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
  }
]

export function ActivitiesSection({ active }: ActivitiesSectionProps) {
  const form = useFormContext<SiteFormValues>()

  if (!active) return null

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-sm">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Activities</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Activity schedules and days adapt to your company working days and industry best practices. Configure company business hours in 
            {" "}
            <Link href="/context" className="text-primary underline underline-offset-4">Context</Link>
            {" "}
            to fine-tune when activities run.
          </p>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {ACTIVITIES.map(({ key, title, description }) => {
          const status = form.watch(`activities.${key}.status` as const) as 'default' | 'inactive' | undefined
          const isInactive = status === 'inactive'
          return (
          <Card key={key} className={cn(
            "border shadow-sm hover:shadow-md transition-shadow duration-200",
            isInactive 
              ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-600" 
              : "border-border"
          )}>
            <CardHeader className="px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold">{title}</CardTitle>
                  <div className="text-sm text-muted-foreground mt-1">{description}</div>
                </div>
                <div className="w-40">
                  <FormField
                    control={form.control}
                    name={`activities.${key}.status` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Status</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Default</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardHeader>
          </Card>
          )})}
      </div>
    </div>
  )
}


