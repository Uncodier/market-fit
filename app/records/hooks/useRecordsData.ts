import { useState, useEffect, useCallback, useRef } from "react"
import { getRecordCategories, getRecords, RecordCategory, RecordItem } from "../actions"
import { toast } from "sonner"
import { useOptionalSite } from "@/app/context/SiteContext"

export function useRecordsData(siteId?: string) {
  const isSiteLoading = Boolean(useOptionalSite()?.isLoading)
  const requestIdRef = useRef(0)
  const [categories, setCategories] = useState<RecordCategory[]>([])
  const [records, setRecords] = useState<RecordItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadedSiteId, setLoadedSiteId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!siteId || isSiteLoading) return
    const requestId = ++requestIdRef.current
    try {
      const [catsRes, recsRes] = await Promise.all([
        getRecordCategories(siteId),
        getRecords(siteId)
      ])

      if (requestId !== requestIdRef.current) return
      setLoadedSiteId(siteId)
      setError(catsRes.error || recsRes.error || null)

      if (catsRes.error) { setCategories([]); toast.error(catsRes.error) }
      else setCategories(catsRes.categories || [])

      if (recsRes.error) { setRecords([]); toast.error(recsRes.error) }
      else setRecords(recsRes.records || [])
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setLoadedSiteId(siteId)
      setCategories([])
      setRecords([])
      setError("Unable to load records. Please retry.")
      console.error(error)
      toast.error("Failed to load records")
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [siteId, isSiteLoading])

  useEffect(() => {
    requestIdRef.current += 1
    if (!isSiteLoading && siteId) void fetchData()
    return () => { requestIdRef.current += 1 }
  }, [siteId, isSiteLoading, fetchData])

  return {
    categories: siteId && loadedSiteId === siteId && !isSiteLoading ? categories : [],
    records: siteId && loadedSiteId === siteId && !isSiteLoading ? records : [],
    isLoading: isSiteLoading || (!!siteId && (loadedSiteId !== siteId || isLoading)),
    error: loadedSiteId === siteId ? error : null,
    refreshData: fetchData
  }
}