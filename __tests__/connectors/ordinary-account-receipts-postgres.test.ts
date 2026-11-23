/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { codeRoot, id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { direct, instance, issueDirect } from './provider-direct-fixture'
import { createGateway, gateway } from './provider-direct-receipt-fixture'
import { completeOrdinaryOauth, installOrdinaryOauth } from './ordinary-oauth-fixture'

const file = '20261123151000_connector_account_receipts.sql', canonical = 'makinari-db-scheme'
const probe = (repo:string, name=file) => readFileSync(path.join(codeRoot,repo,'supabase/tests',name),'utf8')
test('all three repositories ship the same migration and receipt probe', () => {
  for (const repo of ['API','market-fit']) {
    expect(sqlSource(file,repo)).toBe(sqlSource(file,canonical)); expect(probe(repo)).toBe(probe(canonical))
  }
})

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Real PostgreSQL required')
;(postgresAvailable ? describe : describe.skip)('ordinary OAuth receipts on disposable PostgreSQL', () => {
  const pg=isolatedPostgres(), db=pg.db, action=uuid(1510), tool='GMAIL_FETCH_EMAILS', hash='a'.repeat(64)
  const doc={title:'Private mail',note:'',columns:['Subject'],rows:[['Daily summary']]}
  const details={status:'running',ask_request_sha256:hash,assistant_recovery:{version:1,respawnCount:0,inFlight:true,
    inFlightKind:'turn',execution:{callerSource:'interactive',executionMode:'direct',catalogUserSession:true}}}
  const service=(sql:string)=>db(`\\set VERBOSITY verbose\n${gateway} ${sql}`)
  const user=(sql:string,actor=id.member)=>db(`SET ROLE authenticated; SET request.jwt.claims='${JSON.stringify({sub:actor,role:'authenticated',is_anonymous:false})}'; ${sql}`)
  const actor=`'${id.site}','${id.member}','${instance}','${id.agent}'`
  const turn=(key:string)=>service(`INSERT INTO instance_logs(id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details)
    VALUES ('${key}','${instance}','${id.site}','${id.member}','${id.agent}','user_action',true,${jsonSql(details)})`)
  const run=(target:string,key=action,name=file)=>{
    const vars={site:id.site,member:id.member,instance,agent:id.agent,account:target,action:key,tool,details:JSON.stringify(details),report:JSON.stringify(doc)}
    return JSON.parse(db(Object.entries(vars).map(([k,v])=>`\\set ${k} '${v}'`).join('\n')+'\n'+probe(canonical,name)))
  }
  const read=(key:string,owner=id.member)=>user(`SELECT public.read_connector_private_result('${key}')`,owner)
  const list=()=>user('SELECT id FROM public.list_connector_private_results()')
  const claim=(args:string,digest='b'.repeat(64))=>`SELECT public.claim_connector_account_dispatch(${args},'${digest}')`
  const store=(args:string,r:string,d=doc)=>`SELECT public.store_connector_account_result(${args},'${r}',${jsonSql(d)})`
  const install=()=>{
    installOrdinaryOauth(db)
    db(`UPDATE remote_instances SET user_id='${id.member}' WHERE id='${instance}'`)
  }
  const setup=()=>{
    install(); const {connectorId,authorizationId}=completeOrdinaryOauth(db)
    db(sqlSource(file)); const result=run(connectorId)
    expect(result.read).toEqual(doc); expect(result.authorization).toBe(authorizationId)
    expect(db(`SELECT count(*) FROM connector_result_private.direct_bindings WHERE connector_id='${connectorId}'`)).toBe('0')
    const args=`${actor},'${connectorId}','${action}','${tool}','v1','${hash}','${authorizationId}',${result.cr},${result.pr},${result.dr},'${result.credential}'`
    return {args,connectorId,authorizationId,connectorRevision:Number(result.cr),directRevision:Number(result.dr),
      reservation:result.reservation as string,receipt:result.result as string}
  }
  beforeAll(()=>{pg.start();db(createGateway)},30000); afterAll(pg.stop)

  it('retains one private receipt; binds the exact attempt, owner, descriptor, and tool across replays',()=>{
    const {args,authorizationId,connectorId,reservation,receipt}=setup()
    expect(db(`SELECT authorization_id FROM connector_result_private.direct_claims WHERE id='${reservation}' AND attestation_id IS NULL`)).toBe(authorizationId)
    expect(list()).toContain(receipt); expect(read(receipt,id.admin)).toBe('')
    expect(service(store(args,reservation))).toBe(receipt); expect(()=>service(claim(args))).toThrow(/P0D03/)
    expect(()=>service(store(args,reservation,{...doc,rows:[['Different']]}))).toThrow(/P0D04/)
    for(const wrong of [args.replace(id.member,id.admin),args.replace(authorizationId,uuid(1599)),args.replace('v1','v2'),
      args.replace(connectorId,direct),args.replace(tool,'SUPABASE_RUN_READ_ONLY_QUERY')]){
      expect(()=>service(store(wrong,reservation))).toThrow(/P0D04/)
    }
    expect(()=>service(claim(args.replace(authorizationId,uuid(1599))))).toThrow(/42501/)
    expect(()=>service(claim(args.replace(tool,'SUPABASE_RUN_READ_ONLY_QUERY')))).toThrow(/42501/)
    expect(()=>service(claim(args).replace('claim_connector_account_dispatch','claim_connector_direct_dispatch'))).toThrow(/42501/)
    for(const role of ['anon','authenticated','connector_result_reader']){
      expect(()=>db(`SET ROLE ${role}; ${claim(args)}`)).toThrow(/permission denied/)
      expect(()=>db(`SET ROLE ${role}; ${store(args,reservation)}`)).toThrow(/permission denied/)
    }
    expect(()=>service('SELECT * FROM connector_result_private.direct_claims')).toThrow(/42501/)
  },30000)

  it('rechecks parent RLS, screens, credentials and revocation at store/replay/read',()=>{
    const {args,reservation,receipt,connectorId,connectorRevision,directRevision}=setup(), pending=service(claim(args,hash))
    for(const [deny,restore] of [
      ['UPDATE remote_instances SET visible=false','UPDATE remote_instances SET visible=true'],
      [`UPDATE site_members SET blocked_screens=ARRAY['chat'] WHERE user_id='${id.member}'`,`UPDATE site_members SET blocked_screens='{}' WHERE user_id='${id.member}'`],
      ['UPDATE site_secrets SET is_active=false','UPDATE site_secrets SET is_active=true'],
    ]) {
      db(deny); expect(list()).not.toContain(receipt); expect(read(receipt)).toBe('')
      for(const key of [pending,reservation]) expect(()=>service(store(args,key))).toThrow(/42501/)
      db(restore); expect(read(receipt)).not.toBe('')
    }
    const change=(enabled:boolean,epoch:number)=>service(`SELECT public.connector_set_ask_policy('${id.site}','${id.owner}',
      '${connectorId}',${connectorRevision},${epoch},${enabled})`)
    change(false,directRevision)
    expect(read(receipt)).toBe(''); expect(()=>service(store(args,pending))).toThrow(/42501/)
    change(true,directRevision+1)
    expect(read(receipt)).toBe(''); expect(()=>service(store(args,reservation))).toThrow(/42501/)
  },30000)

  it('requires a fresh turn after changed authority, supersession or cancellation; earlier valid receipts survive a new turn',()=>{
    const {args,reservation,receipt,connectorId,authorizationId,connectorRevision}=setup(), next=uuid(1511)
    turn(next); expect(read(receipt)).not.toBe(''); expect(()=>service(store(args,reservation))).toThrow(/42501/)
    db(`UPDATE connectors SET revision=revision+1 WHERE id='${connectorId}'`)
    const updated=args.replace(action,next).replace(`'${authorizationId}',${connectorRevision},`,`'${authorizationId}',${connectorRevision+1},`)
    expect(()=>service(claim(updated))).toThrow(/42501/)
    const fresh=uuid(1512); turn(fresh); const rebound=updated.replace(next,fresh); const key=service(claim(rebound))
    db(`UPDATE instance_logs SET details=jsonb_set(details,'{status}','"stopped"') WHERE id='${fresh}'`)
    expect(()=>service(store(rebound,key))).toThrow(/42501/)
    db(`DELETE FROM instance_logs WHERE id='${fresh}'`); expect(()=>service(claim(updated))).toThrow(/42501/)
  },30000)

  it('serializes concurrent reservations and rejects authority that committed during the current turn',async()=>{
    const {args,connectorId,authorizationId,connectorRevision}=setup()
    const results=await Promise.allSettled([1,2,3].map(()=>pg.concurrent(`${gateway} ${claim(args,hash)}`)))
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    for(const r of results) if(r.status==='rejected') expect(r.reason.message).toMatch(/already reserved/)
    const next=uuid(1515), held=pg.concurrent(`BEGIN; UPDATE connectors SET revision=revision+1 WHERE id='${connectorId}';
      SELECT pg_advisory_xact_lock(1515); SELECT pg_sleep(1.5); COMMIT`)
    try {
      let ready=false
      for(let i=0;i<50&&!ready;i++) {
        ready=db('SELECT NOT pg_try_advisory_lock(1515)')==='t'
        if(!ready) await new Promise(resolve=>setTimeout(resolve,10))
      }
      expect(ready).toBe(true); turn(next)
    } finally {await held}
    const updated=args.replace(action,next).replace(`'${authorizationId}',${connectorRevision},`,`'${authorizationId}',${connectorRevision+1},`)
    expect(()=>service(claim(updated))).toThrow(/42501/)
    const fresh=uuid(1516); turn(fresh); expect(service(claim(updated.replace(next,fresh)))).toMatch(/^[0-9a-f-]{36}$/)
  },30000)

  it('does not reinterpret pre-cutover submissions or historical resource-bound receipts',()=>{
    install(); const {connectorId,authorizationId}=completeOrdinaryOauth(db); issueDirect(db)
    const legacy=run(direct,uuid(1513),'20261123110000_connector_instance_member_policy.sql')
    expect(read(legacy.result)).not.toBe(''); const oldTurn=uuid(1514); turn(oldTurn)
    db(sqlSource(file)); expect(read(legacy.result)).not.toBe('')
    expect(db(`SELECT account_authority FROM connector_result_private.direct_ask_submissions WHERE action_id='${oldTurn}'`)).toBe('f')
    const [account]=JSON.parse(service(`SELECT public.connector_direct_accounts_v2(${actor},'${connectorId}','${tool}')`))
    const args=`${actor},'${connectorId}','${oldTurn}','${tool}','v1','${hash}','${authorizationId}',${account.connector.revision},${account.policy.revision},${account.direct_revision},'${account.provider.credential_revision}'`
    expect(()=>service(claim(args))).toThrow(/42501/)
    const current=run(connectorId); expect(current.read).toEqual(doc)
    db(`UPDATE connector_result_private.direct_attestations SET revoked_at=now()`)
    expect(read(legacy.result)).toBe(''); expect(read(current.result)).not.toBe('')
  },30000)
})