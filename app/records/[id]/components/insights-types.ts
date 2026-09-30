import type { RecordCategory, RecordItem } from "../../actions"

export interface InsightField {
  id: string
  name: string
  type: string
  relationTarget?: string
  aiPreview?: {
    enabled?: boolean
    promptTemplate?: string
  }
}

export interface InsightsTabProps {
  fields: InsightField[]
  formData: RecordItem["data"]
  description?: string
  record?: Partial<Omit<RecordItem, "category">> & {
    category?: Pick<RecordCategory, "name">
  }
  relationsData?: RecordItem["relations"]
}

export type InsightChartPoint = RecordItem["data"] & {
  date: string
  rawDate: Date
  id?: string
}

interface CrossContext {
  catName: string
  catVal: string
  isRelation: boolean
  count: number
}

export type InsightCross = CrossContext & (
  | {
      type: "cat_vs_num"
      numName: string
      subsetAvg: number
      overallAvg: number
      diff: number
    }
  | {
      type: "cat_vs_cat"
      otherCatName: string
      otherCatVal: string
      isOtherRelation: boolean
      totalSubset: number
      percentage: number
    }
)