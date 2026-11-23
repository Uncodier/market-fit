/** @jest-environment node */
import { randomUUID, createHash } from 'node:crypto'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { connector, instance, project, tool } from './connector-analytics-fixture'
import { direct, enableDirect, installProviderDirect, issueDirect, proofTable, revision } from './provider-direct-fixture'
import { createGateway, gateway, installDirectReceipts } from './provider-direct-receipt-fixture'

const migration = '20261123041000_connector_instance_scoped_reads.sql', ddl = sqlSource(migration, 'makinari-db-scheme')
const schema = 'connector_result_private', claims = `${schema}.direct_claims`, heads = `${schema}.scoped_turn_heads`
const reports = `${schema}.reports`, grants = `${schema}.analytics_grants`, request = uuid(971)
const hash = createHash('sha256').update('schema-fixture').digest('hex')
const digest = () => createHash('sha256').update(randomUUID()).digest('hex')
const doc = {title:'Workspace analytics query',note:'Bounded synthetic preview',columns:['total'],rows:[['4']]}
const recovery = {version:1,respawnCount:0,inFlight:true,inFlightKind:'turn',execution:{callerSource:'interactive',executionMode:'direct',catalogUserSession:true}}
const details = {status:'running',ask_request_sha256:hash,assistant_recovery:recovery}
const turn = (key=request, actor=id.member, body:unknown=details, agent=id.agent) => `INSERT INTO instance_logs
  (id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details) VALUES
  ('${key}','${instance}','${id.site}','${actor}','${agent}','user_action',true,${jsonSql(body)})`
const statusActors = `'${id.site}','${id.member}','${instance}','${id.agent}','${connector}'`
const status = (actorArgs=statusActors) => `SELECT public.connector_instance_scoped_read(${actorArgs})`
const base = {actor:id.member, request, account:connector, agent:id.agent, target:project, revision:1, policy:1, epoch:1,
  credential:revision, version:'20261116_00', schema:hash, source:'paid_sales', scope:'workspace'}
type Args = Partial<typeof base>
const bind = (args:Args) => {
  const c = {...base,...args}
  return `'${id.site}','${c.actor}','${instance}','${c.agent}','${c.account}','${c.request}',${c.revision},${c.policy},${c.epoch},
    '${c.credential}','${c.target}','${c.version}','${c.schema}','${c.source}','${c.scope}'`
}
const claim = (args:Args={}, d=digest()) => `SELECT public.claim_connector_instance_scoped_read(${bind(args)},'${d}')`
const store = (key:string,args:Args={},report:unknown=doc) => `SELECT public.store_connector_instance_scoped_read(${bind(args)},'${key}',${jsonSql(report)})`
const read = (key:string) => `SELECT public.read_connector_private_result('${key}')`
const list = 'SELECT id FROM public.list_connector_private_results()'
const verbose = '\\set VERBOSITY verbose\n'

test('uses byte-identical scoped read migrations in the three repositories', () => {
  for (const repo of ['market-fit','API']) expect(sqlSource(migration,repo)).toBe(ddl)
})
if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Socket-only PostgreSQL binaries required')

