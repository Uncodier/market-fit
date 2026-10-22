/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'
import { installRegisterFixture, registerIds } from './register-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
const order = uuid(200)
const secondOrder = uuid(201)
const foreignOrder = uuid(202)
const foreignSale = uuid(203)
const ownerToken = uuid(210)
const retryToken = uuid(211)
const literal = (value: string | null) => value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`

type Identity = { site: string; key: string; actor: string; order: string | null; fingerprint: string; owner: string }
const identity: Identity = { site: ids.site, key: 'checkout-attempt-1', actor: ids.owner,
  order, fingerprint: 'sha256:payload-one', owner: ownerToken }
const claimSql = (overrides: Partial<Identity> = {}) => {
  const c = { ...identity, ...overrides }
  return `SELECT public.pos_checkout_claim(${[c.site, c.key, c.actor, c.order, c.fingerprint, c.owner].map(literal).join(',')})`
}
type Transition = { site: string; key: string; owner: string; state: string;
  order: string | null; sale: string | null; result: Record<string, unknown> | null }
const transitionSql = (overrides: Partial<Transition> = {}) => {
  const t: Transition = { site: ids.site, key: identity.key, owner: ownerToken,
    state: 'writes_started', order: null, sale: null, result: null, ...overrides }
  return `SELECT public.pos_checkout_transition(${[t.site, t.key, t.owner, t.state, t.order, t.sale,
    t.result === null ? null : JSON.stringify(t.result)].map(literal).join(',')})`
}

suite('POS checkout attempt recovery in disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  const serviceSql = (sql: string) => actorSql(sql, ids.owner, 'service_role')
  const claim = (overrides: Partial<Identity> = {}) => JSON.parse(pg.db(serviceSql(claimSql(overrides))))
  const transition = (overrides: Partial<Transition> = {}) => pg.db(serviceSql(transitionSql(overrides))) === 't'
  const attempt = (key = identity.key, site = ids.site): Record<string, unknown> => JSON.parse(pg.db(
    `SELECT to_jsonb(a) FROM public.pos_checkout_attempts a WHERE site_id=${literal(site)} AND client_mutation_id=${literal(key)}`,
  ))
  const count = () => pg.db('SELECT count(*) FROM public.pos_checkout_attempts')
  const waitForEvent = async (name: string, event: string) => {
    const deadline = Date.now() + 5000
    while (pg.db(`SELECT count(*) FROM pg_stat_activity WHERE application_name=${literal(name)}
      AND wait_event=${literal(event)}`) !== '1') {
      if (Date.now() > deadline) throw new Error(`Checkout transaction did not reach ${event}`)
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installRegisterFixture(pg.db)
    // Only the order columns read by this migration are needed; sales already exist.
    pg.db(`CREATE TABLE public.sale_orders(id uuid PRIMARY KEY,site_id uuid NOT NULL REFERENCES public.sites);
      INSERT INTO public.sale_orders VALUES ('${order}','${ids.site}'),('${secondOrder}','${ids.site}'),
        ('${foreignOrder}','${ids.otherSite}');
      INSERT INTO public.sales(id,site_id,location_id) VALUES ('${foreignSale}','${ids.otherSite}','${registerIds.otherLocation}');`)
    // Keep these SECURITY DEFINER functions owned by the fixture auditor, as created.
    pg.db(migration('20261022140000_pos_checkout_attempt_recovery.sql'))
  })

  it('installs RLS, service-only RPC grants and the restricted table grants', () => {
    expect(pg.db("SELECT relrowsecurity FROM pg_class WHERE oid='public.pos_checkout_attempts'::regclass")).toBe('t')
    const signatures = ['public.pos_checkout_claim(uuid,text,uuid,uuid,text,uuid)',
      'public.pos_checkout_transition(uuid,text,uuid,text,uuid,uuid,jsonb)']
    for (const signature of signatures) {
      expect(pg.db(`SELECT has_function_privilege('service_role','${signature}','EXECUTE')`)).toBe('t')
      expect(pg.db(`SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp']
        AND pg_get_userbyid(proowner)='auditor' FROM pg_proc WHERE oid='${signature}'::regprocedure`)).toBe('t')
      for (const role of ['anon', 'authenticated']) {
        expect(pg.db(`SELECT has_function_privilege('${role}','${signature}','EXECUTE')`)).toBe('f')
      }
    }
    for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(pg.db(`SELECT has_table_privilege('service_role','public.pos_checkout_attempts','${operation}')`))
        .toBe(operation === 'DELETE' ? 'f' : 't')
      for (const role of ['anon', 'authenticated']) {
        expect(pg.db(`SELECT has_table_privilege('${role}','public.pos_checkout_attempts','${operation}')`)).toBe('f')
      }
    }
    expect(claim()).toEqual({ state: 'claimed' })
    expect(transition()).toBe(true)
    expect(pg.call('SELECT state FROM public.pos_checkout_attempts', ids.owner, 'service_role')).toBe('writes_started')
  })

  it.each(['authenticated', 'anon'])('denies %s RPCs and table access even with a forged service JWT', role => {
    expect(claim()).toEqual({ state: 'claimed' })
    const before = attempt()
    const statements = [claimSql({ key: 'denied-key' }), transitionSql(),
      'SELECT * FROM public.pos_checkout_attempts',
      "UPDATE public.pos_checkout_attempts SET state='rejected'",
      'INSERT INTO public.pos_checkout_attempts SELECT * FROM public.pos_checkout_attempts',
      'DELETE FROM public.pos_checkout_attempts']
    for (const sql of statements) {
      expect(() => pg.call(sql, ids.owner, role)).toThrow('permission denied')
      expect(() => pg.db(`SET ROLE ${role}; SET request.jwt.claims='{"role":"service_role"}'; ${sql}`))
        .toThrow('permission denied')
    }
    expect(attempt()).toEqual(before)
    expect(count()).toBe('1')
  })

  it.each(['{}', '{"role":"authenticated"}', '{"role":"anon"}'])('requires the service JWT role inside both definer bodies: %s', claims => {
    expect(claim()).toEqual({ state: 'claimed' })
    const before = attempt()
    const restricted = (sql: string) => pg.db(`SET ROLE service_role; SET request.jwt.claims='${claims}'; ${sql}`)
    expect(() => restricted(claimSql({ key: 'invalid-role' }))).toThrow('Server checkout admission required')
    expect(() => restricted(transitionSql())).toThrow('Server checkout transition required')
    expect(attempt()).toEqual(before)
    expect(count()).toBe('1')
  })

  it('replays the same identity without renewing ownership or mutating evidence', () => {
    expect(claim()).toEqual({ state: 'claimed' })
    const before = attempt()
    expect(before).toMatchObject({ state: 'processing', actor_id: ids.owner, requested_order_id: order,
      order_id: order, sale_id: null, fingerprint: identity.fingerprint, owner_token: ownerToken, result: null })
    for (const owner of [ownerToken, retryToken]) {
      expect(claim({ owner })).toEqual({ state: 'processing', result: null, orderId: order, saleId: null })
      expect(attempt()).toEqual(before)
    }
    expect(count()).toBe('1')
  })

  it.each<[string, Partial<Identity>]>([
    ['actor', { actor: ids.admin }], ['payload fingerprint', { fingerprint: 'sha256:payload-two' }],
    ['requested order', { order: secondOrder }], ['removed requested order', { order: null }],
  ])('rejects same-key changes to %s without disclosing the result', (_label, overrides) => {
    claim()
    transition()
    transition({ state: 'completed', sale: registerIds.sale, result: { success: true, saleId: registerIds.sale } })
    const before = attempt()
    expect(claim(overrides)).toEqual({ state: 'identity_conflict' })
    expect(attempt()).toEqual(before)
    expect(count()).toBe('1')
  })

  it.each([foreignOrder, uuid(999)])('rejects a foreign or nonexistent requested order %s', requested => {
    expect(claim({ order: requested })).toEqual({ state: 'identity_conflict' })
    expect(count()).toBe('0')
  })

  it('serializes concurrent same-key retries to one claim without transferring ownership', async () => {
    const results = await Promise.all([ownerToken, retryToken].map(owner => pg.concurrent(serviceSql(claimSql({ owner })))))
    const states = results.map(result => JSON.parse(result).state).sort()
    expect(states).toEqual(['claimed', 'processing'])
    expect(count()).toBe('1')
    // The result order, not process launch order, identifies the token that won.
    const winningToken = [ownerToken, retryToken][results.findIndex(result => JSON.parse(result).state === 'claimed')]
    expect(attempt().owner_token).toBe(winningToken)
    expect(transition({ owner: winningToken === ownerToken ? retryToken : ownerToken })).toBe(false)
    expect(transition({ owner: winningToken })).toBe(true)
  })

  it('blocks concurrent different keys for the same order and returns order_busy, not a unique error', async () => {
    const first = pg.concurrent(serviceSql(`SET application_name='checkout-first'; BEGIN;
      ${claimSql()}; SELECT pg_sleep(1.5); COMMIT;`))
    const pending = [first]
    try {
      await waitForEvent('checkout-first', 'PgSleep')
      const second = pg.concurrent(serviceSql(`SET application_name='checkout-second';
        ${claimSql({ key: 'checkout-attempt-2', owner: retryToken })}`))
      pending.push(second)
      await waitForEvent('checkout-second', 'advisory')
      expect((await Promise.all(pending)).map(result => JSON.parse(result))).toEqual([
        { state: 'claimed' }, { state: 'order_busy' },
      ])
    } finally { await Promise.allSettled(pending) }
    expect(count()).toBe('1')
    expect(attempt()).toMatchObject({ state: 'processing', owner_token: ownerToken })
  }, 15000)

  it('releases an order only after processing is rejected and retains the rejected key evidence', () => {
    claim()
    expect(transition({ state: 'completed' })).toBe(false)
    expect(transition({ state: 'review_required' })).toBe(false)
    expect(claim({ key: 'checkout-attempt-2' })).toEqual({ state: 'order_busy' })
    const result = { success: false, reason: 'validation_failed' }
    expect(transition({ state: 'rejected', result })).toBe(true)
    const rejected = attempt()
    expect(claim({ owner: retryToken })).toEqual({ state: 'rejected', result, orderId: order, saleId: null })
    expect(transition()).toBe(false)
    expect(claim({ key: 'checkout-attempt-2', owner: retryToken })).toEqual({ state: 'claimed' })
    expect(attempt()).toEqual(rejected)
    expect(count()).toBe('2')
  })

  it('never rejects or reclaims writes_started or review_required, even after old timestamps', () => {
    claim()
    expect(transition()).toBe(true)
    expect(transition({ state: 'rejected' })).toBe(false)
    expect(claim({ owner: retryToken }).state).toBe('writes_started')
    expect(claim({ key: 'checkout-attempt-2' })).toEqual({ state: 'order_busy' })
    const result = { success: false, reviewRequired: true }
    expect(transition({ state: 'review_required', result })).toBe(true)
    pg.db("UPDATE public.pos_checkout_attempts SET created_at=now()-interval '1 day',updated_at=now()-interval '1 day'")
    const before = attempt()
    for (const state of ['processing', 'writes_started', 'rejected', 'completed', 'review_required']) {
      expect(transition({ state })).toBe(false)
    }
    expect(claim({ owner: retryToken })).toEqual({ state: 'review_required', result, orderId: order, saleId: null })
    expect(claim({ key: 'checkout-attempt-2', owner: retryToken })).toEqual({ state: 'order_busy' })
    expect(attempt()).toEqual(before)
    expect(count()).toBe('1')
  })

  it('returns the exact completed result and scoped IDs for the same identity', () => {
    claim()
    expect(transition({ order, sale: registerIds.sale })).toBe(true)
    const result = { success: true, orderId: order, saleId: registerIds.sale, paymentStatus: 'completed' }
    expect(transition({ state: 'completed', result })).toBe(true)
    const before = attempt()
    expect(claim({ owner: retryToken })).toEqual({ state: 'completed', result, orderId: order, saleId: registerIds.sale })
    for (const state of ['processing', 'writes_started', 'rejected', 'completed', 'review_required']) {
      expect(transition({ state })).toBe(false)
    }
    expect(attempt()).toEqual(before)
    expect(count()).toBe('1')
  })

  it('keeps new-order retry identity null after a transition fills order_id', () => {
    expect(claim({ order: null })).toEqual({ state: 'claimed' })
    expect(transition({ order, sale: registerIds.sale })).toBe(true)
    expect(attempt()).toMatchObject({ requested_order_id: null, order_id: order, sale_id: registerIds.sale })
    expect(claim({ order: null, owner: retryToken })).toEqual({ state: 'writes_started', result: null,
      orderId: order, saleId: registerIds.sale })
    expect(claim({ order })).toEqual({ state: 'identity_conflict' })
    expect(claim({ key: 'checkout-attempt-2', order })).toEqual({ state: 'order_busy' })
    const result = { success: true, orderId: order, saleId: registerIds.sale }
    expect(transition({ state: 'completed', result })).toBe(true)
    expect(claim({ order: null, owner: retryToken })).toEqual({ state: 'completed', result,
      orderId: order, saleId: registerIds.sale })
    expect(attempt().requested_order_id).toBeNull()
    expect(count()).toBe('1')
  })

  it.each(['processing', 'writes_started'])('returns false for wrong owner, site or key in %s', state => {
    claim()
    if (state === 'writes_started') transition()
    const before = attempt()
    const nextStates = state === 'processing' ? ['writes_started', 'rejected'] : ['completed', 'review_required']
    for (const next of nextStates) {
      for (const overrides of [{ owner: retryToken }, { site: ids.otherSite }, { key: 'missing-key' }]) {
        expect(transition({ ...overrides, state: next, order, sale: registerIds.sale, result: { success: true } })).toBe(false)
      }
    }
    expect(attempt()).toEqual(before)
  })

  it.each<[string, Partial<Transition>]>([
    ['foreign order', { order: foreignOrder }], ['missing order', { order: uuid(999) }],
    ['foreign sale', { sale: foreignSale }], ['missing sale', { sale: uuid(999) }],
  ])('rejects %s result IDs atomically before writes_started and completed', (_label, overrides) => {
    claim()
    for (const state of ['writes_started', 'completed']) {
      const before = attempt()
      expect(() => transition({ ...overrides, state, result: { success: true } })).toThrow('Checkout result scope mismatch')
      expect(attempt()).toEqual(before)
      if (state === 'writes_started') expect(transition()).toBe(true)
    }
  })

  it('isolates the same mutation key and completed result by site', () => {
    claim()
    transition()
    const localResult = { success: true, saleId: registerIds.sale }
    transition({ state: 'completed', sale: registerIds.sale, result: localResult })
    expect(claim({ site: ids.otherSite, actor: ids.foreign, order: foreignOrder, owner: retryToken })).toEqual({ state: 'claimed' })
    const foreignIdentity = { site: ids.otherSite, owner: retryToken }
    expect(transition(foreignIdentity)).toBe(true)
    const foreignResult = { success: true, saleId: foreignSale }
    expect(transition({ ...foreignIdentity, state: 'completed', order: foreignOrder, sale: foreignSale, result: foreignResult })).toBe(true)
    expect(claim()).toEqual({ state: 'completed', result: localResult, orderId: order, saleId: registerIds.sale })
    expect(claim({ ...foreignIdentity, actor: ids.foreign, order: foreignOrder })).toEqual({ state: 'completed',
      result: foreignResult, orderId: foreignOrder, saleId: foreignSale })
    expect(count()).toBe('2')
  })
})