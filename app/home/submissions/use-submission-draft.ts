'use client'

import { useEffect, useRef, useState } from 'react'
import { applicantKey } from './applicant-picker'
import { draftSchema, type Draft, type DraftResponse } from './draft-schema'
import type { Opportunity } from './types'

const emptyDraft = (): Draft => ({ reference: '', prices: {}, evidence: {}, key: crypto.randomUUID(),
  attempted: false, registeredSupplier: null, proposalRevision: '', holderName: '' })

export function useSubmissionDraft(userId: string | undefined, opportunity: Opportunity) {
  const applicant = applicantKey(opportunity)
  const publication = opportunity.publication_id
  const version = opportunity.version
  const identity = `${userId}:${publication}:${version}:${applicant}`
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const revision = useRef<number | null>(null)
  const locked = useRef(false)
  const ready = !!userId && loadedIdentity === identity
  const selector = { publication_id: publication, version, applicant_key: applicant }
  const endpoint = '/api/procurement/credentials/drafts'
  const query = new URLSearchParams({ publication_id: publication, version: String(version), applicant_key: applicant })

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ publication_id: publication, version: String(version), applicant_key: applicant })
    if (!userId) return () => controller.abort()
    async function load() {
      try {
        const response = await fetch(`${endpoint}?${params}`, { cache: 'no-store', signal: controller.signal })
        const result = await response.json() as DraftResponse
        if (!response.ok) throw new Error('Unable to restore draft')
        const restored = result.draft ? draftSchema.parse(result.draft) : emptyDraft()
        if (controller.signal.aborted) return
        revision.current = result.draft_revision
        setDraft(restored); setLoadedIdentity(identity)
        setNotice(result.draft ? 'procurement.portal.draft.restored' : '')
      } catch {
        if (!controller.signal.aborted) {
          setLoadedIdentity(null); setNotice('procurement.portal.draft.loadFailed')
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [userId, publication, version, applicant, identity, reloadCount])

  function update<K extends keyof Draft>(field: K, value: Draft[K] | ((previous: Draft[K]) => Draft[K])) {
    if (!ready || locked.current || draft.attempted) return
    setDraft(current => ({ ...current, [field]: typeof value === 'function' ? value(current[field]) : value }))
    setNotice('')
  }
  async function persist(next: Draft) {
    if (!ready || locked.current) throw new Error('Draft is not ready')
    locked.current = true; setSaving(true)
    try {
      const response = await fetch(endpoint, { method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selector, expected_revision: revision.current, draft: draftSchema.parse(next) }) })
      const result = await response.json() as DraftResponse
      if (!response.ok || !result.draft) {
        if (response.status === 409) setLoadedIdentity(null)
        throw new Error('Unable to save draft')
      }
      const saved = draftSchema.parse(result.draft)
      revision.current = result.draft_revision
      setDraft(saved); setNotice('procurement.portal.draft.saved')
      return saved
    } finally { locked.current = false; setSaving(false) }
  }
  async function save() {
    try { await persist(draft); return true }
    catch { setNotice('procurement.portal.draft.saveFailed'); return false }
  }
  async function recordAttempt(supplierId: string | null) {
    try { return await persist({ ...draft, attempted: true, registeredSupplier: supplierId }) }
    catch { setNotice('procurement.portal.draft.saveFailed'); throw new Error('Unable to save draft') }
  }
  async function clear() {
    if (revision.current === null) return
    const params = new URLSearchParams(query)
    params.set('expected_revision', String(revision.current))
    const response = await fetch(`${endpoint}?${params}`, { method: 'DELETE', cache: 'no-store' })
    if (!response.ok) throw new Error('Unable to clear draft')
    revision.current = null
  }
  return { ...draft, ready, saving, notice, save, recordAttempt, clear,
    reload: () => { setLoadedIdentity(null); setReloadCount(value => value + 1) },
    setReference: (value: string) => update('reference', value),
    setPrices: (value: Draft['prices']) => update('prices', value),
    setEvidence: (value: Draft['evidence'] | ((previous: Draft['evidence']) => Draft['evidence'])) => update('evidence', value),
    setRegisteredSupplier: (value: string | null) => update('registeredSupplier', value),
    setProposalRevision: (value: string) => update('proposalRevision', value),
    setHolderName: (value: string) => update('holderName', value),
  }
}