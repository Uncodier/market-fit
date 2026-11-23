/** @jest-environment node */
import { randomUUID, createHash } from 'node:crypto'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { connector, instance, project } from './connector-analytics-fixture'
import { installProviderDirect, revision } from './provider-direct-fixture'
import { createGateway, gateway, installDirectReceipts } from './provider-direct-receipt-fixture'

const migration = '20261123080000_connector_instance_report_sources.sql', ddl = sqlSource(migration, 'makinari-db-scheme')
const schema = 'connector_result_private', grants = `${schema}.analytics_grants`
const all = ['paid_sales', 'tender_awards', 'approved_orders'], sales = ['paid_sales']
const hash = createHash('sha256').update('schema-fixture').digest('hex')
const recovery = {version:1,respawnCount:0,inFlight:true,inFlightKind:'turn',execution:{callerSource:'interactive',executionMode:'direct',catalogUserSession:true}}
const details = {status:'running',ask_request_sha256:hash,assistant_recovery:recovery}
const base = {site:id.site,user:id.member,parent:instance,agent:id.agent,account:connector,request:uuid(988),
  connectionRev:1,policyRev:1,directRev:1,credential:revision,ref:project}
type Actor = Partial<typeof base>
const args = (a:Actor={}) => {
  const c = {...base,...a}
  return `'${c.site}','${c.user}','${c.parent}','${c.agent}','${c.account}','${c.request}',${c.connectionRev},${c.policyRev},${c.directRev},'${c.credential}','${c.ref}'`
}
const rpc = 'public.connector_instance_report_sources'
const signature = `${rpc}(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,text)`
const query = (a:Actor={}) => `SELECT ${rpc}(${args(a)})`
const turn = (a:Actor={}, body:unknown=details) => {
  const c = {...base,...a}
  return `INSERT INTO instance_logs(id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details)
    VALUES ('${c.request}','${c.parent}','${c.site}','${c.user}','${c.agent}','user_action',true,${jsonSql(body)})`
}

test('canonical and application migrations are byte-identical', () => {
  for (const repo of ['market-fit','API']) expect(sqlSource(migration,repo)).toBe(ddl)
})
if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Socket-only PostgreSQL binaries required')

