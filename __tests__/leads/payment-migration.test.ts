/** @jest-environment node */
import { actorSql, ids, json, PaymentPostgres, postgresAvailable, quote, uuid } from './payment-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
const { site, otherSite, lead, hiddenLead, otherLead, owner, admin, collaborator, restricted,
  marketing, inactive, foreign, coOwner, ownerMember } = ids
type Receipt = { id: string; amount: number; currency: string; method: string; date: string;
  request_id?: string; notes?: string; recorded_by?: string; legacy_inferred?: boolean }
type Snapshot = { invoices: { id: string; amountDue: number; currency: string }[]; version: string }
type Result = { requestId: string; amount: number; currency: string;
  allocations: { invoiceId: string; amount: number; amountDue: number; previousStatus: string; status: string }[] }
type Sale = { id: string; amount_due: number; status: string; payments: Receipt[];
  payment_method: string | null; accounting_state: string; updated_at: string }
type InvoiceInput = { id: string; siteId?: string; leadId?: string; user?: string; due?: number;
  amount?: number; currency?: string | null; status?: string; date?: string | null;
  created?: string; payments?: unknown; accountingState?: string }
type PaymentInput = { request?: string | null; version?: string | null; currency?: string | null;
  mode?: string | null; amount?: string; method?: string | null; notes?: string | null; siteId?: string; leadId?: string }

