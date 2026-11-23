/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { codeRoot, id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { direct, enableDirect, installProviderDirect, instance, issueDirect, proofTable, revision, setSql } from './provider-direct-fixture'
import { createGateway, gateway, installDirectReceipts } from './provider-direct-receipt-fixture'

const file = '20261123100000_connector_policy_save_with_ask.sql', canonical = 'makinari-db-scheme'
const ddl = sqlSource(file, canonical), probe = (repo: string) => readFileSync(path.join(codeRoot,repo,'supabase/tests',file),'utf8')
test('canonical migration and claim/store probe match both application repositories', () => {
  for (const repo of ['API','market-fit']) {
    expect(sqlSource(file,repo)).toBe(ddl); expect(probe(repo)).toBe(probe(canonical))
  }
})
if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Real PostgreSQL required')
;(postgresAvailable ? describe : describe.skip)('single manager authorization, socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db, hash = 'a'.repeat(64), tool = 'CRM_LIST_DEALS', action = uuid(1111)
  const schema = 'connector_result_private', actor = `'${id.site}','${id.member}','${instance}','${id.agent}'`
  const service = (sql: string) => db(`\\set VERBOSITY verbose\n${gateway} ${sql}`)
  const user = (sql: string) => db(`SET ROLE authenticated; SET request.jwt.claims='${JSON.stringify({sub:id.member,role:'authenticated',is_anonymous:false})}'; ${sql}`)
  const details = {status:'running', ask_request_sha256:hash, assistant_recovery:{version:1,respawnCount:0,inFlight:true,
    inFlightKind:'turn',execution:{callerSource:'interactive',executionMode:'direct',catalogUserSession:true}}}
  const turn = (key: string) => service(`INSERT INTO instance_logs(id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details)
    VALUES ('${key}','${instance}','${id.site}','${id.member}','${id.agent}','user_action',true,${jsonSql(details)})`)
  const save = (cr:number,dr:number,on=true,options:{actor?:string;hosts?:string;tools?:string;publication?:string;enabled?:boolean}={}) =>
    `SELECT public.connector_save_policy_with_ask('${id.site}','${direct}','${options.actor??id.admin}',${cr},
      ${options.tools??`ARRAY['${tool}']`},${options.hosts??`ARRAY['${on?'assistant':'direct'}']`},false,${options.enabled??true},'selected',
      ${options.publication??'NULL'},NULL,${on},${dr})`
  const status = () => JSON.parse(service(`SELECT public.connector_ask_policy_status('${id.site}','${id.admin}','${direct}')`))
  const count = (slug=tool) => service(`SELECT jsonb_array_length(public.connector_direct_accounts(${actor},'${direct}','${slug}'))`)
  const read = (result:string) => user(`SELECT public.read_connector_private_result('${result}')`)
  const bound = (key:string,proof:string,cr:number,dr:number) => `${actor},'${direct}','${key}','${tool}','v1','${hash}','${proof}',${cr},${cr},${dr},'${revision}'`
  const claim = (args:string) => `SELECT public.claim_connector_direct_dispatch(${args},'${hash}')`
  const store = (args:string,res:string) => `SELECT public.store_connector_direct_result(${args},'${res}','{"title":"Fixture","note":"","columns":["N"],"rows":[["1"]]}')`
  const ordinary = (rev:number) => `SELECT public.connector_update_policy('${id.site}','${direct}','${id.admin}',${rev},
    ARRAY['${tool}'],ARRAY['assistant'],false,true,'selected',NULL)`
  beforeAll(() => { pg.start(); db(createGateway) },30000)
  afterAll(pg.stop)
  beforeEach(() => {
    installProviderDirect(db); installDirectReceipts(db)
    for (const m of ['20261123030000_connector_ask_on_connect.sql','20261123040000_connector_instance_member_authority.sql',
      '20261123041000_connector_instance_scoped_reads.sql','20261123080000_connector_instance_report_sources.sql',
      '20261123090000_retire_instance_scoped_report.sql']) db(sqlSource(m))
    db(`UPDATE remote_instances SET user_id='${id.member}'`)
  },30000)

  it('one save creates the first exact dispatch; off + renewal never revive reservations, receipts or turns', () => {
    const first = issueDirect(db); db(ddl); expect(count()).toBe('0')
    const vars = {site:id.site,account:direct,manager:id.admin,member:id.member,instance,agent:id.agent,
      action,credential:revision,details:JSON.stringify(details)}
    const receipt = JSON.parse(db(Object.entries(vars).map(([k,v])=>`\\set ${k} '${v}'`).join('\n')+'\n'+probe(canonical)))
    expect(receipt.saved).toEqual({connector_id:direct,revision:2,policy_revision:2,direct_revision:3,ask_enabled:true})
    expect(status()).toMatchObject({enabled:true,attested:true,setup_pending:false}); expect(count('CRM_OTHER')).toBe('0')
    expect(JSON.parse(read(receipt.result)).rows).toEqual([['1']]); const old = bound(action,first,2,3), pending = service(claim(old))
    expect(() => service(claim(old))).toThrow(/P0D03/)
    expect(JSON.parse(service(save(2,3,false)))).toMatchObject({revision:3,direct_revision:4,ask_enabled:false})
    expect(count()).toBe('0'); expect(read(receipt.result)).toBe(''); expect(() => service(store(old,pending))).toThrow(/42501/)
    db(`UPDATE ${proofTable} SET revoked_at=now()`); const renewed = issueDirect(db)
    expect(status()).toMatchObject({enabled:false,attested:true,direct_revision:6})
    service(ordinary(3)); expect(count()).toBe('0'); service(save(4,6)); expect(count()).toBe('1')
    expect(read(receipt.result)).toBe(''); expect(() => service(store(old,pending))).toThrow(/42501/)
    expect(() => service(claim(bound(action,renewed,5,7)))).toThrow(/42501/)
    const later = uuid(1112); turn(later); expect(service(claim(bound(later,renewed,5,7)))).toMatch(/^[a-f0-9-]{36}$/)
  })

  it('does not backfill or enroll on legacy saves; errors roll back both changes and both audits', () => {
    const first = issueDirect(db); service(setSql(false,2)); const before = status(); db(ddl); expect(status()).toEqual(before)
    service(ordinary(1)); expect(status()).toMatchObject({enabled:false,revision:2,direct_revision:3}); expect(count()).toBe('0')
    const snapshot = () => db(`SELECT to_jsonb(c) FROM connectors c WHERE id='${direct}';
      SELECT to_jsonb(p) FROM connector_policies p WHERE connector_id='${direct}'; SELECT count(*) FROM connector_audit_events;
      SELECT count(*) FROM ${schema}.direct_policy_events; SELECT count(*) FROM ${schema}.direct_enrollments`)
    const stable = snapshot()
    for (const [sql,err] of [[save(1,3),/40001/],[save(2,2),/40001/],[save(2,3,true,{actor:id.member}),/42501/],
      [save(2,3,true,{tools:'ARRAY[]::text[]'}),/22023/],[save(2,3,true,{enabled:false}),/22023/],
      [save(2,3,false,{hosts:"ARRAY['assistant']"}),/22023/],[save(2,3,true,{publication:`'{"audience":"verified","label_id":"Label_1"}'`}),/22023/]] as const) {
      expect(() => service(sql)).toThrow(err); expect(snapshot()).toBe(stable)
    }
    expect(() => user(save(2,3))).toThrow(/permission denied/)
    db(`UPDATE ${proofTable} SET revoked_at=now() WHERE id='${first}'`); expect(() => service(save(2,4))).toThrow(/P0D01/)
    expect(status()).toMatchObject({revision:2,attested:false,enabled:false,direct_revision:4})
    expect(JSON.parse(service(save(2,4,false)))).toMatchObject({revision:3,direct_revision:5,ask_enabled:false})
  })

  it('never grants shared/unproved credentials; cancel pending setup and do not consume the CAS twice', () => {
    db(`INSERT INTO ${schema}.direct_revisions(connector_id,direct_revision,setup_credential_revision) VALUES ('${direct}',1,'${revision}')`)
    db(ddl); expect(status()).toMatchObject({enabled:false,attested:false,setup_pending:true})
    expect(() => service(save(1,1))).toThrow(/P0D01/)
    expect(JSON.parse(service(save(1,1,false,{enabled:false})))).toMatchObject({revision:2,direct_revision:2,ask_enabled:false})
    expect(status()).toMatchObject({enabled:false,setup_pending:false,direct_revision:2})
    service(ordinary(2)); issueDirect(db); expect(count()).toBe('0'); expect(status()).toMatchObject({enabled:false,attested:true})
  })

  it('does not authorize a turn admitted during an uncommitted lower-xid re-grant', async () => {
    const proof = issueDirect(db); enableDirect(db); db(ddl)
    const held = pg.concurrent(`${gateway} BEGIN; ${save(1,3)}; SELECT pg_advisory_xact_lock(1113); SELECT pg_sleep(1.6); COMMIT`)
    try {
      let ready = false
      for (let i=0;i<50&&!ready;i++) {
        ready=db('SELECT NOT pg_try_advisory_lock(1113)')==='t'
        if (!ready) await new Promise(r=>setTimeout(r,10))
      }
      expect(ready).toBe(true); turn(action)
    } finally { await held }
    expect(() => service(claim(bound(action,proof,2,4)))).toThrow(/42501/)
    const next = uuid(1114); turn(next); expect(service(claim(bound(next,proof,2,4)))).toMatch(/^[a-f0-9-]{36}$/)
  })
})