;(postgresAvailable ? describe : describe.skip)('current report vocabulary in disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql:string) => db(`\\set VERBOSITY verbose\n${gateway} ${sql}`)
  const sources = (a:Actor={}) => JSON.parse(service(query(a)) || 'null')
  const grant = (a:Actor={},ttl='1 hour') => {
    const c = {...base,...a}
    return db(`INSERT INTO ${grants}(site_id,user_id,connector_id,agent_id,project_ref,expires_at)
      VALUES ('${c.site}','${c.user}','${c.account}','${c.agent}','${c.ref}',clock_timestamp()+interval '${ttl}') RETURNING id`)
  }
  beforeAll(() => { pg.start(); db(createGateway) },30000)
  afterAll(pg.stop)
  beforeEach(() => {
    installProviderDirect(db); installDirectReceipts(db)
    for (const m of ['20261123030000_connector_ask_on_connect.sql','20261123040000_connector_instance_member_authority.sql',
      '20261123041000_connector_instance_scoped_reads.sql']) db(sqlSource(m))
    db(`UPDATE remote_instances SET user_id='${id.member}'`); db(ddl); service(turn())
  },30000)

  it('describes only eligible source/scope pairs; no grant, revision, claim or receipt is created', () => {
    expect(sources()).toEqual({workspace:sales})
    expect(db(`SELECT count(*) FROM ${grants}; SELECT count(*) FROM ${schema}.direct_revisions;
      SELECT count(*) FROM ${schema}.direct_claims; SELECT count(*) FROM ${schema}.reports; SELECT count(*) FROM connector_direct_rpc.write_gate`)).toBe('0\n0\n0\n0\n0')
    const admin = {user:id.admin,request:randomUUID()}; grant(admin) // Wrong human, same connector and agent.
    expect(sources()).toEqual({workspace:sales})
    const alt = uuid(989); db(`INSERT INTO agents VALUES ('${alt}','${id.site}','active')`); grant({agent:alt})
    expect(sources()).toEqual({workspace:sales})
    const otherAccount=uuid(992)
    db(`INSERT INTO connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,display_name,provider_status,
      created_by,verified_at,access_mode,enabled,supabase_project_ref) VALUES ('${otherAccount}','${id.site}','${id.provider}',
      'supabase','report-fixture-two','test-config','Report fixture','ACTIVE','${id.owner}',now(),'workspace',true,'${project}');
      INSERT INTO connector_policies(site_id,connector_id,catalog_reads,allowed_hosts,tool_access_mode)
      VALUES ('${id.site}','${otherAccount}',true,ARRAY['assistant'],'all')`)
    grant({account:otherAccount}); expect(sources({account:otherAccount})).toEqual({workspace:sales,platform:sales})
    expect(sources()).toEqual({workspace:sales}) // Same person, project, agent and site; another account's grant is not ours.
    const epoch = grant(); expect(sources()).toEqual({workspace:sales,platform:sales})
    db(`UPDATE ${grants} SET revoked_at=now() WHERE id='${epoch}'`); expect(sources()).toEqual({workspace:sales})
    // Even with the same grant and actor, screen restrictions differ by source.
    db(`UPDATE remote_instances SET user_id='${id.admin}'`); service(turn(admin))
    expect(sources(admin)).toEqual({workspace:all,platform:all}); expect(sources()).toBeNull()
    db(`UPDATE site_members SET blocked_screens=ARRAY['purchasesOrders'] WHERE user_id='${id.admin}'`)
    expect(sources(admin)).toEqual({workspace:all.slice(0,2),platform:all.slice(0,2)})
    db(`UPDATE site_members SET blocked_screens=ARRAY['reportSales','procurementApprovals'] WHERE user_id='${id.admin}'`)
    expect(sources(admin)).toEqual({})
  })

  it('does not treat an advisory snapshot as permission to claim; expiry and revocation remove platform, never substitute workspace', () => {
    const claim = (source:string,scope:string) => `SELECT public.claim_connector_instance_scoped_read(${args()},'20261116_00','${hash}','${source}','${scope}','${hash}')`
    const key = grant(); expect(sources()).toEqual({workspace:sales,platform:sales})
    expect(() => service(claim('approved_orders','platform'))).toThrow(/42501/)
    db(`UPDATE ${grants} SET revoked_at=now() WHERE id='${key}'`)
    expect(() => service(claim('paid_sales','platform'))).toThrow(/42501/)
    grant({},'0.15 seconds'); db('SELECT pg_sleep(0.20)')
    expect(sources()).toEqual({workspace:sales}); expect(() => service(claim('paid_sales','platform'))).toThrow(/42501/)
    expect(db(`SELECT count(*) FROM ${schema}.direct_claims`)).toBe('0')
    expect(service(claim('paid_sales','workspace'))).toHaveLength(36)
  })

  it('requires the current exact account, actor, project, epochs and original keyed private interactive turn', () => {
    grant()
    for (const changed of [{parent:uuid(990)},{site:id.otherSite},{user:id.foreign},{agent:id.otherAgent},{account:id.foreignConnector}]) {
      expect(sources(changed)).toBeNull()
    }
    for (const changed of [{request:uuid(990)},{ref:'b'.repeat(20)},{policyRev:2},{connectionRev:2},{directRev:2},{credential:'stale'}]) {
      expect(sources(changed)).toEqual({})
    }
    for (const body of [{...details,ask_request_sha256:undefined},{...details,status:'stopped'},
      {...details,assistant_recovery:{...recovery,respawnCount:1}},
      {...details,assistant_recovery:{...recovery,execution:{...recovery.execution,connectorIdHint:id.hidden}}}]) {
      const newer={request:randomUUID()}; service(turn(newer,body)); expect(sources(newer)).toEqual({}); expect(sources()).toEqual({})
    }
    const last={request:randomUUID()}; service(turn(last)); expect(sources(last)).toEqual({workspace:sales,platform:sales})
    db(`UPDATE ${schema}.direct_ask_submissions SET member_authority=false WHERE action_id='${last.request}'`); expect(sources(last)).toEqual({})
  })

  it('rechecks authenticated parent RLS and member, location and tool policy before revealing grant or source information', () => {
    grant(); db('UPDATE remote_instances SET visible=false'); expect(sources()).toBeNull()
    db('UPDATE remote_instances SET visible=true'); expect(sources()).toEqual({workspace:sales,platform:sales})
    db(`INSERT INTO site_member_location_restrictions SELECT site_id,id,'${uuid(991)}' FROM site_members WHERE user_id='${id.member}'`)
    expect(sources()).toBeNull(); db(`DELETE FROM site_member_location_restrictions WHERE location_id='${uuid(991)}'`)
    db(`UPDATE connector_policies SET allowed_tools=ARRAY['SOME_OTHER_TOOL'] WHERE connector_id='${connector}'`); expect(sources()).toBeNull()
    db(`UPDATE connector_policies SET tool_access_mode='all' WHERE connector_id='${connector}';
      INSERT INTO connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by)
      VALUES ('${id.site}','${connector}','${id.member}',true,false,'${id.owner}')`)
    expect(sources()).toBeNull()
  })

  it('preserves legacy strict status, restores caller settings and exposes only the service RPC', () => {
    const old = args().split(',').slice(0,5).join(',')
    expect(JSON.parse(service(`SELECT public.connector_instance_scoped_read(${old})`))).toEqual({connector_id:connector,project_ref:project,
      connector_revision:1,policy_revision:1,direct_revision:1,credential_revision:revision})
    expect(service(`SET connector_scoped.status='prior-status'; ${query()}; SELECT current_setting('connector_scoped.status')='prior-status' AND
      current_setting('connector_direct.result_id')='prior-ack' AND current_setting('request.jwt.claim.sub')='${id.owner}'`).split('\n').at(-1)).toBe('t')
    for (const role of ['anon','authenticated','connector_result_reader','service_role']) {
      expect(db(`SELECT has_function_privilege('${role}','${signature}','EXECUTE'),
        has_function_privilege('${role}','${schema}.describe_report_sources()','EXECUTE'),has_any_column_privilege('${role}','${grants}','SELECT,UPDATE,INSERT')`))
        .toBe(role==='service_role' ? 't|f|f' : 'f|f|f')
      if (role!=='service_role') expect(() => db(`\\set VERBOSITY verbose\nSET ROLE ${role}; ${query()}`)).toThrow(/42501/)
    }
    // Even a preexisting result setting that looks like an acknowledgment is not proof.
    db('UPDATE remote_instances SET visible=false')
    expect(service(`SET connector_direct.result_id='${connector}'; SET connector_scoped.status='{"platform":["paid_sales"]}'; ${query()}`)).toBe('')
    db('UPDATE remote_instances SET visible=true')
    expect(service(query().replace(`'${base.request}'`,'NULL'))).toBe('')
    expect(db(`SET SESSION AUTHORIZATION service_role; SET ROLE service_role; ${query()}`)).toBe('') // Gateway cannot assume authenticated.
  })
})