suite('lead invoice payment migration in disposable PostgreSQL', () => {
  const pg = new PaymentPostgres()
  const newest = uuid(102); const middle = uuid(101); const oldest = uuid(100)
  const request = uuid(200)
  const snapshotSql = (siteId = site, leadId = lead) =>
    `SELECT public.lead_open_invoice_snapshot('${siteId}', '${leadId}')`
  const snapshot = (user = owner, siteId = site, leadId = lead): Snapshot =>
    JSON.parse(pg.call(snapshotSql(siteId, leadId), user))
  const paymentSql = (input: PaymentInput = {}) => {
    const values = { request, version: snapshot().version, currency: 'USD', mode: 'partial', amount: '10',
      method: 'cash', notes: '  Local receipt  ', siteId: site, leadId: lead, ...input }
    return `SELECT public.record_lead_invoice_payment('${values.siteId}', '${values.leadId}',
      ${quote(values.request)}, ${quote(values.version)}, ${quote(values.currency)}, ${quote(values.mode)},
      ${values.amount}, ${quote(values.method)}, ${quote(values.notes)})`
  }
  const pay = (input: PaymentInput = {}, user = owner): Result => JSON.parse(pg.call(paymentSql(input), user))
  const sales = (): Sale[] => JSON.parse(pg.db(`SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id), '[]') FROM public.sales s`))
  const state = () => pg.db(`SELECT jsonb_build_object('sales',
    (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id), '[]') FROM public.sales s), 'requests',
    (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY request_id), '[]') FROM public.lead_invoice_payment_requests r))`)
  const insert = (input: InvoiceInput) => {
    const value = { siteId: site, leadId: lead, user: owner, due: 100, currency: 'USD', status: 'pending',
      date: '2026-10-01', created: '2026-10-01T00:00:00Z', payments: [], accountingState: 'posted', ...input }
    pg.db(`INSERT INTO public.sales(id, site_id, lead_id, user_id, title, invoice_number, amount, amount_due,
      currency, sale_date, created_at, updated_at, status, payments, accounting_state)
      VALUES ('${value.id}', '${value.siteId}', '${value.leadId}', '${value.user}', 'Local invoice', 'INV-${value.id}',
        ${value.amount ?? value.due}, ${value.due}, ${quote(value.currency)}, ${quote(value.date)}, '${value.created}',
        '2026-10-01T00:00:00Z', '${value.status}', ${value.payments === null ? 'NULL' : json(value.payments)}, '${value.accountingState}')`)
  }
  const rejectsUnchanged = (sql: string, code: string, message: string, user: string | null = owner, role = 'authenticated') => {
    const before = state()
    expect(() => pg.call(sql, user, role)).toThrow(new RegExp(`${code}: ${message}`))
    expect(state()).toBe(before)
  }

  beforeAll(() => pg.startCluster(), 30000)
  afterAll(() => pg.stopCluster(), 30000)
  beforeEach(() => pg.reset())

  it('uses only a local socket and installs definer RPCs with RLS/read-only request grants', () => {
    expect(pg.db('SHOW listen_addresses')).toBe('')
    expect(pg.db('SHOW port')).toBe('55442')
    expect(pg.db(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lead_invoice_payment_requests'::regclass`)).toBe('t')
    expect(pg.db(`SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp'])
      FROM pg_proc WHERE proname IN ('lead_open_invoice_snapshot', 'record_lead_invoice_payment')`)).toBe('t')
    expect(pg.db(`SELECT has_table_privilege('authenticated', 'public.lead_invoice_payment_requests', 'SELECT')
      AND NOT has_table_privilege('authenticated', 'public.lead_invoice_payment_requests', 'INSERT,UPDATE,DELETE')`)).toBe('t')
    expect(snapshot()).toEqual({ invoices: [], version: expect.stringMatching(/^[a-f0-9]{32}$/) })
    expect(snapshot()).toEqual(snapshot())
  })

  it('splits newest-first with exact cents/remainder and stable date, creation, ID tie-breaks', () => {
    insert({ id: oldest, due: 70, date: '2026-09-30', accountingState: 'unpublished' })
    insert({ id: middle, due: 25.25, created: '2026-10-01T01:00:00Z' })
    insert({ id: newest, due: 20.1, created: '2026-10-01T01:00:00Z' })
    insert({ id: uuid(103), due: 10, created: '2026-10-01T00:00:00Z', status: 'completed' })
    expect(snapshot().invoices.map(item => item.id)).toEqual([newest, middle, uuid(103), oldest])
    const before = snapshot()
    const result = pay({ version: before.version, amount: '59.60', notes: "  buyer's cash  " })
    expect(result).toEqual({ requestId: request, amount: 59.6, currency: 'USD', allocations: [
      { invoiceId: newest, amount: 20.1, amountDue: 0, previousStatus: 'pending', status: 'completed' },
      { invoiceId: middle, amount: 25.25, amountDue: 0, previousStatus: 'pending', status: 'completed' },
      { invoiceId: uuid(103), amount: 10, amountDue: 0, previousStatus: 'completed', status: 'completed' },
      { invoiceId: oldest, amount: 4.25, amountDue: 65.75, previousStatus: 'pending', status: 'pending' },
    ] })
    const rows = sales()
    expect(rows.map(row => row.amount_due)).toEqual([65.75, 0, 0, 0])
    expect(rows.map(row => row.accounting_state)).toEqual(['unpublished', 'pending', 'pending', 'pending'])
    for (const row of rows) {
      expect(row.payments).toHaveLength(1)
      expect(row.payment_method).toBe('cash')
      expect(row.payments[0]).toMatchObject({ id: `${request}:${row.id}`, request_id: request,
        currency: 'USD', method: 'cash', notes: "buyer's cash", recorded_by: owner })
      expect(Date.parse(row.updated_at)).toBeGreaterThan(Date.parse('2026-10-01T00:00:00Z'))
    }
    expect(new Set(rows.map(row => row.payments[0].date)).size).toBe(1)
    expect(snapshot().version).not.toBe(before.version)
    expect(snapshot().invoices).toEqual([expect.objectContaining({ id: oldest, amountDue: 65.75 })])
  })

  it('pays full balances in the selected currency only, excluding cancelled/refunded/settled and other-tenant invoices', () => {
    insert({ id: newest, due: 20 })
    insert({ id: middle, due: 30, status: 'completed' })
    insert({ id: oldest, due: 80, currency: 'EUR' })
    insert({ id: uuid(103), due: 50, status: 'cancelled' })
    insert({ id: uuid(104), due: 50, status: 'refunded' })
    insert({ id: uuid(105), due: 0 })
    insert({ id: uuid(106), due: 70, siteId: otherSite, leadId: otherLead, user: foreign })
    insert({ id: uuid(107), due: 90, leadId: hiddenLead })
    const before = sales()
    expect(snapshot().invoices.map(item => item.id)).toEqual([newest, middle, oldest])
    const result = pay({ mode: 'full', amount: 'NULL', currency: 'USD' })
    expect(result.amount).toBe(50)
    expect(result.allocations.map(item => item.invoiceId)).toEqual([newest, middle])
    const after = sales()
    for (const row of before.filter(row => ![newest, middle].includes(row.id))) {
      expect(after.find(item => item.id === row.id)).toEqual(row)
    }
    expect(snapshot().invoices).toEqual([expect.objectContaining({ id: oldest, amountDue: 80, currency: 'EUR' })])
  })

  it('preserves inferred legacy balances and existing receipts without duplicating them on later payments', () => {
    insert({ id: newest, amount: 100, due: 60, payments: [{ id: 'old-receipt', amount: 10, method: 'cash' }] })
    const original = sales()[0].payments[0]
    pay({ amount: '20' })
    let row = sales()[0]
    expect(row.amount_due).toBe(40)
    expect(row.payments).toHaveLength(3)
    const inferred = row.payments[0]
    expect(inferred).toEqual({ id: `legacy:sales:${newest}`, amount: 30, currency: 'USD',
      date: '2026-10-01', method: 'legacy_balance', legacy_inferred: true })
    expect(row.payments[1]).toEqual(original)
    pay({ request: uuid(201), mode: 'full', amount: 'NULL' })
    row = sales()[0]
    expect(row.amount_due).toBe(0)
    expect(row.payments).toHaveLength(4)
    expect(row.payments[0]).toEqual(inferred)
    expect(row.payments[1]).toEqual(original)
    expect(row.payments.reduce((sum, receipt) => sum + receipt.amount, 0)).toBe(100)
  })

  it('preserves an unrecorded balance when the legacy payment history is SQL NULL', () => {
    insert({ id: newest, amount: 100, due: 70, payments: null })
    pay({ amount: '10' })
    expect(sales()[0].payments).toEqual([expect.objectContaining({ amount: 30, legacy_inferred: true }),
      expect.objectContaining({ amount: 10, request_id: request })])
  })

  it.each(['amount_due = 90', "updated_at = updated_at + interval '1 second'", "status = 'cancelled'",
    "currency = 'EUR'"])('rejects a stale snapshot after %s with all state rolled back', change => {
    insert({ id: newest })
    const version = snapshot().version
    pg.db(`UPDATE public.sales SET ${change} WHERE id = '${newest}'`)
    rejectsUnchanged(paymentSql({ version }), '40001', 'Invoice balances changed')
  })

  it('invalidates a snapshot when a new open invoice is inserted', () => {
    insert({ id: newest })
    const version = snapshot().version
    insert({ id: middle })
    rejectsUnchanged(paymentSql({ version }), '40001', 'Invoice balances changed')
  })

  it.each(['NULL', '0', '-1', '0.001', '1.999', '1000000000000', "'NaN'::numeric",
    "'Infinity'::numeric", "'-Infinity'::numeric"])('rejects bad partial amount %s without any write', amount => {
    insert({ id: newest })
    rejectsUnchanged(paymentSql({ amount }), '22023', 'Invalid invoice payment')
  })

  it.each([
    { request: null }, { version: null }, { version: 'invalid' }, { currency: null }, { currency: 'usd' },
    { mode: null }, { mode: 'other' }, { method: null }, { method: 'unknown' }, { notes: 'x'.repeat(2001) },
  ])('rejects malformed request fields %# without any write', fields => {
    insert({ id: newest })
    rejectsUnchanged(paymentSql(fields), '22023', 'Invalid invoice payment')
  })

  it.each([{ amount: '100.01' }, { currency: 'EUR' }, { mode: 'full', currency: 'EUR', amount: 'NULL' }])(
    'rejects excess payment or unavailable currency %# atomically', fields => {
      insert({ id: newest })
      rejectsUnchanged(paymentSql(fields), '23514', 'Payment exceeds available invoice balances')
    })

  it('replays identical normalized payloads even after balances change but rejects changed details and actors', () => {
    insert({ id: newest })
    const version = snapshot().version
    const original = pay({ version, notes: ' receipt ' })
    const after = state()
    expect(pay({ version, notes: 'receipt' })).toEqual(original)
    expect(state()).toBe(after)
    for (const changed of [{ amount: '11' }, { currency: 'EUR' }, { mode: 'full' }, { method: 'check' },
      { notes: 'changed' }, { version: snapshot().version }, { leadId: hiddenLead }]) {
      rejectsUnchanged(paymentSql({ version, notes: 'receipt', ...changed }), '22023',
        'Payment request already used with different details')
    }
    rejectsUnchanged(paymentSql({ version, notes: 'receipt' }), '22023',
      'Payment request already used with different details', collaborator)
    rejectsUnchanged(paymentSql({ version, notes: 'receipt' }), '42501', 'Invoice payment access denied', marketing)
    pg.db(`UPDATE public.leads SET assignee_id = NULL WHERE id = '${lead}'`)
    rejectsUnchanged(paymentSql({ version, notes: 'receipt' }), '42501', 'Lead payment access denied', restricted)
  })

  it.each([owner, admin, collaborator, coOwner])('allows the faithful write-capable site role %s', user => {
    insert({ id: newest, leadId: hiddenLead })
    const version = snapshot(user, site, hiddenLead).version
    expect(pay({ version, leadId: hiddenLead }, user).amount).toBe(10)
  })

  it.each([marketing, inactive, foreign, null])('denies snapshot and payment to unauthorized actor %s', user => {
    insert({ id: newest })
    rejectsUnchanged(snapshotSql(), '42501', 'Invoice payment access denied', user)
    rejectsUnchanged(paymentSql(), '42501', 'Invoice payment access denied', user)
  })

  it.each(['anon', 'public_client'])('revokes PUBLIC/anonymous RPC execution and request reads for %s', role => {
    insert({ id: newest })
    for (const sql of [snapshotSql(), paymentSql(), 'SELECT * FROM public.lead_invoice_payment_requests']) {
      rejectsUnchanged(sql, '42501', 'permission denied', null, role)
    }
  })

  it('denies a foreign lead/site pairing and archived site to otherwise authorized owners', () => {
    insert({ id: newest })
    rejectsUnchanged(snapshotSql(site, otherLead), '42501', 'Lead payment access denied')
    rejectsUnchanged(paymentSql({ leadId: otherLead }), '42501', 'Lead payment access denied')
    rejectsUnchanged(snapshotSql(otherSite, otherLead), '42501', 'Invoice payment access denied')
    rejectsUnchanged(paymentSql({ siteId: otherSite, leadId: otherLead }), '42501', 'Invoice payment access denied')
    const sql = paymentSql()
    pg.db(`UPDATE public.sites SET archived_at = now() WHERE id = '${site}'`)
    rejectsUnchanged(snapshotSql(), '42501', 'Invoice payment access denied')
    rejectsUnchanged(sql, '42501', 'Invoice payment access denied')
  })

  it('limits assigned-only collaborators to own sales and a visible assigned/created lead, never buyer scope', () => {
    insert({ id: newest, user: restricted, due: 20 })
    insert({ id: middle, due: 90 }) // Buyer lead is assigned to actor, but this sale belongs to someone else.
    insert({ id: oldest, user: restricted, leadId: hiddenLead, due: 30 })
    expect(pg.call(`SELECT count(*) FROM public.sales WHERE lead_id = '${lead}'`, restricted)).toBe('1')
    expect(snapshot(restricted).invoices.map(item => item.id)).toEqual([newest])
    const result = pay({ version: snapshot(restricted).version, mode: 'full', amount: 'NULL' }, restricted)
    expect(result.amount).toBe(20)
    expect(sales().find(row => row.id === middle)?.amount_due).toBe(90)
    rejectsUnchanged(snapshotSql(site, hiddenLead), '42501', 'Lead payment access denied', restricted)
    rejectsUnchanged(paymentSql({ leadId: hiddenLead }), '42501', 'Lead payment access denied', restricted)
    pg.db(`UPDATE public.leads SET user_id = '${restricted}' WHERE id = '${hiddenLead}'`)
    expect(snapshot(restricted, site, hiddenLead).invoices.map(item => item.id)).toEqual([oldest])
    expect(pay({ request: uuid(201), version: snapshot(restricted, site, hiddenLead).version, leadId: hiddenLead }, restricted).amount).toBe(10)
  })

  it('does not let a restricted owner-role member bypass actual ownership or lead assignment', () => {
    insert({ id: newest, user: ownerMember })
    expect(pg.call(`SELECT count(*) FROM public.leads WHERE id = '${lead}'`, ownerMember)).toBe('0')
    rejectsUnchanged(snapshotSql(), '42501', 'Lead payment access denied', ownerMember)
    rejectsUnchanged(paymentSql(), '42501', 'Lead payment access denied', ownerMember)
    pg.db(`UPDATE public.leads SET assignee_id = '${ownerMember}' WHERE id = '${lead}'`)
    expect(snapshot(ownerMember).invoices.map(item => item.id)).toEqual([newest])
  })

  it('protects stored request results with actor-only RLS and forbids direct mutations', () => {
    insert({ id: newest })
    pay()
    expect(pg.call('SELECT count(*) FROM public.lead_invoice_payment_requests')).toBe('1')
    for (const user of [collaborator, marketing, foreign]) {
      expect(pg.call('SELECT count(*) FROM public.lead_invoice_payment_requests', user)).toBe('0')
    }
    for (const sql of ['DELETE FROM public.lead_invoice_payment_requests',
      "UPDATE public.lead_invoice_payment_requests SET result = '{}'", `INSERT INTO public.lead_invoice_payment_requests
        SELECT '${uuid(201)}', site_id, lead_id, actor_id, payload, result, created_at FROM public.lead_invoice_payment_requests`]) {
      rejectsUnchanged(sql, '42501', 'permission denied')
    }
  })

  it.each([
    { payments: { damaged: true }, message: 'Invoice payment history requires review' },
    { payments: [{ id: 'bad', amount: 'NaN' }], message: 'Payment history contains an invalid amount' },
    { due: 20.001, message: 'Invoice payment history requires review' },
    { amount: 30.001, due: 20, message: 'Legacy payment date, amount or currency requires review' },
    { amount: 30, due: 20, date: null, message: 'Legacy payment date, amount or currency requires review' },
  ])('rolls back earlier invoice balances, status, legacy histories and request on late failure %#', fields => {
    insert({ id: newest, amount: 30, due: 20 }) // First update would append inferred 10 and receipt 20.
    insert({ id: oldest, due: 20, date: '2026-09-30', ...fields })
    rejectsUnchanged(paymentSql({ amount: '25' }), '23514', fields.message)
  })

  it.each([null, 'usd'])('rejects unsafe invoice currency %s across the snapshot without any write', currency => {
    insert({ id: newest })
    insert({ id: oldest, currency })
    rejectsUnchanged(paymentSql(), '23514', 'Invoice currency requires review')
  })

  it.each([true, false])('serializes concurrent %s duplicate/new requests without double receipts or stale overwrite', async duplicate => {
    insert({ id: newest })
    const version = snapshot().version
    const sql = paymentSql({ version, amount: '60' })
    const first = pg.start(`BEGIN; ${actorSql(sql)}`, 'payment-first', true)
    const secondSql = paymentSql({ version, amount: '60', request: duplicate ? request : uuid(201) })
    let second: ReturnType<PaymentPostgres['start']> | undefined
    try {
      await pg.waitFor("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'payment-first' AND state = 'idle in transaction')")
      second = pg.start(actorSql(secondSql), 'payment-second')
      await pg.waitFor("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'payment-second' AND wait_event_type = 'Lock')")
      first.finish()
      const [a, b] = await Promise.all([first.result, second.result])
      expect(a.code).toBe(0)
      if (duplicate) {
        expect(b.code).toBe(0)
        expect(JSON.parse(b.stdout)).toEqual(JSON.parse(a.stdout))
      } else {
        expect(b.code).not.toBe(0)
        expect(b.stderr).toContain('40001: Invoice balances changed')
      }
      expect(sales()[0].amount_due).toBe(40)
      expect(sales()[0].payments).toHaveLength(1)
      expect(pg.db('SELECT count(*) FROM public.lead_invoice_payment_requests')).toBe('1')
    } finally {
      first.kill(); second?.kill()
      await Promise.all([first.result, second?.result])
    }
  }, 30000)

  it('refreshes the snapshot after waiting on an independent invoice row writer', async () => {
    insert({ id: newest })
    const sql = paymentSql({ version: snapshot().version, amount: '60' })
    const writer = pg.start(`BEGIN; UPDATE public.sales SET amount_due = 80 WHERE id = '${newest}';`, 'invoice-writer', true)
    let payment: ReturnType<PaymentPostgres['start']> | undefined
    try {
      await pg.waitFor("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'invoice-writer' AND state = 'idle in transaction')")
      payment = pg.start(actorSql(sql), 'payment-waiter')
      await pg.waitFor("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'payment-waiter' AND wait_event_type = 'Lock')")
      writer.finish()
      expect((await writer.result).code).toBe(0)
      const outcome = await payment.result
      expect(outcome.code).not.toBe(0)
      expect(outcome.stderr).toContain('40001: Invoice balances changed')
      expect(sales()[0].amount_due).toBe(80)
      expect(sales()[0].payments).toEqual([])
      expect(pg.db('SELECT count(*) FROM public.lead_invoice_payment_requests')).toBe('0')
    } finally {
      writer.kill(); payment?.kill()
      await Promise.all([writer.result, payment?.result])
    }
  }, 30000)
})