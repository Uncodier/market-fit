import { createContext, useContext, useState, type ReactNode } from "react"
import type { InsightsTabProps } from "./insights-types"
import { useRecordInsights } from "./use-record-insights"

export type RecordInsights = ReturnType<typeof useRecordInsights>
const Context = createContext<{
  insights: RecordInsights
  requestInsights: (requested: boolean) => void
} | null>(null)

const empty: InsightsTabProps = { fields: [], formData: {} }

export function RecordInsightProvider({ children, visible, ...props }: InsightsTabProps & {
  children: ReactNode; visible: boolean
}) {
  const [requested, requestInsights] = useState(false)
  const insights = useRecordInsights(visible || requested ? props : empty)
  return <Context.Provider value={{ insights, requestInsights }}>{children}</Context.Provider>
}

export function useSharedRecordInsights() {
  const value = useContext(Context)
  if (!value) throw new Error("Record insight provider is missing")
  return value
}