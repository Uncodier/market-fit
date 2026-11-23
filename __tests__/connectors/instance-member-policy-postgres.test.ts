/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { codeRoot, id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { direct, installProviderDirect, instance, issueDirect, proofTable, revision, setSql } from './provider-direct-fixture'
import { createGateway, gateway, installDirectReceipts } from './provider-direct-receipt-fixture'

const file = '20261123110000_connector_instance_member_policy.sql', canonical = 'makinari-db-scheme'
const probe = (repo:string) => readFileSync(path.join(codeRoot,repo,'supabase/tests',file),'utf8')
if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Real PostgreSQL required')
;(postgresAvailable ? describe : describe.skip)('private Instance member policy on disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db, schema='connector_result_private', action=uuid(1200), hash='a'.repeat(64)
  const details={status:'running',ask_request_sha256:hash,assistant_recovery:{version:1,respawnCount:0,inFlight:true,
    inFlightKind:'turn',execution:{callerSource:'interactive',executionMode:'direct',catalogUserSession:true}}}
  const vars={site:id.site,account:direct,member:id.member,instance,agent:id.agent,action,details:JSON.stringify(details)}
  const runProbe=(repo=canonical) => JSON.parse(db(Object.entries(vars).map(([k,v])=>`\\set ${k} '${v}'`).join('\n')+'\n'+probe(repo)))
  const service=(s:string)=>db(`\\set VERBOSITY verbose\n${gateway} ${s}`)
  const read=(key:string,user=id.member)=>db(`SET ROLE authenticated; SET request.jwt.claims='${JSON.stringify({sub:user,role:'authenticated',is_anonymous:false})}'; SELECT public.read_connector_private_result('${key}')`)
  const actor=`'${id.site}','${id.member}','${instance}','${id.agent}'`, manager=`'${id.site}','${id.admin}','${direct}'`
  const status=()=>JSON.parse(service(`SELECT public.connector_instance_policy_status(${manager})`))
  const veto=(ctx=actor,target=direct)=>service(`SELECT public.connector_instance_explicitly_disabled(${ctx},'${target}')`)
  const count=(slug='CRM_LIST_DEALS',ctx=actor)=>service(`SELECT jsonb_array_length(public.connector_direct_accounts(${ctx},'${direct}','${slug}'))`)
  const turn=(key=action)=>service(`INSERT INTO instance_logs(id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details)
    VALUES ('${key}','${instance}','${id.site}','${id.member}','${id.agent}','user_action',true,${jsonSql(details)})`)
  const bound=(proof:string,cr=1,dr=2,key=action)=>`${actor},'${direct}','${key}','CRM_LIST_DEALS','v1','${hash}','${proof}',${cr},${cr},${dr},'${revision}'`
  const claim=(binding:string)=>service(`SELECT public.claim_connector_direct_dispatch(${binding},'${hash}')`)
  const policy=(mode:string,tools:string,host='assistant',cr=1)=>`SELECT public.connector_update_policy('${id.site}','${direct}','${id.admin}',${cr},
    ${tools},ARRAY['${host}'],false,true,'${mode}',NULL)`
  const install=(mode:'explicit'|'workspace'='workspace')=>{
    installProviderDirect(db,undefined,mode); installDirectReceipts(db)
    for (const m of ['20261123030000_connector_ask_on_connect.sql','20261123040000_connector_instance_member_authority.sql',
      '20261123041000_connector_instance_scoped_reads.sql','20261123080000_connector_instance_report_sources.sql',
      '20261123090000_retire_instance_scoped_report.sql','20261123100000_connector_policy_save_with_ask.sql']) db(sqlSource(m))
    db(`UPDATE remote_instances SET user_id='${id.member}' WHERE id='${instance}'`)
  }
  beforeAll(()=>{pg.start();db(createGateway)},30000); afterAll(pg.stop)

  it.each([canonical,'API','market-fit'])('%s: proof + saved policy admits exact claim and private receipt without enrollment', repo=>{
    expect(sqlSource(file,repo)).toBe(sqlSource(file,canonical)); expect(probe(repo)).toBe(probe(canonical))
    install(); const proof=issueDirect(db); expect(count()).toBe('0'); db(sqlSource(file,repo))
    expect(status()).toMatchObject({attested:true,enabled:true,explicitly_disabled:false,authorization_mode:'member_policy'})
    const {result}=runProbe(repo); expect(JSON.parse(read(result)).rows).toEqual([['1']]); expect(read(result,id.admin)).toBe('')
    expect(db(`SELECT count(*) FROM ${schema}.direct_enrollments; SELECT count(*) FROM ${schema}.direct_policy_events`)).toBe('0\n0')
    for (const binding of [bound(uuid(101)),bound(proof,2),bound(proof,1,3),bound(proof).replace(revision,'b'.repeat(64)),
      bound(proof).replace(id.agent,id.inactiveAgent),bound(proof).replace(direct,id.hidden)]) expect(()=>claim(binding)).toThrow(/42501/)
    const old=bound(proof); claim(old); expect(()=>claim(old)).toThrow(/P0D03/)
    db(`UPDATE ${proofTable} SET revoked_at=now()`); expect(count()).toBe('0'); expect(read(result)).toBe('')
    const fresh=issueDirect(db); expect(count()).toBe('1'); expect(read(result)).toBe(''); expect(()=>claim(bound(fresh,1,4))).toThrow(/42501/)
    const next=uuid(1201); turn(next); expect(claim(bound(fresh,1,4,next))).toMatch(/^[a-f0-9-]{36}$/)
  },30000)

  it('retains disable-before-proof across the cutover, ordinary saves and renewal until explicit restore',()=>{
    install(); service(setSql(false,1)); db(sqlSource(file)); expect(status()).toMatchObject({explicitly_disabled:true,enabled:false,attested:false})
    issueDirect(db); service(policy('all','ARRAY[]::text[]')); expect(count()).toBe('0'); expect(veto()).toBe('t')
    db(`UPDATE ${proofTable} SET revoked_at=now()`); issueDirect(db)
    expect(status()).toMatchObject({attested:true,enabled:false,explicitly_disabled:true,direct_revision:5})
    service(setSql(true,5,id.admin,2)); expect(veto()).toBe('f'); expect(count()).toBe('1')
    service(setSql(false,6,id.admin,2)); expect(count()).toBe('0'); expect(veto()).toBe('t')
  },30000)

  it('keeps pre-cutover receipts under their original enrollment requirement; admits only current private members and exact tools',()=>{
    install('explicit'); const proof=issueDirect(db); service(setSql(true,2)); db(`INSERT INTO connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by)
      VALUES ('${id.site}','${direct}','${id.member}',true,true,'${id.owner}')`)
    const {result}=runProbe(); db(sqlSource(file)); expect(JSON.parse(read(result)).rows).toEqual([['1']])
    // Simulate losing the historical row even without an audit/revision advance.
    db(`DELETE FROM ${schema}.direct_enrollments`); expect(read(result)).toBe(''); expect(count()).toBe('1')
    expect(()=>claim(bound(proof,1,3))).toThrow(/42501/)
    service(policy('selected',"ARRAY['CRM_LIST_DEALS']")); expect(count('CRM_OTHER')).toBe('0'); expect(count()).toBe('1')
    const next=uuid(1201); turn(next); expect(()=>claim(bound(proof,2,3,next).replace('CRM_LIST_DEALS','CRM_OTHER'))).toThrow(/42501/)
    claim(bound(proof,2,3,next)); db(`UPDATE connector_members SET can_use=false WHERE connector_id='${direct}'`)
    expect(count()).toBe('0'); expect(veto()).toBe('t'); db(`UPDATE connector_members SET can_use=true WHERE connector_id='${direct}'`)
    expect(veto(actor.replace(instance,uuid(1202)))).toBe('t'); expect(veto(actor,id.hidden)).toBe('t'); expect(veto(actor,id.foreignConnector)).toBe('t')
    expect(veto(actor.replace(id.agent,id.inactiveAgent))).toBe('t'); expect(count('CRM_LIST_DEALS',actor.replace(id.member,id.foreign))).toBe('0')
    service(policy('selected','ARRAY[]::text[]','assistant',2)); expect(count()).toBe('0'); expect(veto()).toBe('t')
    service(policy('all','ARRAY[]::text[]','direct',3)); expect(count()).toBe('0'); expect(veto()).toBe('t')
  },30000)

  it('cannot manufacture a claim from a catalog grant, a different proof or another site; no public/service bypass',()=>{
    install(); db(sqlSource(file)); expect(count()).toBe('0'); expect(veto()).toBe('f'); expect(status().enabled).toBe(false)
    turn(); expect(()=>claim(bound(uuid(1250)))).toThrow(/42501/)
    expect(()=>service(`SELECT public.connector_instance_policy_status('${id.site}','${id.member}','${direct}')`)).toThrow(/42501/)
    for (const role of ['authenticated','anon']) for (const rpc of [`connector_instance_policy_status(${manager})`,
      `connector_instance_explicitly_disabled(${actor},'${direct}')`]) expect(()=>db(`SET ROLE ${role}; SELECT public.${rpc}`)).toThrow(/permission denied/)
    expect(()=>service(`SELECT ${schema}.direct_disabled('${direct}')`)).toThrow(/42501/)
    expect(service(`SELECT has_function_privilege('service_role','public.connector_instance_scoped_read(uuid,uuid,uuid,uuid,uuid)','EXECUTE')`)).toBe('f')
  },30000)

  it('does not retroactively authorize a turn admitted during an ordinary policy change',async()=>{
    install(); db(sqlSource(file)); const proof=issueDirect(db)
    service(policy('all','ARRAY[]::text[]','direct')); expect(count()).toBe('0')
    const held=pg.concurrent(`${gateway} BEGIN; ${policy('all','ARRAY[]::text[]','assistant',2)};
      SELECT pg_advisory_xact_lock(1219); SELECT pg_sleep(1.5); COMMIT`)
    try {
      let ready=false
      for (let i=0;i<50&&!ready;i++) {
        ready=db('SELECT NOT pg_try_advisory_lock(1219)')==='t'
        if (!ready) await new Promise(resolve=>setTimeout(resolve,10))
      }
      expect(ready).toBe(true); turn()
    } finally { await held }
    expect(count()).toBe('1'); expect(()=>claim(bound(proof,3,2))).toThrow(/42501/)
    const next=uuid(1219); turn(next); claim(bound(proof,3,2,next))
  },30000)

  it('rechecks the downstream credential and relevant business screens after reservation, including receipt replay',()=>{
    install(); db(sqlSource(file)); const proof=issueDirect(db), binding=bound(proof)
    const {result,reservation}=runProbe(); const pending=claim(binding)
    const store=(key:string)=>service(`SELECT public.store_connector_direct_result(${binding},'${key}',
      '{"title":"Fixture","note":"","columns":["N"],"rows":[["1"]]}')`)
    db(`UPDATE site_members SET blocked_screens=ARRAY['leads'] WHERE user_id='${id.member}'`)
    expect(count()).toBe('0'); expect(read(result)).toBe(''); expect(()=>store(pending)).toThrow(/42501/)
    db(`UPDATE site_members SET blocked_screens='{}' WHERE user_id='${id.member}'; UPDATE site_secrets SET is_active=false`)
    expect(count()).toBe('0'); expect(read(result)).toBe(''); expect(()=>store(reservation)).toThrow(/42501/)
    db(`UPDATE site_secrets SET is_active=true`); expect(store(reservation)).toBe(result)
    service(setSql(false,2)); expect(read(result)).toBe(''); expect(()=>store(pending)).toThrow(/42501/)
    service(setSql(true,3)); expect(read(result)).toBe(''); expect(()=>store(pending)).toThrow(/42501/)
  },30000)
})