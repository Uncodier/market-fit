/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres';
import { installRegisterFixture, registerIds } from './register-postgres-fixture';

const suite = postgresAvailable ? describe : describe.skip;
const order = uuid(200);
const token = uuid(210);
const key = 'cancel-checkout';
const literal = (value: string | null) => value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;
const serviceSql = (sql: string) => actorSql(sql, ids.owner, 'service_role');
const cancelSql = (actor: string | null = ids.collaborator, reason: string | null = 'Customer cancelled',
  site = ids.site, mutation: string | null = key) =>
  `SELECT public.pos_checkout_cancel(${[site, mutation, actor, reason].map(literal).join(',')})`;
const transitionSql = (state = 'writes_started') =>
  `SELECT public.pos_checkout_transition('${ids.site}','${key}','${token}','${state}')`;

suite('POS cancellation in disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres();
  const cancel = (actor = ids.collaborator, reason = 'Customer cancelled', site = ids.site) =>
    JSON.parse(pg.db(serviceSql(cancelSql(actor, reason, site))));
  const claim = (actor = ids.collaborator) => pg.db(serviceSql(
    `SELECT public.pos_checkout_claim('${ids.site}','${key}','${actor}','${order}','fingerprint','${token}')`,
  ));
  const attempt = () => JSON.parse(pg.db('SELECT to_jsonb(a) FROM public.pos_checkout_attempts a'));
  const financialSnapshot = () => pg.db(`SELECT jsonb_build_object(
    'sales',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.sales s),
    'orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.sale_orders o),
    'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.pos_register_receipts r),
    'movements',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.pos_register_movements m))`);
  const waitForEvent = async (name: string, event: string) => {
    const deadline = Date.now() + 5000;
    while (pg.db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='${event}'`) !== '1') {
      if (Date.now() > deadline) throw new Error(`Cancellation transaction did not reach ${event}`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };

  beforeAll(() => pg.start(), 30000);
  afterAll(() => pg.stop());
  beforeEach(() => {
    installRegisterFixture(pg.db);
    // Ownership alone cannot bypass the current active-membership/license gate.
    pg.db(`INSERT INTO public.site_members(site_id,user_id,role,status)
        VALUES ('${ids.site}','${ids.coOwner}','admin','active');
      ALTER TABLE public.sales ADD COLUMN lead_id uuid,ADD COLUMN buyer_user_id uuid,ADD COLUMN owner_site_id uuid,
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
      INSERT INTO public.sale_orders(id,site_id,sale_id) VALUES ('${order}','${ids.site}','${registerIds.sale}');`);
    pg.db(migration('20261022201051_complete_pos_checkout_recovery.sql'));
    pg.db(migration('20261027190000_pos_checkout_cancel.sql'));
  });

  it('retains RLS and service-only least-privilege grants', () => {
    const signature = 'public.pos_checkout_cancel(uuid,text,uuid,text)';
    expect(pg.db(`SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp']
      FROM pg_proc WHERE oid='${signature}'::regprocedure`)).toBe('t');
    expect(pg.db("SELECT relrowsecurity FROM pg_class WHERE oid='public.pos_checkout_attempts'::regclass")).toBe('t');
    expect(pg.db(`SELECT has_function_privilege('service_role','${signature}','EXECUTE')`)).toBe('t');
    for (const role of ['anon', 'authenticated']) {
      expect(pg.db(`SELECT has_function_privilege('${role}','${signature}','EXECUTE')`)).toBe('f');
      expect(() => pg.call(cancelSql(), ids.collaborator, role)).toThrow('permission denied');
      for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        expect(pg.db(`SELECT has_table_privilege('${role}','public.pos_checkout_attempts','${operation}')`)).toBe('f');
      }
    }
    for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(pg.db(`SELECT has_table_privilege('service_role','public.pos_checkout_attempts','${operation}')`))
        .toBe(operation === 'DELETE' ? 'f' : 't');
    }
    // Even accidentally granting EXECUTE does not bypass the function's role guard.
    pg.db(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`);
    expect(() => pg.call(cancelSql(), ids.collaborator)).toThrow('Server checkout cancellation required');
  });

  it.each([ids.owner, ids.coOwner, ids.admin, ids.collaborator])('cancels only actor %s own admission, without financial writes', actor => {
    claim(actor);
    const before = attempt();
    const finances = financialSnapshot();
    expect(cancel(actor, ' Original reason. ')).toEqual({ state: 'rejected', orderId: order, saleId: null });
    const after = attempt();
    expect(after).toMatchObject({ state: 'rejected', cancelled_by: actor, cancelled_reason: ' Original reason. ',
      actor_id: actor, fingerprint: before.fingerprint, result: before.result, order_id: order });
    expect(after.cancelled_at).toEqual(expect.any(String));
    expect(after.owner_token).not.toBe(token);
    expect(financialSnapshot()).toBe(finances);
    expect(cancel(actor, 'A different retry reason')).toEqual({ state: 'rejected', orderId: order, saleId: null });
    expect(attempt()).toEqual(after);
    expect(JSON.parse(claim(actor))).toMatchObject({ state: 'rejected' });
    expect(attempt()).toEqual(after);
  });

  it('acknowledges a preexisting rejection, preserving its result evidence', () => {
    claim();
    pg.db(serviceSql(`SELECT public.pos_checkout_transition('${ids.site}','${key}','${token}',
      'rejected',NULL,NULL,'{"error":"original rejection"}')`));
    expect(cancel().state).toBe('rejected');
    expect(attempt()).toMatchObject({ result: { error: 'original rejection' }, cancelled_reason: 'Customer cancelled' });
  });

  it('revokes the stale owner token for every transition and commit', () => {
    claim(); cancel();
    const before = attempt();
    const finances = financialSnapshot();
    for (const state of ['writes_started', 'rejected', 'completed', 'review_required']) {
      expect(pg.db(serviceSql(transitionSql(state)))).toBe('f');
    }
    expect(() => pg.db(serviceSql(`SELECT public.pos_checkout_commit_order('${ids.site}','${key}',
      '${token}','${order}','{}','{}','{}','{}')`))).toThrow('Checkout admission mismatch');
    expect(attempt()).toEqual(before);
    expect(financialSnapshot()).toBe(finances);
  });

  it.each(['writes_started', 'completed', 'review_required'])('refuses %s without changing any evidence', state => {
    claim();
    expect(pg.db(serviceSql(transitionSql()))).toBe('t');
    if (state !== 'writes_started') expect(pg.db(serviceSql(transitionSql(state)))).toBe('t');
    const before = attempt();
    const finances = financialSnapshot();
    expect(cancel()).toEqual({ state });
    expect(attempt()).toEqual(before);
    expect(financialSnapshot()).toBe(finances);
  });

  it('never creates a missing attempt or changes a legacy order', () => {
    const finances = financialSnapshot();
    expect(cancel()).toEqual({ state: 'not_found' });
    expect(pg.db('SELECT count(*) FROM public.pos_checkout_attempts')).toBe('0');
    expect(financialSnapshot()).toBe(finances);
  });

  it.each([ids.owner, ids.admin, ids.foreign])('denies foreign actor %s including managers', actor => {
    claim();
    const before = attempt();
    expect(cancel(actor)).toEqual({ state: 'identity_conflict' });
    expect(attempt()).toEqual(before);
  });

  it('scopes identical keys to their tenant', () => {
    claim();
    const before = attempt();
    expect(cancel(ids.collaborator, 'Wrong tenant', ids.otherSite)).toEqual({ state: 'not_found' });
    expect(attempt()).toEqual(before);
  });

  it.each([
    `UPDATE public.site_members SET status='inactive' WHERE user_id='${ids.collaborator}'`,
    `UPDATE public.site_members SET license_suspended=true WHERE user_id='${ids.collaborator}'`,
    `UPDATE public.site_members SET role='marketing' WHERE user_id='${ids.collaborator}'`,
    `UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`,
  ])('reauthorizes before cancellation after %s', change => {
    claim(); pg.db(change);
    const before = attempt();
    expect(() => cancel()).toThrow('Register access denied');
    expect(attempt()).toEqual(before);
  });

  it.each(['true', 'NULL'])('fails closed for location restriction %s', restriction => {
    claim();
    pg.db(`CREATE OR REPLACE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT ${restriction}::boolean $$`);
    const before = attempt();
    expect(() => cancel()).toThrow('Unrestricted checkout access required');
    expect(attempt()).toEqual(before);
  });

  it('reauthorizes repeated cancellation, not just the first call', () => {
    claim(); cancel();
    pg.db(`UPDATE public.site_members SET status='inactive' WHERE user_id='${ids.collaborator}'`);
    const before = attempt();
    expect(() => cancel()).toThrow('Register access denied');
    expect(attempt()).toEqual(before);
  });

  it('denies linked order tenant drift without mutating the attempt', () => {
    claim();
    pg.db(`UPDATE public.sale_orders SET site_id='${ids.otherSite}' WHERE id='${order}'`);
    const before = attempt();
    expect(cancel()).toEqual({ state: 'identity_conflict' });
    expect(attempt()).toEqual(before);
  });

  it.each([null, '', ' \n\t ', 'x'.repeat(501)])('rejects invalid RPC reason %p', reason => {
    claim();
    const before = attempt();
    expect(() => pg.db(serviceSql(cancelSql(ids.collaborator, reason)))).toThrow('Invalid checkout cancellation request');
    expect(attempt()).toEqual(before);
  });

  it('restores service claims after successful actor reauthorization', () => {
    claim();
    const result = pg.db(serviceSql(`BEGIN; ${cancelSql()}; SELECT auth.role(),auth.uid(); COMMIT;`));
    expect(result.split('\n').at(-1)).toBe(`service_role|${ids.owner}`);
  });

  it('serializes cancellation winning against writes_started', async () => {
    claim();
    const cancelling = pg.concurrent(serviceSql(`SET application_name='cancel-wins'; BEGIN;
      ${cancelSql()}; SELECT pg_sleep(1); COMMIT;`));
    await waitForEvent('cancel-wins', 'PgSleep');
    const writing = pg.concurrent(serviceSql(transitionSql()));
    await cancelling;
    expect(await writing).toBe('f');
    expect(attempt()).toMatchObject({ state: 'rejected', cancelled_by: ids.collaborator });
  });

  it('serializes writes_started winning against cancellation without rotating its token', async () => {
    claim();
    const writing = pg.concurrent(serviceSql(`SET application_name='writes-win'; BEGIN;
      ${transitionSql()}; SELECT pg_sleep(1); COMMIT;`));
    await waitForEvent('writes-win', 'PgSleep');
    const cancelling = pg.concurrent(serviceSql(cancelSql()));
    await writing;
    expect(JSON.parse(await cancelling)).toEqual({ state: 'writes_started' });
    expect(attempt()).toMatchObject({ state: 'writes_started', owner_token: token, cancelled_at: null,
      cancelled_by: null, cancelled_reason: null });
  });

  it('waits for an uncommitted claim rather than cancelling unknown legacy work', async () => {
    const claiming = pg.concurrent(serviceSql(`SET application_name='claim-first'; BEGIN;
      SELECT public.pos_checkout_claim('${ids.site}','${key}','${ids.collaborator}',
        '${order}','fingerprint','${token}'); SELECT pg_sleep(1); COMMIT;`));
    await waitForEvent('claim-first', 'PgSleep');
    const cancelling = pg.concurrent(serviceSql(cancelSql()));
    await claiming;
    expect(JSON.parse(await cancelling).state).toBe('rejected');
  });

  it('serializes simultaneous cancellation retries and preserves the winning reason', async () => {
    claim();
    const first = pg.concurrent(serviceSql(`SET application_name='first-cancel'; BEGIN;
      ${cancelSql(ids.collaborator, 'First reason')}; SELECT pg_sleep(1); COMMIT;`));
    await waitForEvent('first-cancel', 'PgSleep');
    const second = pg.concurrent(serviceSql(cancelSql(ids.collaborator, 'Second reason')));
    await first;
    const before = attempt();
    expect(JSON.parse(await second).state).toBe('rejected');
    expect(attempt()).toEqual(before);
    expect(attempt().cancelled_reason).toBe('First reason');
  });
});