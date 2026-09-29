import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { searchFinderPeople } from "./finder-api"

export function useFinderSearch({ siteId, onResults }: {
  siteId?: string
  onResults: (results: Record<string, unknown>[], total: number) => void
}) {
  const [loading, setLoading] = useState(false)
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
    setLoading(true)
    try {
      const payload = siteId ? { ...filters, site_id: siteId } : filters
      const [res, totals] = await searchFinderPeople(payload)
      if (!mounted.current) return
      if (!res.success) throw new Error(res.error?.message || 'Finder request failed')
      const data = res.data
      const totalsData = totals?.data
      const computedTotal = typeof totalsData?.total_persons === 'number'
        ? totalsData.total_persons
        : (typeof data?.total_search_results === 'number' ? data.total_search_results : 0)
      onResults(Array.isArray(data?.search_results) ? data.search_results : [], computedTotal)
    } catch (error) {
      if (!mounted.current) return
      console.error('[People] Finder error:', error)
      toast.error(error instanceof Error ? error.message : 'Finder request failed')
      onResults([], 0)
    } finally {
      pending.current = false
      if (mounted.current) setLoading(false)
    }
  }

  return { loading, executeSearch, isSearchPending }
}