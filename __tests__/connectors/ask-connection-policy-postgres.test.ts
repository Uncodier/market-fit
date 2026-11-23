/** @jest-environment node */
import { randomUUID } from 'node:crypto'
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { completeOrdinaryOauth, installOrdinaryOauth } from './ordinary-oauth-fixture'
import { instance, revision } from './provider-direct-fixture'
import { createGateway, gateway } from './provider-direct-receipt-fixture'

const migration = '20261123170000_connector_ask_connection_policy.sql'
const retirement = '20261123171000_retire_connector_direct_accounts_v2.sql'
test.each([migration, retirement])('all copies of %s match', file => {
  for (const repo of ['API', 'makinari-db-scheme']) expect(sqlSource(file, repo)).toBe(sqlSource(file))
})

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Real PostgreSQL required')
;(postgresAvailable ? describe : describe.skip)('Ask with verified connections on disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => db(`\\set VERBOSITY verbose\n${gateway} ${sql}`)
  const actor = `'${id.site}','${id.member}','${instance}','${id.agent}'`
  const tool = 'NEW_TOOLKIT_LIST_ITEMS', hash = 'a'.repeat(64), digest = 'b'.repeat(64)
  const details = { status: 'running', ask_request_sha256: hash, assistant_recovery: { version: 1, respawnCount: 0, inFlight: true,
    inFlightKind: 'turn', execution: { callerSource: 'interactive', executionMode: 'direct', catalogUserSession: true } } }
  const doc = { title: 'Synthetic items', note: '', columns: ['Count'], rows: [['1']] }
  const read = (connector: string, slug = tool, scope = actor) => `SELECT public.connector_ask_connections(${scope},'${connector}','${slug}')`
  const turn = (action: string, connectionPolicy = false) => service(`INSERT INTO instance_logs(id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details)
    VALUES ('${action}','${instance}','${id.site}','${id.member}','${id.agent}','user_action',true,${jsonSql(connectionPolicy ? {...details,ask_connection_policy:true} : details)})`)
  const args = (connector: string, action: string, attempt: string, connectorRev = 1, policyRev = 1, slug = tool) =>
    `${actor},'${connector}','${action}','${slug}','v1','${hash}','${attempt}',${connectorRev},${policyRev},1,'${revision}'`
  const claim = (a: string) => service(`SELECT public.claim_connector_account_dispatch(${a},'${digest}')`)
  const store = (a: string, reservation: string) => service(`SELECT public.store_connector_account_result(${a},'${reservation}',${jsonSql(doc)})`)
  const open = (receipt: string, actorId = id.member) => db(`SET ROLE authenticated; SET request.jwt.claims='${JSON.stringify({ sub: actorId, role: 'authenticated', is_anonymous: false })}';
    SELECT public.read_connector_private_result('${receipt}')`)
  const cutover = () => {
    for (const file of ['20261123164000_retire_connector_project_binding.sql','20261123165000_connector_ask_host_policy.sql',migration]) db(sqlSource(file))
  }

  beforeAll(() => { pg.start(); db(createGateway) }, 30_000)
  afterAll(pg.stop)
  beforeEach(() => {
    installOrdinaryOauth(db)
    db(sqlSource('20261123151000_connector_account_receipts.sql'))
    db(`UPDATE remote_instances SET user_id='${id.member}' WHERE id='${instance}'`)
  }, 30_000)

  it('admits an exact completed connection without delegation, but not a different actor, tool, or credential', () => {
    const {connectorId,authorizationId}=completeOrdinaryOauth(db,{toolkit:'new-toolkit',legacy:true,notice:false})
    cutover()
    expect(db('SELECT count(*) FROM connector_result_private.ordinary_oauth_accounts')).toBe('0')
    expect(JSON.parse(service(read(connectorId)))).toMatchObject([{authority_kind:'verified_connection',connection_attempt_id:authorizationId,
      connector:{id:connectorId},policy:{tool_access_mode:'all'},direct_revision:1}])
    expect(service(read(connectorId,'OTHER_LIST_ITEMS'))).toBe('[]')
    expect(service(read(connectorId,tool,actor.replace(id.site,id.otherSite)))).toBe('[]')
    expect(service(read(connectorId,tool,actor.replace(id.agent,id.inactiveAgent)))).toBe('[]')
    expect(service(read(connectorId,tool,actor.replace(instance,randomUUID())))).toBe('[]')
    for (const statement of [
      `UPDATE connector_policies SET allowed_hosts=ARRAY['direct'] WHERE connector_id='${connectorId}'`,
      `UPDATE connector_policies SET allowed_tools=ARRAY['NEW_TOOLKIT_OTHER'],tool_access_mode='selected' WHERE connector_id='${connectorId}'`,
      `INSERT INTO connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by) VALUES ('${id.site}','${connectorId}','${id.member}',true,false,'${id.owner}')`,
      `UPDATE site_members SET blocked_screens=ARRAY['chat'] WHERE user_id='${id.member}'`,
      `UPDATE public.site_secrets SET is_active=false`,
      `UPDATE public.connectors SET enabled=false WHERE id='${connectorId}'`,
    ]) expect(db(`BEGIN; ${statement}; SET ROLE service_role; ${read(connectorId)}; ROLLBACK;`)).toBe('[]')
    expect(() => db(`SET ROLE authenticated; ${read(connectorId)}`)).toThrow(/permission denied/)
    expect(() => service('SELECT * FROM connector_result_private.ask_connections')).toThrow(/permission denied/)
    db(sqlSource(retirement))
    expect(db("SELECT to_regprocedure('public.connector_direct_accounts_v2(uuid,uuid,uuid,uuid,uuid,text)') IS NULL")).toBe('t')
    expect(JSON.parse(service(read(connectorId)))).toHaveLength(1)
  })

  it('keeps the saved project pin on a Supabase account connected before project selection at creation', () => {
    const {connectorId,authorizationId}=completeOrdinaryOauth(db,{toolkit:'supabase',scopes:[],legacy:true,notice:false})
    const project='abcdefghijklmnopqrst'
    service(`SELECT public.connector_bind_supabase_project('${id.site}','${connectorId}','${id.owner}',1,'${project}','${revision}')`)
    expect(db(`SELECT supabase_project_ref IS NULL FROM public.site_connector_auth_attempts WHERE id='${authorizationId}'`)).toBe('t')
    cutover()
    expect(db(`SELECT count(*) FROM connector_result_private.direct_attestations WHERE connector_id='${connectorId}'`)).toBe('0')
    expect(db(`SELECT count(*) FROM connector_result_private.ordinary_oauth_accounts WHERE connector_id='${connectorId}'`)).toBe('0')
    expect(JSON.parse(service(read(connectorId,'SUPABASE_GET_PROJECT')))).toMatchObject([{authority_kind:'verified_connection',
      connection_attempt_id:authorizationId,connector:{id:connectorId,supabase_project_ref:project}}])
    expect(JSON.parse(service(`SELECT public.connector_instance_policy_status('${id.site}','${id.owner}','${connectorId}')`)))
      .toMatchObject({enabled:true,attested:false,setup_pending:false,assistant_allowed:true,authority_kind:'connected_account'})
    expect(() => db(`UPDATE public.connectors SET supabase_project_ref='${'z'.repeat(20)}' WHERE id='${connectorId}'`)).toThrow(/immutable/)
  })

  it('preserves the old worker contract during the rollout, including an in-flight result and historical receipts', () => {
    const {connectorId,authorizationId}=completeOrdinaryOauth(db)
    db(sqlSource('20261123152000_connector_customer_delegation.sql'))
    const mail='GMAIL_FETCH_EMAILS'
    const legacyDiscovery=`SELECT public.connector_direct_accounts_v2(${actor},'${connectorId}','${mail}')`
    const [legacyAccount]=JSON.parse(service(legacyDiscovery))
    expect(legacyAccount).toMatchObject({authorization_id:authorizationId,direct_revision:1})
    const first=randomUUID(); turn(first)
    const mailArgs=(action: string)=>args(connectorId,action,authorizationId,legacyAccount.connector.revision,legacyAccount.policy.revision,mail)
    const oldArgs=mailArgs(first)
    const reservation=claim(oldArgs)
    cutover()
    const historicalReceipt=store(oldArgs,reservation)
    expect(JSON.parse(open(historicalReceipt))).toEqual(doc)

    db(`UPDATE site_members SET blocked_screens=ARRAY['calendar'] WHERE user_id='${id.member}'`)
    const fresh=randomUUID(); turn(fresh)
    expect(JSON.parse(service(legacyDiscovery))).toMatchObject([{authorization_id:authorizationId}])
    expect(service(read(connectorId,mail))).toBe('[]')
    const freshArgs=mailArgs(fresh)
    const freshReceipt=store(freshArgs,claim(freshArgs))
    const upgraded=randomUUID(); turn(upgraded,true)
    expect(() => claim(mailArgs(upgraded))).toThrow(/42501/)
    db(sqlSource(retirement))
    expect(JSON.parse(open(historicalReceipt))).toEqual(doc)
    expect(JSON.parse(open(freshReceipt))).toEqual(doc)
    db(`DELETE FROM connector_result_private.ordinary_oauth_accounts WHERE connector_id='${connectorId}'`)
    expect(open(historicalReceipt)).toBe('')
    expect(open(freshReceipt)).toBe('')
  }, 30_000)

  it('reserves only a new trusted turn, stores one private receipt, and invalidates it on revocation', () => {
    const {connectorId,authorizationId}=completeOrdinaryOauth(db,{toolkit:'new-toolkit',legacy:true,notice:false})
    const old=randomUUID(); turn(old)
    cutover()
    expect(() => claim(args(connectorId,old,authorizationId))).toThrow(/42501/)
    const legacy=randomUUID(); turn(legacy)
    expect(() => claim(args(connectorId,legacy,authorizationId))).toThrow(/42501/)
    service(`UPDATE instance_logs SET details=details || '{"ask_connection_policy":true}' WHERE id='${legacy}'`)
    expect(() => claim(args(connectorId,legacy,authorizationId))).toThrow(/42501/)
    const action=randomUUID(); turn(action,true)
    const a=args(connectorId,action,authorizationId)
    expect(() => claim(args(connectorId,action,randomUUID()))).toThrow(/42501/)
    const reservation=claim(a)
    expect(() => claim(a)).toThrow(/P0D03/)
    const receipt=store(a,reservation)
    expect(store(a,reservation)).toBe(receipt)
    expect(JSON.parse(open(receipt))).toEqual(doc)
    expect(open(receipt,id.admin)).toBe('')
    db(`UPDATE connector_policies SET allowed_hosts='{}',revision=2 WHERE connector_id='${connectorId}';
      UPDATE connectors SET revision=2 WHERE id='${connectorId}'`)
    expect(open(receipt)).toBe('')
    expect(() => store(a,reservation)).toThrow(/42501/)
  }, 30_000)
})