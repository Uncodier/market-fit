"use client"

import { type SiteFormValues } from "./form-schema"
import { OfficeLocationsSection } from "./OfficeLocationsSection"
import { ServiceAvailableRestrictionsSection } from "./ServiceAvailableRestrictionsSection"
import { ServiceExclusionsAddressesSection } from "./ServiceExclusionsAddressesSection"

interface LocationsCardProps {
  onSave?: (data: SiteFormValues) => void
}

export function LocationsCard({ onSave }: LocationsCardProps) {
  return (
    <div className="space-y-6">
      <OfficeLocationsSection onSave={onSave} />
      <ServiceAvailableRestrictionsSection onSave={onSave} />
      <ServiceExclusionsAddressesSection onSave={onSave} />
    </div>
  )
} 