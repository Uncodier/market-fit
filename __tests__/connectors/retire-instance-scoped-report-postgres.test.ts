/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { codeRoot, id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { connector, instance, project } from './connector-analytics-fixture'
import { direct, enableDirect, installProviderDirect, issueDirect, revision } from './provider-direct-fixture'
import { createGateway, gateway, installDirectReceipts } from './provider-direct-receipt-fixture'

const file = '20261123090000_retire_instance_scoped_report.sql', canonical = 'makinari-db-scheme'
const probes = (repo: string) => readFileSync(path.join(codeRoot, repo, 'supabase/tests', file), 'utf8')
test('all three repositories carry identical migration and PostgreSQL probes', () => {
  for (const repo of ['API', 'market-fit']) {
    expect(sqlSource(file, repo)).toBe(sqlSource(file, canonical))
    expect(probes(repo)).toBe(probes(canonical))
  }
})

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Disposable PostgreSQL required')
;(postgresAvailable ? describe : describe.skip)('scoped report retirement on a populated database', () => {
  const pg = isolatedPostgres(), db = pg.db, request = uuid(930), next = uuid(931), hash = 'a'.repeat(64)
  const schema = 'connector_result_private', claims = `${schema}.direct_claims`, grants = `${schema}.analytics_grants`
  const service = (sql: string) => db(`\\set VERBOSITY verbose\n${gateway} ${sql}`)
  const user = (sql: string, actor = id.member) => db(`SET ROLE authenticated;
    SET request.jwt.claims='${JSON.stringify({sub:actor,role:'authenticated',is_anonymous:false})}'; ${sql}`)
  const details = {status:'running', ask_request_sha256:hash, assistant_recovery:{version:1,respawnCount:0,inFlight:true,
    inFlightKind:'turn',execution:{callerSource:'interactive',executionMode:'direct',catalogUserSession:true}}}
  const turn = (key: string) => service(`INSERT INTO instance_logs(id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details)
    VALUES ('${key}','${instance}','${id.site}','${id.member}','${id.agent}','user_action',true,${jsonSql(details)})`)
  const actor = `'${id.site}','${id.member}','${instance}','${id.agent}'`
  const bound = `${actor},'${connector}','${request}',1,1,1,'${revision}','${project}'`
  const scope = `${bound},'20261116_00','${hash}','paid_sales','platform'`
  const claim = (digest: string) => `SELECT public.claim_connector_instance_scoped_read(${scope},'${digest}')`
  const doc = {title:'Fixture report',note:'Private preview',columns:['total'],rows:[['4']]}
  const store = (key: string) => `SELECT public.store_connector_instance_scoped_read(${scope},'${key}',${jsonSql(doc)})`
  const read = (key: string) => `SELECT public.read_connector_private_result('${key}')`
  const list = 'SELECT id FROM public.list_connector_private_results()'
  let historical: string, pending: string, epoch: string

  beforeAll(async () => {
    pg.start(); db(createGateway); installProviderDirect(db); installDirectReceipts(db)
    for (const m of ['20261123030000_connector_ask_on_connect.sql','20261123040000_connector_instance_member_authority.sql',
      '20261123041000_connector_instance_scoped_reads.sql','20261123080000_connector_instance_report_sources.sql']) db(sqlSource(m))
    db(`UPDATE remote_instances SET user_id='${id.member}'; INSERT INTO ${grants}(site_id,user_id,agent_id,connector_id,project_ref,expires_at)
      VALUES ('${id.site}','${id.member}','${id.agent}','${connector}','${project}',now()+interval '1 hour')`)
    epoch = issueDirect(db); enableDirect(db); turn(request)
    historical = service(store(service(claim(hash)))); pending = service(claim('b'.repeat(64)))
    // Snapshot immutable public configuration before cutover, including revisions.
    const snapshot = () => db(`SELECT to_jsonb(c) FROM connectors c ORDER BY id;
      SELECT to_jsonb(p) FROM connector_policies p ORDER BY connector_id`)
    const before = snapshot()
    // A busy journal must abort the whole cutover, not leave just the RPC or
    // trigger half retired. A queued request is never a reason to force locks.
    const holder = pg.concurrent(`BEGIN; LOCK TABLE ${claims} IN ROW EXCLUSIVE MODE;
      SELECT pg_advisory_xact_lock(930); SELECT pg_sleep(4.5); COMMIT;`)
    try {
      let locked = false
      for (let i=0; i<50 && !locked; i++) {
        locked = db('SELECT NOT pg_try_advisory_lock(930)') === 't'
        if (!locked) await new Promise(resolve => setTimeout(resolve,10))
      }
      expect(locked).toBe(true)
      expect(() => db(sqlSource(file, canonical))).toThrow(/lock timeout/)
      expect(db(`SELECT to_regprocedure('${schema}.reject_retired_scoped_write()') IS NULL`)).toBe('t')
    } finally { await holder }
    db(sqlSource(file, canonical)); expect(snapshot()).toBe(before)
  },30000)
  afterAll(pg.stop)

  it('denies stale RPCs, gate submissions and private journal writes without losing the outstanding reservation', () => {
    db(probes(canonical))
    for (const sql of [`SELECT public.connector_instance_scoped_read(${actor},'${connector}')`,
      `SELECT public.connector_instance_report_sources(${bound})`,claim('c'.repeat(64)),store(pending)]) {
      expect(() => service(sql)).toThrow(/42501/)
    }
    expect(() => db(`INSERT INTO ${claims} SELECT (jsonb_populate_record(c,jsonb_build_object('id',gen_random_uuid(),
      'arguments_digest',repeat('d',64)))).* FROM ${claims} c WHERE c.id='${pending}'`)).toThrow(/direct_claim_requires_attestation/)
    expect(() => db(`UPDATE ${claims} SET consumed_at=now() WHERE id='${pending}'`)).toThrow(/direct_claim_requires_attestation/)
    expect(db(`SELECT consumed_at IS NULL FROM ${claims} WHERE id='${pending}'`)).toBe('t')
  })

  it('keeps owner-only historical reads subject to parent RLS and the original platform grant', () => {
    expect(JSON.parse(user(read(historical)))).toEqual(doc); expect(user(list)).toContain(historical)
    expect(user(read(historical),id.admin)).toBe('')
    db('UPDATE remote_instances SET visible=false'); expect(user(read(historical))).toBe('')
    db('UPDATE remote_instances SET visible=true'); expect(user(list)).toContain(historical)
    db(`UPDATE ${grants} SET revoked_at=now()`); expect(user(read(historical))).toBe(''); expect(user(list)).not.toContain(historical)
  })

  it('freezes scoped heads only; a fresh attested member turn claims, stores, reopens and cannot redispatch', () => {
    turn(next)
    expect(db(`SELECT action_id FROM ${schema}.scoped_turn_heads; SELECT action_id FROM ${schema}.direct_turn_heads`)).toBe(`${request}\n${next}`)
    const args = `${actor},'${direct}','${next}','CRM_LIST_DEALS','v1','${hash}','${epoch}',1,1,3,'${revision}'`
    const reserve = `SELECT public.claim_connector_direct_dispatch(${args},'${hash}')`
    const key = service(reserve), save = `SELECT public.store_connector_direct_result(${args},'${key}',${jsonSql(doc)})`
    const receipt = service(save); expect(service(save)).toBe(receipt); expect(JSON.parse(user(read(receipt)))).toEqual(doc)
    expect(user(read(receipt),id.foreign)).toBe(''); expect(() => service(reserve)).toThrow(/P0D03/)
    expect(() => service(save.replace(key,pending))).toThrow(/P0D04/)
  })
})