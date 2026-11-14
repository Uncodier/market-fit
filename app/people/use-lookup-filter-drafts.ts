import { useMemo, useState } from 'react'
import { LOOKUP_FILTERS, type LookupFilterField } from './lookup-filters'

export function useLookupFilterDrafts() {
  const [lookupDrafts, setDrafts] = useState<Partial<Record<LookupFilterField, string>>>({})
  const lookupDraftSetters = useMemo(() => Object.fromEntries(
    (Object.keys(LOOKUP_FILTERS) as LookupFilterField[]).map(field => [field, (text: string) => {
      setDrafts(previous => previous[field] === text ? previous : { ...previous, [field]: text })
    }]),
  ) as Record<LookupFilterField, (text: string) => void>, [])
  return { lookupDrafts, lookupDraftSetters }
}