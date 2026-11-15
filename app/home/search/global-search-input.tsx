'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AccountSearch } from '@/app/buyer/components/AccountSearch'
import { searchHref } from './types'

/** The Home header enters search mode; collection screens keep their own filters. */
export function GlobalSearchInput() {
  const { t } = useProcurementI18n()
  const router = useRouter()
  const [query, setQuery] = useState('')
  return <AccountSearch value={query} placeholder={t('procurement.surfaces.search.placeholder')} onChange={event => {
    const next = event.target.value.slice(0, 200)
    setQuery(next)
    if (next.trim()) router.push(searchHref(next), { scroll: false })
  }} />
}