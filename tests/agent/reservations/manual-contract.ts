import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { fixtureClient } from '../../support/mutation-fixtures'
import { requireMutationEnvironment, requireUuid } from '../../support/mutation-safety'
import { required } from '../../support/environment'
import { loadItem } from './fixture'

const rowSchema = z.object({
  id: z.string().uuid(), site_id: z.string().uuid(), catalog_item_id: z.string().uuid(),
  lead_id: z.string().uuid(), notes: z.string(), status: z.literal('confirmed'),
  start_time: z.string().datetime({ offset: true }), end_time: z.string().datetime({ offset: true }),
  sale_order_item_id: z.string().uuid(),
}).passthrough()

function identity() {
  requireMutationEnvironment()
  const item = loadItem()
  return { ...item, leadId: requireUuid(required(process.env, 'TEST_RESERVATION_CUSTOMER_ID'), 'customer ID') }
}

export function manualRunMarker(): string {
  return `Shiplight Manual Reservation ${identity().runId}`
}

/** Accept a decoded action result, never a UUID guessed from the Flight/UI payload. */
export function validateManualActionResult(result: unknown) {
  const parsed = z.object({ data: rowSchema, error: z.never().optional() }).parse(result)
  const row = parsed.data
  const owner = identity()
  if (row.site_id !== owner.siteId || row.catalog_item_id !== owner.itemId
    || row.lead_id !== owner.leadId || row.notes !== manualRunMarker()
    || Date.parse(row.end_time) <= Date.parse(row.start_time)) {
    throw new Error('Manual reservation does not match the exact run-owned creation intent')
  }
  return row
}

function journalPath() {
  const owner = identity()
  return path.resolve(__dirname, '.runtime', owner.runId, 'manual-reservation.json')
}

/** Local journal only. This function performs no database/provider mutation. */
export function journalManualActionResult(result: unknown) {
  const reservation = validateManualActionResult(result)
  const owner = identity()
  const file = journalPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({
    version: 1, runId: owner.runId, siteId: owner.siteId, itemId: owner.itemId,
    reservation, persisted: false,
    cleanup: { completed: false, reservationId: reservation.id,
      saleOrderItemId: reservation.sale_order_item_id,
      blocker: 'Resolve exact linked order/sale and financial side effects before cleanup; no deletion is authorized by this journal.' },
  }), { flag: 'wx', mode: 0o600 })
  return reservation
}

export function loadManualJournal() {
  const value = JSON.parse(fs.readFileSync(journalPath(), 'utf8'))
  const owner = identity()
  if (value.version !== 1 || value.runId !== owner.runId || value.siteId !== owner.siteId
    || value.itemId !== owner.itemId || value.cleanup?.completed !== false) {
    throw new Error('Manual reservation journal belongs to another execution or has unsupported cleanup state')
  }
  const reservation = validateManualActionResult({ data: value.reservation })
  if (value.cleanup.reservationId !== reservation.id
    || value.cleanup.saleOrderItemId !== reservation.sale_order_item_id) {
    throw new Error('Manual cleanup identities do not match the captured reservation')
  }
  return { ...value, reservation }
}

/** Authenticates with the existing public-key fixture client; RLS reads only. */
export async function assertManualReservationPersisted() {
  const journal = loadManualJournal()
  const { client, siteId } = await fixtureClient()
  if (siteId !== journal.siteId) throw new Error('Manual verification tenant mismatch')
  const result = await client.from('reservations')
    .select('id,site_id,catalog_item_id,lead_id,notes,status,start_time,end_time,sale_order_item_id')
    .eq('site_id', siteId).eq('id', journal.reservation.id).single()
  if (result.error || !result.data) throw new Error('Manual reservation persisted read failed; denial is not absence')
  const persisted = validateManualActionResult({ data: result.data })
  for (const key of ['id', 'sale_order_item_id'] as const) {
    if (persisted[key] !== journal.reservation[key]) throw new Error('Manual persisted reservation identity changed')
  }
  for (const key of ['start_time', 'end_time'] as const) {
    if (Date.parse(persisted[key]) !== Date.parse(journal.reservation[key])) {
      throw new Error('Manual persisted reservation slot changed')
    }
  }
  return persisted
}