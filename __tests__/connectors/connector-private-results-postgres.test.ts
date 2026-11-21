import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, installConnectorFixture, jsonSql, memberRow, sqlSource } from './connector-postgres-fixture'

const migration = '20261121002000_connector_private_results.sql'
const instance = uuid(600)
const report = { title: 'Published reports', columns: ['Report name'], rows: [['private_pick']], published: true, next_after: 'private_pick', note: '' }
const tool = 'SUPABASE_RUN_READ_ONLY_QUERY'
const args = `'${id.site}','${id.member}','${instance}','${id.agent}','${id.connector}','${tool}',true,1,1,'rev-1'`
const store = (binding = args) => `SELECT public.store_connector_private_result(${binding},'v1','${'a'.repeat(64)}',${jsonSql(report)})`
const ready = (binding = args) => `SELECT public.connector_private_result_ready(${binding})`

;(postgresAvailable ? describe : describe.skip)('owner-only private result destination in isolated PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (q: string) => pg.call(q, id.owner, 'service_role')
  const user = (q: string, who = id.member, anonymous: boolean | null = false) => db(`SET ROLE authenticated;
    SET request.jwt.claims = '${JSON.stringify({ sub: who, ...(anonymous !== null && { is_anonymous: anonymous }) })}'; ${q}`)
  const active = (receipt: string) => `SELECT public.read_connector_private_result('${receipt}')`
  const pick = (receipt: string, n: number) => `SELECT public.connector_private_report_choice('${receipt}',${n})`
  const list = 'SELECT id FROM public.list_connector_private_results()'
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    db('DROP SCHEMA IF EXISTS connector_result_private CASCADE'); installConnectorFixture(db)
    db('DROP ROLE IF EXISTS connector_result_reader')
    db(sqlSource('20261120050000_connector_support_publication.sql'))
    const deployed = sqlSource('20261019220003_startup_trial_licensing.sql')
    const fn = deployed.slice(deployed.indexOf('CREATE FUNCTION public.site_user_has_effective_access(')).split('$$;')[0] + '$$;'
    db(fn)
    db(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claims',true)::jsonb$$;
      CREATE TABLE remote_instances(id uuid PRIMARY KEY, site_id uuid, user_id uuid, is_archived boolean DEFAULT false,
        visible_in_workspace boolean NOT NULL DEFAULT true);
      INSERT INTO remote_instances VALUES ('${instance}','${id.site}','${id.member}');
      GRANT SELECT (id,site_id,user_id) ON remote_instances TO authenticated;
      ALTER TABLE remote_instances ENABLE ROW LEVEL SECURITY;
      CREATE POLICY instance_fixture_read ON remote_instances FOR SELECT TO authenticated USING (visible_in_workspace);
      ALTER TABLE site_members ADD COLUMN restrict_to_assigned_only boolean DEFAULT false;`)
    db(sqlSource('20261120235000_connector_catalog_reads.sql')); db(sqlSource(migration))
    db('REVOKE ALL ON public.site_member_location_restrictions FROM service_role')
    db(sqlSource('20261121013000_connector_catalog_actor_location_acl.sql'))
    db(`UPDATE connectors SET enabled=true WHERE id='${id.connector}';
      INSERT INTO connector_members(site_id,connector_id,user_id,granted_by,can_view,can_use)
        VALUES ('${id.site}','${id.connector}','${id.member}','${id.owner}',true,true);
      INSERT INTO connector_agents(site_id,connector_id,agent_id,granted_by,enabled)
        VALUES ('${id.site}','${id.connector}','${id.agent}','${id.owner}',true);
      INSERT INTO connector_policies(site_id,connector_id,allowed_tools,allowed_hosts,catalog_reads)
        VALUES ('${id.site}','${id.connector}',ARRAY['${tool}','GMAIL_FETCH_EMAILS'],ARRAY['assistant'],true);`)
  })

  it('has no service/browser table access or service-role retrieval, returns only a UUID to the writer', () => {
    expect(service(ready())).toBe('t')
    const receipt = service(store()); expect(receipt).toMatch(/^[a-f\d-]{36}$/)
    expect(db("SELECT pg_has_role('authenticated','connector_result_reader','MEMBER') OR pg_has_role('service_role','connector_result_reader','MEMBER')")).toBe('f')
    expect(JSON.parse(user(active(receipt)))).toEqual(report); expect(user(list)).toBe(receipt)
    expect(JSON.parse(user(pick(receipt, 0)))).toMatchObject({ site_id: id.site, user_id: id.member, agent_id: id.agent,
      instance_id: instance, connector_id: id.connector, version: 'v1', arguments: { view: 'private_pick' } })
    expect(JSON.parse(user(pick(receipt,-1))).arguments).toEqual({ after: 'private_pick' }); expect(user(pick(receipt,1))).toBe('')
    for (const who of [id.owner,id.coowner,id.admin,id.viewer,id.foreign]) {
      expect(user(active(receipt), who)).toBe(''); expect(user(list, who)).toBe(''); expect(user(pick(receipt,0),who)).toBe('')
    }
    for (const anonymous of [true,null]) expect(user(active(receipt),id.member,anonymous)).toBe('')
    for (const role of ['anon','service_role']) for (const q of [active(receipt),pick(receipt,0),list])
      expect(() => pg.call(q, id.member, role)).toThrow(/permission denied/)
    for (const role of ['anon','authenticated','service_role']) {
      expect(() => pg.call('SELECT report FROM connector_result_private.reports',id.member,role)).toThrow(/permission denied/)
      if (role !== 'service_role') for (const q of [ready(),store()]) expect(() => pg.call(q,id.member,role)).toThrow(/permission denied/)
    }
  })

  it('rechecks each independent local permission, site/instance identity, TTL and exact action revision for every read', () => {
    const receipt = service(store())
    for (const change of ["UPDATE agents SET status='inactive'", 'UPDATE remote_instances SET is_archived=true',
      'UPDATE remote_instances SET visible_in_workspace=false',
      `UPDATE remote_instances SET user_id='${id.owner}'`, 'UPDATE connector_agents SET enabled=false',
      "UPDATE connector_agents SET expires_at=now()-interval '1 second'", 'UPDATE connector_members SET can_use=false',
      "UPDATE connector_members SET revoked_at=now()", "UPDATE sites SET archived_at=now()", "UPDATE site_members SET status='pending'",
      'UPDATE site_members SET manually_disabled=true',
      'UPDATE site_members SET restrict_to_assigned_only=true', "UPDATE site_members SET blocked_screens=ARRAY['leads']",
      `INSERT INTO site_member_location_restrictions VALUES ('${id.site}','${memberRow(id.member)}','${uuid(99)}')`,
      'UPDATE connectors SET enabled=false', 'UPDATE connectors SET revocation_dispatched=true', 'UPDATE connectors SET revision=2',
      "UPDATE connector_policies SET allowed_hosts=ARRAY['direct']", "UPDATE connector_policies SET allowed_tools='{}'",
      'UPDATE connector_policies SET catalog_reads=false', 'UPDATE connector_policies SET revision=2',
      "UPDATE site_connector_providers SET status='disabled'", "UPDATE site_connector_providers SET credential_revision='rev-2'",
      'UPDATE connector_result_private.reports SET expires_at=now()']) {
      const claims = JSON.stringify({ sub: id.member, is_anonymous:false })
      const denial = db(`BEGIN; ${change}; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='${claims}';
        SELECT (${active(receipt)}) IS NULL AND (${pick(receipt,0)}) IS NULL AND NOT EXISTS(${list}); ROLLBACK;`)
      expect({ change, denial }).toEqual({ change, denial: 't' })
    }
    expect(user(list)).toBe(receipt)
    for (const bad of [args.replace(id.connector,id.foreignConnector),args.replace(id.agent,id.otherAgent),args.replace(id.member,id.admin),
      args.replace(id.site,id.otherSite),args.replace(tool,'GMAIL_DELETE_MESSAGE'),args.replace("'rev-1'","'other'")]) {
      expect(service(ready(bad))).toBe('f'); expect(() => service(store(bad))).toThrow(/unavailable/)
    }
  })

  it('allows verified curated use without catalog opt-in, and bounds stored items even without a scheduler', () => {
    const reviewed = args.replace(tool,'GMAIL_FETCH_EMAILS').replace(',true,',',false,')
    db('UPDATE connector_policies SET catalog_reads=false'); expect(service(ready())).toBe('f')
    const receipt = service(store(reviewed)); expect(JSON.parse(user(active(receipt)))).toEqual(report)
    expect(user(pick(receipt,0))).toBe('') // A curated result cannot become a published-report action.
    db('UPDATE connector_result_private.reports SET expires_at=now()'); expect(user(active(receipt))).toBe('')
    for (let i=0;i<21;i++) service(store(reviewed))
    expect(db('SELECT count(*) FROM connector_result_private.reports')).toBe('20'); expect(user(list).split('\n')).toHaveLength(20)
    db('DELETE FROM remote_instances'); expect(db('SELECT count(*) FROM connector_result_private.reports')).toBe('0')
  })
})

test('private destination migration is byte-identical in canonical and mirrored repositories', () => {
  for (const repo of ['market-fit','API']) expect(sqlSource(migration,repo)).toBe(sqlSource(migration,'makinari-db-scheme'))
})