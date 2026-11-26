import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react"
import { getRecordCategories, getRecords, updateRecord, updateRecordCategory, RecordCategory, RecordItem } from "../actions"
import type { SaveRecordProperty } from "../lib/record-properties"
import type { ValidatedTemplateField } from "../lib/template-validation"
import { toast } from "sonner"
import { useOptionalSite } from "@/app/context/SiteContext"

export function useRecordsData(siteId?: string) {
  const isSiteLoading = Boolean(useOptionalSite()?.isLoading)
  const requestIdRef = useRef(0)
  const activeSite = useRef<string | undefined>(undefined)
  const [categories, setCategories] = useState<RecordCategory[]>([])
  const [records, setRecords] = useState<RecordItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadedSiteId, setLoadedSiteId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    activeSite.current = isSiteLoading ? undefined : siteId
    return () => {
      activeSite.current = undefined
      requestIdRef.current += 1
    }
  }, [siteId, isSiteLoading])

  const fetchData = useCallback(async () => {
    if (!siteId || activeSite.current !== siteId) return
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
  }, [siteId])

  const saveRecordProperty: SaveRecordProperty = async (record, updates) => {
    if (record.site_id !== activeSite.current) return { error: "The active site has changed." }
    const result = await updateRecord(record.id, updates, record.updated_at)
    if (record.site_id !== activeSite.current) return result
    if (result.conflict) await fetchData()
    if (result.record) {
      const saved = result.record
      setRecords(current => current.map(item =>
        item.site_id === record.site_id && item.id === record.id && item.updated_at === record.updated_at
          ? { ...item, ...saved, category: item.category }
          : item,
      ))
    }
    return result
  }

  const addTableProperty = async (category: RecordCategory, field: ValidatedTemplateField) => {
    if (category.site_id !== activeSite.current) return { error: "The active site has changed." }
    const result = await updateRecordCategory(category.id, {
      template_fields: [...(category.template_fields ?? []), field],
    }, category.updated_at)
    if (category.site_id !== activeSite.current) return { error: "The active site has changed." }
    if (result.category || result.conflict) await fetchData()
    return category.site_id === activeSite.current ? result : { error: "The active site has changed." }
  }

  useEffect(() => {
    if (isSiteLoading || !siteId) return
    let active = true
    queueMicrotask(() => { if (active) void fetchData() })
    return () => { active = false }
  }, [siteId, isSiteLoading, fetchData])

  return {
    categories: siteId && loadedSiteId === siteId && !isSiteLoading ? categories : [],
    records: siteId && loadedSiteId === siteId && !isSiteLoading ? records : [],
    isLoading: isSiteLoading || (!!siteId && (loadedSiteId !== siteId || isLoading)),
    error: loadedSiteId === siteId ? error : null,
    refreshData: fetchData,
    saveRecordProperty,
    addTableProperty,
  }
}