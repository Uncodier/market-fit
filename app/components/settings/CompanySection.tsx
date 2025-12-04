"use client"

import { CompanyProfileCard } from "./CompanyProfileCard"
import { BusinessHoursCard } from "./BusinessHoursCard"
import { GoalsSection } from "./GoalsSection"
import { SWOTSection } from "./SWOTSection"
import { LocationsCard } from "./LocationsCard"

import { type SiteFormValues } from "./form-schema"

interface CompanySectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

export function CompanySection({ active, onSave }: CompanySectionProps) {
  if (!active) return null

  return (
    <div className="space-y-6">
      <CompanyProfileCard onSave={onSave} />
      <BusinessHoursCard onSave={onSave} />
      <GoalsSection active={true} onSave={onSave} />
      <SWOTSection active={true} onSave={onSave} />
      <LocationsCard onSave={onSave} />
    </div>
  )
} 