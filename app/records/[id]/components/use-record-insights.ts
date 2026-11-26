import { useScopedPreviewState } from "../../hooks/useScopedPreviewState"
import { buildPreviewRequests, fieldPreviewKey, fetchPreviewBatches } from "../../lib/entity-preview-request"
import { useEffect, useMemo } from "react"
import { getRecords, type RecordItem } from "../../actions"
import { useMetricHistory } from "./use-metric-history"
import { isMetricNumber, metricDate, metricNumber, savedMetricRecords } from "./record-metrics"
import type { InsightChartPoint, InsightCross, InsightsTabProps } from "./insights-types"

export function useRecordInsights({ fields, formData, description, record, relationsData }: InsightsTabProps) {
  // 1. Text Summary (Placeholder for AI generation or just showing the description)
  const hasDescription = !!description || fields.some(f => f.type === 'description' && formData[f.name])

  // 2. Numeric Charts
  const numberFields = useMemo(() => fields.filter(f => f.type === 'number'), [fields])
  
  // 3. Select / Pie Charts
  const selectFields = fields.filter(f => f.type === 'select' && formData[f.name])
  const categoricalFields = useMemo(() => fields.filter(f => {
    if (f.type === 'relation') return relationsData?.[f.name] !== undefined
    return (f.type === 'select' || f.type === 'text') && formData[f.name]
  }), [fields, formData, relationsData])
  
  // 4. File / Images
  const fileFields = fields.filter(f => f.type === 'file' && formData[f.name])

  // History logic
  const { history, historyStatus, primaryRelationName, primaryRelationId, setHistoryRelation, retryHistory } =
    useMetricHistory({ fields, formData, record, relationsData })
  const categoryScope = JSON.stringify([record?.site_id, record?.category_id])
  const [categoryHistory, setCategoryHistory] = useScopedPreviewState<RecordItem[]>(categoryScope, [])
  const [categoryStatus, setCategoryStatus] = useScopedPreviewState(categoryScope,
    record?.site_id && record.category_id ? "loading" : "idle")

  // Resolve the actual name of the related entity for UI context
  const labelScope = JSON.stringify([record?.site_id, primaryRelationName, primaryRelationId, relationsData])
  const [primaryRelationLabel, setPrimaryRelationLabel] = useScopedPreviewState<string | null>(labelScope, null)
  const [allRelationLabels, setAllRelationLabels] = useScopedPreviewState<Record<string, string>>(labelScope, {})
  
  const activeRelations = useMemo(() => {
    return fields.filter(f => f.type === 'relation' && relationsData?.[f.name])
  }, [fields, relationsData])
  
  useEffect(() => {
    let active = true
    setAllRelationLabels({})
    setPrimaryRelationLabel(null)
    if (activeRelations.length > 0 && record?.site_id) {
      const siteId = record.site_id
      const entitiesToResolve = buildPreviewRequests(activeRelations, relationsData || {})
      import("../../actions").then(({ resolveRelationsForSidebar }) => {
        if (!active) return
        fetchPreviewBatches(entitiesToResolve, siteId, resolveRelationsForSidebar).then(res => {
          if (!active) return
          setAllRelationLabels(res)
          const primaryField = activeRelations.find(field => field.name === primaryRelationName)
          setPrimaryRelationLabel(primaryField && primaryRelationId ? res[fieldPreviewKey(primaryField, primaryRelationId)] || null : null)
        })
      })
    }
    return () => { active = false }
  }, [activeRelations, relationsData, primaryRelationId, primaryRelationName, record?.site_id, setAllRelationLabels, setPrimaryRelationLabel])

  useEffect(() => {
    let active = true
    if (record?.category_id && record?.site_id) {
      setCategoryStatus("loading")
      getRecords(record.site_id, record.category_id)
        .then(({ records, error }) => {
          if (!active) return
          setCategoryStatus(error || !records ? "error" : "ready")
          setCategoryHistory(records ?? [])
        })
        .catch(() => { if (active) setCategoryStatus("error") })
    } else {
      setCategoryStatus("idle")
      setCategoryHistory([])
    }
    return () => { active = false }
  }, [record?.category_id, record?.site_id, setCategoryHistory, setCategoryStatus])

  const metricRecords = useMemo(() => savedMetricRecords(
    history, record, primaryRelationName, primaryRelationId,
  ), [history, record, primaryRelationName, primaryRelationId])

  // Activity is based on saved timestamps, never the time the panel was opened.
  const chartData = useMemo<InsightChartPoint[]>(() => {
    if (!numberFields.length || historyStatus === "loading" || historyStatus === "error") return []
    return metricRecords.flatMap(item => {
      const timestamp = metricDate(item.created_at)
      if (timestamp === null) return []
      const rawDate = new Date(timestamp)
      return [{ id: item.id, rawDate, date: rawDate.toLocaleDateString(),
        values: Object.fromEntries(numberFields.map(field => [field.name, metricNumber(item.data[field.name])])),
      }]
    }).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
  }, [metricRecords, numberFields, historyStatus])

  const numericData = numberFields.map(field => ({ name: field.name, value: metricNumber(formData[field.name]) }))

  // Macro-analysis computations (Category level)
  const macroAnalysis = useMemo(() => {
    if (categoryHistory.length === 0) return null

    const totalRecords = categoryHistory.length

    // Sort ascending to calculate time differences
    const sorted = [...categoryHistory].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    
    // Numeric field stats
    const numericStats = numberFields.map(f => {
      const values = sorted.map(p => metricNumber(p.data[f.name])).filter(isMetricNumber)
      if (values.length === 0) return null

      const max = Math.max(...values)
      const min = Math.min(...values)
      const avg = values.reduce((a, b) => a + b, 0) / values.length

      return {
        name: f.name,
        avg: avg.toFixed(1),
        min,
        max
      }
    }).filter(stat => stat !== null)

    // Categorical mode for select and relation fields
    const categoricalStats = categoricalFields.map(f => {
      // Gather historical + current
      const allValues = sorted.map(h => {
        if (f.type === 'relation') {
          // Resolve relation from ID? We might only have the ID here. Let's just use the ID for now, 
          // or if we have relationsData we could map it, but we only have relationsData for the current record.
          // Wait, h.relations[f.name] might have the ID!
          return h.relations?.[f.name]
        }
        return h.data[f.name]
      }).filter(Boolean)
      
      if (f.type === 'relation' && formData[f.name]) {
        // formData doesn't hold relation IDs, relationsData does
        if (relationsData?.[f.name]) {
          allValues.push(relationsData[f.name])
        }
      } else if (formData[f.name]) {
        allValues.push(formData[f.name])
      }

      const frequencies: Record<string, number> = {}
      allValues.forEach(val => {
        frequencies[val] = (frequencies[val] || 0) + 1
      })

      let modeId: string | null = null
      let maxFreq = 0
      for (const [val, freq] of Object.entries(frequencies)) {
        if (freq > maxFreq) {
          maxFreq = freq
          modeId = val
        }
      }

      return {
        name: f.name,
        type: f.type,
        modeId,
        count: maxFreq
      }
    }).filter((stat): stat is typeof stat & { modeId: string } => stat.modeId !== null)

    return {
      totalRecords,
      numericStats,
      categoricalStats
    }
  }, [categoryHistory, numberFields, categoricalFields, formData, relationsData])
  const [macroRelationLabels, setMacroRelationLabels] = useScopedPreviewState<Record<string, string>>(record?.site_id, {})

  useEffect(() => {
    let active = true
    setMacroRelationLabels({})
    if (macroAnalysis?.categoricalStats && record?.site_id) {
      const siteId = record.site_id
      const values = Object.fromEntries(macroAnalysis.categoricalStats
        .filter(stat => stat.type === "relation").map(stat => [stat.name, stat.modeId]))
      const entitiesToResolve = buildPreviewRequests(fields, values)
      if (entitiesToResolve.length > 0) {
        import("../../actions").then(({ resolveRelationsForSidebar }) => {
          if (!active) return
          fetchPreviewBatches(entitiesToResolve, siteId, resolveRelationsForSidebar).then(res => {
            if (active) setMacroRelationLabels(res)
          })
        })
      }
    }
    return () => { active = false }
  }, [macroAnalysis?.categoricalStats, fields, record?.site_id, setMacroRelationLabels])

  const dynamicCrosses = useMemo(() => {
    if (categoryHistory.length === 0) return []

    const crosses: InsightCross[] = []
    const seenCatVsCat = new Set<string>()

    categoricalFields.forEach(catField => {
      let currentVal = formData[catField.name]
      if (catField.type === 'relation') {
         currentVal = relationsData?.[catField.name]
      }
      if (!currentVal) return

      const subset = categoryHistory.filter(h => {
        if (catField.type === 'relation') return h.relations?.[catField.name] === currentVal
        return h.data[catField.name] === currentVal
      })

      if (subset.length <= 1) return // Need at least 2 records for a meaningful cross-analysis

      // Cross 1: Categorical vs Numeric
      numberFields.forEach(numField => {
        const subsetVals = subset.map(h => metricNumber(h.data[numField.name])).filter(isMetricNumber)
        if (subsetVals.length === 0) return
        
        const subsetAvg = subsetVals.reduce((a, b) => a + b, 0) / subsetVals.length
        
        const allVals = categoryHistory.map(h => metricNumber(h.data[numField.name])).filter(isMetricNumber)
        const overallAvg = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0
        
        if (overallAvg > 0) {
          const diff = ((subsetAvg - overallAvg) / overallAvg) * 100
          crosses.push({
            type: 'cat_vs_num',
            catName: catField.name,
            catVal: currentVal,
            isRelation: catField.type === 'relation',
            numName: numField.name,
            subsetAvg,
            overallAvg,
            diff,
            count: subset.length
          })
        }
      })

      // Cross 2: Categorical vs Categorical
      categoricalFields.forEach(otherCatField => {
        if (catField.name === otherCatField.name) return
        
        // Avoid duplicates (A vs B is same context as B vs A if we just look at correlations, but here we are saying "Given A, most common B is...")
        // Actually, "Given A, B" is different from "Given B, A". So we can keep it, but maybe limit to strong ones.
        
        const frequencies: Record<string, number> = {}
        subset.forEach(h => {
          let val = h.data[otherCatField.name]
          if (otherCatField.type === 'relation') {
            val = h.relations?.[otherCatField.name]
          }
          if (val) {
            frequencies[val] = (frequencies[val] || 0) + 1
          }
        })
        
        let modeVal = null
        let maxFreq = 0
        Object.entries(frequencies).forEach(([v, f]) => {
          if (f > maxFreq) {
            maxFreq = f
            modeVal = v
          }
        })

        // If this mode value appears in more than 50% of the subset, it's a strong correlation
        if (modeVal && maxFreq > 0 && (maxFreq / subset.length) >= 0.5) {
          const crossKey = [catField.name, otherCatField.name].sort().join('-')
          if (!seenCatVsCat.has(crossKey)) {
            seenCatVsCat.add(crossKey)
            crosses.push({
              type: 'cat_vs_cat',
              catName: catField.name,
              catVal: currentVal,
              isRelation: catField.type === 'relation',
              otherCatName: otherCatField.name,
              otherCatVal: modeVal,
              isOtherRelation: otherCatField.type === 'relation',
              count: maxFreq,
              totalSubset: subset.length,
              percentage: Math.round((maxFreq / subset.length) * 100)
            })
          }
        }
      })
    })

    return crosses
  }, [categoryHistory, formData, relationsData, categoricalFields, numberFields])

  const metaAnalysis = useMemo(() => {
    if (chartData.length === 0) return null

    const totalRecords = chartData.length

    // Sort ascending to calculate time differences
    const sorted = [...chartData].sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
    const firstDate = sorted[0].rawDate
    const lastDate = sorted[sorted.length - 1].rawDate
    
    const daysSinceFirst = Math.max(0, Math.floor((new Date().getTime() - firstDate.getTime()) / (1000 * 3600 * 24)))
    const daysSinceLast = Math.max(0, Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24)))

    // Calculate average periodicity
    let avgPeriodicity = 0
    if (totalRecords > 1) {
      const diffs = []
      for (let i = 1; i < sorted.length; i++) {
        const diffMs = sorted[i].rawDate.getTime() - sorted[i-1].rawDate.getTime()
        diffs.push(diffMs / (1000 * 3600 * 24))
      }
      avgPeriodicity = diffs.reduce((a, b) => a + b, 0) / diffs.length
    }

    // Numeric field stats
    const numericStats = numberFields.map(f => {
      const values = sorted.map(p => p.values[f.name]).filter(isMetricNumber)
      if (values.length === 0) return null

      const max = Math.max(...values)
      const min = Math.min(...values)
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const current = sorted.find(point => point.id === record?.id)?.values[f.name] ?? null

      let trend: number | null = null
      if (avg > 0 && current !== null) {
        trend = ((current - avg) / avg) * 100
      }

      return {
        name: f.name,
        avg: avg.toFixed(1),
        min,
        max,
        current,
        trend: trend === null ? null : trend.toFixed(1)
      }
    }).filter(stat => stat !== null)

    // Categorical mode (most frequent value)
    const categoricalStats = selectFields.map(f => {
      // Gather historical + current
      const allValues = metricRecords.map(h => h.data[f.name]).filter(Boolean)

      const frequencies: Record<string, number> = {}
      allValues.forEach(val => {
        frequencies[val] = (frequencies[val] || 0) + 1
      })

      let mode = null
      let maxFreq = 0
      Object.entries(frequencies).forEach(([val, freq]) => {
        if (freq > maxFreq) {
          maxFreq = freq
          mode = val
        }
      })

      return {
        name: f.name,
        mode,
        count: maxFreq
      }
    }).filter(s => s.mode !== null)

    return {
      activity: {
        totalRecords,
        avgPeriodicity: Math.round(avgPeriodicity),
        daysSinceFirst,
        daysSinceLast
      },
      numericStats,
      categoricalStats
    }
  }, [chartData, numberFields, selectFields, metricRecords, record?.id])

  return {
    hasDescription, numberFields, selectFields, fileFields,
    chartData, numericData, metaAnalysis, macroAnalysis, dynamicCrosses,
    metricRecords, historyStatus, setHistoryRelation, retryHistory,
    primaryRelationName, primaryRelationLabel, macroRelationLabels,
    activeRelations, allRelationLabels, categoryHistory, categoryStatus,
  }
}
