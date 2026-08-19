import { useState, useEffect } from "react"
import { getRecordCategories, getRecords, RecordCategory, RecordItem } from "../actions"
import { toast } from "sonner"

export function useRecordsData(siteId?: string) {
  const [categories, setCategories] = useState<RecordCategory[]>([])
  const [records, setRecords] = useState<RecordItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    if (!siteId) return
    setIsLoading(true)
    try {
      const [catsRes, recsRes] = await Promise.all([
        getRecordCategories(siteId),
        getRecords(siteId)
      ])

      if (catsRes.error) toast.error(catsRes.error)
      else setCategories(catsRes.categories || [])

      if (recsRes.error) toast.error(recsRes.error)
      else setRecords(recsRes.records || [])
    } catch (error) {
      console.error(error)
      toast.error("Failed to load records")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [siteId])

  return {
    categories,
    records,
    isLoading,
    refreshData: fetchData
  }
}