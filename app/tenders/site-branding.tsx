'use client'

import { useState } from 'react'
import { Building, MapPin } from '@/app/components/ui/icons'
import { localizeMarketplaceRegion } from '@/app/marketplace/marketplace-region-label'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { cn } from '@/lib/utils'
import type { PublicTenderRow } from './public-data'

export function TenderSiteLogo({ logo, name, compact = false }: {
  logo?: string | null; name: string; compact?: boolean
}) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const size = compact ? 28 : 48
  return <div className={cn('flex shrink-0 items-center justify-center overflow-hidden border bg-background',
    compact ? 'h-7 w-7 rounded-md' : 'h-12 w-12 rounded-xl')}>
    {logo && logo !== failedLogo ? (
      // Public branding loads directly, without a server-side remote fetch.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={name} width={size} height={size} className="h-full w-full object-contain" onError={() => setFailedLogo(logo)} />
    ) : <Building aria-hidden={true} className={cn('text-muted-foreground', compact ? 'h-4 w-4' : 'h-6 w-6')} />}
  </div>
}

/** Buyer countries are discovery metadata, not published delivery addresses. */
export function TenderSiteCountries({ regions = [], className }: {
  regions?: NonNullable<PublicTenderRow['facets']>['regions']; className?: string
}) {
  const { locale } = useProcurementI18n()
  if (!regions.length) return null
  return <div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground', className)}>
    {regions.map(country => <span key={country.value} className="inline-flex items-center gap-1.5">
      <MapPin aria-hidden={true} className="h-4 w-4 shrink-0" />
      {localizeMarketplaceRegion(country.value, country.label, locale)}
    </span>)}
  </div>
}