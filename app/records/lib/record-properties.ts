import type { RecordItem } from "../actions"
import { recordScalarFieldValue } from "./field-values"
import type { ValidatedTemplateField } from "./template-validation"

export type RecordProperty =
  | { label: string; key: "title" | "description" | "status" }
  | { label: string; key: "field"; field: ValidatedTemplateField }

export const titleProperty = { label: "Title", key: "title" } as const
export const descriptionProperty = { label: "Description", key: "description" } as const
export const statusProperty = { label: "Status", key: "status" } as const

export function readRecordProperty(record: RecordItem, property: RecordProperty): unknown {
  if (property.key !== "field") return record[property.key]
  const { name, type } = property.field
  return type === "relation" ? record.relations?.[name] : recordScalarFieldValue(type, record.data?.[name])
}

export function recordPropertyUpdate(record: RecordItem, property: RecordProperty, value: unknown): Partial<RecordItem> {
  if (property.key === "field") {
    const key = property.field.type === "relation" ? "relations" : "data"
    return { [key]: { ...record[key], [property.field.name]: value } }
  }
  if (property.key === "description") return { description: value ? String(value) : null }
  return { [property.key]: String(value ?? "").trim() }
}

export type SaveRecordProperty = (record: RecordItem, updates: Partial<RecordItem>) => Promise<{
  error?: string
  conflict?: boolean
}>