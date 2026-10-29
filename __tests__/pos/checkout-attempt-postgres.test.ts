/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'
import { installRegisterFixture, openSql, payment, registerIds } from './register-postgres-fixture'

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
type Commit = { site: string; key: string; owner: string; order: string;
  salePatch: unknown; orderPatch: unknown; expectedSale: unknown; expectedOrder: unknown }
const paid = payment({ amount: 100, tendered: 100, change: 0, recorded_by: ids.collaborator })
const commitSql = (overrides: Partial<Commit> = {}) => {
  const c: Commit = { site: ids.site, key: identity.key, owner: ownerToken, order,
    salePatch: { amount: 100, amount_due: 0, payments: [paid], status: 'completed', payment_method: 'cash' },
    orderPatch: { status: 'completed', total: 100, notes: 'Committed checkout' },
    expectedSale: { amount: 100, amount_due: 100, payments: [] },
    expectedOrder: { id: order, site_id: ids.site, sale_id: registerIds.sale, status: 'pending' }, ...overrides }
  return `SELECT public.pos_checkout_commit_order(${[c.site, c.key, c.owner, c.order].map(literal).join(',')},
    ${[c.salePatch, c.orderPatch, c.expectedSale, c.expectedOrder].map(value => literal(value === null ? null : JSON.stringify(value))).join(',')})`
}

