/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { accessSql, codeRoot, id, sqlSource } from './connector-postgres-fixture'
import { direct, instance, issueSql } from './provider-direct-fixture'
import { completeOrdinaryOauth, installOrdinaryOauth, ordinaryFile } from './ordinary-oauth-fixture'

const probe=(repo:string)=>readFileSync(path.join(codeRoot,repo,'supabase/tests',ordinaryFile),'utf8')
test('ordinary OAuth rollout and PostgreSQL probe match the canonical source',()=>{
  for(const repo of ['market-fit','API']) {
    expect(sqlSource(ordinaryFile,repo)).toBe(sqlSource(ordinaryFile,'makinari-db-scheme'))
    expect(probe(repo)).toBe(probe('makinari-db-scheme'))
  }
})
if(process.env.REQUIRE_REAL_POSTGRES==='1' && !postgresAvailable) throw Error('Real Postgres required')
;(postgresAvailable?describe:describe.skip)('verified customer account authority on disposable PostgreSQL',()=>{
  const pg=isolatedPostgres(),db=pg.db,service=(sql:string)=>db(`SET ROLE service_role; ${sql}`)
  const admit=(c:string,tool="'GMAIL_FETCH_EMAILS'")=>`SELECT public.connector_direct_accounts_v2('${id.site}','${id.admin}','${instance}','${id.agent}','${c}',${tool})`
  const agent=(c:string,tool="'GMAIL_FETCH_EMAILS'")=>`SELECT public.connector_support_agent_account_v2('${id.site}','${id.agent}','${c}',${tool})`
  const grant=(c:string)=>service(accessSql([],[{agent_id:id.agent,enabled:true}],1,id.owner,c))
  beforeAll(pg.start,30000);afterAll(pg.stop);beforeEach(()=>installOrdinaryOauth(db),30000)

  it('binds a real authorization per account; member-only Instance, explicit Support agent and same-site reviews',()=>{
    const one=completeOrdinaryOauth(db),two=completeOrdinaryOauth(db),c=one.connectorId
    const look=()=>JSON.parse(db(Object.entries({site:id.site,member:id.admin,manager:id.owner,instance,agent:id.agent,account:c})
      .map(([k,v])=>`\\set ${k} '${v}'`).join('\n')+'\n'+probe('market-fit')))
    const snapshot=look();expect(snapshot.instance).toHaveLength(1);expect(snapshot.support).toEqual([])
    expect(snapshot.manager).toMatchObject({authority_kind:'connected_account',enabled:true,setup_pending:false,attested:false})
    expect(snapshot.instance[0]).toMatchObject({authority_kind:'connected_account',authorization_id:one.authorizationId,connector:{id:c}})
    expect(Object.keys(snapshot.instance[0]).sort()).toEqual(['authority_kind','authorization_id','connector','direct_revision','policy','provider'].sort())
    expect(JSON.parse(service(admit(two.connectorId)))[0].authorization_id).toBe(two.authorizationId)
    expect(service(admit(c).replace('_v2(','('))).toBe('[]');expect(service(agent(c))).toBe('[]')
    const candidates=`SELECT * FROM connector_agent_review_candidates('${id.site}','${id.agent}','GMAIL_FETCH_EMAILS')`
    grant(c);expect(look().support[0]).toMatchObject({authorization_id:one.authorizationId,required_screens:['chat']});expect(service(candidates)).toBe('')
    for (const slug of ['GMAIL_ADMIN_SETTINGS','GMAIL_EXECUTE_SQL','GMAIL_RAW_API','COMPOSIO_LIST','GMAIL_']) {
      expect(service(agent(c,`'${slug}'`))).toBe('[]');expect(service(admit(c,`'${slug}'`))).toBe('[]')
    }
    grant(two.connectorId);db('UPDATE connector_policies SET require_approval=true');expect(service(candidates).split('\n').sort()).toEqual([c,two.connectorId].sort())
    expect(service(agent(c).replace(id.agent,id.otherAgent))).toBe('[]');expect(service(admit(c).replace(id.site,id.otherSite))).toBe('[]')
    const conversation=uuid(1501);db(`INSERT INTO conversations VALUES ('${conversation}','${id.site}','${id.agent}','${id.admin}')`)
    const claim=`SELECT connector_claim_support_dispatch('${id.site}','${id.agent}','${id.admin}','${conversation}','${c}','GMAIL_FETCH_EMAILS',repeat('b',64))`
    expect(service(claim)).toBe('t');expect(service(claim)).toBe('f')
    db(`UPDATE site_members SET blocked_screens=ARRAY['chat'] WHERE user_id='${id.admin}'`);expect(service(admit(c))).toBe('[]')
    db('UPDATE connector_agents SET expires_at=now()');expect(service(agent(c))).toBe('[]');expect(service(candidates)).toBe('')
  })

  it('never falls back to ordinary authority when a stronger resource proof expires or is removed',()=>{
    const {connectorId:c}=completeOrdinaryOauth(db),account=db(`SELECT provider_account_id FROM connectors WHERE id='${c}'`)
    const proof=db(issueSql().replace(direct,c).replace('direct-a',account).replace("'crm'","'gmail'"))
    expect(JSON.parse(service(admit(c)))[0].attestation_id).toBe(proof)
    db(`DELETE FROM connector_result_private.direct_attestations WHERE id='${proof}'`)
    expect(service(admit(c))).toBe('[]')
  })

  it('rejects unsupported or broader grants, hidden provenance, foreign schemes and legacy replay',()=>{
    const scope='https://www.googleapis.com/auth/gmail.send'
    for(const opts of [{notice:false},{legacy:true},{scopes:[scope,'admin']},{scopes:[]},{toolkit:'supabase'},
      {toolkit:'custom_business_api'},{toolkit:'hubspot',scopes:['oauth']},{toolkit:'gmail',scopes:['https://mail.google.com/']}]) {
      const {connectorId,args}=completeOrdinaryOauth(db,opts)
      service(`SELECT public.connector_finalize_private_oauth${args}`);expect(service(admit(connectorId,'NULL'))).toBe('[]')
    }
    for(const [toolkit,scopes] of [['googlecalendar',['https://www.googleapis.com/auth/calendar.events.readonly']],
      ['hubspot',['oauth','crm.objects.deals.write']],['gmail',[scope]]] as const){
      const {connectorId:c}=completeOrdinaryOauth(db,{toolkit,scopes:[...scopes]});expect(JSON.parse(service(admit(c,'NULL')))).toHaveLength(1)
      const change=(sql:string)=>db(`BEGIN; ${sql}; SET ROLE service_role; ${admit(c,'NULL')}; ROLLBACK`)
      for(const sql of [`UPDATE connectors SET granted_scopes=ARRAY['${scope}','x'] WHERE id='${c}'`,
        `UPDATE connectors SET enabled=false WHERE id='${c}'`,"DELETE FROM connector_result_private.provider_attestations",
        "UPDATE site_secrets SET is_active=false", `UPDATE connector_policies SET allowed_hosts=ARRAY['direct'] WHERE connector_id='${c}'`]) expect(change(sql)).toBe('[]')
    }
    for(const role of ['authenticated','anon','connector_result_reader']) for(const sql of [admit(id.connector),agent(id.connector),
      'SELECT * FROM connector_result_private.ordinary_accounts',"SELECT public.connector_finalize_private_oauth(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)"]) {
      expect(()=>db(`SET ROLE ${role}; ${sql}`)).toThrow(/permission denied/)
    }
    expect(()=>service('DELETE FROM connector_result_private.ordinary_oauth_accounts')).toThrow(/permission denied/)
  })

  it('serializes standalone and combined opt-outs and restores; they never create resource enrollments',()=>{
    const {connectorId:c}=completeOrdinaryOauth(db), manager=`'${id.site}','${id.owner}','${c}'`
    const set=(r:number,on:boolean)=>JSON.parse(service(`SELECT connector_set_ask_policy(${manager},1,${r},${on})`))
    expect(set(1,false)).toMatchObject({authority_kind:'connected_account',enabled:false,attested:false});expect(service(admit(c))).toBe('[]')
    expect(()=>set(1,true)).toThrow(/authorization changed/);expect(set(2,true).enabled).toBe(true)
    const save=(rev:number,epoch:number,on:boolean)=>service(`SELECT connector_save_policy_with_ask('${id.site}','${c}','${id.owner}',${rev},
      ARRAY['GMAIL_FETCH_EMAILS'],ARRAY['${on?'assistant':'direct'}'],true,true,'selected',NULL,NULL,${on},${epoch})`)
    expect(JSON.parse(save(1,3,false)).ask_enabled).toBe(false);expect(service(admit(c))).toBe('[]')
    expect(JSON.parse(save(2,4,true)).ask_enabled).toBe(true);expect(JSON.parse(service(admit(c)))).toHaveLength(1)
    expect(service(admit(c,"'GMAIL_OTHER'"))).toBe('[]');expect(db('SELECT count(*) FROM connector_result_private.direct_enrollments')).toBe('0')
  })
})
