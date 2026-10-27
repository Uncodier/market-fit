/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import { fixtureClient } from '../../tests/support/mutation-fixtures'
import { saveItem } from '../../tests/agent/reservations/fixture'
import {
  assertManualReservationPersisted, journalManualActionResult, loadManualJournal,
  manualRunMarker, validateManualActionResult,
} from '../../tests/agent/reservations/manual-contract'

jest.mock('../../tests/support/mutation-fixtures', () => ({ fixtureClient: jest.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const itemId = '22222222-2222-4222-8222-222222222222'
const leadId = '33333333-3333-4333-8333-333333333333'
const reservationId = '44444444-4444-4444-8444-444444444444'
const lineId = '55555555-5555-4555-8555-555555555555'
const foreignId = '66666666-6666-4666-8666-666666666666'
const originalEnv = process.env
let dir: string
let row: Record<string, unknown>

beforeEach(() => {
  process.env = { ...originalEnv, TEST_TARGET: 'local', TEST_SUITE: 'regression',
    TEST_BASE_URL: 'http://localhost:3000', TEST_COMMERCE_BASE_URL: 'http://localhost:3000',
    TEST_SITE_ID: id, TEST_SITE_NAME: 'Disposable', TEST_ALLOW_MUTATIONS: '1',
    TEST_DISPOSABLE_ENVIRONMENT: '1', TEST_RESERVATION_CUSTOMER_ID: leadId,
    AGENT_VERIFICATION_RUN_ID: `manual-contract-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}` }
  dir = path.resolve(__dirname, '../../tests/agent/reservations/.runtime', process.env.AGENT_VERIFICATION_RUN_ID!)
  saveItem(itemId)
  row = { id: reservationId, site_id: id, catalog_item_id: itemId, lead_id: leadId,
    notes: manualRunMarker(), status: 'confirmed', start_time: '2030-01-02T10:00:00Z',
    end_time: '2030-01-02T11:00:00Z', sale_order_item_id: lineId }
})
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); process.env = originalEnv; jest.clearAllMocks() })

it('journals only the exact successful returned reservation and line IDs in an exclusive private file', () => {
  expect(journalManualActionResult({ data: row })).toMatchObject({ id: reservationId })
  const journal = loadManualJournal()
  expect(journal.cleanup).toMatchObject({ completed: false, reservationId, saleOrderItemId: lineId })
  expect(journal.persisted).toBe(false)
  expect(fs.statSync(path.join(dir, 'manual-reservation.json')).mode & 0o777).toBe(0o600)
  expect(() => journalManualActionResult({ data: row })).toThrow(/EEXIST/)
})

it.each(['site_id', 'catalog_item_id', 'lead_id', 'id', 'sale_order_item_id'])('rejects foreign/malformed %s', key => {
  const changed = { ...row, [key]: ['id', 'sale_order_item_id'].includes(key) ? 'not-a-uuid' : foreignId }
  expect(() => journalManualActionResult({ data: changed })).toThrow()
  expect(fs.existsSync(path.join(dir, 'manual-reservation.json'))).toBe(false)
})

it.each([
  { error: 'Order creation failed after reservation commit' },
  { data: { id: reservationId } },
  { data: 'Flight UUID is not a decoded reservation' },
])('rejects errors, incomplete results and guessed payloads', result => {
  expect(() => validateManualActionResult(result)).toThrow()
})

it('rejects missing run marker, nonconfirmed state, reversed dates and mixed success/error', () => {
  for (const changed of [{ notes: 'Generic reservation' }, { status: 'pending' },
    { end_time: row.start_time }, { start_time: 'invalid' }]) {
    expect(() => validateManualActionResult({ data: { ...row, ...changed } })).toThrow()
  }
  expect(() => validateManualActionResult({ data: row, error: 'Partial failure' })).toThrow()
})

it('rejects stale journal or mismatched cleanup identity without any backend call', async () => {
  journalManualActionResult({ data: row })
  const file = path.join(dir, 'manual-reservation.json')
  const journal = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const changed of [{ runId: 'other-run' }, { siteId: foreignId },
    { cleanup: { ...journal.cleanup, reservationId: foreignId } }]) {
    fs.writeFileSync(file, JSON.stringify({ ...journal, ...changed }))
    await expect(assertManualReservationPersisted()).rejects.toThrow()
  }
  expect(fixtureClient).not.toHaveBeenCalled()
})

function reads(data: unknown, error: unknown = null) {
  const query: { select: jest.Mock; eq: jest.Mock; single: jest.Mock } = { select: jest.fn(() => query), eq: jest.fn(() => query),
    single: jest.fn(async () => ({ data, error })) }
  const client = { from: jest.fn(() => query) }
  ;(fixtureClient as jest.Mock).mockResolvedValue({ client, siteId: id })
  return { client, query }
}

it('integrates private journal with an exact site+ID read and accepts equivalent timezone serialization', async () => {
  journalManualActionResult({ data: row })
  const { client, query } = reads({ ...row, start_time: '2030-01-02T10:00:00+00:00' })
  await expect(assertManualReservationPersisted()).resolves.toMatchObject({ id: reservationId })
  expect(client.from).toHaveBeenCalledWith('reservations')
  expect(query.eq.mock.calls).toEqual([['site_id', id], ['id', reservationId]])
  expect(loadManualJournal().cleanup.completed).toBe(false)
})

it.each([null, { ...row, id: foreignId }])('rejects absent or mismatched persisted identity', async data => {
  journalManualActionResult({ data: row })
  reads(data)
  await expect(assertManualReservationPersisted()).rejects.toThrow()
})

it('does not interpret RLS/read denial as absence or success', async () => {
  journalManualActionResult({ data: row })
  reads(row, new Error('RLS denied'))
  await expect(assertManualReservationPersisted()).rejects.toThrow(/read failed/)
})

it('rejects changed slots, line links and authenticated fixture failures', async () => {
  journalManualActionResult({ data: row })
  for (const changed of [{ sale_order_item_id: foreignId }, { end_time: '2030-01-02T12:00:00Z' }]) {
    reads({ ...row, ...changed })
    await expect(assertManualReservationPersisted()).rejects.toThrow(/changed/)
  }
  ;(fixtureClient as jest.Mock).mockRejectedValue(new Error('Authentication failed'))
  await expect(assertManualReservationPersisted()).rejects.toThrow(/Authentication failed/)
})

it('retains the production/two-flag safety boundary', () => {
  process.env.TEST_ALLOW_MUTATIONS = '0'
  expect(() => journalManualActionResult({ data: row })).toThrow(/require TEST_ALLOW_MUTATIONS/)
  process.env.TEST_ALLOW_MUTATIONS = '1'
  process.env.TEST_TARGET = 'production'
  expect(() => journalManualActionResult({ data: row })).toThrow()
})