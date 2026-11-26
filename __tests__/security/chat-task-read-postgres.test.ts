/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable, uuid } from './isolated-postgres'
import { installLeadReadFixture, leadActors as a } from '../leads/read-rls-postgres-fixture'

const change = () => migration('20261126195000_bound_chat_task_membership.sql')
const tables = ['tasks', 'conversations', 'messages'] as const
const actors = [a.owner, a.coOwner, a.assigned, a.collaborator, a.legacy, a.inactive,
  a.disabled, a.pending, a.unlicensed, a.foreign, a.locationRestricted, a.archivedOwner, a.lapsedMember]

function install(db: (sql: string) => string) {
  installLeadReadFixture(db)
  db(migration('20261123183000_bound_leads_rls_membership.sql'))
  db(`CREATE TABLE public.tasks(id uuid PRIMARY KEY, site_id uuid, user_id uuid, assignee uuid);
    CREATE TABLE public.conversations(id uuid PRIMARY KEY, site_id uuid, user_id uuid,
      agent_id uuid, delegate_id uuid, visitor_id uuid, lead_id uuid, channel text DEFAULT 'web');
    CREATE TABLE public.messages(id uuid PRIMARY KEY, conversation_id uuid, user_id uuid,
      agent_id uuid, visitor_id uuid);
    CREATE INDEX ON public.tasks(site_id); CREATE INDEX ON public.conversations(site_id);
    CREATE INDEX ON public.messages(conversation_id);`)
  const old = migration('20260820000000_team_member_restrict_assigned.sql')
  db(old.slice(old.indexOf('-- Tasks'), old.indexOf('-- Reservations')))
  db(old.slice(old.indexOf('-- Conversations'), old.indexOf('-- Records')))
  for (const table of tables) {
    db(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON public.${table} TO authenticated,anon,service_role;
      CREATE POLICY location_guard ON public.${table} AS RESTRICTIVE TO authenticated
        USING (NOT (SELECT public.current_user_has_location_restrictions()));
      CREATE POLICY anonymous_guard ON public.${table} AS RESTRICTIVE TO anon USING(false);`)
  }
  db(`CREATE POLICY review_guard ON public.conversations AS RESTRICTIVE TO authenticated
      USING (channel IS DISTINCT FROM 'internal_review');
    INSERT INTO public.tasks VALUES
      ('${uuid(500)}','${a.site}','${a.owner}','${a.assigned}'),
      ('${uuid(501)}','${a.site}','${a.assigned}',NULL),
      ('${uuid(502)}','${a.site}','${a.owner}',NULL),
      ('${uuid(503)}','${a.otherSite}','${a.assigned}',NULL),
      ('${uuid(504)}','${a.site}','${a.legacy}',NULL),
      ('${uuid(505)}','${a.archivedSite}','${a.archivedOwner}',NULL),
      ('${uuid(506)}','${a.lapsedSite}','${a.lapsedMember}',NULL);
    INSERT INTO public.conversations(id,site_id,user_id,agent_id,delegate_id,visitor_id,lead_id,channel) VALUES
      ('${uuid(600)}','${a.site}','${a.owner}',NULL,NULL,NULL,'${uuid(100)}','web'),
      ('${uuid(601)}','${a.site}','${a.assigned}',NULL,NULL,NULL,NULL,'web'),
      ('${uuid(602)}','${a.site}','${a.owner}',NULL,NULL,NULL,NULL,'web'),
      ('${uuid(603)}','${a.site}','${a.owner}','${a.assigned}',NULL,NULL,NULL,'web'),
      ('${uuid(604)}','${a.site}','${a.owner}',NULL,'${a.assigned}',NULL,NULL,'web'),
      ('${uuid(605)}','${a.otherSite}','${a.assigned}',NULL,NULL,NULL,NULL,'web'),
      ('${uuid(606)}','${a.site}','${a.owner}',NULL,NULL,'${a.assigned}',NULL,'web'),
      ('${uuid(607)}','${a.site}','${a.owner}',NULL,NULL,NULL,'${uuid(104)}','web'),
      ('${uuid(608)}','${a.site}','${a.assigned}',NULL,NULL,NULL,NULL,'internal_review'),
      ('${uuid(609)}',NULL,NULL,NULL,NULL,NULL,NULL,'web'),
      ('${uuid(610)}','${a.archivedSite}','${a.archivedOwner}',NULL,NULL,NULL,NULL,'web');
    INSERT INTO public.messages(id,conversation_id,user_id) SELECT md5('message-'||id)::uuid,id,'${a.owner}' FROM public.conversations;
    INSERT INTO public.messages VALUES ('${uuid(700)}','${uuid(602)}','${a.assigned}',NULL,NULL),
      ('${uuid(701)}',NULL,NULL,'${a.assigned}',NULL),
      ('${uuid(702)}',NULL,NULL,NULL,'${a.assigned}');`)
}

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('PostgreSQL binaries required')

;(postgresAvailable ? describe : describe.skip)('Bounded Chat and Tasks membership policies', () => {
  const pg = isolatedPostgres()
  beforeAll(pg.start, 30_000)
  beforeEach(() => install(pg.db), 30_000)
  afterAll(pg.stop)

  const visible = (table: string, actor: string, role = 'authenticated') =>
    pg.call(`SELECT id FROM public.${table} ORDER BY id`, actor, role)

  it('preserves exact visibility across ownership, NULL flags, parent access and denials', () => {
    const samples = actors.flatMap(actor => tables.map(table => ({ actor, table, role: 'authenticated' })))
    samples.push(...tables.flatMap(table => ['anon', 'service_role'].map(role => ({ table, actor: a.owner, role }))))
    const before = samples.map(s => visible(s.table, s.actor, s.role))
    expect(visible('tasks', a.assigned).split('\n')).toEqual([uuid(500), uuid(501)])
    expect(visible('conversations', a.assigned).split('\n')).toEqual([600, 601, 603, 604, 605, 606].map(uuid))
    // Visitor/direct conversation access must not authorize unrelated messages.
    expect(visible('messages', a.assigned)).not.toContain(pg.db(`SELECT md5('message-${uuid(606)}')::uuid`))
    pg.db(change())
    expect(samples.map(s => visible(s.table, s.actor, s.role))).toEqual(before)
  })

  it('preserves write checks and fresh revocation', () => {
    const attempt = (sql: string, preparation = '') => pg.db(`BEGIN; ${preparation} ${actorSql(sql, a.assigned)}; ROLLBACK;`)
    const verify = () => {
      expect(attempt(`UPDATE public.tasks SET user_id='${a.assigned}' WHERE id='${uuid(500)}' RETURNING id`)).toBe(uuid(500))
      expect(() => attempt(`UPDATE public.tasks SET assignee=NULL WHERE id='${uuid(500)}'`)).toThrow(/row-level security/)
      expect(() => attempt(`INSERT INTO public.tasks VALUES ('${uuid(800)}','${a.otherSite}','${a.assigned}',NULL)`)).toThrow(/row-level security/)
      expect(() => attempt(`INSERT INTO public.messages VALUES ('${uuid(800)}','${uuid(606)}','${a.owner}',NULL,NULL)`)).toThrow(/row-level security/)
      expect(attempt(`SELECT count(*) FROM public.tasks`, `UPDATE public.site_members SET status='inactive' WHERE user_id='${a.assigned}';`)).toBe('0')
      expect(attempt(`SELECT count(*) FROM public.tasks`, `UPDATE public.billing SET status='inactive' WHERE site_id='${a.site}';`)).toBe('0')
    }
    verify(); pg.db(change()); verify()
  })

  it('preserves NULL identity and visible cross-site lead behavior', () => {
    pg.db(`INSERT INTO public.site_members(site_id,user_id,role,status) VALUES
      ('${a.otherSite}','${a.assigned}','collaborator','active');
      UPDATE public.site_members SET restrict_to_assigned_only=true WHERE user_id='${a.assigned}';
      INSERT INTO public.billing(site_id,status,plan) VALUES ('${a.otherSite}','active','enterprise');`)
    const nullIdentity = (table: string, role: string) => pg.db(`SET ROLE ${role};
      SET request.jwt.claims='{"role":"${role}"}'; SELECT id FROM public.${table} ORDER BY id`)
    const samples = tables.flatMap(table => ['authenticated', 'anon'].map(role => ({ table, role })))
    const beforeNull = samples.map(s => nullIdentity(s.table, s.role))
    const beforeRows = tables.map(table => visible(table, a.assigned))
    expect(visible('conversations', a.assigned)).toContain(uuid(607))
    pg.db(change())
    expect(samples.map(s => nullIdentity(s.table, s.role))).toEqual(beforeNull)
    expect(tables.map(table => visible(table, a.assigned))).toEqual(beforeRows)
  })

  it('does not repeat site-membership scans for each hidden candidate', () => {
    pg.db(`INSERT INTO public.tasks SELECT md5('task-'||i)::uuid,'${a.site}','${a.owner}',NULL FROM generate_series(1,1000) g(i);
      INSERT INTO public.conversations(id,site_id,user_id) SELECT md5('conversation-'||i)::uuid,'${a.site}','${a.owner}' FROM generate_series(1,1000) g(i);
      INSERT INTO public.messages(id,conversation_id,user_id) SELECT md5('message-'||i)::uuid,md5('conversation-'||i)::uuid,'${a.owner}' FROM generate_series(1,1000) g(i);
      ANALYZE public.tasks; ANALYZE public.conversations; ANALYZE public.messages;`)
    type Node = { 'Relation Name'?: string; 'Actual Loops': number; Plans?: Node[] }
    const scans = (node: Node): number => (['sites', 'site_members'].includes(node['Relation Name'] ?? '') ? node['Actual Loops'] : 0)
      + (node.Plans ?? []).reduce((sum, child) => sum + scans(child), 0)
    const measure = (table: string) => {
      const result = JSON.parse(pg.call(`EXPLAIN (ANALYZE,TIMING OFF,FORMAT JSON) SELECT id FROM public.${table}`, a.assigned))[0]
      return scans(result.Plan)
    }
    for (const table of ['tasks', 'conversations']) expect(measure(table)).toBeGreaterThan(1000)
    const before = tables.map(table => visible(table, a.assigned))
    pg.db(change())
    for (const table of tables) expect(measure(table)).toBeLessThan(100)
    expect(tables.map(table => visible(table, a.assigned))).toEqual(before)
  }, 30_000)

  it('refuses policy drift atomically', () => {
    pg.db('ALTER POLICY tasks_unified ON public.tasks USING(false)')
    expect(() => pg.db(change())).toThrow(/Unexpected membership policy/)
    expect(visible('tasks', a.owner)).toBe('')
  })
})