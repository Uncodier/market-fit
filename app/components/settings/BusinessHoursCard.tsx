"use client"

import { BusinessHoursSection } from "./BusinessHoursSection"
import { type SiteFormValues } from "./form-schema"

interface BusinessHoursCardProps {
  onSave?: (data: SiteFormValues) => void
}

export function BusinessHoursCard({ onSave }: BusinessHoursCardProps) {
  return (
    <BusinessHoursSection onSave={onSave} />
  )
} 