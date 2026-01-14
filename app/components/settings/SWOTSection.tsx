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
    <div className="space-y-8">
      {/* Strengths */}
      <Card id="swot-strengths" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Strengths</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            What are your company's key strengths and competitive advantages?
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="swot.strengths"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="List your internal strengths..."
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

      {/* Weaknesses */}
      <Card id="swot-weaknesses" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Weaknesses</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            What internal limitations or challenges does your company face?
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="swot.weaknesses"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Identify areas that need improvement..."
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

      {/* Opportunities */}
      <Card id="swot-opportunities" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Opportunities</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            What external factors could positively impact your business?
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="swot.opportunities"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Explore potential opportunities..."
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

      {/* Threats */}
      <Card id="swot-threats" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Threats</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            What external challenges could negatively impact your business?
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="swot.threats"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Identify potential threats..."
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