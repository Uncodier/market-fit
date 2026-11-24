import { useEffect, useState } from "react"
import { getHistoricalRelatedRecords, type RecordItem } from "../../actions"
import { useScopedPreviewState } from "../../hooks/useScopedPreviewState"
import type { InsightsTabProps } from "./insights-types"

export function useMetricHistory({ fields, record, relationsData }: InsightsTabProps) {
  const selectionScope = JSON.stringify([record?.site_id, record?.category_id, record?.id])
  const [selection, setSelection] = useScopedPreviewState<string | null>(selectionScope, null)
  const relations = fields.filter(field => field.type === "relation"
    && typeof relationsData?.[field.name] === "string" && relationsData[field.name])
  const primaryRelationName = relations.find(field => field.name === selection)?.name
    ?? (relations.length === 1 ? relations[0].name : null)
  const primaryRelationId = primaryRelationName ? relationsData?.[primaryRelationName] as string : null
  const enabled = !!(record?.site_id && record.category_id && primaryRelationName && primaryRelationId)
  const [attempt, setAttempt] = useState(0)
  const scope = JSON.stringify([selectionScope, primaryRelationName, primaryRelationId, attempt])
  const [state, setState] = useScopedPreviewState<{
    records: RecordItem[]; status: "idle" | "loading" | "ready" | "error"
  }>(scope, { records: [], status: enabled ? "loading" : "idle" })

  useEffect(() => {
    if (!enabled || !record?.category_id || !primaryRelationName || !primaryRelationId) return
    let active = true
    setState({ records: [], status: "loading" })
    getHistoricalRelatedRecords(record.category_id, primaryRelationName, primaryRelationId)
      .then(result => {
        if (active) setState(result.error || !result.records
          ? { records: [], status: "error" }
          : { records: result.records, status: "ready" })
      })
      .catch(() => { if (active) setState({ records: [], status: "error" }) })
    return () => { active = false }
  }, [enabled, record?.category_id, primaryRelationName, primaryRelationId, scope, setState])

  return {
    history: state.records, historyStatus: state.status,
    primaryRelationName, primaryRelationId,
    setHistoryRelation: setSelection, retryHistory: () => setAttempt(value => value + 1),
  }
}