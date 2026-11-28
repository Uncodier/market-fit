import { fieldPreviewKey } from "../lib/entity-preview-request"
import { recordFieldLabel, recordScalarFieldValue } from "../lib/field-values"
import { formatRecordCurrency } from "../lib/record-field-presentation"
import type { InsightField } from "./components/insights-types"
import type { RecordInsights } from "./components/record-insight-context"
import type { RecordOutputDocument } from "./record-output"

export interface RecordOutputDraft {
  title: string
  description: string
  status: string
  category?: string
  fields: InsightField[]
  formData: Record<string, unknown>
  relationsData: Record<string, unknown>
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(displayValue).join("\n")
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, entry]) => `${key}: ${displayValue(entry)}`).join("; ")
  }
  return String(value ?? "")
}

function insightLines(insights: RecordInsights, fields: InsightField[]) {
  const { metaAnalysis, macroAnalysis, dynamicCrosses } = insights
  const lines: string[] = []
  const label = (name: string, value: string, labels: Record<string, string>) =>
    labels[fieldPreviewKey(fields.find(field => field.name === name), value)] || value
  if (metaAnalysis) {
    const scope = insights.primaryRelationLabel || insights.primaryRelationName
    lines.push(`Saved record activity${scope ? ` (${scope})` : ""}: ${metaAnalysis.activity.totalRecords} records`)
    for (const stat of metaAnalysis.numericStats) {
      const trend = stat.trend === null ? "" : `, ${stat.trend}% vs. average`
      lines.push(`${stat.name}: average ${stat.avg}, range ${stat.min}–${stat.max}${trend}`)
    }
    for (const stat of metaAnalysis.categoricalStats) {
      lines.push(`Most frequent ${stat.name} in saved records: ${stat.mode} (${stat.count} occurrences)`)
    }
  }
  if (macroAnalysis) {
    lines.push(`Category activity: ${macroAnalysis.totalRecords} records`)
    for (const stat of macroAnalysis.numericStats) {
      lines.push(`Category ${stat.name}: average ${stat.avg}, range ${stat.min}–${stat.max}`)
    }
    for (const stat of macroAnalysis.categoricalStats) {
      const mode = stat.type === "relation" ? label(stat.name, stat.modeId, insights.macroRelationLabels) : stat.modeId
      lines.push(`Most frequent ${stat.name}: ${mode} (${stat.count} occurrences)`)
    }
  }
  for (const cross of dynamicCrosses) {
    const group = cross.isRelation ? label(cross.catName, cross.catVal, insights.allRelationLabels) : cross.catVal
    if (cross.type === "cat_vs_num") {
      lines.push(`${cross.catName} = ${group}: average ${cross.numName} is ${cross.subsetAvg.toFixed(1)} (category average ${cross.overallAvg.toFixed(1)}).`)
    } else {
      const other = cross.isOtherRelation ? label(cross.otherCatName, cross.otherCatVal, insights.allRelationLabels) : cross.otherCatVal
      lines.push(`${cross.catName} = ${group}: ${cross.otherCatName} is ${other} in ${cross.percentage}% of cases.`)
    }
  }
  if (insights.historyStatus === "error") lines.push("Related record history is unavailable.")
  if (insights.categoryStatus === "error") lines.push("Category insights are unavailable.")
  return lines.length ? lines : ["No analytical insights are available for this record."]
}

export function buildRecordOutput(draft: RecordOutputDraft, insights: RecordInsights, includeInsights: boolean): RecordOutputDocument {
  return {
    title: draft.title.trim() || "Untitled record",
    metadata: [...(draft.category ? [`Category: ${draft.category}`] : []), `Status: ${draft.status}`],
    description: draft.description,
    fields: draft.fields.flatMap(field => {
      const relation = draft.relationsData[field.name]
      const value = field.type === "relation"
        ? (typeof relation === "string" ? insights.allRelationLabels[fieldPreviewKey(field, relation)] || relation : relation)
        : recordScalarFieldValue(field.type, draft.formData[field.name])
      const text = (field.type === "number" && "currency" in field ? formatRecordCurrency(value, field.currency) : undefined)
        ?? displayValue(value)
      return text ? [{ label: recordFieldLabel(field), value: text }] : []
    }),
    ...(includeInsights && { insights: insightLines(insights, draft.fields) }),
  }
}