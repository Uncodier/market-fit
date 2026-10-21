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

  const fetchData = useCallback(async () => {
    if (!siteId || isSiteLoading) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const [catsRes, recsRes] = await Promise.all([
        getRecordCategories(siteId),
        getRecords(siteId)
      ])

      if (requestId !== requestIdRef.current) return

      if (catsRes.error) toast.error(catsRes.error)
      else setCategories(catsRes.categories || [])

      if (recsRes.error) toast.error(recsRes.error)
      else setRecords(recsRes.records || [])
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      console.error(error)
      toast.error("Failed to load records")
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [siteId, isSiteLoading])

  useEffect(() => {
    requestIdRef.current += 1
    if (isSiteLoading) setIsLoading(true)
    else if (siteId) void fetchData()
    else {
      setCategories([])
      setRecords([])
      setIsLoading(false)
    }
    return () => { requestIdRef.current += 1 }
  }, [siteId, isSiteLoading, fetchData])

  return {
    categories,
    records,
    isLoading: isSiteLoading || isLoading,
    refreshData: fetchData
  }
}