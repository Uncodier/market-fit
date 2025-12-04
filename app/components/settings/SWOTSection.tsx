"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Textarea } from "../ui/textarea"
import { type SiteFormValues } from "./form-schema"
import { useState } from "react"

interface SWOTSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

export function SWOTSection({ active, onSave }: SWOTSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving SWOT:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!active) return null

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">SWOT Analysis</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Define your company's strengths, weaknesses, opportunities, and threats
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <FormField
          control={form.control}
          name="swot.strengths"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Strengths</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What are your company's key strengths and competitive advantages?"
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
          name="swot.weaknesses"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Weaknesses</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What internal limitations or challenges does your company face?"
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
          name="swot.opportunities"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Opportunities</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What external factors could positively impact your business?"
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
          name="swot.threats"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Threats</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What external challenges could negatively impact your business?"
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
      <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </CardFooter>
    </Card>
  )
} 