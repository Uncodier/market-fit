import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { searchFinderPeople } from "./finder-api"

type SearchState =
  | { status: 'idle' | 'loading' | 'success'; error: null }
  | { status: 'error'; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function failureMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error) return error
  return isRecord(error) && typeof error.message === 'string' && error.message
    ? error.message
    : fallback
}

function finderData(response: unknown, kind: 'search' | 'totals') {
  const fallback = `Finder ${kind} request failed`
  if (!isRecord(response) || response.success !== true || response.error) {
    throw new Error(failureMessage(isRecord(response) ? response.error : null, fallback))
  }
  const data = response.data
  // HTTP success does not establish provider success, including wrapped errors.
  if (!isRecord(data) || data.success === false || data.error) {
    throw new Error(failureMessage(isRecord(data) ? data.error : null, fallback))
  }
  return data
}

export function useFinderSearch({ siteId, onResults }: {
  siteId?: string
  // Updates visible data on success and clears it on failure; status identifies the outcome.
  onResults: (results: Record<string, unknown>[], total: number) => void
}) {
  const [state, setState] = useState<SearchState>({ status: 'idle', error: null })
  const pending = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const isSearchPending = () => pending.current

  const executeSearch = async (filters: { site_id?: string }) => {
    // State alone cannot guard two invocations before React's next render.
    if (pending.current) return
    pending.current = true
    setState({ status: 'loading', error: null })
    try {
      const payload = siteId ? { ...filters, site_id: siteId } : filters
      const [res, totals] = await searchFinderPeople(payload)
      if (!mounted.current) return
      const data = finderData(res, 'search')
      const totalsData = finderData(totals, 'totals')
      if (!Array.isArray(data.search_results) || !data.search_results.every(isRecord)) {
        throw new Error('Finder search returned invalid results')
      }
      const total = totalsData.total_persons
      if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
        throw new Error('Finder totals returned an invalid count')
      }
      onResults(data.search_results, total)
      setState({ status: 'success', error: null })
    } catch (error) {
      if (!mounted.current) return
      const message = error instanceof Error ? error.message : 'Finder request failed'
      console.error('[People] Finder error:', error)
      setState({ status: 'error', error: message })
      toast.error(message)
      // The page advances pagination before fetching; old rows must not appear as the new page.
      onResults([], 0)
    } finally {
      pending.current = false
    }
  }

  return { ...state, loading: state.status === 'loading', executeSearch, isSearchPending }
}