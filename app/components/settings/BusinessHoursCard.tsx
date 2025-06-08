"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { BusinessHoursSection } from "./BusinessHoursSection"

export function BusinessHoursCard() {
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
    </Card>
  )
} 