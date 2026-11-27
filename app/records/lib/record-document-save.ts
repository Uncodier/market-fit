import { getRecordById, updateRecord, type RecordItem } from "../actions"

export type RecordDocumentDraft = Pick<RecordItem, "title" | "status" | "data" | "relations"> & { description: string }

const textFields = ["title", "description", "status"] as const
const mapFields = ["data", "relations"] as const

export function recordDocumentDraft(record: Partial<RecordItem> = {}): RecordDocumentDraft {
  return {
    title: record.title ?? "",
    description: record.description ?? "",
    status: record.status ?? "draft",
    data: record.data ?? {},
    relations: record.relations ?? {},
  }
}

// JSON object key order can change on a round trip through Postgres jsonb.
function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => equal(value, right[index]))
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key)
    && equal(Reflect.get(left, key), Reflect.get(right, key)))
}

/** Three-way merge per field; descriptions and individual field values are atomic. */
export function mergeRecordDocument(base: RecordDocumentDraft, local: RecordDocumentDraft, remote: RecordDocumentDraft) {
  let conflict = false
  const choose = <T,>(before: T, draft: T, latest: T): T => {
    if (equal(draft, before)) return latest
    if (!equal(latest, before) && !equal(latest, draft)) conflict = true
    return draft
  }
  const merged = { ...remote }
  for (const field of textFields) merged[field] = choose(base[field], local[field], remote[field])
  for (const field of mapFields) {
    const keys = new Set([...Object.keys(base[field]), ...Object.keys(local[field]), ...Object.keys(remote[field])])
    const value = (doc: RecordDocumentDraft, key: string) => Object.hasOwn(doc[field], key) ? doc[field][key] : undefined
    merged[field] = Object.fromEntries(Array.from(keys, (key) => [
      key, choose(value(base, key), value(local, key), value(remote, key)),
    ]).filter(([, value]) => value !== undefined))
  }
  return { merged, conflict }
}

function documentPatch(base: RecordDocumentDraft, next: RecordDocumentDraft) {
  return Object.fromEntries([...textFields, ...mapFields]
    .filter((field) => !equal(base[field], next[field]))
    .map((field) => [field, next[field]])) as Partial<RecordDocumentDraft>
}

function normalizeDraft(base: RecordDocumentDraft, input: RecordDocumentDraft) {
  const draft = { ...input }
  // Trim only local edits, not untouched legacy values read from the record.
  for (const field of ["title", "status"] as const) {
    if (input[field] !== base[field]) draft[field] = input[field].trim()
  }
  return draft
}

export function rebasePendingDocumentEdits(opened: RecordItem, submitted: RecordDocumentDraft, current: RecordDocumentDraft, saved: RecordItem) {
  const base = recordDocumentDraft(opened)
  return mergeRecordDocument(normalizeDraft(base, submitted), normalizeDraft(base, current), recordDocumentDraft(saved))
}

type DocumentSaveResult =
  | { record: RecordItem; previousVersion: string }
  | { error: string; conflict?: boolean }

const conflictMessage = "This value changed since editing began. Review the latest version before editing again."
const busyMessage = "The record is still changing. Try saving again."
const retryDelays = [100, 250]

export async function saveRecordDocument(
  opened: RecordItem,
  input: Partial<Pick<RecordItem, keyof RecordDocumentDraft>>,
): Promise<DocumentSaveResult> {
  const base = recordDocumentDraft(opened)
  const draft = normalizeDraft(base, recordDocumentDraft({ ...base, ...input }))
  let latest = opened

  for (let attempt = 0; ; attempt++) {
    const remote = recordDocumentDraft(latest)
    const { merged, conflict } = mergeRecordDocument(base, draft, remote)
    if (conflict) return { error: conflictMessage, conflict: true }
    const patch: Partial<RecordItem> = documentPatch(remote, merged)
    if (input.description === null && patch.description === "") patch.description = null
    if (!Object.keys(patch).length) return { record: latest, previousVersion: latest.updated_at }
    if (attempt > retryDelays.length) return { error: busyMessage }

    const result = await updateRecord(opened.id, patch, latest.updated_at)
    if (result.record) return {
      record: { ...latest, ...patch, ...result.record, category: latest.category }, previousVersion: latest.updated_at,
    }
    if ((!result.conflict && !result.retryable) || (result.retryable && attempt === retryDelays.length)) {
      return { error: result.error ?? "Failed to save record" }
    }

    if (result.retryable) await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]))
    const fresh = await getRecordById(opened.id)
    if (!fresh.record || fresh.error) return { error: fresh.error || "Unable to reload the latest record for saving" }
    if (fresh.record.site_id !== opened.site_id) return { error: "The record is no longer in this workspace." }
    if (fresh.record.category_id !== opened.category_id
      || !equal(fresh.record.category?.template_fields ?? [], opened.category?.template_fields ?? [])) {
      return { error: "The record's field template changed. Your edits have not been saved.", conflict: true }
    }
    latest = fresh.record
  }
}