export type ExportScalar = string | number | boolean | null
export type ExportAvailability = "available" | "partial" | "unavailable" | "missing" | "empty"
export type ExportSchema = true | { readonly [key: string]: ExportSchema } | readonly [ExportSchema]
export type ReportExportRow = {
  dataset: string
  rowPath: string
  field: string
  value: ExportScalar
  availability: ExportAvailability
}

const cellTag = Symbol("export-cell")
type ExportCell = { [cellTag]: true; value: unknown; availability: ExportAvailability }

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

export function fields(...keys: string[]): Record<string, true> {
  return Object.fromEntries(keys.map(key => [key, true]))
}

export function observed(value: unknown, missing: unknown, population: unknown): unknown {
  if (typeof missing !== "number" || missing <= 0) return value
  const unavailable = typeof population === "number" && population > 0 && missing >= population
  return { [cellTag]: true, value: unavailable ? null : value,
    availability: unavailable ? "unavailable" : "partial" } satisfies ExportCell
}

/** Walk an explicit schema, never arbitrary payload keys or raw provider objects. */
export function projectRows(dataset: string, value: unknown, schema: ExportSchema): ReportExportRow[] {
  const rows: ReportExportRow[] = []
  function emit(rowPath: string, field: string, input: unknown, status?: ExportAvailability) {
    if (input && typeof input === "object" && cellTag in input) {
      const cell = input as ExportCell
      emit(rowPath, field, cell.value, cell.availability)
      return
    }
    const scalar = typeof input === "string" || typeof input === "boolean" ||
      typeof input === "number" && Number.isFinite(input)
    rows.push({ dataset, rowPath, field, value: scalar ? input as ExportScalar : null,
      availability: status ?? (input === undefined ? "missing" : scalar ? "available" : "unavailable") })
  }
  function visit(input: unknown, shape: ExportSchema, rowPath: string, field: string) {
    if (shape === true || input == null) {
      emit(rowPath, field, input)
      return
    }
    const path = field === "" ? rowPath : `${rowPath}.${field}`
    if (Array.isArray(shape)) {
      if (!Array.isArray(input)) emit(rowPath, field, null)
      else if (!input.length) emit(rowPath, field, null, "empty")
      else input.forEach((item, index) => visit(item, shape[0], `${path}[${index}]`, ""))
      return
    }
    if (typeof input !== "object" || Array.isArray(input)) {
      emit(rowPath, field, null)
      return
    }
    for (const [key, child] of Object.entries(shape)) visit(record(input)[key], child, path, key)
  }
  visit(value, schema, "$", "")
  return rows
}

export const metricSchema = fields("actual", "previous", "percentChange", "periodType", "noData", "currency", "unit")
export const comparisonSchema = fields("actual", "previous", "percentChange")
export const categorySchema = fields("name", "amount", "prevAmount", "percentChange")
export const distributionSchema = fields("name", "value")
export const periodSchema = fields("startDate", "endDate", "prevStartDate", "prevEndDate", "segmentId", "basis", "dateBasis")