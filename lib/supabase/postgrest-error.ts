export type PostgrestErrorSnapshot = {
  name: string
  message: string
  code: string
  details: string
  hint: string
  keys: string[]
}

function asRecord(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object") return null
  return error as Record<string, unknown>
}

function readString(value: unknown): string {
  if (typeof value === "string") return value
  if (value == null) return ""
  return String(value)
}

export function snapshotPostgrestError(error: unknown): PostgrestErrorSnapshot {
  if (error instanceof Error) {
    const record = asRecord(error)
    return {
      name: error.name || "Error",
      message: error.message || "",
      code: readString(record?.code),
      details: readString(record?.details),
      hint: readString(record?.hint),
      keys: record ? Object.keys(record) : [],
    }
  }

  if (typeof error === "string") {
    return { name: "", message: error, code: "", details: "", hint: "", keys: [] }
  }

  const record = asRecord(error)
  if (!record) {
    return { name: "", message: error == null ? "" : String(error), code: "", details: "", hint: "", keys: [] }
  }

  return {
    name: readString(record.name),
    message: readString(record.message),
    code: readString(record.code),
    details: readString(record.details),
    hint: readString(record.hint),
    keys: Object.keys(record),
  }
}

export function isAbortError(error: unknown): boolean {
  const snapshot = snapshotPostgrestError(error)
  const text = `${snapshot.name} ${snapshot.message} ${snapshot.hint}`.toLowerCase()
  return (
    snapshot.name === "AbortError" ||
    snapshot.name === "TimeoutError" ||
    snapshot.code === "ABORT_ERR" ||
    snapshot.code === "TIMEOUT_ERR" ||
    text.includes("abort")
  )
}

export function postgrestErrorMessage(error: unknown, fallback = "Request failed"): string {
  const snapshot = snapshotPostgrestError(error)
  return snapshot.message || snapshot.hint || snapshot.details || snapshot.code || fallback
}
