/** @jest-environment node */
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {isolatedPostgres, postgresAvailable, uuid} from '../security/isolated-postgres'
import {codeRoot, id, sqlSource} from './connector-postgres-fixture'
import {direct, installProviderDirect, issueDirect, proofTable, revision} from './provider-direct-fixture'
import {connector as databaseConnector} from './connector-analytics-fixture'

const file='20261123130000_connector_support_direct_accounts.sql'
const repos=['makinari-db-scheme','market-fit','API']
const probe=(repo:string)=>readFileSync(path.join(codeRoot,repo,'supabase/tests',file),'utf8')
const turn=uuid(1310), context=`'${id.site}','${id.agent}'`, target=`'${direct}','CRM_LIST_DEALS'`
const admit=`SELECT public.connector_support_agent_account(${context},${target})`
const claim=`SELECT public.connector_claim_support_dispatch(${context},'${id.member}','${turn}',${target},repeat('a',64))`
const grant=`INSERT INTO public.connector_agents(site_id,connector_id,agent_id,enabled,granted_by)
  VALUES ('${id.site}','${direct}','${id.agent}',true,'${id.owner}')`
const setGrant=(s:string)=>`UPDATE public.connector_agents SET ${s} WHERE connector_id='${direct}'`
const setPolicy=(s:string)=>`UPDATE public.connector_policies SET ${s} WHERE connector_id='${direct}'`

if(process.env.REQUIRE_REAL_POSTGRES==='1'&&!postgresAvailable)throw Error('Real PostgreSQL required')
;(postgresAvailable?describe:describe.skip)('Support agent account and durable dispatch on socket-only PostgreSQL',()=>{
  const pg=isolatedPostgres(), db=pg.db, service=(sql:string)=>db(`SET ROLE service_role; ${sql}`)
  const list=(sql=admit)=>JSON.parse(service(sql))
  function install(repo=repos[0],mode:'workspace'|'explicit'='explicit'){
    installProviderDirect(db,undefined,mode)
    db(`ALTER TABLE public.agents ADD COLUMN role text;
      UPDATE public.agents SET role='Customer Support';
      CREATE TABLE public.conversations(id uuid PRIMARY KEY,site_id uuid,agent_id uuid,user_id uuid);
      INSERT INTO public.conversations VALUES ('${turn}','${id.site}','${id.agent}','${id.member}')`)
    db(sqlSource(file,repo))
  }
  beforeAll(pg.start,30000); afterAll(pg.stop)

  it.each(repos)('runs the exact mirrored migration/probe in %s; returns current proof epoch and resource screens',repo=>{
    expect(sqlSource(file,repo)).toBe(sqlSource(file,repos[0])); expect(probe(repo)).toBe(probe(repos[0]))
    install(repo); db(grant); expect(list()).toEqual([]); const proof=issueDirect(db)
    const run=()=>JSON.parse(db(`\\set site '${id.site}'\n\\set agent '${id.agent}'\n\\set account '${direct}'\n${probe(repo)}`))
    expect(run()).toMatchObject({same:true,account:{connector:{id:direct,revision:1},provider:{credential_revision:revision},
      policy:{tool_access_mode:'all',allowed_hosts:['assistant'],revision:1},attestation_id:proof,direct_revision:2,
      resource_boundary:'customer-tenant-17',required_screens:['people','leads'],local_installation_ref:null}})
    db(`UPDATE ${proofTable} SET revoked_at=now()`); expect(list()).toEqual([])
    const next=issueDirect(db); expect(run().account).toMatchObject({attestation_id:next,direct_revision:4})
    expect(db(`SELECT count(*) FROM public.connector_members WHERE connector_id='${direct}';
      SELECT count(*) FROM connector_result_private.direct_enrollments`)).toBe('0\n0')
  },30000)

  it('denies wrong site, account, slug, non-Support/inactive agent, unverified and stale credentials',()=>{
    install(); issueDirect(db); expect(list()).toEqual([]); db(grant); expect(list()).toHaveLength(1)
    for(const sql of [admit.replace(id.agent,id.otherAgent),admit.replace(id.agent,id.inactiveAgent),admit.replace(id.site,id.otherSite),
      admit.replace(direct,id.foreignConnector),admit.replace(target,'NULL,NULL'),admit.replace(direct,databaseConnector).replace('CRM_LIST_DEALS','SUPABASE_RUN_READ_ONLY_QUERY'),
      ...['CRM_foo','OTHER_LIST','COMPOSIO_RAW','CRM-LIST'].map(slug=>admit.replace('CRM_LIST_DEALS',slug))])expect(list(sql)).toEqual([])
    for(const change of ["UPDATE public.agents SET role='Sales'","UPDATE public.sites SET archived_at=now()",
      "UPDATE public.site_secrets SET encrypted_value='rotated'","UPDATE public.site_secrets SET is_active=false",
      `UPDATE public.connectors SET enabled=false WHERE id='${direct}'`]){
      expect(db(`BEGIN; ${change}; SET ROLE service_role; ${admit}; ROLLBACK`)).toBe('[]')
    }
  },30000)

  it('applies workspace sharing but never overrides an explicit agent veto or tool/host restriction',()=>{
    install(repos[0],'workspace'); issueDirect(db); expect(list()).toHaveLength(1); db(grant)
    for(const change of ['enabled=false','revoked_at=now()',"expires_at=now()-interval '1 second'"]){
      expect(db(`BEGIN; ${setGrant(change)}; SET ROLE service_role; ${admit}; ROLLBACK`)).toBe('[]')
    }
    db(setPolicy("tool_access_mode='selected',allowed_tools=ARRAY['CRM_LIST_DEALS']")); expect(list()).toHaveLength(1)
    expect(list(admit.replace('CRM_LIST_DEALS','CRM_WRITE'))).toEqual([])
    db(setPolicy("allowed_hosts=ARRAY['direct']")); expect(list()).toEqual([])
    db(setPolicy("allowed_hosts=ARRAY['assistant'],allowed_tools=ARRAY['OTHER_LIST']")); expect(list(admit.replace("'CRM_LIST_DEALS'",'NULL'))).toEqual([])
  },30000)

  it('claims exactly once even concurrently; binds conversation, agent, user, account, slug and current authority',async()=>{
    install(); issueDirect(db); db(grant)
    for(const sql of [claim.replace(turn,uuid(1311)),claim.replace(id.member,id.foreign),claim.replace(id.agent,id.otherAgent),
      claim.replace(direct,id.foreignConnector),claim.replace('CRM_LIST_DEALS','OTHER_LIST'),claim.replace("repeat('a',64)","'invalid'"),
      claim.replace("'CRM_LIST_DEALS'",'NULL')])expect(service(sql)).toBe('f')
    const results=await Promise.all([1,2,3].map(()=>pg.concurrent(`SET ROLE service_role; ${claim}`)))
    expect(results.sort()).toEqual(['f','f','t']); expect(service(claim)).toBe('f')
    db(setGrant('enabled=false')); expect(service(claim.replace("repeat('a'","repeat('b'"))).toBe('f')
    expect(db('SELECT count(*) FROM connector_result_private.support_dispatch_claims')).toBe('1')
    for(const role of ['anon','authenticated','connector_result_reader']){
      for(const sql of [admit,claim])expect(()=>db(`SET ROLE ${role}; ${sql}`)).toThrow(/permission denied/)
    }
    expect(()=>service('DELETE FROM connector_result_private.support_dispatch_claims')).toThrow(/permission denied/)
  },30000)
})