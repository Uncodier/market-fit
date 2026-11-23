/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { direct, enableDirect, installProviderDirect, instance, issueDirect, issueSql, revision, setSql } from './provider-direct-fixture'
import { createGateway, gateway, installDirectReceipts, receiptMigration as migration } from './provider-direct-receipt-fixture'

const request = uuid(902), hash = 'a'.repeat(64), digest = 'b'.repeat(64), slug = 'CRM_LIST_DEALS'
const report = { title: 'Connector result', note: 'A private preview.', columns: ['Field', 'Value'], rows: [['$.total', '23']] }
const recovery = { version: 1, revision: uuid(910), respawnCount: 0, inFlight: true, inFlightKind: 'turn',
  execution: { callerSource: 'interactive', executionMode: 'direct', catalogUserSession: true, connectorIdHint: direct } }
const action = (logId = request, details: unknown = { status: 'running', ask_request_sha256: hash, assistant_recovery: recovery }, agent: string | null = id.agent) => `INSERT INTO instance_logs
  (id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details) VALUES
  ('${logId}','${instance}','${id.site}','${id.admin}',${agent ? `'${agent}'` : 'NULL'},'user_action',true,${jsonSql(details)})`
const claims = 'connector_result_private.direct_claims', reports = 'connector_result_private.reports'
const read = (receipt: string) => `SELECT public.read_connector_private_result('${receipt}')`
const choice = (receipt: string) => `SELECT public.connector_private_report_choice('${receipt}',0)`
const list = 'SELECT id FROM public.list_connector_private_results()'
const session = (who = id.admin, anon: boolean | null = false) => `SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims='${JSON.stringify({sub: who, role:'authenticated', ...(anon !== null && {is_anonymous: anon})})}';`
const verbose = '\\set VERBOSITY verbose\n'

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw new Error('Disposable PostgreSQL binaries required')

test('direct receipt migration matches the canonical copy byte-for-byte', () => {
  for (const repo of ['market-fit', 'API']) expect(sqlSource(migration, repo)).toBe(sqlSource(migration, 'makinari-db-scheme'))
})

test('hosted migration owners need no persistent custom parameter grants', () => {
  const ddl=sqlSource(migration,'makinari-db-scheme')
  expect(ddl).not.toMatch(/\bSET\s+(?:request|connector_direct)\.[a-z._]+\s*=/i)
  expect(ddl).not.toMatch(/GRANT\s+SET\s+ON\s+PARAMETER/i)
})

