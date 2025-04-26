"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Textarea } from "../ui/textarea"
import { type SiteFormValues } from "./form-schema"

interface GoalsSectionProps {
  active: boolean
}

export function GoalsSection({ active }: GoalsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  console.log("GoalsSection: Current goals values:", form.getValues("goals"));

  if (!active) return null

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Business Goals</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Set your company goals for different time periods
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <FormField
          control={form.control}
          name="goals.quarterly"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quarter Goals</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What do you want to achieve this quarter?"
                  className="min-h-[100px]"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="goals.yearly"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Year Goals</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What do you want to achieve this year?"
                  className="min-h-[100px]"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="goals.fiveYear"
          render={({ field }) => (
            <FormItem>
              <FormLabel>5 Year Goals</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What do you want to achieve in the next 5 years?"
                  className="min-h-[100px]"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="goals.tenYear"
          render={({ field }) => (
            <FormItem>
              <FormLabel>10 Year Goals</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What do you want to achieve in the next 10 years?"
                  className="min-h-[100px]"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
} 