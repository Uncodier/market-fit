/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { openSql, payment, registerIds } from '../pos/register-postgres-fixture'
import { claimId, installSelfServiceFixture, orderId } from './self-service-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
suite('self-service cash/mobile payment race in disposable PostgreSQL', () => {
  const pg = isolatedPostgres()
  const service = (sql: string) => actorSql(sql,ids.owner,'service_role')
  const settle = `SELECT public.settle_stripe_sale_checkout('${registerIds.sale}','${orderId}','cs_race',10000,'usd','pi_race')`
  let expectedOrder = ''
  const commit = (amount: number) => `SELECT public.pos_checkout_commit_order('${ids.site}','race','${claimId}','${orderId}',
    '${JSON.stringify({source:'shop',amount:100,amount_due:100-amount,status:amount===100?'completed':'pending',
      payments:amount?[payment({amount,tendered:amount,change:0})]:[]})}',
    '{"status":"pending"}','{"amount":100,"amount_due":100,"payments":[]}','${expectedOrder}')`
  beforeAll(() => pg.start(),30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installSelfServiceFixture(pg.db)
    pg.db(`ALTER TABLE public.stripe_sale_checkout_effects ADD COLUMN settlement_status text,ADD COLUMN rejection_reason text,
      ADD COLUMN sale_reference text,ADD COLUMN payment_intent_id text,ADD COLUMN amount_minor bigint,ADD COLUMN currency text,
      ADD COLUMN financial_status text,ADD COLUMN compensation_status text;
      UPDATE public.sales SET stripe_checkout_session_id='cs_race',stripe_checkout_attempt=7 WHERE id='${registerIds.sale}';`)
    const security = migration('20260917210000_stripe_payment_security.sql')
    pg.db(security.slice(security.indexOf('CREATE OR REPLACE FUNCTION public.stripe_amount_to_minor('))
      .split('CREATE OR REPLACE FUNCTION public.reserve_stripe_checkout_attempt(')[0])
    pg.call(openSql())
    pg.db(service(`SELECT public.pos_checkout_claim('${ids.site}','race','${ids.owner}','${orderId}','fingerprint','${claimId}');
      SELECT public.pos_checkout_transition('${ids.site}','race','${claimId}','writes_started',NULL,NULL,NULL);`))
    expectedOrder = pg.db(`SELECT to_jsonb(o) FROM public.sale_orders o WHERE id='${orderId}'`)
  })

  it.each([25,100])('cash %s invalidates the linked session and reserved-attempt fence; late Stripe is rejected for compensation', amount => {
    const result = JSON.parse(pg.db(service(commit(amount))))
    expect(result.sale).toMatchObject({stripe_checkout_session_id:null,stripe_checkout_attempt:8,amount_due:100-amount})
    expect(JSON.parse(pg.db(service(settle)))).toEqual({status:'rejected',reason:'checkout_session_replaced'})
    expect(pg.db('SELECT count(*) FROM public.stripe_sale_checkout_effects')).toBe('0')
    expect(pg.db('SELECT count(*) FROM public.pos_register_receipts')).toBe('1')
  })

  it('an unchanged save does not invalidate a mobile session', () => {
    expect(JSON.parse(pg.db(service(commit(0)))).sale)
      .toMatchObject({stripe_checkout_session_id:'cs_race',stripe_checkout_attempt:7})
  })

  it('Stripe winning first rejects the stale cash snapshot without a cash receipt', () => {
    expect(JSON.parse(pg.db(service(settle))).status).toBe('settled')
    expect(() => pg.db(service(commit(100)))).toThrow('changed before commit')
    expect(pg.db('SELECT count(*) FROM public.pos_register_receipts')).toBe('0')
  })

  it('serializes cash-first and Stripe settlement without the old sale/order lock inversion', async () => {
    const cash = pg.concurrent(service(`BEGIN; SELECT id FROM public.sale_orders WHERE id='${orderId}' FOR UPDATE;
      SET application_name='self-service-cash-race'; SELECT pg_sleep(0.5); ${commit(100)}; COMMIT;`))
    const deadline = Date.now()+3000
    while (pg.db("SELECT count(*) FROM pg_stat_activity WHERE application_name='self-service-cash-race' AND wait_event='PgSleep'") !== '1') {
      if (Date.now()>deadline) throw new Error('Cash transaction did not reach its lock')
      await new Promise(resolve => setTimeout(resolve,10))
    }
    const stripe = pg.concurrent(service(settle))
    await cash
    expect(JSON.parse(await stripe)).toEqual({status:'rejected',reason:'checkout_session_replaced'})
    expect(pg.db('SELECT count(*) FROM public.pos_register_receipts')).toBe('1')
  })

  it('rolls back the entire inventory migration if Stripe delegation installation fails', () => {
    const sql = migration('20261022220001_self_service_atomic_release.sql')
    expect(sql.match(/COMMIT;/g)).toHaveLength(1)
    pg.db('DROP TABLE public.self_service_inventory_releases CASCADE')
    const failed = sql.replace('CREATE OR REPLACE FUNCTION public.apply_stripe_sale_inventory_effect(',
      "DO $$ BEGIN RAISE EXCEPTION 'synthetic migration failure'; END $$;\nCREATE OR REPLACE FUNCTION public.apply_stripe_sale_inventory_effect(")
    expect(() => pg.db(failed)).toThrow('synthetic migration failure')
    expect(pg.db("SELECT to_regclass('public.self_service_inventory_releases') IS NULL")).toBe('t')
  })
})