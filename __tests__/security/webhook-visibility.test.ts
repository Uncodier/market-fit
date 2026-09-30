/** @jest-environment node */
import { actorSql, ids, installSiteFixture, isolatedPostgres, migration, postgresAvailable, uuid } from './isolated-postgres'

const repair = () => migration('20260930000000_restrict_webhook_event_access.sql')
const suite = postgresAvailable ? describe : describe.skip
const claim = (event = 'evt_local', token = uuid(40)) =>
  `SELECT claim_stripe_webhook_event('${event}', 'checkout.session.completed', '{}', '${token}');`

describe('webhook visibility migration contract', () => {
  it('removes ordinary user access without changing the claim function bodies or stored events', () => {
    const sql = repair()
    expect(sql).toContain('DROP POLICY IF EXISTS webhook_events_users_policy')
    expect(sql).toContain('REVOKE ALL ON TABLE public.webhook_events FROM PUBLIC, anon, authenticated')
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION|DELETE FROM|UPDATE public.webhook_events SET/)
  })
})

suite('webhook privacy and delivery in disposable PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installSiteFixture(pg.db)
    pg.db(`CREATE TABLE webhook_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), stripe_event_id text NOT NULL UNIQUE,
      event_type text NOT NULL, processed_at timestamptz, status text NOT NULL, event_data jsonb, error_message text,
      site_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
      GRANT ALL ON webhook_events TO postgres, anon, authenticated, service_role;
      CREATE POLICY webhook_events_users_policy ON webhook_events FOR SELECT TO authenticated
        USING (site_id IS NULL OR EXISTS (SELECT 1 FROM sites s WHERE s.id=webhook_events.site_id
          AND (s.user_id=auth.uid() OR EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id=s.id AND sm.user_id=auth.uid()))));
      CREATE POLICY webhook_events_service_role_policy ON webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);`)
    pg.db(migration('20260917210100_stripe_webhook_delivery_claims.sql'))
    pg.db(migration('20260925000000_fix_webhook_events_status_constraint.sql'))
    for (const signature of ['claim_stripe_webhook_event(text,text,jsonb,uuid)', 'complete_stripe_webhook_event(text,uuid)',
      'fail_stripe_webhook_event(text,uuid,text)', 'cleanup_old_webhook_events(integer)']) {
      pg.db(`ALTER FUNCTION public.${signature} OWNER TO postgres;`)
    }
  })

  it('reproduces foreign-user visibility of a site-null event and closes it', () => {
    pg.call(claim(), '', 'service_role')
    expect(pg.call('SELECT count(*) FROM webhook_events', ids.foreign)).toBe('1')
    pg.db(repair())
    expect(() => pg.call('SELECT count(*) FROM webhook_events', ids.foreign)).toThrow('permission denied')
    expect(pg.call('SELECT count(*) FROM webhook_events', '', 'service_role')).toBe('1')
  })

  it.each([['owner', ids.owner], ['admin', ids.admin], ['marketing', ids.marketing], ['inactive', ids.inactive]])(
    'denies %s access to internal events even when a site is assigned', (_label, user) => {
      pg.call(claim(), '', 'service_role')
      pg.db(`UPDATE webhook_events SET site_id='${ids.site}'; GRANT SELECT (event_data) ON webhook_events TO authenticated;`)
      pg.db(repair())
      expect(() => pg.call('SELECT event_data FROM webhook_events', user)).toThrow('permission denied')
      expect(() => pg.call('DELETE FROM webhook_events', user)).toThrow('permission denied')
    },
  )

  it('denies anonymous reads and browser execution of every privileged RPC', () => {
    pg.db(repair())
    expect(() => pg.call('SELECT * FROM webhook_events', '', 'anon')).toThrow('permission denied')
    for (const sql of [claim(), `SELECT complete_stripe_webhook_event('evt_local','${uuid(40)}')`,
      `SELECT fail_stripe_webhook_event('evt_local','${uuid(40)}','test')`, 'SELECT cleanup_old_webhook_events(30)']) {
      expect(() => pg.call(sql)).toThrow('permission denied')
      expect(() => pg.call(sql, '', 'anon')).toThrow('permission denied')
    }
  })

  it('retains single-owner concurrent claims, token fencing and replay handling', async () => {
    pg.db(repair())
    const results = await Promise.all([uuid(40), uuid(41)].map(token =>
      pg.concurrent(actorSql(claim('evt_local', token), '', 'service_role')).then(result => JSON.parse(result))))
    expect(results.map(result => result.outcome).sort()).toEqual(['claimed', 'in_progress'])
    const token = results.find(result => result.outcome === 'claimed').claim_token
    expect(pg.call(`SELECT complete_stripe_webhook_event('evt_local','${uuid(42)}')`, '', 'service_role')).toBe('f')
    expect(pg.call(`SELECT complete_stripe_webhook_event('evt_local','${token}')`, '', 'service_role')).toBe('t')
    expect(JSON.parse(pg.call(claim(), '', 'service_role')).outcome).toBe('processed')
  })

  it('preserves failure/retry processing, fenced stale claims and processed-only cleanup', () => {
    pg.db(repair())
    pg.call(claim(), '', 'service_role')
    expect(pg.call(`SELECT fail_stripe_webhook_event('evt_local','${uuid(40)}','Synthetic failure')`, '', 'service_role')).toBe('t')
    expect(JSON.parse(pg.call(claim('evt_local', uuid(41)), '', 'service_role')).outcome).toBe('claimed')
    expect(pg.call(`SELECT complete_stripe_webhook_event('evt_local','${uuid(40)}')`, '', 'service_role')).toBe('f')
    pg.call(`SELECT complete_stripe_webhook_event('evt_local','${uuid(41)}')`, '', 'service_role')
    pg.call(claim('evt_pending'), '', 'service_role')
    pg.db("UPDATE webhook_events SET created_at=now()-interval '40 days';")
    expect(pg.call('SELECT cleanup_old_webhook_events(30)', '', 'service_role')).toBe('1')
    expect(pg.call('SELECT stripe_event_id FROM webhook_events', '', 'service_role')).toBe('evt_pending')
  })

  it('rejects unknown policy drift transactionally and allows rerunning the reviewed migration', () => {
    pg.db('CREATE POLICY unexpected_access ON webhook_events FOR SELECT USING (true);')
    expect(() => pg.db(repair())).toThrow('Unexpected webhook_events policies')
    expect(pg.db("SELECT count(*) FROM pg_policies WHERE policyname='webhook_events_users_policy'")).toBe('1')
    pg.db('DROP POLICY unexpected_access ON webhook_events;')
    pg.db(repair()); pg.db(repair())
    expect(pg.db("SELECT count(*) FROM pg_policies WHERE tablename='webhook_events'")).toBe('1')
  })
})