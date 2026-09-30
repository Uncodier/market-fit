import type { RecordItem } from "@/app/records/actions"
import type { InsightField } from "@/app/records/[id]/components/insights-types"

export const previewField: InsightField = {
  id: "concept-field",
  name: "Concept",
  type: "text",
  aiPreview: { enabled: true, promptTemplate: "Illustrate {value} beside {value}" },
}

export const relationField: InsightField = {
  id: "customer-field",
  name: "Customer",
  type: "relation",
  relationTarget: "lead",
}

export function insightRecord(overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    id: "current-record",
    site_id: "site-1",
    category_id: "category-1",
    title: "Current record",
    description: null,
    data: {},
    relations: {},
    status: "active",
    created_at: "2026-01-03T12:00:00Z",
    updated_at: "2026-01-03T12:00:00Z",
    ...overrides,
  }
}