/** @jest-environment node */
import { actorSql, isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, installConnectorFixture, jsonSql, sqlSource } from './connector-postgres-fixture'

const migration = '20261120020000_connector_action_approvals.sql'
const table = 'public.connector_action_approvals'
const conversation = uuid(1100)
const action = { connectorId: id.connector, tool: 'DEMO', revision: 1, args: { quantity: 4 } }
const request = (args: { site?: string; agent?: string; conversation?: string | null; key?: string; action?: unknown } = {}) =>
  `SELECT id FROM public.request_connector_action_approval('${args.site ?? id.site}',
    ${args.conversation === null ? 'NULL' : `'${args.conversation ?? conversation}'`},
    '${args.agent ?? id.agent}','${args.key ?? 'command-1:call-1'}',${jsonSql(args.action ?? action)})`
const decide = (approval: string, decision = 'approve', actor = id.admin, site = id.site) =>
  `SELECT status FROM public.decide_connector_action_approval('${site}','${approval}','${actor}','${decision}')`
const finish = (approval: string, status = 'succeeded', actor = id.admin, site = id.site) =>
  `SELECT status FROM public.finish_connector_action_approval('${site}','${approval}','${actor}','${status}')`

it('ships identical forward migrations in the canonical repository and both mirrors', () => {
  expect(sqlSource(migration)).toBe(sqlSource(migration, 'API'))
  expect(sqlSource(migration)).toBe(sqlSource(migration, 'makinari-db-scheme'))
})

