"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Textarea } from "../ui/textarea"
import { type SiteFormValues } from "./form-schema"
import { useState } from "react"

interface GoalsSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

export function GoalsSection({ active, onSave }: GoalsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isSaving, setIsSaving] = useState(false)
  console.log("GoalsSection: Current goals values:", form.getValues("goals"));

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving goals:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!active) return null

  return (
    <div className="space-y-8">
      {/* Quarterly Goals */}
      <Card id="goals-quarterly" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Quarter Goals</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            What do you want to achieve this quarter?
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="goals.quarterly"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Define your quarterly objectives..."
                    className="min-h-[120px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Yearly Goals */}
      <Card id="goals-yearly" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Year Goals</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            What do you want to achieve this year?
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="goals.yearly"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Define your annual objectives..."
                    className="min-h-[120px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* 5 Year Goals */}
      <Card id="goals-five-year" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">5 Year Goals</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            What do you want to achieve in the next 5 years?
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="goals.fiveYear"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Define your mid-term vision..."
                    className="min-h-[120px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* 10 Year Goals */}
      <Card id="goals-ten-year" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">10 Year Goals</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            What do you want to achieve in the next 10 years?
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="goals.tenYear"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Define your long-term vision..."
                    className="min-h-[120px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 