;(postgresAvailable ? describe : describe.skip)('direct receipts in disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (query: string) => db(`${verbose}${gateway} ${query}`)
  const user = (query: string, who = id.admin, anon: boolean | null = false) => db(`BEGIN; ${session(who,anon)} ${query}; ROLLBACK;`)
  let epoch: string
  const binding = (logId = request, directRev=3) => `'${id.site}','${id.admin}','${instance}','${id.agent}','${direct}','${logId}',
    '${slug}','v1','${hash}','${epoch}',1,1,${directRev},'${revision}'`
  const claim = (args = binding(), fingerprint = digest) => `SELECT public.claim_connector_direct_dispatch(${args},'${fingerprint}')`
  const store = (claimId: string, args = binding(), doc: unknown = report) =>
    `SELECT public.store_connector_direct_result(${args},'${claimId}',${jsonSql(doc)})`
  const deliver = () => service(store(service(claim())))
  async function waitForHolder(key: number) {
    for (let i=0;i<40;i++) {
      if (db(`SELECT NOT pg_try_advisory_lock(${key})`)==='t') return
      await new Promise(resolve=>setTimeout(resolve,10))
    }
    throw new Error('Fixture lock not acquired')
  }

  beforeAll(() => { pg.start(); db(createGateway) }, 30000)
  afterAll(pg.stop)
  beforeEach(() => {
    installProviderDirect(db)
    installDirectReceipts(db)
    epoch = issueDirect(db); enableDirect(db); service(action())
  }, 30000)

  it('delivers only to the original human, not a manager, anonymous session, service, model or legacy follow-up', () => {
    const reservation = service(claim()), receipt = service(store(reservation))
    expect(receipt).not.toBe(reservation)
    expect(JSON.parse(user(read(receipt)))).toEqual(report); expect(user(list)).toBe(receipt)
    expect(user(choice(receipt))).toBe(''); expect(user(read(reservation))).toBe('')
    for (const other of [id.owner,id.coowner,id.member,id.foreign]) {
      expect(user(read(receipt), other)).toBe(''); expect(user(list, other)).toBe('')
    }
    for (const anon of [true, null]) {
      expect(user(read(receipt), id.admin, anon)).toBe(''); expect(user(list, id.admin, anon)).toBe('')
    }
    for (const role of ['anon','authenticated','service_role','connector_result_reader']) {
      expect(() => pg.call(`SELECT * FROM ${claims}`, id.admin, role)).toThrow(/permission denied/)
      expect(db(`SELECT has_table_privilege('${role}','${claims}','DELETE') OR
        has_function_privilege('${role}','connector_result_private.direct_admissions(uuid,uuid,uuid,uuid,uuid,text)','EXECUTE')`)).toBe('f')
      if (role !== 'service_role') for (const query of [claim(),store(reservation)]) {
        expect(() => pg.call(query,id.admin,role)).toThrow(/permission denied/)
      }
      if (role === 'anon' || role === 'service_role') for (const query of [list,read(receipt),choice(receipt)]) {
        expect(() => pg.call(query,id.admin,role)).toThrow(/permission denied/)
      }
    }
    db(`UPDATE remote_instances SET visible=false`)
    expect(user(list)).toBe(''); expect(user(read(receipt))).toBe('') // Real caller-limited parent RLS
    db(`UPDATE remote_instances SET visible=true`)
    service(`UPDATE instance_logs SET details=jsonb_set(details,'{status}','"completed"')`)
    expect(JSON.parse(user(read(receipt)))).toEqual(report) // A completed request never needs re-execution to open.
  })

  it('requires a server-owned initial interactive turn, current selection, requester and exact grant on claim and store', () => {
    const reservation = service(claim())
    const pending = store(reservation)
    for (const [name, value] of [
      ['status','"stopped"'], ['assistant_recovery,respawnCount','1'], ['assistant_recovery,inFlight','false'],
      ['assistant_recovery,inFlightKind','"plan"'], ['assistant_recovery,lease_token','"claimed"'],
      ['assistant_recovery,conversationOnly','true'], ['assistant_recovery,execution,catalogUserSession','false'],
      ['assistant_recovery,execution,callerSource','"background"'], ['assistant_recovery,execution,executionMode','"plan"'],
      ['assistant_recovery,execution,instanceNodeId',`"${uuid(909)}"`], ['assistant_recovery,execution,expectedResultsAmount','2'],
      ['assistant_recovery,execution,connectorIdHint',`"${id.foreignConnector}"`],
    ]) {
      const change = `UPDATE instance_logs SET details=jsonb_set(details,'{${name}}','${value}')`
      for (const query of [claim(),pending]) expect(() => db(`${verbose}BEGIN; SET LOCAL ROLE service_role; ${change}; ${query};`)).toThrow(/42501/)
    }
    for (const [old,fresh] of [[id.site,id.otherSite],[id.admin,id.member],[instance,uuid(811)],[id.agent,id.otherAgent],
      [direct,id.foreignConnector],[request,uuid(919)],[epoch,uuid(990)],[revision,'0'.repeat(64)],[slug,'OTHER_QUERY'],
      [',1,1,3,',',2,1,3,'],[',1,1,3,',',1,2,3,'],[',1,1,3,',',1,1,2,']]) {
      expect(() => service(claim(binding().replace(old,fresh)))).toThrow(/42501/)
      expect(() => service(store(reservation,binding().replace(old,fresh)))).toThrow(/P0D04/)
    }
    expect(() => service(claim(binding().replace(`'${slug}'`, 'NULL')))).toThrow(/42501/)
    expect(() => user(action(uuid(923)))).toThrow(/server_only/)
    expect(() => user(`UPDATE instance_logs SET message='unrelated'`)).toThrow(/insufficient_privilege/)
    expect(() => service(`UPDATE instance_logs SET agent_id='${id.otherAgent}'`)).toThrow(/42501/)
    service(action(uuid(912),{status:'running'})); expect(() => service(pending)).toThrow(/42501/) // Superseded
    expect(() => service(claim(binding(uuid(912))))).toThrow(/42501/) // Missing recovery proof
    db(`DELETE FROM instance_logs WHERE id='${uuid(912)}'`)
    expect(() => service(claim())).toThrow(/42501/); expect(() => service(pending)).toThrow(/42501/)
    db(`BEGIN; ${session()} UPDATE instance_logs SET details=jsonb_set(details,'{status}','"cancelled"'); COMMIT;`)
    expect(() => user(`UPDATE instance_logs SET details=jsonb_set(details,'{status}','"running"')`)).toThrow(/insufficient_privilege/)
    expect(() => service(pending)).toThrow(/42501/)
    expect(db(`SELECT count(*) FROM ${reports}`)).toBe('0')
  })

  it('enforces parent RLS in the real authenticated role, restores gateway state, and rolls back hidden writes and acknowledgments', () => {
    // Exercise BOTH production service branches, plus a new authenticated-only
    // restrictive predicate independent of the connector membership functions.
    db(`DROP POLICY user_instance ON remote_instances;
      ALTER TABLE remote_instances ADD COLUMN restricted boolean DEFAULT false;
      CREATE POLICY parent_access ON remote_instances USING (current_setting('role')='service_role'
        OR auth.jwt()->>'role'='service_role' OR (user_id=auth.uid() AND visible));
      CREATE POLICY exact_context ON remote_instances AS RESTRICTIVE FOR SELECT TO authenticated USING (
        NOT restricted AND current_user='authenticated' AND current_setting('role')='authenticated' AND auth.role()='authenticated'
        AND auth.jwt()=jsonb_build_object('sub',user_id,'role','authenticated','is_anonymous',false)
        AND current_setting('request.headers')='{}' AND current_setting('request.cookies')='{}');`)
    const saved=service(claim()), receipt=service(store(saved)), pending=service(claim(binding(),'c'.repeat(64)))
    const state=`current_user='service_role' AND current_setting('role')='service_role' AND auth.role()='service_role'
      AND auth.jwt()=' {"role":"service_role"}'::jsonb AND auth.uid()='${id.owner}' AND current_setting('request.jwt.claims')='{"role":"service_role"}'
      AND current_setting('request.headers')='{"x-test":"outer"}' AND current_setting('request.cookies')='{"test":"outer"}'
      AND current_setting('connector_direct.result_id')='prior-ack'`
    expect(service(`SELECT (${store(saved)})='${receipt}'; SELECT ${state};`)).toBe('t\nt')
    for (const hide of ['visible=false','restricted=true']) {
      db(`UPDATE remote_instances SET ${hide}`)
      for (const query of [claim(binding(),'d'.repeat(64)),store(pending),store(saved)]) {
        expect(() => service(query)).toThrow(/42501/)
      }
      expect(service(`DO $$ BEGIN PERFORM (${store(pending)}); EXCEPTION WHEN insufficient_privilege THEN NULL; END $$; SELECT ${state}`)).toBe('t')
      expect(db(`SELECT count(*) FROM ${claims}; SELECT count(*) FROM ${reports}; SELECT consumed_at IS NULL FROM ${claims} WHERE id='${pending}'`)).toBe('2\n1\nt')
      db('UPDATE remote_instances SET visible=true,restricted=false')
    }
    expect(db('SELECT count(*) FROM connector_direct_rpc.write_gate')).toBe('0')
    for (const role of ['anon','authenticated','service_role','connector_result_reader']) {
      expect(db(`SELECT has_function_privilege('${role}','connector_result_private.apply_direct_write()','EXECUTE') OR
        has_function_privilege('${role}','connector_result_private.authorize_direct_parent()','EXECUTE') OR
        has_table_privilege('${role}','connector_direct_rpc.write_gate','TRIGGER,SELECT,DELETE,TRUNCATE')`)).toBe('f')
      if(role!=='service_role') expect(db(`SELECT has_any_column_privilege('${role}','connector_direct_rpc.write_gate','INSERT')`)).toBe('f')
    }
    expect(db(`SELECT has_schema_privilege('service_role','connector_result_private','USAGE')`)).toBe('f')
    expect(() => service(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${claim(binding(),'f'.repeat(64))}`)).toThrow(/42501/)
    // A service login without the gateway's SET capability cannot borrow it from the definer.
    expect(() => db(`${verbose}SET SESSION AUTHORIZATION service_role; SET ROLE service_role; ${claim(binding(),'e'.repeat(64))}`)).toThrow(/42501/)
  })

  it('requires a keyed trusted action with the exact immutable prompt-selected agent, not just an active same-site agent', () => {
    const unbound=uuid(963), unmarked=uuid(964), other=uuid(965)
    db(`INSERT INTO agents VALUES ('${other}','${id.site}','active')`)
    const keyed={status:'running',ask_request_sha256:hash,assistant_recovery:recovery}
    service(action(unbound,keyed,null)); expect(() => service(claim(binding(unbound)))).toThrow(/42501/)
    expect(() => user(`UPDATE instance_logs SET agent_id='${id.agent}' WHERE id='${unbound}'`)).toThrow(/insufficient_privilege/)
    service(`UPDATE instance_logs SET agent_id='${id.agent}' WHERE id='${unbound}'`)
    expect(() => service(claim(binding(unbound).replace(id.agent,other)))).toThrow(/42501/)
    const pending=service(claim(binding(unbound))); expect(pending).toHaveLength(36)
    service(action(unmarked,{status:'running',assistant_recovery:recovery})); expect(() => service(claim(binding(unmarked)))).toThrow(/42501/)
    service(`DELETE FROM instance_logs WHERE id='${unmarked}'`)
    expect(() => service(claim(binding(unbound),'d'.repeat(64)))).toThrow(/42501/)
    expect(() => service(store(pending,binding(unbound)))).toThrow(/42501/)
  })

  it('reserves only once, acknowledges the identical stored receipt, and never recreates an evicted result', async () => {
    async function race(query: string, loser: string) {
      const outcomes = await Promise.allSettled(Array.from({length: 4}, () => pg.concurrent(`${verbose}${gateway} ${query}`)))
      const winners = outcomes.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
      const losses = outcomes.flatMap(r => r.status === 'rejected' ? [String(r.reason)] : [])
      expect(winners).toHaveLength(1); expect(losses).toHaveLength(3)
      expect(losses.every(s => s.includes(loser))).toBe(true)
      return winners[0]
    }
    const reservation = await race(claim(), 'P0D03')
    expect(() => service(claim(binding().replace('v1','v2').replace(hash,'0'.repeat(64))))).toThrow(/P0D03/)
    for (const args of [binding().replace('v1','v2'),binding().replace(hash,'0'.repeat(64))]) {
      expect(() => service(store(reservation,args))).toThrow(/P0D04/)
    }
    const receipts = await Promise.all(Array.from({length:4}, () => pg.concurrent(`${verbose}${gateway} ${store(reservation)}`)))
    const receipt=receipts[0]; expect(new Set(receipts).size).toBe(1); expect(user(list)).toBe(receipt)
    expect(service(store(reservation))).toBe(receipt) // First reply lost; no second claim or provider dispatch.
    expect(() => service(store(reservation,binding(),{...report,note:'Other'}))).toThrow(/P0D04/)
    // Same owner cap as all private results; pruning the report never unconsumes its claim.
    for (let n = 1; n <= 20; n++) service(store(service(claim(binding(),n.toString(16).padStart(64,'0')))))
    expect(db(`SELECT count(*) FROM ${reports}`)).toBe('20'); expect(user(read(receipt))).toBe('')
    expect(() => service(store(reservation))).toThrow(/P0D04/); expect(() => service(claim())).toThrow(/P0D03/)
    const next = uuid(904); service(action(next)); expect(service(claim(binding(next)))).not.toBe(reservation)
    service(`DELETE FROM instance_logs WHERE id='${request}'`)
    expect(db(`SELECT count(*) FROM ${claims}`)).toBe('1'); expect(db(`SELECT count(*) FROM ${reports}`)).toBe('0')
  })

  it('does not release or store stale admissions; revocation, renewal and re-enrollment do not restore old receipts', () => {
    const receipt = deliver(), reservation = service(claim(binding(), 'c'.repeat(64)))
    for (const change of [
      `UPDATE connector_policies SET tool_access_mode='selected', allowed_tools='{}' WHERE connector_id='${direct}'`,
      `UPDATE remote_instances SET user_id='${id.owner}'`, `UPDATE agents SET status='inactive' WHERE id='${id.agent}'`,
      `UPDATE connector_policies SET revision=revision+1 WHERE connector_id='${direct}'`,
      `UPDATE site_members SET blocked_screens=ARRAY['leads'] WHERE user_id='${id.admin}'`,
      `UPDATE site_secrets SET is_active=false`, 'DELETE FROM connector_result_private.provider_attestations',
      `INSERT INTO connector_agents(site_id,connector_id,agent_id,granted_by,enabled) VALUES ('${id.site}','${direct}','${id.agent}','${id.owner}',false)`,
      `INSERT INTO connector_members(site_id,connector_id,user_id,granted_by,can_view,can_use) VALUES ('${id.site}','${direct}','${id.admin}','${id.owner}',true,false)`,
    ]) {
      expect(db(`BEGIN; ${change}; ${session()} SELECT (${read(receipt)}) IS NULL AND NOT EXISTS(${list}); ROLLBACK`)).toBe('t')
      expect(() => db(`${verbose}BEGIN; ${change}; SET LOCAL ROLE service_role; ${store(reservation)};`)).toThrow(/42501/)
    }
    service(setSql(false,3)); enableDirect(db); expect(user(read(receipt))).toBe(''); expect(user(list)).toBe('')
    expect(() => service(store(reservation))).toThrow(/42501/)
    expect(() => service(claim(binding(request,5)))).toThrow(/P0D03/)
    db(`UPDATE connector_result_private.direct_attestations SET revoked_at=now()`)
    const renewed = issueDirect(db); enableDirect(db)
    expect(user(read(receipt))).toBe(''); expect(user(list)).toBe('')
    expect(() => service(store(reservation))).toThrow(/42501/)
    const freshBinding = binding(request,8).replace(epoch,renewed)
    const fresh = service(store(service(claim(freshBinding,'d'.repeat(64))),freshBinding))
    expect(user(list)).toBe(fresh); expect(user(choice(fresh))).toBe('')
  })

  it('bounds physical expiry cleanup and keeps retries read-only', () => {
    // Fixture rows represent independently expired reports. No hot log scan.
    db(`INSERT INTO ${reports}(site_id,owner_id,instance_id,agent_id,connector_id,tool,catalog,version,schema_hash,
      connector_revision,policy_revision,credential_revision,report,expires_at)
      SELECT '${id.site}','${id.owner}','${instance}','${id.agent}','${direct}','${slug}',true,'v1','${hash}',1,1,'${revision}',
        ${jsonSql(report)},now()-interval '1 second' FROM generate_series(1,105);`)
    const pending=service(claim()), receipt=service(store(pending))
    const expired=()=>db(`SELECT count(*) FROM ${reports} WHERE expires_at<=now()`)
    expect(expired()).toBe('5'); expect(service(store(pending))).toBe(receipt); expect(expired()).toBe('5')
  })

  it('validates the bounded document before consuming the claim; cannot submit a published choice or raw envelope', () => {
    const reservation = service(claim())
    for (const doc of [null,[],{}, {successful:true,data:report}, {...report,published:true}, {...report,next_after:'extra'},
      {...report,rows:[[{}]]}, {...report,rows:[null]}, {...report,rows:[['one']]}, {...report,rows:[[true, '1']]},
      {...report,rows:[['x'.repeat(201),'1']]}, {...report,rows:Array(101).fill(['field','value'])}, {...report,note:null},
      {...report,title:'x'.repeat(201)}, {...report,note:'x'.repeat(501)}, {...report,columns:['a','b','c','d','e','f']},
      {...report,columns:['a','b','c','d','e'],rows:Array(100).fill(Array(5).fill('x'.repeat(200)))},
    ]) expect(() => service(store(reservation,binding(),doc))).toThrow(/22023/)
    expect(() => service(claim(binding(),'raw argument'))).toThrow(/22023/)
    expect(() => service(claim(binding().replace(hash,'bad')))).toThrow(/22023/)
    expect(db(`SELECT consumed_at IS NULL FROM ${claims} WHERE id='${reservation}'`)).toBe('t')
    expect(JSON.parse(user(read(service(store(reservation)))))).toEqual(report)
  })

  it('enforces independent reservation, report and proof expiry', () => {
    const receipt = deliver(), reservation = service(claim(binding(),'c'.repeat(64)))
    db(`UPDATE ${reports} SET expires_at=now(); UPDATE ${claims} SET claimed_at=now()-interval '1 hour' WHERE id='${reservation}'`)
    expect(user(read(receipt))).toBe(''); expect(() => service(store(reservation))).toThrow(/P0D04/)
    db('UPDATE connector_result_private.direct_attestations SET revoked_at=now()')
    const shortEpoch = db(issueSql().replace("'1 day'","'2 seconds'")); enableDirect(db)
    const args = binding(request,6).replace(epoch,shortEpoch)
    const fresh = service(store(service(claim(args,'d'.repeat(64))),args)), pending = service(claim(args,'e'.repeat(64)))
    expect(user(list)).toBe(fresh); db('SELECT pg_sleep(2.1)'); expect(user(list)).toBe(''); expect(user(read(fresh))).toBe('')
    expect(() => service(store(pending,args))).toThrow(/42501/)
  })

  it('denies claim and store waiting behind a newer server action, including after deletion of that action', async () => {
    const pending=service(claim()), newer=uuid(972)
    const holder=pg.concurrent(`${gateway} BEGIN; ${action(newer)}; SELECT pg_advisory_xact_lock(97201); SELECT pg_sleep(0.8); COMMIT;`)
    try {
      await waitForHolder(97201)
      const result=await Promise.allSettled([claim(binding(),'c'.repeat(64)),store(pending)].map(q=>pg.concurrent(`${verbose}${gateway} ${q}`)))
      expect(result.every(r=>r.status==='rejected' && String(r.reason).includes('42501'))).toBe(true)
    } finally { await holder }
    service(`DELETE FROM instance_logs WHERE id='${newer}'`)
    expect(() => service(store(pending))).toThrow(/42501/)
    expect(db(`SELECT count(*) FROM ${reports}; SELECT count(*) FROM ${claims}; SELECT consumed_at IS NULL FROM ${claims}`)).toBe('0\n1\nt')
  })

  it('rechecks parent RLS after waiting for receipt retention, without consuming the claim', async () => {
    const pending=service(claim())
    db('CREATE TABLE fixture_parent_gate(allowed boolean); INSERT INTO fixture_parent_gate VALUES (true); GRANT SELECT ON fixture_parent_gate TO authenticated;\n'+
      'CREATE POLICY after_wait ON remote_instances AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT allowed FROM fixture_parent_gate))')
    const holder=pg.concurrent(`BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('connector-private-results:${id.admin}',0));
      UPDATE fixture_parent_gate SET allowed=false; SELECT pg_advisory_xact_lock(97202); SELECT pg_sleep(0.8); COMMIT;`)
    try {
      await waitForHolder(97202)
      await expect(pg.concurrent(`${verbose}${gateway} ${store(pending)}`)).rejects.toThrow(/42501/)
    } finally { await holder }
    expect(db(`SELECT count(*) FROM ${reports}; SELECT consumed_at IS NULL FROM ${claims}`)).toBe('0\nt')
  })

  it('rechecks wall-clock grant expiry after waiting for a concurrent manager transaction', async () => {
    db(`INSERT INTO connector_agents(site_id,connector_id,agent_id,granted_by,enabled,expires_at)
      VALUES ('${id.site}','${direct}','${id.agent}','${id.owner}',true,clock_timestamp()+interval '1 second')`)
    const holder = pg.concurrent(`BEGIN; SELECT id FROM connectors WHERE id='${direct}' FOR UPDATE;
      SELECT pg_advisory_xact_lock(91502); SELECT pg_sleep(1.15); COMMIT;`)
    try {
      await waitForHolder(91502)
      expect(db(`SELECT expires_at>clock_timestamp() FROM connector_agents WHERE connector_id='${direct}'`)).toBe('t')
      await expect(pg.concurrent(`${verbose}SET ROLE service_role; ${claim()}`)).rejects.toThrow(/42501/)
      expect(db(`SELECT count(*) FROM ${claims}`)).toBe('0')
    } finally { await holder }
  })

  it('preserves unmarked legacy results and never applies legacy admission to a direct row', () => {
    // An unmarked live catalogue result, the representation of a pre-migration row.
    const legacy = service(`SELECT public.store_connector_private_result('${id.site}','${id.admin}','${instance}','${id.agent}',
      '${direct}','${slug}',true,1,1,'${revision}','v1','${hash}',${jsonSql(report)})`)
    const privateId = deliver()
    expect(new Set(user(list).split('\n'))).toEqual(new Set([legacy, privateId]))
    // The direct branch must never fall back to a valid legacy catalogue read.
    db('DELETE FROM connector_result_private.direct_enrollments')
    expect(user(list)).toBe(legacy); expect(user(read(privateId))).toBe('')
    expect(JSON.parse(user(read(legacy)))).toEqual(report)
    db('DELETE FROM connector_result_private.provider_attestations'); expect(user(list)).toBe('')
  })
})
