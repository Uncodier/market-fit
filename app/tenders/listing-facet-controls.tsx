'use client'

import { useId } from 'react'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Button } from '@/app/components/ui/button'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { localizeMarketplaceRegion } from '@/app/marketplace/marketplace-region-label'
import type { TenderFacetOption } from './listing-facets'

type Props = {
  regions: TenderFacetOption[]; categories: TenderFacetOption[]
  region: string; category: string; onRegion: (value: string) => void; onCategory: (value: string) => void
}

/** The same region radio/list hierarchy as MarketplaceFilters, without inferred delivery coverage. */
export function TenderFacetControls({ regions, categories, region, category, onRegion, onCategory }: Props) {
  const { t, locale, formatNumber } = useProcurementI18n()
  const id = useId()
  if (!regions.length && !categories.length) return null
  const groups = [
    { key: 'regions', title: t('marketplace.filters.regions'), all: t('marketplace.filters.allRegions'), value: region, change: onRegion,
      options: regions.map(option => ({ ...option, label: localizeMarketplaceRegion(option.value, option.label, locale) })) },
    { key: 'categories', title: t('marketplace.categories.title'), all: t('procurement.portal.listing.allCategories'), value: category, change: onCategory, options: categories },
  ]
  return <div className="space-y-6">
    {groups.filter(group => group.options.length).map(group => <section key={group.key} className="space-y-3">
      <h3 className="font-semibold" id={`${id}-${group.key}`}>{group.title}</h3>
      {group.key === 'regions' && <p className="text-xs text-muted-foreground">{t('procurement.portal.listing.regionHint')}</p>}
      <RadioGroup aria-labelledby={`${id}-${group.key}`} value={group.value || '__all__'} onValueChange={value => group.change(value === '__all__' ? '' : value)}>
        {[{ value: '__all__', label: group.all, count: undefined }, ...group.options].map(option => <label key={option.value} className="flex items-center gap-2 min-h-9 cursor-pointer text-sm">
          <RadioGroupItem value={option.value} aria-label={option.label} />
          <span className="flex-1 min-w-0 break-words">{option.label}</span>
          {option.count !== undefined && <span className="text-muted-foreground tabular-nums">{formatNumber(option.count)}</span>}
        </label>)}
      </RadioGroup>
    </section>)}
    {(region || category) && <Button type="button" variant="link" size="sm" className="!p-0" onClick={() => { onRegion(''); onCategory('') }}>{t('marketplace.filters.clear')}</Button>}
  </div>
}