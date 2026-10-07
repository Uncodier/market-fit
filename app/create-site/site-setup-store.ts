import { z } from 'zod'
import { checkSiteSetup, startSiteSetup } from './start-site-setup'
import { isSiteSetupWorkflowId, setupDetailSchema, setupFeedback, setupIdSchema,
  setupStatusSchema, unconfirmedSetup, type SiteSetupFeedback } from './site-setup-feedback'

const recordSchema = z.object({
  version: z.literal(1), userId: setupIdSchema, siteId: setupIdSchema,
  status: setupStatusSchema, workflowId: z.string().max(100).optional(), detail: setupDetailSchema.optional(),
}).strict()
type Entry = { raw: string | null; feedback: SiteSetupFeedback | null; memoryOnly: boolean; listeners: Set<() => void> }

export function siteSetupStorageKey(userId: string, siteId: string): string | null {
  if (!setupIdSchema.safeParse(userId).success || !setupIdSchema.safeParse(siteId).success) return null
  return `site-setup:v1:${userId.toLowerCase()}:${siteId.toLowerCase()}`
}

/** Browser feedback only: no stored DTO is sent to a server or used for billing. */
export function createSiteSetupStore(storage: () => Storage | null = () =>
  typeof window === 'undefined' ? null : window.sessionStorage) {
  const entries = new Map<string, Entry>()
  const starts = new Map<string, Promise<void>>()
  const checks = new Map<string, Promise<void>>()
  const entryFor = (key: string) => {
    let entry = entries.get(key)
    if (!entry) {
      entry = { raw: null, feedback: null, memoryOnly: false, listeners: new Set() }
      entries.set(key, entry)
    }
    return entry
  }
  const getSnapshot = (userId: string, siteId: string): SiteSetupFeedback | null => {
    const key = siteSetupStorageKey(userId, siteId)
    if (!key) return null
    const entry = entryFor(key)
    if (entry.memoryOnly) return entry.feedback
    let raw: string | null
    try {
      const browserStorage = storage()
      if (!browserStorage) return entry.feedback
      raw = browserStorage.getItem(key)
    } catch { return entry.feedback }
    if (raw === entry.raw) return entry.feedback
    entry.raw = raw
    entry.feedback = null
    try {
      if (!raw || raw.length > 1024) return null
      const parsed = recordSchema.safeParse(JSON.parse(raw))
      if (!parsed.success || parsed.data.userId !== userId.toLowerCase()
        || parsed.data.siteId !== siteId.toLowerCase()
        || (parsed.data.workflowId !== undefined && !isSiteSetupWorkflowId(parsed.data.workflowId, siteId))) return null
      // Reload interrupts an HTTP launch. Missing identity is not proof it never started.
      const status = parsed.data.status === 'pending' && !parsed.data.workflowId && !starts.has(key)
        ? 'unconfirmed' : parsed.data.status
      entry.feedback = setupFeedback(status, parsed.data.workflowId, parsed.data.detail)
    } catch { /* Corrupt storage is not an execution result. */ }
    return entry.feedback
  }
  const save = (userId: string, siteId: string, value: SiteSetupFeedback) => {
    const key = siteSetupStorageKey(userId, siteId)
    if (!key) return
    const current = getSnapshot(userId, siteId)
    const status = setupStatusSchema.safeParse(value.status)
    const detail = setupDetailSchema.safeParse(value.detail)
    const workflowId = isSiteSetupWorkflowId(value.workflowId, siteId) ? value.workflowId : current?.workflowId
    const feedback = setupFeedback(status.success ? status.data : 'unconfirmed', workflowId,
      detail.success ? detail.data : undefined)
    // Reconstruct copy from allowlisted codes; never persist arbitrary response text or PII.
    const raw = JSON.stringify({ version: 1, userId: userId.toLowerCase(), siteId: siteId.toLowerCase(),
      status: feedback.status, workflowId: feedback.workflowId, detail: feedback.detail })
    const entry = entryFor(key)
    entry.raw = raw
    entry.feedback = feedback
    try {
      const browserStorage = storage()
      browserStorage?.setItem(key, raw)
      entry.memoryOnly = !browserStorage
    } catch { entry.memoryOnly = true }
    entry.listeners.forEach(listener => listener())
  }
  const subscribe = (userId: string, siteId: string, listener: () => void) => {
    const key = siteSetupStorageKey(userId, siteId)
    if (!key) return () => {}
    const entry = entryFor(key)
    entry.listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener()
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
    return () => {
      entry.listeners.delete(listener)
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
  }
  const launch = (userId: string, siteId: string): Promise<void> => {
    const key = siteSetupStorageKey(userId, siteId)
    if (!key) return Promise.resolve()
    if (starts.has(key)) return starts.get(key)!
    // Even an ambiguous pending/terminal record must never cause an automatic replay.
    if (getSnapshot(userId, siteId)) return Promise.resolve()
    save(userId, siteId, setupFeedback('pending'))
    const task = startSiteSetup(siteId).then(result => save(userId, siteId, result))
      .catch(() => save(userId, siteId, unconfirmedSetup()))
      .finally(() => starts.delete(key))
    starts.set(key, task)
    return task
  }
  const check = (userId: string, siteId: string): Promise<void> => {
    const key = siteSetupStorageKey(userId, siteId)
    const workflowId = getSnapshot(userId, siteId)?.workflowId
    if (!key || !workflowId) return Promise.resolve()
    if (checks.has(key)) return checks.get(key)!
    const task = checkSiteSetup(siteId, workflowId).then(result => save(userId, siteId, result))
      .catch(() => save(userId, siteId, unconfirmedSetup(workflowId)))
      .finally(() => checks.delete(key))
    checks.set(key, task)
    return task
  }
  return { getSnapshot, subscribe, launch, check }
}

export const siteSetupStore = createSiteSetupStore()