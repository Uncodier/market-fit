/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { closeSql, installRegisterFixture, moveSql, openSql, payment, registerIds as r,
  savePayments, summarySql } from './register-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip

suite('POS register in live disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  const summary = () => JSON.parse(pg.call(summarySql()))
  const session = () => JSON.parse(pg.db(`SELECT to_jsonb(s) FROM public.pos_register_sessions s WHERE id='${r.session}'`))
  const receiptCount = () => pg.db('SELECT count(*) FROM public.pos_register_receipts')
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installRegisterFixture(pg.db))

  it('returns the exact empty interfaces, scoped reads and mutation-only RPC grants', () => {
    const opened = JSON.parse(pg.call(openSql()))
    expect(opened).toMatchObject({ id: r.session, site_id: ids.site, location_id: r.location, currency: 'USD',
      opened_by: ids.owner, opening_amount: 100, status: 'open', closed_by: null, snapshot: null, close_request_id: null, notes: '' })
    expect(opened.opened_at).toBeTruthy()
    expect(summary()).toEqual({ opening_amount: 100, cash_received: 0, cash_in: 0, cash_out: 0, cash_refunds: 0,
      expected_amount: 100, total_received: 0, payment_totals: {}, receipt_count: 0, movements: [], receipts: [] })
    for (const user of [ids.owner, ids.admin, ids.collaborator]) {
      expect(pg.call('SELECT count(*) FROM public.pos_register_sessions', user)).toBe('1')
      expect(JSON.parse(pg.call(summarySql(), user)).expected_amount).toBe(100)
    }
    for (const user of [ids.marketing, ids.inactive, ids.foreign]) {
      expect(pg.call('SELECT count(*) FROM public.pos_register_sessions', user)).toBe('0')
      expect(() => pg.call(summarySql(), user)).toThrow('Register access denied')
    }
    for (const table of ['sessions', 'movements', 'receipts']) {
      for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
        expect(pg.db(`SELECT has_table_privilege('authenticated','public.pos_register_${table}','${operation}')`)).toBe('f')
      }
      expect(() => pg.call(`SELECT * FROM public.pos_register_${table}`, ids.owner, 'anon')).toThrow('permission denied')
      expect(() => pg.call(`SELECT * FROM public.pos_register_${table}`, ids.owner, 'service_role')).toThrow('permission denied')
    }
    expect(() => pg.call(openSql(uuid(999)), ids.owner, 'anon')).toThrow('permission denied')
    expect(() => pg.call(summarySql(), ids.owner, 'service_role')).toThrow('permission denied')
    expect(() => pg.call(`SELECT public.pos_register_authorize('${ids.site}',NULL)`)).toThrow('permission denied')
  })

  it('validates trusted site currency, location, role and finite amounts', () => {
    for (const user of [ids.marketing, ids.inactive, ids.foreign]) {
      expect(() => pg.call(openSql(), user)).toThrow('Register access denied')
    }
    for (const location of [r.otherLocation, r.inactiveLocation, uuid(999)]) {
      expect(() => pg.call(openSql(r.session, location))).toThrow('active same-site location')
    }
    for (const currency of ['usd', 'EUR', 'US', '']) {
      expect(() => pg.call(openSql(r.session, r.location, '100', currency))).toThrow('currency must match')
    }
    for (const amount of ['NULL', '-1', '1000000000', '0.001', "'NaN'", "'Infinity'", "'-Infinity'"]) {
      expect(() => pg.call(openSql(r.session, r.location, amount))).toThrow('finite nonnegative opening')
    }
    pg.db(`UPDATE public.site_members SET license_suspended=true WHERE user_id='${ids.collaborator}'`)
    expect(() => pg.call(openSql(), ids.collaborator)).toThrow('Register access denied')
    pg.db(`UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(() => pg.call(openSql())).toThrow('Register access denied')
  })

  it('serializes opening, permits one per location and detects conflicting retries', async () => {
    const rows = await Promise.all([1, 2].map(() => pg.concurrent(actorSql(openSql()))))
    expect(JSON.parse(rows[0])).toEqual(JSON.parse(rows[1]))
    expect(() => pg.call(openSql(uuid(112)))).toThrow('pos_register_one_open_location')
    expect(() => pg.call(openSql(r.session, r.location, '101'))).toThrow('request ID conflict')
    pg.call(openSql(r.secondSession, r.secondLocation))
    expect(pg.db('SELECT count(*) FROM public.pos_register_sessions')).toBe('2')
  })

  it('allows only opener/manager movements and idempotently accounts cash movements', () => {
    pg.call(openSql(), ids.collaborator)
    const first = JSON.parse(pg.call(moveSql(), ids.collaborator))
    expect(first).toMatchObject({ session_id: r.session, site_id: ids.site, kind: 'cash_in', amount: 10,
      reason: 'Float', actor_id: ids.collaborator, request_id: uuid(140) })
    expect(JSON.parse(pg.call(moveSql(), ids.collaborator))).toEqual(first)
    expect(() => pg.call(moveSql('cash_in', '11'), ids.collaborator)).toThrow('request ID conflict')
    pg.call(moveSql('cash_out', '3', uuid(141)), ids.admin)
    pg.call(moveSql('cash_refund', '2', uuid(142)), ids.owner)
    expect(summary()).toMatchObject({ cash_in: 10, cash_out: 3, cash_refunds: 2, expected_amount: 105 })
    for (const amount of ['0', '-1', '1000000000', '0.001', 'NULL', "'NaN'", "'Infinity'"]) {
      expect(() => pg.call(moveSql('cash_in', amount, uuid(143)), ids.collaborator)).toThrow('positive finite amount')
    }
    expect(() => pg.call(moveSql('cash_in', '10', uuid(143), r.session, '  '), ids.collaborator)).toThrow('reason')
    expect(() => pg.call(moveSql('cash_in', '10', uuid(143), r.session, 'x'.repeat(501)), ids.collaborator)).toThrow('reason')
    expect(() => pg.call(moveSql('refund', '10', uuid(143)), ids.collaborator)).toThrow('valid kind')
    pg.call(openSql(r.secondSession, r.secondLocation), ids.owner)
    expect(() => pg.call(moveSql('cash_in', '1', uuid(144), r.secondSession), ids.collaborator)).toThrow('opener or a manager')
    expect(() => pg.call(closeSql('100', uuid(151), r.secondSession), ids.collaborator)).toThrow('opener or a manager')
  })

  it('captures positive completed payments with server time across historical sale dates', () => {
    pg.call(openSql())
    const before = Date.now()
    pg.call(savePayments([payment(), payment({ payment_id: uuid(131), method: 'credit_card', amount: 40, tendered: 40, change: 0 })]))
    const result = summary()
    expect(result).toMatchObject({ cash_received: 30, total_received: 70, receipt_count: 2,
      payment_totals: { cash: 30, credit_card: 40 }, expected_amount: 130 })
    const cashReceipt = result.receipts.find((receipt: { id: string }) => receipt.id === r.payment)
    expect(cashReceipt).toMatchObject({ id: r.payment, session_id: r.session, site_id: ids.site,
      sale_id: r.sale, method: 'cash', amount: 30, tendered: 50, change: 20, actor_id: ids.owner })
    expect(new Date(cashReceipt.received_at).getTime()).toBeGreaterThanOrEqual(before - 1000)
    pg.call(savePayments([payment(), payment({ payment_id: uuid(131), method: 'credit_card', amount: 40, tendered: 40, change: 0 })]))
    expect(receiptCount()).toBe('2')
    pg.call(`UPDATE public.sales SET amount=200,amount_due=130,sale_date='2030-01-01',source='sales' WHERE id='${r.sale}'`)
    expect(summary()).toEqual(result)
  })

  it('supports same-site manager receipts but rejects forged actor and ordinary other cashiers', () => {
    pg.call(openSql(), ids.collaborator)
    expect(() => pg.call(savePayments([payment()]), ids.collaborator)).toThrow('actor must match')
    pg.call(savePayments([payment({ recorded_by: ids.admin })]), ids.admin)
    expect(summary().receipts[0].actor_id).toBe(ids.admin)
    pg.call(openSql(r.secondSession, r.secondLocation))
    pg.db(`UPDATE public.sales SET location_id='${r.secondLocation}' WHERE id='${r.secondSale}'`)
    expect(() => pg.call(savePayments([payment({ register_session_id: r.secondSession,
      recorded_by: ids.collaborator, payment_id: uuid(131) })], r.secondSale), ids.collaborator)).toThrow('opener or a manager')
    expect(() => pg.call(savePayments([payment()], r.secondSale), ids.owner, 'service_role')).toThrow('Register access denied')
  })

  it.each([
    { amount: 0 }, { amount: -1 }, { amount: 'NaN' }, { amount: 'Infinity' }, { amount: null },
    { tendered: -1 }, { tendered: 'Infinity' }, { change: -1 }, { change: 'NaN' },
    { tendered: 49 }, { amount: 'nonsense' }, { status: 'pending' }, { status: 'refunded' },
    { method: 'Cash' }, { method: '' }, { currency: 'EUR' }, { payment_id: 'bad' },
    { payment_id: null }, { recorded_by: null }, { register_session_id: null },
  ])('rejects invalid tagged payments transactionally: %j', overrides => {
    pg.call(openSql())
    const original = pg.db(`SELECT payments FROM public.sales WHERE id='${r.sale}'`)
    expect(() => pg.call(savePayments([payment({ payment_id: uuid(131) }), payment(overrides)]))).toThrow()
    expect(receiptCount()).toBe('0')
    expect(pg.db(`SELECT payments FROM public.sales WHERE id='${r.sale}'`)).toBe(original)
  })

  it('rejects cross-site/location/currency/session tags without a partial ledger', () => {
    pg.call(openSql())
    expect(() => pg.call(`UPDATE public.sales SET site_id='${ids.otherSite}',payments='${JSON.stringify([payment()])}'
      WHERE id='${r.sale}'`)).toThrow('row-level security')
    for (const field of [`location_id='${r.otherLocation}'`, "currency='EUR'"]) {
      expect(() => pg.call(`UPDATE public.sales SET ${field},payments='${JSON.stringify([payment()])}' WHERE id='${r.sale}'`))
        .toThrow('must match the sale')
    }
    expect(() => pg.call(savePayments([payment({ register_session_id: uuid(999) })]))).toThrow('session not found')
    expect(receiptCount()).toBe('0')
  })

  it('rejects duplicate stable IDs within one save, across sales and across sessions', () => {
    pg.call(openSql())
    expect(() => pg.call(savePayments([payment(), payment()]))).toThrow('Duplicate register payment ID')
    pg.call(savePayments([payment()]))
    expect(() => pg.call(savePayments([payment()], r.secondSale))).toThrow('pos_register_receipts_pkey')
    pg.call(openSql(r.secondSession, r.secondLocation))
    pg.db(`UPDATE public.sales SET location_id='${r.secondLocation}' WHERE id='${r.secondSale}'`)
    expect(() => pg.call(savePayments([payment({ register_session_id: r.secondSession })], r.secondSale)))
      .toThrow('pos_register_receipts_pkey')
    expect(receiptCount()).toBe('1')
  })

  it('preserves immutable tagged payments, receipts and sale identity while permitting append', () => {
    pg.call(openSql())
    pg.call(savePayments([payment()]))
    for (const payments of [[], [payment({ amount: 31 })], [payment({ status: 'refunded' })],
      [payment({ register_session_id: undefined })]]) {
      expect(() => pg.call(savePayments(payments))).toThrow('immutable')
    }
    // Owner-level SQL demonstrates trigger protection independent of existing RLS.
    expect(() => pg.db(`UPDATE public.sales SET site_id='${ids.otherSite}' WHERE id='${r.sale}'`)).toThrow('immutable')
    for (const field of ["currency='EUR'", `location_id='${r.secondLocation}'`]) {
      expect(() => pg.call(`UPDATE public.sales SET ${field} WHERE id='${r.sale}'`)).toThrow('immutable')
    }
    expect(() => pg.call(`DELETE FROM public.sales WHERE id='${r.sale}'`)).toThrow()
    for (const table of ['receipts', 'movements']) {
      if (table === 'movements') pg.call(moveSql())
      expect(() => pg.db(`UPDATE public.pos_register_${table} SET amount=999`)).toThrow('immutable')
      expect(() => pg.db(`DELETE FROM public.pos_register_${table}`)).toThrow('immutable')
    }
    pg.call(savePayments([payment(), payment({ payment_id: uuid(131), amount: 10, tendered: 10, change: 0 })]))
    expect(summary().cash_received).toBe(40)
  })

  it('keeps untagged legacy/new clients unassigned without requiring a session', () => {
    pg.call(savePayments([{ amount: 5, method: 'cash' }, { amount: 10, method: 'transfer' }], r.secondSale))
    pg.call(`INSERT INTO public.sales(site_id,location_id,payments) VALUES
      ('${ids.site}','${r.location}','[{"amount":10,"method":"cash"}]')`)
    expect(receiptCount()).toBe('0')
    expect(pg.db('SELECT count(*) FROM public.pos_register_sessions')).toBe('0')
  })

  it('captures an INSERT atomically and rolls it back if a subsequent save fails', () => {
    pg.call(openSql())
    const sql = `INSERT INTO public.sales(id,site_id,location_id,payments) VALUES
      ('${uuid(125)}','${ids.site}','${r.location}','${JSON.stringify([payment()])}')`
    expect(() => pg.call(`BEGIN; ${sql}; SELECT 1/0; COMMIT;`)).toThrow('division by zero')
    expect(receiptCount()).toBe('0')
    expect(pg.db(`SELECT count(*) FROM public.sales WHERE id='${uuid(125)}'`)).toBe('0')
    pg.call(sql)
    expect(summary().receipts[0].sale_id).toBe(uuid(125))
  })

  it('closes once with an immutable coherent snapshot and identical retries', () => {
    pg.call(openSql())
    pg.call(savePayments([payment()]))
    pg.call(moveSql())
    const original = summary()
    const closed = JSON.parse(pg.call(closeSql('138')))
    expect(closed).toMatchObject({ status: 'closed', counted_amount: 138, expected_amount: 140, difference: -2,
      closed_by: ids.owner, close_request_id: uuid(150), notes: 'Counted', snapshot: original })
    expect(closed.closed_at).toBeTruthy()
    expect(summary()).toEqual(original)
    expect(JSON.parse(pg.call(closeSql('138')))).toEqual(closed)
    expect(JSON.parse(pg.call(openSql()))).toEqual(closed)
    expect(() => pg.call(closeSql('139'))).toThrow('request ID conflict')
    expect(() => pg.call(moveSql('cash_in', '1', uuid(144)))).toThrow('session is closed')
    expect(() => pg.call(savePayments([payment(), payment({ payment_id: uuid(131) })]))).toThrow('session is closed')
    expect(receiptCount()).toBe('1')
    expect(session()).toEqual(closed)
    expect(() => pg.db(`UPDATE public.pos_register_sessions SET notes='edited'`)).toThrow('snapshots are immutable')
    expect(() => pg.db('DELETE FROM public.pos_register_sessions')).toThrow('cannot be deleted')
    pg.call(openSql(uuid(112)))
  })

  it('rejects nonfinite/negative counted amounts and protects the opening fields', () => {
    pg.call(openSql())
    for (const counted of ['NULL', '-1', '1000000000', '0.001', "'NaN'", "'Infinity'", "'-Infinity'"]) {
      expect(() => pg.call(closeSql(counted))).toThrow('finite nonnegative counted')
    }
    expect(() => pg.call(closeSql('100', uuid(150), r.session, 'x'.repeat(2001)))).toThrow('at most 2000')
    expect(() => pg.db('UPDATE public.pos_register_sessions SET opening_amount=1')).toThrow('opening fields are immutable')
  })

  it('denies missing authentication and scopes receipt/movement SELECT to operational same-site roles', () => {
    expect(() => pg.db(`SET ROLE authenticated; ${openSql()}`)).toThrow('Register access denied')
    pg.call(openSql())
    pg.call(moveSql())
    pg.call(savePayments([payment()]))
    for (const table of ['movements', 'receipts']) {
      for (const user of [ids.owner, ids.admin, ids.collaborator]) {
        expect(pg.call(`SELECT count(*) FROM public.pos_register_${table}`, user)).toBe('1')
      }
      for (const user of [ids.marketing, ids.inactive, ids.foreign]) {
        expect(pg.call(`SELECT count(*) FROM public.pos_register_${table}`, user)).toBe('0')
      }
      expect(pg.db(`SET ROLE authenticated; SELECT count(*) FROM public.pos_register_${table}`)).toBe('0')
    }
    expect(() => pg.call(`INSERT INTO public.pos_register_movements(session_id,site_id,kind,amount,reason,actor_id,request_id)
      VALUES ('${r.session}','${ids.site}','cash_in',1,'Forged','${ids.owner}','${uuid(145)}')`)).toThrow('permission denied')
    expect(() => pg.call(`UPDATE public.pos_register_sessions SET status='closed'`)).toThrow('permission denied')
  })

  it('keeps receipts attached to explicit sessions even when one old sale receives later payments', () => {
    pg.call(openSql())
    const first = payment()
    pg.call(savePayments([first]))
    const firstSnapshot = JSON.parse(pg.call(closeSql('130'))).snapshot
    pg.call(openSql(r.secondSession))
    const second = payment({ register_session_id: r.secondSession, payment_id: uuid(131),
      amount: 20, tendered: 20, change: 0 })
    pg.call(savePayments([first, second]))
    expect(summary()).toEqual(firstSnapshot)
    expect(JSON.parse(pg.call(summarySql(r.secondSession)))).toMatchObject({
      receipt_count: 1, cash_received: 20, total_received: 20, expected_amount: 120,
    })
    expect(pg.db(`SELECT sale_date FROM public.sales WHERE id='${r.sale}'`)).toBe('1999-01-01')
  })

  it('blocks new receipts for archived sites, suspended members and inactive locations', () => {
    pg.call(openSql(), ids.collaborator)
    const tagged = payment({ recorded_by: ids.collaborator })
    pg.db(`UPDATE public.site_members SET license_suspended=true WHERE user_id='${ids.collaborator}'`)
    expect(() => pg.db(`SET request.jwt.claims='${JSON.stringify({ sub: ids.collaborator, role: 'authenticated' })}';
      ${savePayments([tagged])}`)).toThrow('Register access denied')
    pg.db(`UPDATE public.site_members SET license_suspended=false WHERE user_id='${ids.collaborator}';
      UPDATE public.locations SET is_active=false WHERE id='${r.location}'`)
    expect(() => pg.call(savePayments([tagged]), ids.collaborator)).toThrow('active same-site register location')
    pg.db(`UPDATE public.locations SET is_active=true WHERE id='${r.location}';
      UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(pg.call('SELECT count(*) FROM public.pos_register_sessions')).toBe('0')
    expect(() => pg.call(moveSql())).toThrow('Register access denied')
    expect(() => pg.call(closeSql())).toThrow('Register access denied')
    expect(receiptCount()).toBe('0')
  })

  it('represents overwithdrawal as negative expected cash, not a silently clamped balance', () => {
    pg.call(openSql())
    pg.call(moveSql('cash_out', '110'))
    expect(summary().expected_amount).toBe(-10)
    expect(JSON.parse(pg.call(closeSql('0')))).toMatchObject({ expected_amount: -10, difference: 10 })
  })
})