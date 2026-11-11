import { getRelationTargetConfig } from "./relation-target"

export type Validation = { valid: true } | { valid: false; error: string }
export type ValidatedTemplateField = {
  id: string
  name: string
  type: string
  label?: string
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  options?: string[]
  relationTarget?: string
  targetCategoryId?: string
  [key: string]: unknown
}
export type TemplateValidation =
  | { valid: true; fields: ValidatedTemplateField[] }
  | { valid: false; error: string }

export const recordUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const types = new Set(["text", "description", "number", "date", "select", "boolean", "location", "relation", "file", "table"])
const textTypes = new Set(["text", "description", "location", "file"])
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"])

export function isRecordObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

export function validateTemplateFields(fields: unknown): TemplateValidation {
  if (!Array.isArray(fields) || fields.length > 200) return { valid: false, error: "Template fields must be an array of at most 200 fields" }
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const field of fields) {
    if (!isRecordObject(field)) return { valid: false, error: "Invalid template field" }
    for (const key of ["id", "name"] as const) {
      const value = field[key]
      if (typeof value !== "string" || !value.trim() || value.length > 240 || unsafeKeys.has(value)) {
        return { valid: false, error: `Each field needs a valid ${key}` }
      }
    }
    const name = field.name as string
    if (ids.has(field.id as string) || names.has(name)) return { valid: false, error: "Field IDs and storage names must be unique" }
    ids.add(field.id as string)
    names.add(name)
    const fail = (reason: string): TemplateValidation => ({ valid: false, error: `${name}: ${reason}` })
    if (typeof field.type !== "string" || !types.has(field.type)) return fail("unsupported field type")
    if (field.label !== undefined && (typeof field.label !== "string" || !field.label.trim() || field.label.length > 240)) return fail("invalid display label")
    if (field.required !== undefined && typeof field.required !== "boolean") return fail("required must be a boolean")
    for (const bound of ["min", "max", "minLength", "maxLength"] as const) {
      const value = field[bound]
      if (value === undefined) continue
      if (typeof value !== "number" || !Number.isFinite(value)) return fail(`invalid ${bound}`)
      if (bound.endsWith("Length")) {
        if (!textTypes.has(field.type) || !Number.isInteger(value) || value < 0) return fail(`invalid ${bound}`)
      } else if (field.type !== "number") return fail(`${bound} is only supported for numbers`)
    }
    if (typeof field.min === "number" && typeof field.max === "number" && field.min > field.max) return fail("min exceeds max")
    if (typeof field.minLength === "number" && typeof field.maxLength === "number" && field.minLength > field.maxLength) return fail("minLength exceeds maxLength")
    if (field.type === "select") {
      if (!Array.isArray(field.options) || !field.options.length || field.options.length > 200
        || field.options.some(option => typeof option !== "string" || !option.trim() || option.length > 1000)
        || new Set(field.options).size !== field.options.length) return fail("select options must be unique nonempty strings")
    }
    if (field.type === "relation") {
      const target = field.relationTarget ?? "lead"
      // Legacy person definitions remain readable; new links are never admitted.
      if (typeof target !== "string" || (target !== "person" && !getRelationTargetConfig(target))) return fail("unsupported relation target")
      if (field.targetCategoryId !== undefined && (target !== "record" || typeof field.targetCategoryId !== "string" || !recordUuid.test(field.targetCategoryId))) return fail("invalid target category")
    } else if (field.relationTarget !== undefined || field.targetCategoryId !== undefined) return fail("relation configuration requires a relation field")
  }
  return { valid: true, fields: fields as ValidatedTemplateField[] }
}

/** Storage keys never rename. Populated schemas require an explicit data migration. */
export function validateTemplateFieldUpdate(previous: unknown, next: unknown, populated: boolean): TemplateValidation {
  const result = validateTemplateFields(next)
  if (!result.valid) return result
  if (previous === null) previous = [] // Nullable legacy templates have no fields.
  if (!Array.isArray(previous)) return { valid: false, error: "Existing template is invalid" }
  for (const field of result.fields) {
    const old = previous.find(candidate => isRecordObject(candidate) && candidate.id === field.id)
    if (field.relationTarget === "person" && (!old || old.relationTarget !== "person")) return { valid: false, error: "New person fields are unsupported" }
    if (populated && field.required && !old) return { valid: false, error: "Adding required fields to populated categories requires a data migration" }
  }
  for (const old of previous) {
    if (!isRecordObject(old)) return { valid: false, error: "Existing template is invalid" }
    const field = result.fields.find(candidate => candidate.id === old.id)
    if (field && field.name !== old.name) return { valid: false, error: "Existing field storage names are immutable; edit the display label instead" }
    if (!populated) continue
    if (!field || field.type !== old.type
      || (field.type === "relation" && ((field.relationTarget ?? "lead") !== (old.relationTarget ?? "lead") || field.targetCategoryId !== old.targetCategoryId))) {
      return { valid: false, error: "Populated fields cannot be removed, retyped, or retargeted without a data migration" }
    }
    if ((field.required && !old.required)
      || (field.min !== undefined && (typeof old.min !== "number" || field.min > old.min))
      || (field.max !== undefined && (typeof old.max !== "number" || field.max < old.max))
      || (field.minLength !== undefined && (typeof old.minLength !== "number" || field.minLength > old.minLength))
      || (field.maxLength !== undefined && (typeof old.maxLength !== "number" || field.maxLength < old.maxLength))
      || (field.type === "select" && Array.isArray(old.options) && old.options.some(option => !field.options?.includes(option)))) {
      return { valid: false, error: "Tightening populated field constraints requires a data migration" }
    }
  }
  return result
}

export function validateScalarValue(field: ValidatedTemplateField, value: unknown, requireValue: boolean): Validation {
  const fail = (reason: string): Validation => ({ valid: false, error: `${field.label || field.name}: ${reason}` })
  if (value === undefined || value === null || value === "") {
    return requireValue && field.required ? fail("is required") : { valid: true }
  }
  if (textTypes.has(field.type)) {
    if (typeof value !== "string") return fail("must be text")
    if (requireValue && field.required && !value.trim()) return fail("is required")
    if (field.minLength !== undefined && value.length < field.minLength) return fail("is too short")
    if (field.maxLength !== undefined && value.length > field.maxLength) return fail("is too long")
  } else if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return fail("must be a finite number")
    if (field.min !== undefined && value < field.min) return fail("is below the minimum")
    if (field.max !== undefined && value > field.max) return fail("exceeds the maximum")
  } else if (field.type === "boolean" && typeof value !== "boolean") return fail("must be a boolean")
  else if (field.type === "select" && (typeof value !== "string" || !field.options?.includes(value))) return fail("must be one of the configured options")
  else if (field.type === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
      || !Number.isFinite(Date.parse(value))) return fail("must be a valid date")
    const day = value.slice(0, 10)
    if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return fail("must be a valid calendar date")
  } else if (field.type === "relation" && (typeof value !== "string" || !recordUuid.test(value))) return fail("must be a single entity ID")
  else if (field.type === "table") {
    if (!Array.isArray(value) || value.length > 1000 || value.some(row => !isRecordObject(row)
      || Object.keys(row).length > 200 || Object.entries(row).some(([key, cell]) => unsafeKeys.has(key)
        || !(cell === null || typeof cell === "string" || typeof cell === "boolean" || (typeof cell === "number" && Number.isFinite(cell)))))) {
      return fail("must be a table of scalar cells")
    }
    if (requireValue && field.required && value.length === 0) return fail("is required")
  }
  return { valid: true }
}