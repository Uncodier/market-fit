/** @jest-environment node */
import {randomUUID,randomBytes} from 'node:crypto'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {isolatedPostgres,postgresAvailable} from '../security/isolated-postgres'
import {accessSql,codeRoot,id,sqlSource} from './connector-postgres-fixture'
import {instance,revision} from './provider-direct-fixture'
import {createGateway} from './provider-direct-receipt-fixture'
import {completeOrdinaryOauth,installOrdinaryOauth} from './ordinary-oauth-fixture'

const file='20261123152000_connector_customer_delegation.sql',receipts='20261123151000_connector_account_receipts.sql'
const probe=(name:string,repo='market-fit')=>readFileSync(path.join(codeRoot,repo,'supabase/tests',name),'utf8')
test('ships the identical migration and actor probe to each consumer',()=>{
  for(const repo of ['market-fit','API']) {
    expect(sqlSource(file,repo)).toBe(sqlSource(file,'makinari-db-scheme'))
    expect(probe(file,repo)).toBe(probe(file,'makinari-db-scheme'))
  }
})
if(process.env.REQUIRE_REAL_POSTGRES==='1'&&!postgresAvailable)throw Error('Real PostgreSQL required')
;(postgresAvailable?describe:describe.skip)('customer-delegated accounts on disposable PostgreSQL',()=>{
  const pg=isolatedPostgres(),db=pg.db
  const service=(sql:string)=>db(`SET ROLE service_role; ${sql}`)
  const ref='abcdefghijklmnopqrst',kit='new-toolkit',slug='NEW_TOOLKIT_LIST_ORDERS'
  const actor=`'${id.site}','${id.member}','${instance}','${id.agent}'`
  const rpc='public.connector_finalize_customer_account'
  const read=(c:string,tool=slug)=>JSON.parse(service(`SELECT public.connector_direct_accounts_v2(${actor},'${c}','${tool}')`))
  const support=(c:string,tool=slug)=>JSON.parse(service(`SELECT public.connector_support_agent_account_v2('${id.site}','${id.agent}','${c}','${tool}')`))
  const run=(name:string,vars:Record<string,string>)=>JSON.parse(db(Object.entries(vars).map(([k,v])=>`\\set ${k} '${v}'`).join('\n')+'\n'+probe(name)))
  const setup=()=>{installOrdinaryOauth(db);db(sqlSource(receipts));db(`UPDATE remote_instances SET user_id='${id.member}' WHERE id='${instance}'`)}
  function pending(toolkit=kit,project:string|null=null,askOnConnect=true,account=randomUUID().toString()) {
    const attempt=randomUUID(),nonce=randomBytes(32).toString('hex')
    service(`INSERT INTO site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,auth_config_id,nonce_hash,credential_revision,
      status,expires_at,ask_on_connect,supabase_project_ref) VALUES ('${attempt}','${id.site}','${id.provider}','${id.owner}',
      '${toolkit}','cfg','${nonce}','${revision}','pending',now()+interval '5 minutes',${askOnConnect},${project?`'${project}'`:'NULL'});
      UPDATE site_connector_auth_attempts SET provider_account_id='${account}' WHERE id='${attempt}';
      UPDATE site_connector_auth_attempts SET status='completing' WHERE id='${attempt}';`)
    const args=`'${attempt}','${id.owner}','${nonce}','${account}','${toolkit}','cfg','Synthetic',ARRAY[]::text[]`
    return {attempt,query:(scheme:string)=>`SELECT ${rpc}(${args},'${scheme}')->>'id'`,legacy:()=>service(`SELECT public.connector_finalize_auth(${args})->>'id'`)}
  }
  beforeAll(()=>{pg.start();db(createGateway)},30000);afterAll(pg.stop)
  beforeEach(setup,30000)
  it('admits inventory but not execution when all selected actions are locally restricted',()=>{
    db(sqlSource(file)); const migration='20261123153000_connector_catalog_policy_inventory.sql';
    for(const repo of ['market-fit','API'])expect(sqlSource(migration,repo)).toBe(sqlSource(migration,'makinari-db-scheme'));
    db(sqlSource(migration));const c=service(pending().query('OAUTH2'));
    db(`UPDATE connector_policies SET tool_access_mode='selected',allowed_tools=ARRAY['NEW_TOOLKIT_RUN_QUERY'] WHERE connector_id='${c}'`);
    expect(JSON.parse(service(`SELECT public.connector_direct_accounts_v2(${actor},'${c}',NULL)`))).toHaveLength(1);
    expect(read(c,'NEW_TOOLKIT_RUN_QUERY')).toEqual([]);expect(read(c,slug)).toEqual([]);
  })
  it('admits an exact delegated project action for Ask and an explicitly granted agent, respecting selected mode',()=>{
    const migration='20261123154000_connector_delegated_project_actions.sql', tool='SUPABASE_LIST_TABLES';
    for(const repo of ['market-fit','API'])expect(sqlSource(migration,repo)).toBe(sqlSource(migration,'makinari-db-scheme'));
    db(sqlSource(file));db(sqlSource('20261123153000_connector_catalog_policy_inventory.sql'));db(sqlSource(migration));
    const c=service(pending('supabase',ref,false).query('API_KEY'));
    expect(read(c,tool)[0]).toMatchObject({bound_project_ref:ref,connector:{id:c}});expect(support(c,tool)).toEqual([]);
    service(accessSql([],[{agent_id:id.agent,enabled:true}],1,id.owner,c));expect(support(c,tool)).toHaveLength(1);
    db(`UPDATE connector_policies SET tool_access_mode='selected',allowed_tools=ARRAY['SUPABASE_GET_PROJECT'] WHERE connector_id='${c}'`);
    expect(read(c,tool)).toEqual([]);expect(support(c,tool)).toEqual([]);
    db(`UPDATE connector_policies SET allowed_tools=ARRAY['${tool}'] WHERE connector_id='${c}'`);
    expect(read(c,tool)).toHaveLength(1);expect(support(c,tool)).toHaveLength(1);
  })
  it('admits business identifiers for the exact account without authorizing executable code',()=>{
    const next='20261123155000_connector_business_identifiers.sql';
    for(const repo of ['market-fit','API'])expect(sqlSource(next,repo)).toBe(sqlSource(next,'makinari-db-scheme'));
    for(const migration of [file,'20261123153000_connector_catalog_policy_inventory.sql','20261123154000_connector_delegated_project_actions.sql',next])db(sqlSource(migration));
    const c=service(pending().query('OAUTH2')), action='NEW_TOOLKIT_GET_PRODUCT_CODE';
    expect(read(c,action)).toHaveLength(1);expect(support(c,action)).toEqual([]);
    service(accessSql([],[{agent_id:id.agent,enabled:true}],1,id.owner,c));expect(support(c,action)).toHaveLength(1);
    for(const denied of ['NEW_TOOLKIT_EXECUTE_PRODUCT_CODE','NEW_TOOLKIT_GET_PRODUCT_CODE_AND_RUN_CODE','OTHER_GET_PRODUCT_CODE']) {
      expect(read(c,denied)).toEqual([]);expect(support(c,denied)).toEqual([]);
    }
  })
  it('admits a selected business query for each authorized actor without widening the saved selection',()=>{
    const next='20261123160000_connector_structured_query_policy.sql',directory='20261123162000_connector_directory_reads.sql',action='NEW_TOOLKIT_QUERY_ORDERS';
    for(const repo of ['market-fit','API'])expect(sqlSource(next,repo)).toBe(sqlSource(next,'makinari-db-scheme'));
    for(const migration of [file,'20261123153000_connector_catalog_policy_inventory.sql','20261123154000_connector_delegated_project_actions.sql','20261123155000_connector_business_identifiers.sql',next])db(sqlSource(migration));
    for(const repo of ['market-fit','API'])expect(sqlSource(directory,repo)).toBe(sqlSource(directory,'makinari-db-scheme'));
    db(sqlSource(directory));const c=service(pending().query('OAUTH2'));
    expect(read(c,'NEW_TOOLKIT_GET_ADMIN_ROLE')).toHaveLength(1);expect(read(c,'NEW_TOOLKIT_SET_ADMIN_ROLE')).toEqual([]);
    expect(read(c,action)).toHaveLength(1);expect(support(c,action)).toEqual([]);
    service(accessSql([],[{agent_id:id.agent,enabled:true}],1,id.owner,c));
    db(`UPDATE connector_policies SET tool_access_mode='selected',allowed_tools=ARRAY['${action}'] WHERE connector_id='${c}'`);
    expect(read(c,action)).toHaveLength(1);expect(support(c,action)).toHaveLength(1);expect(read(c,slug)).toEqual([]);expect(support(c,slug)).toEqual([]);
  })
  it('does not consume a Support claim for a view-only member despite an explicit agent grant',()=>{
    const next='20261123161000_connector_support_member_use.sql';
    for(const repo of ['market-fit','API'])expect(sqlSource(next,repo)).toBe(sqlSource(next,'makinari-db-scheme'));
    db(sqlSource(file));db(sqlSource(next));const c=service(pending().query('OAUTH2')),turn=randomUUID();
    service(accessSql([{user_id:id.member,can_view:true,can_use:false}],[{agent_id:id.agent,enabled:true}],1,id.owner,c));
    db(`INSERT INTO conversations VALUES ('${turn}','${id.site}','${id.agent}','${id.member}')`);
    const claim=`SELECT connector_claim_support_dispatch('${id.site}','${id.agent}','${id.member}','${turn}','${c}','${slug}',repeat('c',64))`;
    expect(support(c)).toHaveLength(1);expect(service(claim)).toBe('f');
    db(`UPDATE connector_members SET can_use=true WHERE connector_id='${c}' AND user_id='${id.member}'`);
    expect(service(claim)).toBe('t');expect(service(claim)).toBe('f');
  })
  it('does not silently reinterpret old scoped OAuth, old PAT consent, a later bind, or completion replay',()=>{
    const old=completeOrdinaryOauth(db),outside=completeOrdinaryOauth(db,{toolkit:kit}),pat=pending('supabase',ref,false),p=pat.legacy()
    const late=pending('supabase',null,false),l=late.legacy()
    db(sqlSource(file))
    expect(read(old.connectorId,'GMAIL_FETCH_EMAILS')[0]).not.toHaveProperty('auth_scheme')
    expect(read(outside.connectorId)).toEqual([])
    expect(service(pat.query('API_KEY'))).toBe(p);expect(read(p,'SUPABASE_GET_PROJECT')).toEqual([])
    service(`SELECT connector_bind_supabase_project('${id.site}','${l}','${id.owner}',1,'${ref}','${revision}')`)
    expect(read(l,'SUPABASE_GET_PROJECT')).toEqual([])
    expect(db('SELECT count(*) FROM connector_result_private.ordinary_oauth_accounts WHERE auth_scheme IS NOT NULL')).toBe('0')
  })
  it('keeps an existing OAuth receipt readable and denies borrowing its earlier turn for a new authority',()=>{
    const old=completeOrdinaryOauth(db),action=randomUUID(),report={title:'Mail',note:'',columns:['Subject'],rows:[['Fixture']]}
    const details={status:'running',ask_request_sha256:'a'.repeat(64),assistant_recovery:{version:1,respawnCount:0,inFlight:true,
      inFlightKind:'turn',execution:{callerSource:'interactive',executionMode:'direct',catalogUserSession:true}}}
    const receipt=run(receipts,{site:id.site,member:id.member,instance,agent:id.agent,account:old.connectorId,tool:'GMAIL_FETCH_EMAILS',action,
      details:JSON.stringify(details),report:JSON.stringify(report)})
    db(sqlSource(file))
    expect(JSON.parse(db(`SET ROLE authenticated; SET request.jwt.claims='{"role":"authenticated","sub":"${id.member}","is_anonymous":false}';
      SELECT public.read_connector_private_result('${receipt.result}')`))).toEqual(report)
    const a=pending(),c=service(a.query('OAUTH2'))
    expect(read(c)).toHaveLength(1)
    expect(()=>service(`SELECT public.claim_connector_account_dispatch(${actor},'${c}','${action}','${slug}','v1',repeat('a',64),
      '${a.attempt}',1,1,1,'${revision}',repeat('b',64))`)).toThrow(/insufficient_privilege|permission denied/)
  })
  it('uses the exact service-verified completion, member policy and explicit agent; unknown screens fail closed',()=>{
    db(sqlSource(file));const auth=pending(),c=service(auth.query('OAUTH2'))
    const snapshot=run(file,{site:id.site,member:id.member,instance,agent:id.agent,account:c,tool:slug})
    expect(snapshot.instance).toHaveLength(1);expect(snapshot.instance[0]).toMatchObject({authority_kind:'connected_account',
      authorization_id:auth.attempt,auth_scheme:'OAUTH2',bound_project_ref:null,connector:{id:c,toolkit_slug:kit}})
    expect(snapshot.support).toEqual([]);expect(snapshot.instance[0]).not.toHaveProperty('attestation_id')
    service(accessSql([],[{agent_id:id.agent,enabled:true}],1,id.owner,c));expect(support(c)[0].required_screens).toEqual(['*'])
    for(const tool of ['OTHER_LIST_ORDERS','NEW_TOOLKIT_EXECUTE_SQL','NEW_TOOLKIT_RUN_CODE']){
      expect(read(c,tool)).toEqual([]);expect(support(c,tool)).toEqual([])
    }
    db(`UPDATE site_members SET blocked_screens=ARRAY['arbitrary-new-screen'] WHERE user_id='${id.member}'`);expect(read(c)).toEqual([])
    db(`UPDATE site_members SET blocked_screens='{}' WHERE user_id='${id.member}'`);expect(read(c)).toHaveLength(1)
    service(`SELECT connector_set_ask_policy('${id.site}','${id.owner}','${c}',2,1,false)`)
    expect(read(c)).toEqual([]);expect(support(c)).toEqual([]);expect(service(auth.query('OAUTH2'))).toBe(c);expect(read(c)).toEqual([])
    for(const role of ['authenticated','anon','connector_result_reader'])expect(()=>db(`SET ROLE ${role}; ${auth.query('OAUTH2')}`)).toThrow(/permission denied/)
    expect(()=>service('SELECT auth_scheme FROM connector_result_private.ordinary_oauth_accounts')).toThrow(/permission denied/)
  })
  it('admits a private API key submitted on a new hosted link for an unfamiliar toolkit without a resource proof',()=>{
    db(sqlSource(file));const auth=pending(),c=service(auth.query('API_KEY'));
    expect(read(c)[0]).toMatchObject({authorization_id:auth.attempt,auth_scheme:'API_KEY',bound_project_ref:null});
    expect(db(`SELECT count(*) FROM connector_result_private.direct_bindings WHERE connector_id='${c}'`)).toBe('0');
    expect(support(c)).toEqual([]);
    service(accessSql([],[{agent_id:id.agent,enabled:true}],1,id.owner,c));expect(support(c)[0].connector.id).toBe(c);
    expect(read(c,'OTHER_LIST_ORDERS')).toEqual([]);
  })
  it('rejects absent consent or project, wrong actor, instant or unsupported schemes; unbound Supabase stays ineligible',()=>{
    db(sqlSource(file))
    for(const [a,scheme] of [[pending(kit,null,false),'OAUTH2'],[pending(kit,null,false),'API_KEY'],[pending(),'BASIC'],
      [pending(kit,null,true,'instant_account'),'OAUTH2'],[pending('supabase',ref,false),'OAUTH2']] as const){
      expect(()=>service(a.query(scheme))).toThrow(/insufficient_privilege|permission denied/)
      expect(db(`SELECT status FROM site_connector_auth_attempts WHERE id='${a.attempt}'`)).toBe('completing')
    }
    const good=pending();expect(()=>service(good.query('OAUTH2').replace(id.owner,id.foreign))).toThrow(/attempt denied/)
    const c=service(pending('supabase').query('OAUTH2'));expect(read(c,'SUPABASE_GET_PROJECT')).toEqual([])
  })
  it('reuses ordinary private receipts for a project-pinned PAT; provider account revocation is terminal',()=>{
    db(sqlSource(file)); const auth=pending('supabase',ref,false),c=service(auth.query('API_KEY')),tool='SUPABASE_GET_PROJECT'
    expect(read(c,tool)[0]).toMatchObject({auth_scheme:'API_KEY',bound_project_ref:ref,authorization_id:auth.attempt,connector:{supabase_project_ref:ref}})
    for(const denied of ['SUPABASE_LIST_PROJECTS','SUPABASE_UPDATE_PROJECT','SUPABASE_LIST_TABLES','SUPABASE_RUN_SQL'])expect(read(c,denied)).toEqual([])
    const report={title:'Project metadata',note:'',columns:['Status'],rows:[['Active']]}
    const details={status:'running',ask_request_sha256:'a'.repeat(64),assistant_recovery:{version:1,respawnCount:0,inFlight:true,
      inFlightKind:'turn',execution:{callerSource:'interactive',executionMode:'direct',catalogUserSession:true}}}
    const receipt=run(receipts,{site:id.site,member:id.member,instance,agent:id.agent,account:c,tool,action:randomUUID(),
      details:JSON.stringify(details),report:JSON.stringify(report)})
    expect(receipt.authorization).toBe(auth.attempt);expect(receipt.read).toEqual(report)
    expect(db(`SELECT count(*) FROM connector_result_private.direct_bindings WHERE connector_id='${c}'`)).toBe('0')
    db(`UPDATE connectors SET revocation_pending=true WHERE id='${c}';UPDATE connectors SET revocation_pending=false,enabled=true WHERE id='${c}'`)
    expect(read(c,tool)).toEqual([]);expect(service(auth.query('API_KEY'))).toBe(c);expect(read(c,tool)).toEqual([])
    expect(db(`SET ROLE authenticated; SET request.jwt.claims='{"role":"authenticated","sub":"${id.member}","is_anonymous":false}';
      SELECT public.read_connector_private_result('${receipt.result}')`)).toBe('')
  })
  it('a provider credential or downstream grant cannot return from a retired epoch',()=>{
    db(sqlSource(file));const a=service(pending().query('OAUTH2'))
    db(`UPDATE connectors SET granted_scopes=ARRAY['other'] WHERE id='${a}'; UPDATE connectors SET granted_scopes='{}' WHERE id='${a}'`)
    expect(read(a)).toEqual([])
    const b=service(pending().query('OAUTH2'))
    db(`UPDATE site_connector_providers SET status='disabled' WHERE id='${id.provider}'; UPDATE site_connector_providers SET status='active' WHERE id='${id.provider}'`)
    expect(read(b)).toEqual([])
  })
})
