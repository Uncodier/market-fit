import { useCallback, useState } from 'react'
import type { FinderRequest } from './finder-request-types'

type SavedField = 'funding_types' | 'funding_total_start' | 'funding_total_end' |
  'job_post_is_remote' | 'job_post_is_active' | 'require_deal' | 'require_site_visit'
type SavedValues = Pick<FinderRequest, SavedField>

// Preserve saved distinctions that the compact UI cannot display (unset vs false,
// one-sided ranges and multiple funding types) until the corresponding user edit.
export function useSavedFilterValues() {
  const [savedValues, setSavedFilterValues] = useState<SavedValues>({})
  const clearSavedFields = useCallback((...fields: SavedField[]) => {
    setSavedFilterValues(previous => {
      const next = { ...previous }
      fields.forEach(field => { delete next[field] })
      return next
    })
  }, [])
  return { savedValues, setSavedFilterValues, clearSavedFields }
}