;(postgresAvailable ? describe : describe.skip)('private instance scoped reads in socket-only PostgreSQL', () => {
  const pg=isolatedPostgres(), db=pg.db
  const service=(sql:string) => db(`${verbose}${gateway} ${sql}`)
  const user=(sql:string,actor=id.member, anon=false) => db(`${verbose}SET ROLE authenticated;
    SET request.jwt.claims='${JSON.stringify({sub:actor,role:'authenticated',is_anonymous:anon})}'; ${sql}`)
  const member = `INSERT INTO connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by)
    VALUES ('${id.site}','${connector}','${id.member}',true,true,'${id.owner}')`
  const policy = `UPDATE connector_policies SET `, onAccount=` WHERE connector_id='${connector}'`
  const current = () => JSON.parse(service(status()))
  const complete = (args:Args={}) => service(store(service(claim(args)),args))
  const platform = {scope:'platform'}
  const issueGrant = (actor=id.member, agent=id.agent) => db(`INSERT INTO ${grants}(site_id,user_id,agent_id,connector_id,project_ref,expires_at)
    VALUES ('${id.site}','${actor}','${agent}','${connector}','${project}',now()+interval '1 hour') RETURNING id`)
  const grantRevoke = (key:string) => `UPDATE ${grants} SET revoked_at=now() WHERE id='${key}'`
  async function waitFor(sql:string) {
    for (let i=0; i<100; i++) { if (db(sql)==='t') return; await new Promise(resolve=>setTimeout(resolve,10)) }
    throw Error('Fixture synchronization timed out')
  }
  beforeAll(() => { pg.start(); db(createGateway) },30000)
  afterAll(pg.stop)
  beforeEach(() => {
    installProviderDirect(db); installDirectReceipts(db); db(sqlSource('20261123030000_connector_ask_on_connect.sql'))
    db(sqlSource('20261123040000_connector_instance_member_authority.sql'))
    db(`UPDATE remote_instances SET user_id='${id.member}'`)
    // An already-running post-40000 turn is not promoted by 41000. No enrollment on this site.
    service(turn(uuid(970))); db(ddl)
  },30000)

  it('returns exact metadata, reserves the first fresh turn and reads only the owner receipt, with no direct enrollment or agent grant', () => {
    expect(current()).toEqual({connector_id:connector,connector_revision:1,policy_revision:1,direct_revision:1,credential_revision:revision,project_ref:project})
    expect(() => service(claim({request:uuid(970)}))).toThrow(/42501/)
    expect(db(`SELECT count(*) FROM ${schema}.direct_enrollments; SELECT count(*) FROM ${heads}`)).toBe('0\n0')
    service(turn()); const key=service(claim()), receipt=service(store(key))
    expect(db(`SELECT action_id FROM ${heads}; SELECT count(*) FROM ${schema}.direct_turn_heads`)).toBe(`${request}\n0`)
    expect(JSON.parse(user(read(receipt)))).toEqual(doc); expect(user(list)).toBe(receipt)
    expect(user(read(receipt),id.admin)).toBe(''); expect(user(list,id.member,true)).toBe('')
    expect(user(`SELECT public.connector_private_report_choice('${receipt}',0)`)).toBe('')
    expect(db(`SELECT (c.data_scope,c.source_name,c.project_ref)=('workspace','paid_sales','${project}') AND c.grant_id IS NULL AND c.attestation_id IS NULL
      FROM ${claims} c JOIN ${reports} r ON r.direct_claim_id=c.id WHERE r.id='${receipt}'`)).toBe('t')
    db(`INSERT INTO connector_agents(site_id,connector_id,agent_id,enabled,revoked_at,granted_by) VALUES
      ('${id.site}','${connector}','${id.agent}',false,now(),'${id.owner}')`)
    expect(service(store(key))).toBe(receipt); expect(user(list)).toBe(receipt)
    const ready = `'${id.site}','${id.member}','${instance}','${id.agent}','${connector}','${tool}',true,1,1,'${revision}'`
    expect(service(`SELECT public.connector_private_result_ready(${ready})`)).toBe('f')
    expect(service(`SELECT public.connector_direct_accounts('${id.site}','${id.member}','${instance}','${id.agent}','${connector}','${tool}')`)).toBe('[]')
    db(`UPDATE agents SET status='inactive' WHERE id='${id.agent}'`)
    expect(user(list)).toBe(''); expect(() => service(store(key))).toThrow(/42501/)
  })

  it('requires a saved exact policy and transport proof; no ambient fallback, account search, project or epoch substitution', () => {
    service(turn())
    for (const args of [statusActors.replace(id.site,id.otherSite),statusActors.replace(id.member,id.admin),statusActors.replace(instance,uuid(973)),
      statusActors.replace(id.agent,id.otherAgent),statusActors.replace(connector,id.hidden),statusActors.replace(`'${connector}'`,'NULL')]) expect(service(status(args))).toBe('')
    for (const args of [{target:'b'.repeat(20)},{revision:2},{policy:2},{epoch:2},{credential:'c'.repeat(64)}, {account:id.connector},{version:'latest'},
      {source:'published_views'},{scope:'all'},{scope:''},{source:'analytics.paid_sales'}]) expect(() => service(claim(args))).toThrow(/42501/)
    for (const [deny,allow] of [['catalog_reads=false','catalog_reads=true'],["allowed_hosts=ARRAY['direct']","allowed_hosts=ARRAY['assistant']"],
      ["allowed_tools=ARRAY['SUPABASE_LIST_TABLES']",`allowed_tools=ARRAY['${tool}']`]]) {
      db(policy+deny+onAccount); expect(service(status())).toBe(''); expect(() => service(claim())).toThrow(/42501/); db(policy+allow+onAccount)
    }
    db(policy+"tool_access_mode='all',allowed_tools='{}'"+onAccount); expect(current().connector_id).toBe(connector)
    db(`UPDATE site_secrets SET is_active=false`); expect(service(status())).toBe('')
    db(`UPDATE site_secrets SET is_active=true; DELETE FROM ${schema}.provider_attestations`); expect(service(status())).toBe('')
    expect(db(`SELECT count(*) FROM ${claims}`)).toBe('0')
  })

  it('requires a real member use grant on explicit accounts; managers, agent grants and a visible parent cannot substitute', () => {
    // Create the second fixture account in explicit mode (access_mode is immutable).
    const account=uuid(977), chosen={account}, aa=statusActors.replace(connector,account)
    db(`INSERT INTO connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,display_name,provider_status,
      created_by,verified_at,access_mode,enabled,supabase_project_ref) VALUES ('${account}','${id.site}','${id.provider}',
      'supabase','fixture-two','fixture-config','fixture','ACTIVE','${id.owner}',now(),'explicit',true,'${project}');
      INSERT INTO connector_policies(site_id,connector_id,catalog_reads,allowed_hosts,tool_access_mode)
      VALUES ('${id.site}','${account}',true,ARRAY['assistant'],'all');
      INSERT INTO connector_agents(site_id,connector_id,agent_id,enabled,granted_by) VALUES ('${id.site}','${account}','${id.agent}',true,'${id.owner}');`)
    service(turn()); expect(service(status(aa))).toBe(''); expect(() => service(claim(chosen))).toThrow(/42501/)
    db(`UPDATE remote_instances SET user_id='${id.admin}'`); expect(service(status(aa.replace(id.member,id.admin)))).toBe('')
    db(`UPDATE remote_instances SET user_id='${id.member}'; ${member.replace(connector,account)}`)
    const key=service(claim(chosen)), receipt=service(store(key,chosen)); expect(user(list)).toBe(receipt)
    db(`UPDATE connector_members SET revoked_at=now() WHERE connector_id='${account}'`)
    expect(() => service(store(key,chosen))).toThrow(/42501/); expect(user(list)).toBe('')
    // Even workspace inheritance loses to an explicit expired/revoked member row.
    db(`${member}; UPDATE connector_members SET expires_at=now()-interval '1 second' WHERE connector_id='${connector}'`)
    expect(service(status())).toBe(''); expect(() => service(claim())).toThrow(/42501/)
  })

  it('uses actual authenticated restrictive parent RLS at status/claim/store/replay/open, rolling back the tentative write', () => {
    service(turn()); const saved=service(claim()), receipt=service(store(saved)), pending=service(claim())
    db(`ALTER TABLE remote_instances ADD COLUMN allow_scoped boolean DEFAULT false;
      CREATE POLICY scoped_parent_fixture ON remote_instances AS RESTRICTIVE FOR SELECT TO authenticated USING
        (allow_scoped AND current_setting('request.headers',true) IS DISTINCT FROM '{"x-test":"outer"}');`)
    expect(service(status())).toBe(''); expect(user(read(receipt))).toBe(''); expect(user(list)).toBe('')
    for (const sql of [claim(),store(pending),store(saved)]) expect(() => service(sql)).toThrow(/42501/)
    expect(db(`SELECT count(*) FROM ${claims}; SELECT count(*) FROM ${reports}; SELECT consumed_at IS NULL FROM ${claims} WHERE id='${pending}'`)).toBe('2\n1\nt')
    db('UPDATE remote_instances SET allow_scoped=true'); expect(current().connector_id).toBe(connector); expect(service(store(saved))).toBe(receipt)
    expect(service(`${status()}; SELECT current_setting('request.jwt.claim.sub')='${id.owner}' AND
      current_setting('connector_direct.result_id')='prior-ack' AND current_setting('request.headers')='{"x-test":"outer"}'`).split('\n').at(-1)).toBe('t')
    expect(() => db(`${verbose}SET SESSION AUTHORIZATION service_role; SET ROLE service_role; ${claim()}`)).toThrow(/42501/)
  })

  it('requires original platform epoch even after reissue; no platform grant substitutes for source, role, location or site', () => {
    service(turn()); expect(() => service(claim(platform))).toThrow(/42501/)
    issueGrant(id.admin); expect(() => service(claim(platform))).toThrow(/42501/)
    const first=issueGrant(); const key=service(claim(platform)), receipt=service(store(key,platform)), pending=service(claim(platform))
    expect(db(`SELECT grant_id FROM ${claims} WHERE id='${key}'`)).toBe(first)
    expect(user(list)).toBe(receipt)
    for (const source of ['approved_orders','tender_awards']) {
      for (const scope of ['workspace','platform']) expect(() => service(claim({scope,source}))).toThrow(/42501/)
    }
    db(`UPDATE site_members SET blocked_screens=ARRAY['reportSales'] WHERE user_id='${id.member}'`)
    expect(() => service(claim(platform))).toThrow(/42501/); expect(user(list)).toBe('')
    db(`UPDATE site_members SET blocked_screens=ARRAY['printers'] WHERE user_id='${id.member}'`); expect(user(list)).toBe(receipt)
    db(`UPDATE site_members SET restrict_to_assigned_only=true WHERE user_id='${id.member}'`); expect(service(status())).toBe('')
    db(`UPDATE site_members SET restrict_to_assigned_only=false WHERE user_id='${id.member}';
      INSERT INTO site_member_location_restrictions SELECT site_id,id,'${uuid(979)}' FROM site_members WHERE user_id='${id.member}'`)
    expect(user(list)).toBe(''); expect(() => service(store(pending,platform))).toThrow(/42501/)
    db(`DELETE FROM site_member_location_restrictions WHERE location_id='${uuid(979)}'; ${grantRevoke(first)}`); const fresh=issueGrant(); expect(fresh).not.toBe(first)
    expect(user(list)).toBe(''); expect(() => service(store(key,platform))).toThrow(/42501/); expect(() => service(store(pending,platform))).toThrow(/42501/)
    expect(() => service(store(pending))).toThrow(/P0D04/); expect(complete(platform)).toHaveLength(36)
    db(`UPDATE remote_instances SET user_id='${id.admin}'`); const next=randomUUID(); service(turn(next,id.admin))
    const managed={actor:id.admin,request:next}
    expect(complete({...managed,source:'approved_orders'})).toHaveLength(36)
    expect(complete({...managed,scope:'platform',source:'tender_awards'})).toHaveLength(36)
    db(`UPDATE site_members SET role='collaborator' WHERE user_id='${id.admin}'`); expect(user(list,id.admin)).toBe('')
  })

  it('rejects non-current, unkeyed, unpinned, wrong-account, recovery and cancelled turns, without erasing valid saved history', () => {
    service(turn()); const receipt=complete(), oldPending=service(claim()); const alt=uuid(975)
    db(`INSERT INTO agents VALUES ('${alt}','${id.site}','active')`)
    expect(() => service(claim({agent:alt}))).toThrow(/42501/)
    const blockedExec = [{connectorIdHint:direct},{instanceNodeId:'node'},{expectedResultsAmount:2},
      {catalogUserSession:false},{callerSource:'scheduled'},{executionMode:'automatic'}]
    const bad = [{...details,ask_request_sha256:undefined}, {...details,status:'stopped'},
      ...[{respawnCount:1},{lease_token:'lease'},{conversationOnly:true}].map(o=>({...details,assistant_recovery:{...recovery,...o}})),
      ...blockedExec.map(o=>({...details,assistant_recovery:{...recovery,execution:{...recovery.execution,...o}}}))]
    for (const body of bad) {
      const key=randomUUID(); service(turn(key,id.member,body)); expect(() => service(claim({request:key}))).toThrow(/42501/)
    }
    service(`DELETE FROM instance_logs WHERE id<>'${request}'`)
    expect(() => service(claim())).toThrow(/42501/); expect(() => service(store(oldPending))).toThrow(/42501/); expect(user(list)).toBe(receipt)
    const next=randomUUID(); service(turn(next)); const pending=service(claim({request:next}))
    user(`UPDATE instance_logs SET details=jsonb_set(details,'{status}','"cancelled"') WHERE id='${next}'`)
    expect(() => service(store(pending,{request:next}))).toThrow(/42501/)
    // Prospective member-authority tombstone is necessary even if current head and action are intact.
    const last=randomUUID(); service(turn(last)); db(`UPDATE ${schema}.direct_ask_submissions SET member_authority=false WHERE action_id='${last}'`)
    expect(() => service(claim({request:last}))).toThrow(/42501/)
  })

  it('vetoes explicit Ask clear before any proof, and never reinterprets claims across re-enable or policy epochs', () => {
    service(turn()); const key=service(claim()), receipt=service(store(key)), pending=service(claim())
    const set=(on:boolean,epoch:number) => `SELECT public.connector_set_ask_policy('${id.site}','${id.owner}','${connector}',1,${epoch},${on})`
    service(set(false,1)); expect(service(status())).toBe(''); expect(user(read(receipt))).toBe('')
    for (const q of [claim(),claim({epoch:2}),store(key),store(pending)]) expect(() => service(q)).toThrow(/42501/)
    expect(() => service(set(true,2))).toThrow(/P0D01/)
    // Use real proof triggers and manager CAS on the synthetic connector. An
    // external classification contradicts local scope even when explicitly ON.
    const proof = () => db(`INSERT INTO ${proofTable}(site_id,connector_id,provider_id,project_id,account_id,auth_config_id,toolkit_slug,
      credential_revision,resource_namespace,resource_kind,local_installation_ref,resource_boundary,evidence_ref,credential_custody,resource_scope,operation_scope,rotation_scope,expires_at)
      VALUES ('${id.site}','${connector}','${id.provider}','project-a','test-account','test-config','supabase','${revision}',
      'fixture-issuer','external_database_project','${'b'.repeat(20)}','${project}','fixture-classification','customer_owned_dedicated',
      'provider_enforced_single_site','business_data_only_no_control_plane','reauth_cannot_expand_boundary',now()+interval '1 hour') RETURNING id`)
    const retire=(p:string) => db(`UPDATE ${proofTable} SET revoked_at=clock_timestamp() WHERE id='${p}'`)
    db(`INSERT INTO ${schema}.direct_resources VALUES ('fixture-issuer','${project}','${id.site}','{}')`)
    const a=proof(); retire(a); expect(service(status())).toBe(''); expect(() => service(claim({epoch:4}))).toThrow(/42501/)
    const b=proof(); service(set(true,5)); expect(service(status())).toBe(''); expect(() => service(claim({epoch:6}))).toThrow(/42501/)
    retire(b); expect(current().direct_revision).toBe(7); expect(user(list)).toBe(''); expect(() => service(store(pending))).toThrow(/42501/)
    const fresh=complete({epoch:7}); db(policy+'revision=revision+1'+onAccount); expect(user(read(fresh))).toBe('')
  })

  it('prevents concurrent redispatch, validates receipts and acknowledges only an identical retained result', async () => {
    service(turn()); const argsDigest=digest()
    const race=await Promise.allSettled(Array.from({length:4},()=>pg.concurrent(`${verbose}${gateway} ${claim({},argsDigest)}`)))
    const wins=race.flatMap(r=>r.status==='fulfilled'?[r.value]:[]); expect(wins).toHaveLength(1)
    expect(race.filter(r=>r.status==='rejected' && String(r.reason).includes('P0D03'))).toHaveLength(3)
    const key=wins[0]
    for (const forged of [{...doc,published:true},{...doc,rows:Array.from({length:26},()=>['3'])},{...doc,columns:['private.name']},
      {...doc,rows:[['2','3']]},{successful:true,data:doc}]) expect(() => service(store(key,{},forged))).toThrow(/22023/)
    for (const args of [{account:direct},{target:'b'.repeat(20)},{scope:'platform'},{source:'tender_awards'},
      {epoch:2},{actor:id.owner},{schema:digest()},{version:'other'}]) expect(() => service(store(key,args))).toThrow(/P0D04/)
    const ids=await Promise.all(Array.from({length:4},()=>pg.concurrent(`${gateway} ${store(key)}`)))
    expect(new Set(ids).size).toBe(1); expect(() => service(store(key,{},{...doc,rows:[['5']]}))).toThrow(/P0D04/)
    db(`DELETE FROM ${reports} WHERE id='${ids[0]}'`)
    expect(() => service(store(key))).toThrow(/P0D04/); expect(() => service(claim({},argsDigest))).toThrow(/P0D03/)
    const stale=service(claim()); db(`UPDATE ${claims} SET claimed_at=now()-interval '2 hours' WHERE id='${stale}'`)
    expect(() => service(store(stale))).toThrow(/P0D04/)
    expect(db(`SELECT count(*) FROM ${reports}`)).toBe('0')
  })

  it('leaves generic direct transactions and legacy receipt authority unchanged after migration', () => {
    const epoch=issueDirect(db); enableDirect(db); service(turn())
    const args = `'${id.site}','${id.member}','${instance}','${id.agent}','${direct}','${request}',
      'CRM_LIST_DEALS','v1','${hash}','${epoch}',1,1,3,'${revision}'`
    const generic=service(`SELECT public.claim_connector_direct_dispatch(${args},'${digest()}')`)
    const genericStore=`SELECT public.store_connector_direct_result(${args},'${generic}',${jsonSql(doc)})`
    const receipt=service(genericStore); expect(service(genericStore)).toBe(receipt); expect(JSON.parse(user(read(receipt)))).toEqual(doc)
    expect(() => service(store(generic,{account:direct}))).toThrow(/P0D04/)
    const scoped=service(claim()); expect(() => service(genericStore.replace(generic,scoped))).toThrow(/P0D04/)
    const legacy=`'${id.site}','${id.member}','${instance}','${id.agent}','${connector}','${tool}',true,1,1,'${revision}'`
    const old=service(`SELECT public.store_connector_private_result(${legacy},'v1','${hash}',${jsonSql(doc)})`)
    expect(JSON.parse(user(read(old)))).toEqual(doc)
    service(`SELECT public.connector_set_direct_policy('${id.site}','${id.owner}','${connector}',1,1,false)`)
    expect(JSON.parse(user(read(old)))).toEqual(doc); expect(user(read(receipt))).not.toBe('')
    db(`INSERT INTO connector_agents(site_id,connector_id,agent_id,enabled,granted_by) VALUES ('${id.site}','${connector}','${id.agent}',false,'${id.owner}')`)
    expect(user(read(old))).toBe('')
  })

  it('does not expose private tables, trigger functions, status keys or either mutation to a browser', () => {
    const funcs=["'public.connector_instance_scoped_read(uuid,uuid,uuid,uuid,uuid)'",
      "'public.claim_connector_instance_scoped_read(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,text,text,text,text,text,text)'",
      "'public.store_connector_instance_scoped_read(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,text,text,text,text,text,uuid,jsonb)'"]
    for (const role of ['anon','authenticated','connector_result_reader','service_role']) {
      expect(db(`SELECT ${funcs.map(f=>`has_function_privilege('${role}',${f},'EXECUTE')`).join(',')}`)).toBe(role==='service_role'?'t|t|t':'f|f|f')
      expect(db(`SELECT has_any_column_privilege('${role}','${claims}','SELECT,UPDATE,INSERT') OR
        has_table_privilege('${role}','${heads}','SELECT,UPDATE,INSERT,DELETE,TRIGGER,TRUNCATE') OR
        has_function_privilege('${role}','${schema}.scoped_read_admission(uuid,uuid,uuid,uuid,uuid)','EXECUTE') OR
        has_function_privilege('${role}','${schema}.advance_scoped_turn()','EXECUTE') OR
        has_function_privilege('${role}','${schema}.scoped_claim_admitted(${claims})','EXECUTE')`)).toBe('f')
      if (role!=='service_role') expect(() => db(`${verbose}SET ROLE ${role}; ${status()}`)).toThrow(/42501/)
    }
    service(turn()); expect(() => service(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${claim()}`)).toThrow(/42501/)
    expect(db(`SELECT count(*) FROM connector_direct_rpc.write_gate`)).toBe('0')
  })

  it.each(['member','platform'])('uses post-lock wall time for an expiring %s grant', async kind => {
    service(turn()); const isMember=kind==='member', args=isMember?{}:platform
    if (isMember) db(member); else db(`INSERT INTO ${grants}(site_id,user_id,agent_id,connector_id,project_ref,expires_at) VALUES
      ('${id.site}','${id.member}','${id.agent}','${connector}','${project}',clock_timestamp()+interval '1.8 seconds')`)
    const tbl=isMember?'public.connector_members':grants
    if (isMember) db(`UPDATE ${tbl} SET expires_at=clock_timestamp()+interval '1.8 seconds' WHERE connector_id='${connector}'`)
    const expiry=`(SELECT expires_at FROM ${tbl} WHERE connector_id='${connector}')`
    const holder=pg.concurrent(`BEGIN; SELECT id FROM connectors WHERE id='${connector}' FOR UPDATE; SELECT pg_advisory_xact_lock(1041001);
      SELECT pg_sleep(greatest(0,extract(epoch FROM (${expiry}-clock_timestamp())))+0.2); COMMIT;`)
    try {
      await waitFor('SELECT NOT pg_try_advisory_lock(1041001)')
      const attempt=Promise.allSettled([pg.concurrent(`${verbose}${gateway} SET application_name='scoped-expiry-test'; ${claim(args)}`)])
      await waitFor("SELECT EXISTS (SELECT FROM pg_stat_activity WHERE application_name='scoped-expiry-test' AND wait_event_type='Lock')")
      expect(db(`SELECT ${expiry}>clock_timestamp()`)).toBe('t')
      const [outcome]=await attempt; expect(outcome.status).toBe('rejected'); if(outcome.status==='rejected') expect(String(outcome.reason)).toContain('42501')
    } finally { await holder }
    expect(db(`SELECT count(*) FROM ${claims}`)).toBe('0')
  },15000)

  it('rolls back a waiter after a concurrent new turn or concurrent platform revoke, without resurrecting an older receipt', async () => {
    service(turn()); const grant=issueGrant(), pending=service(claim(platform)), old=complete(platform)
    const holder=pg.concurrent(`BEGIN; ${grantRevoke(grant)}; SELECT pg_advisory_xact_lock(1041002); SELECT pg_sleep(1.1); COMMIT`)
    try {
      await waitFor('SELECT NOT pg_try_advisory_lock(1041002)')
      const attempt=Promise.allSettled([pg.concurrent(`${verbose}${gateway} SET application_name='scoped-revoke-test'; ${store(pending,platform)}`)])
      await waitFor("SELECT EXISTS (SELECT FROM pg_stat_activity WHERE application_name='scoped-revoke-test' AND wait_event_type='Lock')")
      const [outcome]=await attempt; expect(outcome.status).toBe('rejected'); if(outcome.status==='rejected') expect(String(outcome.reason)).toContain('42501')
    } finally { await holder }
    expect(user(read(old))).toBe(''); expect(db(`SELECT consumed_at IS NULL FROM ${claims} WHERE id='${pending}'`)).toBe('t')
    const newer=pg.concurrent(`${gateway} BEGIN; ${turn(uuid(985))}; SELECT pg_advisory_xact_lock(1041003); SELECT pg_sleep(1.1); COMMIT`)
    try {
      await waitFor('SELECT NOT pg_try_advisory_lock(1041003)')
      const attempt=Promise.allSettled([pg.concurrent(`${verbose}${gateway} SET application_name='scoped-turn-test'; ${claim()}`)])
      await waitFor("SELECT EXISTS (SELECT FROM pg_stat_activity WHERE application_name='scoped-turn-test' AND wait_event_type='Lock')")
      const [outcome]=await attempt; expect(outcome.status).toBe('rejected'); if(outcome.status==='rejected') expect(String(outcome.reason)).toContain('42501')
    } finally { await newer }
    expect(db(`SELECT count(*) FROM ${claims}; SELECT count(*) FROM ${reports}`)).toBe('2\n1')
  },15000)
})