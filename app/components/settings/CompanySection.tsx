"use client"

import { CompanyProfileCard } from "./CompanyProfileCard"
import { BusinessHoursCard } from "./BusinessHoursCard"
import { GoalsSection } from "./GoalsSection"
import { SWOTSection } from "./SWOTSection"
import { LocationsCard } from "./LocationsCard"

interface CompanySectionProps {
  active: boolean
}

export function CompanySection({ active }: CompanySectionProps) {
  if (!active) return null

  return (
    <div className="space-y-6">
      <CompanyProfileCard />
      <BusinessHoursCard />
      <GoalsSection active={true} />
      <SWOTSection active={true} />
      <LocationsCard />
    </div>
  )
} 