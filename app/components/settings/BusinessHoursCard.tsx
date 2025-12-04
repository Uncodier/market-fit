"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { BusinessHoursSection } from "./BusinessHoursSection"
import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { useState } from "react"

interface BusinessHoursCardProps {
  onSave?: (data: SiteFormValues) => void
}

export function BusinessHoursCard({ onSave }: BusinessHoursCardProps) {
  const form = useFormContext<SiteFormValues>()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving business hours:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Business Hours</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Define your business hours for different regions and locations. Most agent activities will start on those time ranges.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <BusinessHoursSection />
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