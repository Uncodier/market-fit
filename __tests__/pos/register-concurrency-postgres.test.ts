/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { closeSql, installRegisterFixture, moveSql, openSql, payment, registerIds as r,
  savePayments, summarySql } from './register-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip

suite('POS register PostgreSQL transaction races', () => {
  const pg = isolatedPostgres()
  const summary = () => JSON.parse(pg.call(summarySql()))
  const pausedTransaction = (sql: string, name: string) => pg.concurrent(actorSql(
    `SET application_name='${name}'; BEGIN; ${sql}; SELECT pg_sleep(0.7); COMMIT;`,
  ))
  const barrier = async (name: string) => {
    const deadline = Date.now() + 5000
    while (pg.db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='PgSleep'`) !== '1') {
      if (Date.now() > deadline) throw new Error('Transaction did not reach its PostgreSQL barrier')
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => { installRegisterFixture(pg.db); pg.call(openSql()) })

  it('admits just one concurrent open with different request IDs', async () => {
    pg.call(closeSql())
    const result = await Promise.allSettled([uuid(112), uuid(113)].map(id => pg.concurrent(actorSql(openSql(id)))))
    expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    expect(result.filter(item => item.status === 'rejected')).toHaveLength(1)
    expect(pg.db("SELECT count(*) FROM public.pos_register_sessions WHERE status='open'")).toBe('1')
  })

  it('counts concurrent identical movement retries exactly once', async () => {
    const rows = await Promise.all([1, 2].map(() => pg.concurrent(actorSql(moveSql()))))
    expect(JSON.parse(rows[0])).toEqual(JSON.parse(rows[1]))
    expect(summary()).toMatchObject({ cash_in: 10, expected_amount: 110 })
    expect(summary().movements).toHaveLength(1)
  })

  it('rejects cross-session movement request reuse without double accounting', () => {
    pg.call(moveSql())
    pg.call(openSql(r.secondSession, r.secondLocation))
    expect(() => pg.call(moveSql('cash_in', '10', uuid(140), r.secondSession))).toThrow('request ID conflict')
    expect(pg.db('SELECT count(*) FROM public.pos_register_movements')).toBe('1')
  })

  it('prevents two sales from concurrently claiming the same stable payment ID', async () => {
    const result = await Promise.allSettled([r.sale, r.secondSale].map(sale => pg.concurrent(actorSql(savePayments([payment()], sale)))))
    expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    expect(result.filter(item => item.status === 'rejected')).toHaveLength(1)
    expect(summary()).toMatchObject({ receipt_count: 1, cash_received: 30, expected_amount: 130 })
    expect(pg.db(`SELECT count(*) FROM public.sales WHERE payments @> '[{"payment_id":"${r.payment}"}]'`)).toBe('1')
  })

  it('includes a receipt that commits before close acquires the session lock', async () => {
    const save = pausedTransaction(savePayments([payment()]), 'register-receipt-first')
    try {
      await barrier('register-receipt-first')
      const closed = JSON.parse(await pg.concurrent(actorSql(closeSql('130'))))
      expect(closed).toMatchObject({ status: 'closed', expected_amount: 130, difference: 0,
        snapshot: { receipt_count: 1, cash_received: 30, total_received: 30 } })
    } finally { await save }
    expect(summary().receipt_count).toBe(1)
  })

  it('rolls back a sale payment when close wins the session lock', async () => {
    const close = pausedTransaction(closeSql(), 'register-close-first')
    try {
      await barrier('register-close-first')
      await expect(pg.concurrent(actorSql(savePayments([payment()])))).rejects.toThrow('session is closed')
    } finally { await close }
    expect(summary()).toMatchObject({ receipt_count: 0, expected_amount: 100 })
    expect(pg.db(`SELECT payments FROM public.sales WHERE id='${r.sale}'`)).toBe('[]')
  })

  it('includes a movement committed before close and rejects later mutations', async () => {
    const move = pausedTransaction(moveSql(), 'register-move-first')
    try {
      await barrier('register-move-first')
      const closed = JSON.parse(await pg.concurrent(actorSql(closeSql('110'))))
      expect(closed).toMatchObject({ expected_amount: 110, difference: 0, snapshot: { cash_in: 10 } })
    } finally { await move }
    expect(() => pg.call(moveSql('cash_out', '1', uuid(141)))).toThrow('session is closed')
    // A committed movement replay is still idempotent after close.
    expect(JSON.parse(pg.call(moveSql())).amount).toBe(10)
  })

  it('returns an identical snapshot for concurrent same-request close retries', async () => {
    pg.call(savePayments([payment()]))
    const rows = await Promise.all([1, 2].map(() => pg.concurrent(actorSql(closeSql('130')))))
    expect(JSON.parse(rows[0])).toEqual(JSON.parse(rows[1]))
    expect(summary()).toMatchObject({ receipt_count: 1, cash_received: 30, expected_amount: 130 })
  })

  it('serializes close with another cashier manager receipt without trusting recorded_by', async () => {
    const save = pg.concurrent(actorSql(`BEGIN; ${savePayments([payment({ recorded_by: ids.admin })])};
      SET application_name='register-manager-receipt'; SELECT pg_sleep(0.7); COMMIT;`, ids.admin))
    try {
      await barrier('register-manager-receipt')
      const closed = JSON.parse(await pg.concurrent(actorSql(closeSql('130'))))
      expect(closed.snapshot.receipts[0].actor_id).toBe(ids.admin)
    } finally { await save }
  })
})