/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { connector as databaseConnector, project as databaseProject } from './connector-analytics-fixture'
import { direct, directMigration, enableDirect, installProviderDirect, instance, issueDirect, issueSql, proofTable, revision, setSql } from './provider-direct-fixture'

const account = `public.connector_direct_accounts('${id.site}','${id.admin}','${instance}','${id.agent}','${direct}','CRM_LIST_DEALS')`
const count = (rpc=account) => `SELECT jsonb_array_length(${rpc})`
const read = `SELECT public.connector_direct_policy('${id.site}','${id.owner}','${direct}')`
const revoke = `UPDATE ${proofTable} SET revoked_at=now() WHERE revoked_at IS NULL`
const state = (direct_revision:number,attested:boolean,enabled:boolean,revision=1) => ({connector_id:direct,revision,direct_revision,attested,enabled})
const audit = `SELECT direct_revision,connector_revision,actor_id,enabled FROM connector_result_private.direct_policy_events WHERE connector_id='${direct}' ORDER BY direct_revision`
const updatePolicy = `SELECT public.connector_update_policy('${id.site}','${direct}','${id.owner}',1,ARRAY['CRM_LIST_DEALS'],ARRAY['assistant'],false,true,'selected',NULL,true)`
const legacyReport = { title:'Catalogue preview', note:'Private report', columns:['Field'], rows:[['23']] }

it('mirrors the forward migration byte-for-byte', () => {
  for (const repo of ['API','market-fit']) expect(sqlSource(directMigration,repo)).toBe(sqlSource(directMigration,'makinari-db-scheme'))
})