suite('POS checkout attempt recovery in disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  let expectedOrder: Record<string, unknown>
  const serviceSql = (sql: string) => actorSql(sql, ids.owner, 'service_role')
  const claim = (overrides: Partial<Identity> = {}) => JSON.parse(pg.db(serviceSql(claimSql(overrides))))
  const transition = (overrides: Partial<Transition> = {}) => pg.db(serviceSql(transitionSql(overrides))) === 't'
  const attempt = (key = identity.key, site = ids.site): Record<string, unknown> => JSON.parse(pg.db(
    `SELECT to_jsonb(a) FROM public.pos_checkout_attempts a WHERE site_id=${literal(site)} AND client_mutation_id=${literal(key)}`,
  ))
  const count = () => pg.db('SELECT count(*) FROM public.pos_checkout_attempts')
  const preparedCommitSql = (overrides: Partial<Commit> = {}) => commitSql({ expectedOrder, ...overrides })
  const commit = (overrides: Partial<Commit> = {}) => JSON.parse(pg.db(serviceSql(preparedCommitSql(overrides))))
  const prepareCommit = () => {
    pg.call(openSql(), ids.collaborator)
    expect(claim({ actor: ids.collaborator })).toEqual({ state: 'claimed' })
    expect(transition()).toBe(true)
  }
  const snapshot = () => pg.db(`SELECT jsonb_build_object(
    'sales',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.sales s),
    'orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.sale_orders o),
    'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY site_id,client_mutation_id) FROM public.pos_checkout_attempts a),
    'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.pos_register_receipts r))`)
  const receipts = () => JSON.parse(pg.db("SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM public.pos_register_receipts r"))
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
    // Minimal row types for the RPC; register/accounting trigger bodies remain real.
    pg.db(`ALTER TABLE public.sales ADD COLUMN lead_id uuid,ADD COLUMN buyer_user_id uuid,ADD COLUMN owner_site_id uuid,
      ADD COLUMN campaign_id uuid,ADD COLUMN segment_id uuid,ADD COLUMN company_id uuid,ADD COLUMN title text,
      ADD COLUMN product_name text,ADD COLUMN user_id uuid,ADD COLUMN payment_method text;
      CREATE TABLE public.sale_orders(id uuid PRIMARY KEY,site_id uuid NOT NULL REFERENCES public.sites,
        sale_id uuid REFERENCES public.sales,status text DEFAULT 'pending',price_list_id uuid,buyer_user_id uuid,
        owner_site_id uuid,fulfillment_method text,origin_location_id uuid,shipping_address jsonb,scheduled_for timestamptz,
        subtotal numeric DEFAULT 100,tax_total numeric DEFAULT 0,shipping_cost numeric DEFAULT 0,total numeric DEFAULT 100,
        currency text DEFAULT 'USD',discount_total numeric DEFAULT 0,promotion_id uuid,user_id uuid,seller_user_id uuid,
        requested_by_lead_id uuid,items jsonb DEFAULT '[]',notes text,updated_at timestamptz DEFAULT now());
      CREATE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid) RETURNS boolean
        LANGUAGE sql STABLE AS $$ SELECT false $$;
      INSERT INTO public.sales(id,site_id,location_id) VALUES ('${foreignSale}','${ids.otherSite}','${registerIds.otherLocation}');`)
    pg.db(`INSERT INTO public.sale_orders(id,site_id,sale_id) VALUES ('${order}','${ids.site}','${registerIds.sale}'),
      ('${secondOrder}','${ids.site}','${registerIds.secondSale}'),('${foreignOrder}','${ids.otherSite}','${foreignSale}');`)
    expectedOrder = JSON.parse(pg.db(`SELECT to_jsonb(o) FROM public.sale_orders o WHERE id='${order}'`))
    // Keep these SECURITY DEFINER functions owned by the fixture auditor, as created.
    pg.db(migration('20261022140000_pos_checkout_attempt_recovery.sql'))
    pg.db(migration('20261022201051_complete_pos_checkout_recovery.sql'))
  })

  it('installs RLS, service-only RPC grants and the restricted table grants', () => {
    expect(pg.db("SELECT relrowsecurity FROM pg_class WHERE oid='public.pos_checkout_attempts'::regclass")).toBe('t')
    const signatures = ['public.pos_checkout_claim(uuid,text,uuid,uuid,text,uuid)',
      'public.pos_checkout_transition(uuid,text,uuid,text,uuid,uuid,jsonb)',
      'public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb)']
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
  it('reapplies the forward correction without changing evidence and disables the legacy commit', () => {
    expect(claim()).toEqual({ state: 'claimed' })
    const before = attempt()
    pg.db(`CREATE FUNCTION public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb) RETURNS jsonb
      LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
      GRANT EXECUTE ON FUNCTION public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb) TO service_role;`)
    pg.db(migration('20261022201051_complete_pos_checkout_recovery.sql'))
    expect(attempt()).toEqual(before)
    for (const role of ['anon', 'authenticated', 'service_role']) expect(pg.db(
      `SELECT has_function_privilege('${role}','public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb)','EXECUTE')`,
    )).toBe('f')
    expect(pg.db("SELECT has_function_privilege('service_role','public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE')")).toBe('t')
  })

  it.each(['authenticated', 'anon'])('denies %s RPCs and table access even with a forged service JWT', role => {
    expect(claim()).toEqual({ state: 'claimed' })
    const before = attempt()
    const statements = [claimSql({ key: 'denied-key' }), transitionSql(), commitSql(),
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
    expect(() => restricted(commitSql())).toThrow('Server checkout commit required')
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

  it.each([order, null])('serializes concurrent same-key retries for order %s to one claim without transferring ownership', async (requestedOrder) => {
    const results = await Promise.all([ownerToken, retryToken].map(owner => pg.concurrent(serviceSql(claimSql({ owner, order: requestedOrder })))))
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

  it('commits sale, order and receipt together as the durable actor and restores service JWT claims', () => {
    prepareCommit()
    const output = pg.db(serviceSql(`BEGIN; SET request.jwt.claim.role='service_role'; SET request.jwt.claim.sub='${ids.owner}';
      ${preparedCommitSql()}; SELECT jsonb_build_object('claims',auth.jwt(),'role',current_setting('request.jwt.claim.role'),
        'sub',current_setting('request.jwt.claim.sub')); COMMIT;`))
      .split('\n').map(line => JSON.parse(line))
    expect(output[0]).toMatchObject({ sale: { id: registerIds.sale, site_id: ids.site, amount: 100, amount_due: 0,
      payments: [paid], status: 'completed', payment_method: 'cash' },
    order: { id: order, site_id: ids.site, sale_id: registerIds.sale, status: 'completed', total: 100, notes: 'Committed checkout' } })
    expect(output[1]).toEqual({ claims: { sub: ids.owner, role: 'service_role' }, role: 'service_role', sub: ids.owner })
    expect(JSON.parse(pg.db(`SELECT to_jsonb(s) FROM public.sales s WHERE id='${registerIds.sale}'`))).toEqual(output[0].sale)
    expect(JSON.parse(pg.db(`SELECT to_jsonb(o) FROM public.sale_orders o WHERE id='${order}'`))).toEqual(output[0].order)
    expect(receipts()).toHaveLength(1)
    expect(receipts()[0]).toMatchObject({ id: registerIds.payment, sale_id: registerIds.sale, site_id: ids.site,
      session_id: registerIds.session, amount: 100, tendered: 100, change: 0, actor_id: ids.collaborator })
    expect(attempt()).toMatchObject({ state: 'writes_started', actor_id: ids.collaborator, order_id: order, sale_id: registerIds.sale })
    const before = snapshot()
    expect(() => commit()).toThrow('Checkout balance or order changed before commit')
    expect(snapshot()).toBe(before)
    expect(transition({ state: 'completed', result: { success: true } })).toBe(true)
    expect(() => commit()).toThrow('Checkout admission mismatch')
  })

  it('rolls back the sale and captured receipt when the subsequent order trigger raises', () => {
    prepareCommit()
    pg.db(`CREATE FUNCTION public.fail_checkout_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.pos_register_receipts WHERE id='${registerIds.payment}' AND actor_id='${ids.collaborator}')
        OR NOT EXISTS (SELECT 1 FROM public.sales WHERE id='${registerIds.sale}' AND amount_due=0) THEN
        RAISE EXCEPTION 'Receipt or sale not visible before order update';
      END IF;
      RAISE EXCEPTION 'Injected order failure after sale and receipt'; END $$;
      CREATE TRIGGER fail_checkout_order BEFORE UPDATE ON public.sale_orders FOR EACH ROW EXECUTE FUNCTION public.fail_checkout_order();`)
    const before = snapshot()
    expect(() => commit()).toThrow('Injected order failure after sale and receipt')
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
    expect(attempt()).toMatchObject({ state: 'writes_started', sale_id: null })
    pg.db('DROP TRIGGER fail_checkout_order ON public.sale_orders')
    expect(commit().order.status).toBe('completed')
    expect(receipts()).toHaveLength(1)
  })

  it('serializes concurrent commit snapshots to one receipt and one stale rejection', async () => {
    prepareCommit()
    const results = await Promise.allSettled([1, 2].map(() => pg.concurrent(serviceSql(preparedCommitSql()))))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const failures = results.filter(result => result.status === 'rejected')
    expect(failures).toHaveLength(1)
    if (failures[0].status === 'rejected') expect(failures[0].reason.message).toContain('Checkout balance or order changed before commit')
    expect(receipts()).toHaveLength(1)
    expect(attempt()).toMatchObject({ state: 'writes_started', sale_id: registerIds.sale })
  })

  it.each<[string, Partial<Commit>]>([
    ['wrong token', { owner: retryToken }], ['wrong tenant', { site: ids.otherSite }],
    ['wrong key', { key: 'missing' }], ['wrong order', { order: secondOrder }],
  ])('denies commit with %s before writing', (_label, overrides) => {
    prepareCommit()
    const before = snapshot()
    expect(() => commit(overrides)).toThrow('Checkout admission mismatch')
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
  })

  it('denies commit before writes_started and when payment actor differs from durable admission', () => {
    pg.call(openSql(), ids.collaborator)
    claim({ actor: ids.collaborator })
    expect(() => commit()).toThrow('Checkout admission mismatch')
    transition()
    const before = snapshot()
    expect(() => commit({ salePatch: { payments: [{ ...paid, recorded_by: ids.owner }] } }))
      .toThrow('Register payment actor must match authenticated user')
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
  })

  it.each([
    `UPDATE public.sales SET amount=101 WHERE id='${registerIds.sale}'`,
    `UPDATE public.sales SET amount_due=99 WHERE id='${registerIds.sale}'`,
    `UPDATE public.sales SET payments='[{"amount":1,"method":"cash"}]' WHERE id='${registerIds.sale}'`,
    `UPDATE public.sale_orders SET status='cancelled' WHERE id='${order}'`,
    `UPDATE public.sale_orders SET sale_id='${registerIds.secondSale}' WHERE id='${order}'`,
    `UPDATE public.sale_orders SET total=101,notes='Changed order',updated_at=now() WHERE id='${order}'`,
  ])('rejects a stale sale/order snapshot after %s without a receipt', change => {
    prepareCommit()
    pg.db(change)
    const before = snapshot()
    expect(() => commit()).toThrow('Checkout balance or order changed before commit')
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
  })

  it.each<[string, Partial<Commit>]>([
    ['non-POS sale source', { salePatch: { source: 'shop' } }],
    ['negative remaining balance', { salePatch: { amount_due: -1 } }],
    ['remaining balance above sale amount', { salePatch: { amount_due: 101 } }],
    ['changed order currency', { orderPatch: { currency: 'EUR' } }],
  ])('rejects financial patch %s before writing', (_label, overrides) => {
    prepareCommit()
    const before = snapshot()
    expect(() => commit(overrides)).toThrow('Invalid checkout financial state')
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
  })

  it.each<[string, Partial<Commit>]>([
    ['null sale snapshot', { expectedSale: null }], ['null order snapshot', { expectedOrder: null }],
    ['empty sale snapshot', { expectedSale: {} }], ['empty order snapshot', { expectedOrder: {} }],
    ['incomplete sale snapshot', { expectedSale: { amount: 100, amount_due: 100 } }],
    ['incomplete order snapshot', { expectedOrder: { sale_id: registerIds.sale, status: 'pending' } }],
    ['sale ID', { salePatch: { id: foreignSale } }], ['sale tenant', { salePatch: { site_id: ids.otherSite } }],
    ['sale location', { salePatch: { location_id: registerIds.otherLocation } }], ['sale currency', { salePatch: { currency: 'EUR' } }],
    ['order ID', { orderPatch: { id: foreignOrder } }], ['order tenant', { orderPatch: { site_id: ids.otherSite } }],
    ['order sale', { orderPatch: { sale_id: foreignSale } }], ['nonobject sale patch', { salePatch: [] }],
    ['null order patch', { orderPatch: null }],
  ])('rejects invalid commit %s atomically', (label, overrides) => {
    prepareCommit()
    const before = snapshot()
    const message = label.includes('snapshot') ? 'Checkout balance or order changed before commit'
      : label.includes('patch') ? 'Invalid checkout patches' : 'Checkout scope is immutable'
    expect(() => commit(overrides)).toThrow(message)
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
  })

  it.each([
    `UPDATE public.site_members SET status='inactive' WHERE user_id='${ids.collaborator}'`,
    `UPDATE public.site_members SET license_suspended=true WHERE user_id='${ids.collaborator}'`,
    `UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`,
  ])('reauthorizes the durable cashier after %s', change => {
    prepareCommit()
    pg.db(change)
    const before = snapshot()
    expect(() => commit()).toThrow('Register access denied')
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
  })

  it.each(['true', 'NULL'])('fails closed for location restriction result %s', restriction => {
    prepareCommit()
    pg.db(`CREATE OR REPLACE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT ${restriction}::boolean $$`)
    const before = snapshot()
    expect(() => commit()).toThrow('Unrestricted checkout access required')
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
  })

  it.each<[string, string]>([
    ['order', `UPDATE public.sale_orders SET site_id='${ids.otherSite}' WHERE id='${order}'`],
    ['sale', `UPDATE public.sale_orders SET sale_id='${foreignSale}' WHERE id='${order}'`],
  ])('denies an admitted order whose %s is no longer in the tenant', (entity, change) => {
    prepareCommit()
    pg.db(change)
    const before = snapshot()
    expect(() => commit()).toThrow(`Checkout ${entity} unavailable`)
    expect(snapshot()).toBe(before)
    expect(receipts()).toEqual([])
  })
})