const suite = postgresAvailable ? describe : describe.skip
suite('private connector approvals in disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  // This JWT subject is deliberately NOT the manager. Authorization checks use
  // the explicit manager authenticated by the API, not the proposal origin/JWT.
  const service = (sql: string) => pg.call(sql, id.viewer, 'service_role')
  const race = (sql: string) => pg.concurrent(actorSql(sql, id.viewer, 'service_role'))
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installConnectorFixture(db)
    db(`CREATE TABLE public.conversations(id uuid PRIMARY KEY, site_id uuid, agent_id uuid);
      INSERT INTO public.conversations VALUES ('${conversation}','${id.site}','${id.agent}');
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon,authenticated,service_role;`)
    db(sqlSource(migration))
    db(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon,authenticated,service_role;`)
  })

  it('denies browser reads, direct writes and RPC calls, including authenticated site owners', () => {
    const approval = service(request())
    expect(db(`SELECT relrowsecurity FROM pg_class WHERE oid='${table}'::regclass`)).toBe('t')
    for (const role of ['anon', 'authenticated']) {
      for (const sql of [`SELECT action FROM ${table}`, request(), decide(approval), finish(approval),
        `SELECT public.connector_assert_approval_origin('${id.site}',NULL,'${id.agent}')`]) {
        expect(() => pg.call(sql, id.owner, role)).toThrow(/permission denied/)
      }
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const sql of [`INSERT INTO ${table} DEFAULT VALUES`, `UPDATE ${table} SET status='pending'`,
        `DELETE FROM ${table}`, `TRUNCATE ${table}`]) {
        expect(() => pg.call(sql, id.owner, role)).toThrow(/permission denied/)
      }
    }
    expect(service(`SELECT status,actor_user_id IS NULL FROM ${table}`)).toBe('pending|t')
  })

  it('atomically deduplicates identical snapshots, never changes or reopens a consumed proposal', async () => {
    const [first, retry] = await Promise.all([race(request()), race(request())])
    expect(retry).toBe(first)
    expect(() => service(request({ action: { ...action, args: { quantity: 5 } } }))).toThrow(/idempotency conflict/)
    const standalone = service(request({ conversation: null }))
    expect(standalone).not.toBe(first)
    expect(service(request({ conversation: null }))).toBe(standalone)
    expect(service(decide(first, 'reject'))).toBe('rejected')
    expect(service(request())).toBe(first)
    expect(service(decide(first))).toBe('')
    for (const set of [`site_id='${id.otherSite}'`, `agent_id='${id.otherAgent}'`, 'conversation_id=NULL',
      "action=jsonb_set(action,'{args}','{}')", "expires_at=expires_at + interval '1 day'", "status='pending'"]) {
      expect(() => db(`UPDATE ${table} SET ${set} WHERE id='${first}'`)).toThrow(/Invalid approval transition/)
    }
  })

  it('rejects mismatched tenant, missing/inactive agents, reassignment, malformed and oversized actions', () => {
    for (const input of [{ site: id.otherSite }, { agent: id.otherAgent }, { agent: id.inactiveAgent },
      { site: id.otherSite, agent: id.otherAgent }, { conversation: uuid(1234) }]) {
      expect(() => service(request(input))).toThrow(/Invalid approval origin/)
    }
    for (const input of [{ action: [] }, { action: {} }, { action: { arg: 'x'.repeat(65536) } }, { key: '' }]) {
      expect(() => service(request(input))).toThrow(/violates check constraint/)
    }
    const approval = service(request())
    db(`UPDATE public.conversations SET agent_id=NULL WHERE id='${conversation}'`)
    expect(() => service(decide(approval))).toThrow(/Invalid approval origin/)
    expect(service(decide(approval, 'reject'))).toBe('rejected')
  })

  it('rechecks current manager authority and never consumes another site’s approval', () => {
    const approval = service(request())
    for (const user of [id.member, id.foreign, id.pending, id.blocked, id.disabled]) {
      expect(() => service(decide(approval, 'approve', user))).toThrow(/management denied/)
    }
    expect(service(decide(approval, 'approve', id.foreign, id.otherSite))).toBe('')
    db(`UPDATE public.site_members SET status='inactive' WHERE user_id='${id.admin}'`)
    expect(() => service(decide(approval))).toThrow(/management denied/)
    expect(service(decide(approval, 'approve', id.coowner))).toBe('executing')
  })

  it('admits only one concurrent claim; only its recorded manager can finish once', async () => {
    const approval = service(request())
    const results = await Promise.all([race(decide(approval)), race(decide(approval)), race(decide(approval))])
    expect(results.sort()).toEqual(['', '', 'executing'])
    expect(service(`SELECT status,actor_user_id,decided_at IS NOT NULL FROM ${table}`)).toBe(`executing|${id.admin}|t`)
    expect(service(decide(approval, 'reject'))).toBe('')
    expect(service(finish(approval, 'failed', id.owner))).toBe('')
    expect(service(finish(approval, 'failed', id.admin, id.otherSite))).toBe('')
    expect(() => service(finish(approval, 'pending'))).toThrow(/Invalid completion status/)
    expect(service(finish(approval, 'failed'))).toBe('failed')
    expect(service(finish(approval))).toBe('')
    expect(service(`SELECT finished_at IS NOT NULL FROM ${table}`)).toBe('t')
  })

  it('does not authorize past expiry, change attribution or rearm on duplicate request', () => {
    const approval = db(`INSERT INTO ${table}(site_id,agent_id,conversation_id,idempotency_key,action,created_at,expires_at)
      VALUES('${id.site}','${id.agent}','${conversation}','command-1:call-1',${jsonSql(action)},
        now()-interval '2 days',now()-interval '1 day') RETURNING id`)
    expect(service(decide(approval))).toBe('')
    expect(service(request())).toBe(approval)
    expect(service(decide(approval, 'reject'))).toBe('')
    expect(service(`SELECT status,actor_user_id IS NULL,decided_at IS NULL FROM ${table}`)).toBe('expired|t|t')
  })

  it('atomically caps new live conversation proposals, allowing replay before checking quota', async () => {
    const sql = (index: number) => request({ key: `conversation:${index}` })
    const first = service(sql(0))
    for (let i = 1; i < 4; ++i) service(sql(i))
    // psql verbose diagnostics expose SQLSTATE without matching localized text.
    const attempts = await Promise.allSettled([4, 5, 6].map(i => race('\\set VERBOSITY verbose\n' + sql(i))))
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    for (const result of attempts) if (result.status === 'rejected') expect(String(result.reason)).toContain('54000')
    expect(service(sql(0))).toBe(first)
    expect(() => service(request({ key: 'conversation:0', action: { ...action, revision: 2 } }))).toThrow(/idempotency conflict/)
    expect(service(decide(first, 'reject'))).toBe('rejected')
    expect(service(sql(0))).toBe(first)
    expect(service(sql(7))).not.toBe(first)
  })

  it('atomically caps the whole site across origins, excluding expired and other-site proposals', async () => {
    const first = service(request({ conversation: null }))
    db(`INSERT INTO ${table}(site_id,agent_id,idempotency_key,action)
      SELECT '${id.site}','${id.agent}','seed:'||i,${jsonSql(action)} FROM generate_series(1,48) i;
      INSERT INTO ${table}(site_id,agent_id,conversation_id,idempotency_key,action,created_at,expires_at)
      SELECT '${id.site}','${id.agent}','${conversation}','expired:'||i,${jsonSql(action)},
        now()-interval '2 days',now()-interval '1 day' FROM generate_series(1,10) i;`)
    const attempts = await Promise.allSettled([null, conversation].map(origin =>
      race('\\set VERBOSITY verbose\n' + request({ key: 'last-slot', conversation: origin }))))
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    for (const result of attempts) if (result.status === 'rejected') expect(String(result.reason)).toContain('54000')
    expect(service(request({ conversation: null }))).toBe(first)
    expect(service(request({ site: id.otherSite, agent: id.otherAgent, conversation: null }))).not.toBe(first)
    expect(service(decide(first))).toBe('executing')
    expect(service(request({ key: 'released-slot' }))).not.toBe(first)
  })

  it('fails closed for isolation levels that could count a stale pending queue', () => {
    expect(() => service('BEGIN ISOLATION LEVEL REPEATABLE READ; ' + request())).toThrow(/requires read committed/)
    expect(service(`SELECT count(*) FROM ${table}`)).toBe('0')
  })
})