;(postgresAvailable ? describe : describe.skip)('direct resource admission on disposable socket-only PostgreSQL',()=>{
  const pg=isolatedPostgres(), db=pg.db, service=(sql:string)=>pg.call(sql,id.owner,'service_role')
  const manage=()=>JSON.parse(service(read))
  const user=(sql:string)=>db(`SET ROLE authenticated; SET request.jwt.claims='{"sub":"${id.admin}","is_anonymous":false}'; ${sql}`)
  let legacy: string
  beforeAll(()=>pg.start(),30000); afterAll(pg.stop)
  beforeEach(()=>installProviderDirect(db,()=>{
    legacy=service(`SELECT public.store_connector_private_result('${id.site}','${id.admin}','${instance}','${id.agent}','${direct}',
      'CRM_LIST_DEALS',true,1,1,'${revision}','v1','${'a'.repeat(64)}',${jsonSql(legacyReport)})`)
  }),30000)

  it('retains a pre-migration catalogue report through direct changes but not through an ordinary policy edit',()=>{
    const revisions=`SELECT c.revision,cp.revision FROM public.connectors c JOIN public.connector_policies cp ON cp.connector_id=c.id WHERE c.id='${direct}'`
    const open=`SELECT public.read_connector_private_result('${legacy}')`, list='SELECT id FROM public.list_connector_private_results()'
    const unchanged=()=>{ expect(db(revisions)).toBe('1|1'); expect(user(list)).toBe(legacy); expect(JSON.parse(user(open))).toEqual(legacyReport) }
    unchanged(); issueDirect(db); unchanged(); enableDirect(db); unchanged()
    service(setSql(false,3)); unchanged(); enableDirect(db); unchanged()
    db(revoke); unchanged(); issueDirect(db); unchanged(); enableDirect(db); unchanged()
    db(`DELETE FROM ${proofTable} WHERE revoked_at IS NULL`); unchanged()
    expect(manage()).toEqual(state(9,false,false))
    expect(JSON.parse(service(updatePolicy))).toEqual({connector_id:direct,revision:2,policy_revision:2})
    expect(user(list)).toBe(''); expect(user(open)).toBe('')
    expect(db(revisions)).toBe('2|2'); expect(manage()).toEqual(state(9,false,false,2))
    expect(()=>service(setSql(false,9))).toThrow(/Connector revision conflict/)
    expect(()=>service(setSql(false,8,id.admin,2))).toThrow(/Direct revision conflict/)
    expect(JSON.parse(service(setSql(false,9,id.admin,2)))).toEqual(state(10,false,false,2))
    expect(db(`SELECT revision FROM connector_audit_events WHERE connector_id='${direct}'`)).toBe('2')
  })

  it('has indexed private FK lookups and drops direct state with its connector',()=>{
    // Composite connector/provider FKs can use their globally unique ID first.
    // Ignore partial indexes: retired proofs must be found by parent deletes too.
    const leading=db(`SELECT i.indrelid::regclass::text || '.' || a.attname FROM pg_index i JOIN pg_attribute a
      ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0] WHERE i.indrelid IN (SELECT c.oid FROM pg_class c
      WHERE c.relnamespace='connector_result_private'::regnamespace) AND i.indisvalid AND i.indpred IS NULL`).split('\n')
    for (const key of ['direct_resources.site_id','direct_attestations.connector_id','direct_attestations.provider_id',
      'direct_attestations.resource_namespace','direct_enrollments.site_id','direct_enrollments.enabled_by',
      'direct_revisions.connector_id','direct_policy_events.connector_id','direct_policy_events.actor_id']) {
      expect(leading).toContain(`connector_result_private.${key}`)
    }
    issueDirect(db); enableDirect(db)
    db(`DELETE FROM public.connectors WHERE id='${direct}'`)
    for (const name of ['direct_attestations','direct_enrollments','direct_revisions','direct_policy_events']) {
      expect(db(`SELECT count(*) FROM connector_result_private.${name} WHERE connector_id='${direct}'`)).toBe('0')
    }
  })

  it('starts empty despite all, catalog opt-in, valid project credentials, workspace inheritance and manager role',()=>{
    expect(manage()).toEqual(state(1,false,false)); expect(service(count())).toBe('0')
    expect(()=>service(setSql(true,1))).toThrow(/attestation required/)
    issueDirect(db); expect(manage()).toEqual(state(2,true,false)); expect(service(count())).toBe('0')
    expect(()=>service(setSql(true,1))).toThrow(/revision conflict/)
    expect(()=>service(setSql(true,2,id.member))).toThrow(/management denied/)
    expect(()=>service(setSql(true,2,id.foreign))).toThrow(/management denied/)
    expect(JSON.parse(enableDirect(db))).toEqual(state(3,true,true)); expect(service(count())).toBe('1')
    db(`UPDATE connector_policies SET catalog_reads=false WHERE connector_id='${direct}'`)
    expect(service(count())).toBe('1'); expect(JSON.parse(service(setSql(false,3)))).toEqual(state(4,true,false)); expect(service(count())).toBe('0')
    expect(db(audit)).toBe(`3|1|${id.admin}|t\n4|1|${id.admin}|f`)
    expect(db(`SELECT count(*) FROM connector_audit_events WHERE connector_id='${direct}'`)).toBe('0')
  })

  it('proof is immutable, revocable and terminal; renewal or deletion does not inherit manager enrollment',()=>{
    const first=issueDirect(db); enableDirect(db)
    expect(()=>db(`UPDATE ${proofTable} SET expires_at=now()+interval '2 days'`)).toThrow(/only be revoked/)
    db(revoke); expect(service(count())).toBe('0'); expect(manage()).toEqual(state(4,false,false))
    expect(()=>db(`UPDATE ${proofTable} SET revoked_at=null`)).toThrow(/only be revoked/)
    expect(issueDirect(db)).not.toBe(first); expect(manage()).toEqual(state(5,true,false)); expect(service(count())).toBe('0')
    expect(()=>service(setSql(true,3))).toThrow(/revision conflict/); enableDirect(db)
    db(`DELETE FROM ${proofTable} WHERE revoked_at IS NULL`); expect(service(count())).toBe('0')
    issueDirect(db); expect(service(count())).toBe('0')
  })

  it('rejects foreign, global/admin or mismatched attestations, preserves same-site multiple accounts',()=>{
    for (const [from,to] of [
      [id.site,id.otherSite], [id.provider,id.otherProvider], ['project-a','wrong-project'],['direct-a','wrong-account'],['auth-config','wrong-config'],
      [revision,'b'.repeat(64)],['customer_owned_dedicated','internally_held_admin'],['provider_enforced_single_site','global'],
      ['business_data_only_no_control_plane','arbitrary_execution'],['reauth_cannot_expand_boundary','unverified_rotation'],
      ['customer-tenant-17','unknown'],['now()+interval \'1 day\'',"'infinity'::timestamptz"],
    ]) expect(()=>db(issueSql().replace(from,to))).toThrow()
    issueDirect(db)
    const second=uuid(812)
    db(`INSERT INTO public.connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,display_name,provider_status,
      created_by,verified_at,access_mode,enabled) VALUES ('${second}','${id.site}','${id.provider}','crm','direct-b','auth-config','Second','ACTIVE','${id.owner}',now(),'workspace',true)`)
    expect(db(issueSql().replace(direct,second).replace('direct-a','direct-b'))).toMatch(/^[a-f0-9-]{36}$/)
    expect(()=>db(`INSERT INTO connector_result_private.direct_resources VALUES ('crm-issuer','customer-tenant-17','${id.otherSite}','{}')`)).toThrow(/duplicate key/)
  })

  it('continually intersects exact account, assistant host and selected tools (an empty selection means none)',()=>{
    issueDirect(db); enableDirect(db)
    expect(service(count(account.replace(direct,id.foreignConnector)))).toBe('0'); expect(service(count(account.replace(direct,id.connector)))).toBe('0')
    for (const bad of ['OTHER_GET_DEALS','COMPOSIO_EXECUTE_TOOL','CRM:LIST_DEALS']) expect(service(count(account.replace('CRM_LIST_DEALS',bad)))).toBe('0')
    db(`UPDATE connector_policies SET allowed_hosts=ARRAY['direct'] WHERE connector_id='${direct}'`); expect(service(count())).toBe('0')
    db(`UPDATE connector_policies SET allowed_hosts=ARRAY['assistant'],tool_access_mode='selected',allowed_tools=ARRAY['CRM_OTHER'] WHERE connector_id='${direct}'`)
    expect(service(count())).toBe('0'); expect(service(count(account.replace('CRM_LIST_DEALS','CRM_OTHER')))).toBe('1')
    db(`UPDATE connector_policies SET allowed_tools='{}' WHERE connector_id='${direct}'`)
    expect(service(count(account.replace("'CRM_LIST_DEALS'",'null')))).toBe('0')
  })

  it('permits a platform transport project without conferring any downstream authority, and never falls back on broken BYOK',()=>{
    db(`DELETE FROM site_secrets; DELETE FROM connector_result_private.provider_attestations;
      UPDATE public.site_connector_providers SET credential_revision='platform:${revision}' WHERE id='${id.provider}'`)
    expect(()=>service(setSql(true,1))).toThrow(/attestation required/)
    expect(()=>issueDirect(db)).toThrow(/binding required/)
    db(issueSql().replace(revision,`platform:${revision}`)); expect(service(count())).toBe('0')
    enableDirect(db); expect(service(count())).toBe('1')
    db(`INSERT INTO site_secrets VALUES ('${id.site}',null,'composio','integrations',false,'invalid')`)
    expect(service(count())).toBe('0')
  })

  it('requires an exact external database binding and refuses the installation resource even for the site owner',()=>{
    const local='b'.repeat(20), namespace='database-issuer'
    db(`INSERT INTO connector_result_private.direct_resources VALUES ('${namespace}','${databaseProject}','${id.site}',ARRAY['applicationsDatabase'])`)
    const make=(bound:string|null)=>issueSql().replace(direct,databaseConnector).replace("'direct-a'","'test-account'").replace("'crm'","'supabase'")
      .replace("'auth-config'","'test-config'").replace('crm-issuer',namespace).replace('customer-tenant-17',databaseProject)
      .replace('external_business_resource','external_database_project').replace('resource_namespace,','local_installation_ref,resource_namespace,')
      .replace(`'${namespace}',`,`${bound===null?'NULL':`'${bound}'`},'${namespace}',`)
    expect(()=>db(make(null))).toThrow();expect(()=>db(make(databaseProject))).toThrow(); db(make(local))
    const enable=setSql(true,2,id.owner).replace(direct,databaseConnector); service(enable)
    db(`UPDATE connector_policies SET tool_access_mode='all' WHERE connector_id='${databaseConnector}'`)
    expect(service(count(account.replace(direct,databaseConnector).replace('CRM_LIST_DEALS','SUPABASE_LIST_WIDGETS')))).toBe('1')
  })

  it('serializes concurrent manager updates with exactly one revision/audit winner',async()=>{
    issueDirect(db)
    const apply=(enable:boolean)=>pg.concurrent(`SET ROLE service_role; ${setSql(enable,2)}`)
    const results=await Promise.allSettled([apply(true),apply(false)])
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    const rejected=results.find(r=>r.status==='rejected'); expect(String(rejected?.status==='rejected' && rejected.reason)).toContain('revision conflict')
    expect(manage()).toMatchObject({direct_revision:3,revision:1});expect(db(audit)).toMatch(/^3\|1\|[^|]+\|[tf]$/)
  })

  it('rechecks actor, license, site-wide screen/location eligibility, current selected agent and both grants',()=>{
    issueDirect(db); enableDirect(db)
    for (const [from,to] of [[id.site,id.otherSite],[id.admin,id.member],[instance,uuid(815)],[id.agent,id.inactiveAgent],[id.agent,id.otherAgent]]) {
      expect(service(count(account.replace(from,to)))).toBe('0')
    }
    db(`UPDATE site_members SET restrict_to_assigned_only=true WHERE user_id='${id.admin}'`); expect(service(count())).toBe('0')
    db(`UPDATE site_members SET restrict_to_assigned_only=false WHERE user_id='${id.admin}'; UPDATE remote_instances SET is_archived=true`); expect(service(count())).toBe('0')
    db(`UPDATE remote_instances SET is_archived=false; INSERT INTO connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by)
      VALUES ('${id.site}','${direct}','${id.admin}',true,false,'${id.owner}')`); expect(service(count())).toBe('0')
    db(`UPDATE connector_members SET can_use=true WHERE connector_id='${direct}'`); expect(service(count())).toBe('1')
    db(`INSERT INTO connector_agents(site_id,connector_id,agent_id,enabled,granted_by) VALUES ('${id.site}','${direct}','${id.agent}',false,'${id.owner}')`)
    expect(service(count())).toBe('0'); db(`UPDATE connector_agents SET enabled=true, expires_at=now()-interval '1s' WHERE connector_id='${direct}'`)
    expect(service(count())).toBe('0'); db(`UPDATE connector_agents SET expires_at=null WHERE connector_id='${direct}'`); expect(service(count())).toBe('1')
    db(`UPDATE site_members SET manually_disabled=true WHERE user_id='${id.admin}'`); expect(service(count())).toBe('0')
  })

  it('expires unattended proofs and checks the actual BYOK secret and operator proof, not just the cached project row',()=>{
    db(issueSql().replace("'1 day'","'1 second'")); enableDirect(db); expect(service(count())).toBe('1')
    db(`SELECT pg_sleep(1.05)`); expect(service(count())).toBe('0'); expect(manage().attested).toBe(false)
    db(revoke); issueDirect(db); enableDirect(db)
    db(`UPDATE site_secrets SET is_active=false`); expect(service(count())).toBe('0')
    db(`UPDATE site_secrets SET is_active=true`); expect(service(count())).toBe('1')
    db(`DELETE FROM connector_result_private.provider_attestations`); expect(service(count())).toBe('0')
    db(`UPDATE site_secrets SET encrypted_value='rotated'`); expect(manage().attested).toBe(false)
    expect(JSON.parse(service(setSql(false,6))).enabled).toBe(false)
  })

  it('does not turn unrelated hidden screens into a veto, but never disregards relevant screens or location restrictions',()=>{
    issueDirect(db); enableDirect(db)
    db(`UPDATE public.remote_instances SET user_id='${id.member}' WHERE id='${instance}';
      UPDATE site_members SET blocked_screens=ARRAY['billing'] WHERE user_id='${id.member}'`)
    const memberCount=count(account.replace(id.admin,id.member));expect(service(memberCount)).toBe('1')
    for (const screen of ['connectors','aiWorkspace','leads','people']) {
      db(`UPDATE site_members SET blocked_screens=ARRAY['${screen}'] WHERE user_id='${id.member}'`); expect(service(memberCount)).toBe('0')
    }
    db(`UPDATE site_members SET blocked_screens='{}' WHERE user_id='${id.member}'; INSERT INTO site_member_location_restrictions
      SELECT site_id,id,'${uuid(912)}' FROM site_members WHERE user_id='${id.member}'`); expect(service(memberCount)).toBe('0')
  })

  it('never exposes proofs/credentials/enrollments to application roles, even with permissive default grants',()=>{
    issueDirect(db); enableDirect(db)
    for (const role of ['anon','authenticated','connector_result_reader','service_role']) {
      const sql=(q:string)=>db(`SET ROLE ${role}; ${q}`)
      for (const table of [proofTable,...['direct_bindings','direct_resources','direct_enrollments','direct_revisions','direct_policy_events'].map(t=>`connector_result_private.${t}`)]) {
        expect(()=>sql(`SELECT * FROM ${table}`)).toThrow(/permission denied/)
        expect(db(`SELECT has_table_privilege('${role}','${table}','DELETE')`)).toBe('f')
        expect(()=>sql(`DELETE FROM ${table}`)).toThrow(/permission denied|cannot delete from view/)
      }
      expect(()=>sql(issueSql())).toThrow(/permission denied/)
      if (role!=='service_role') for (const query of [count(),read,setSql(true,3)]) expect(()=>sql(query)).toThrow(/permission denied/)
    }
  })
})