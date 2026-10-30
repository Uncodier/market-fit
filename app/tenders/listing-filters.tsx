'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import type { ReactNode } from 'react'

type Props = { value: string; onChange: (value: string) => void; mobile?: boolean; children?: ReactNode }

/** Mirrors MarketplaceCategoryChips and MarketplaceFilterSidebar for tender participation. */
export function TenderListingFilters({ value, onChange, mobile = false, children }: Props) {
  const { t } = useProcurementI18n()
  const options = [
    { value: 'all', label: t('procurement.portal.listing.all') },
    { value: 'open', label: t('procurement.portal.listing.open') },
    { value: 'closed', label: t('procurement.portal.public.closed') },
  ]
  const controls = options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value}
    onClick={() => onChange(option.value)}
    className={`!min-w-0 min-h-11 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${mobile
      ? `shrink-0 px-5 py-2 rounded-full font-medium border backdrop-blur-3xl shadow-sm ${value === option.value ? 'bg-black/60 text-white border-black/30 dark:bg-white/60 dark:text-black dark:border-white/30' : 'bg-white/60 text-gray-700 border-black/5 dark:bg-[#030303]/60 dark:text-gray-300 dark:border-white/10'}`
      : `flex w-full !justify-start text-left px-3 py-2 rounded-lg ${value === option.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}`}>
    {option.label}
  </button>)

  if (mobile) return <div role="group" aria-label={t('procurement.portal.listing.mobileFilters')}
    className="md:hidden sticky top-[72px] z-30 -mx-4 pt-2 pb-4 mb-4 bg-background/95 backdrop-blur-sm">
    <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center py-2 px-4">{controls}</div>
  </div>

  return <aside aria-label={t('procurement.portal.listing.filter')}
    className="w-full md:w-64 shrink-0 space-y-8 hidden md:block pb-4 md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto">
    <section><h2 className="font-bold text-lg mb-4">{t('procurement.portal.public.participation')}</h2><div className="space-y-1">{controls}</div></section>
    {children}
    <p className="text-sm leading-relaxed text-muted-foreground">{t('procurement.portal.listing.scope')}</p>
  </aside>
}