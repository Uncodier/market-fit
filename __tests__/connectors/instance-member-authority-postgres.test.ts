/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, jsonSql, memberRow, sqlSource } from './connector-postgres-fixture'
import { direct, enableDirect, installProviderDirect, instance, issueDirect, issueSql, proofTable, revision } from './provider-direct-fixture'
import { createGateway, gateway, installDirectReceipts } from './provider-direct-receipt-fixture'

const migration = '20261123040000_connector_instance_member_authority.sql'
const ddl = sqlSource(migration, 'makinari-db-scheme')
const journal = 'connector_result_private.direct_ask_submissions', claims = 'connector_result_private.direct_claims'
const tool = 'CRM_LIST_DEALS', hash = randomBytes(32).toString('hex'), request = uuid(1050)
const receiptDoc = { title: 'Synthetic report', note: '', columns: ['Count'], rows: [['42']] }
const details = { status: 'running', ask_request_sha256: hash, assistant_recovery: {
  version: 1, respawnCount: 0, inFlight: true, inFlightKind: 'turn',
  execution: { catalogUserSession: true, callerSource: 'interactive', executionMode: 'direct', connectorIdHint: direct },
} }
const turn = (key = request, snapshot: unknown = details) => `INSERT INTO public.instance_logs
  (id,instance_id,site_id,user_id,agent_id,log_type,trusted_user_action,details) VALUES
  ('${key}','${instance}','${id.site}','${id.member}','${id.agent}','user_action',true,${jsonSql(snapshot)})`
const session = (user = id.member, anonymous = false) => `SET ROLE authenticated;
  SET request.jwt.claims='${JSON.stringify({ sub: user, role: 'authenticated', is_anonymous: anonymous })}';`
const verbose = '\\set VERBOSITY verbose\n'
const read = (receipt: string) => `SELECT public.read_connector_private_result('${receipt}')`
const list = 'SELECT id FROM public.list_connector_private_results()'
const accounts = (target = `'${direct}'`, slug = `'${tool}'`, agent = id.agent) => `public.connector_direct_accounts(
  '${id.site}','${id.member}','${instance}','${agent}',${target},${slug})`
const memberGrant = `INSERT INTO public.connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by)
  VALUES ('${id.site}','${direct}','${id.member}',true,true,'${id.owner}')`
const agentGrant = `INSERT INTO public.connector_agents(site_id,connector_id,agent_id,enabled,granted_by)
  VALUES ('${id.site}','${direct}','${id.agent}',true,'${id.owner}')`
const memberWhere = `WHERE (connector_id,user_id)=('${direct}','${id.member}')`
const agentWhere = `WHERE (connector_id,agent_id)=('${direct}','${id.agent}')`
const digest = () => randomBytes(32).toString('hex')

test('the canonical member-authority migration is identical in both application repositories', () => {
  for (const repo of ['API', 'market-fit']) expect(sqlSource(migration, repo)).toBe(ddl)
})
if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw new Error('Disposable PostgreSQL binaries required')

;(postgresAvailable ? describe : describe.skip)('private Instance member authority on socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => db(`${verbose}${gateway} ${sql}`)
  const user = (sql: string, actor = id.member, anon = false) => db(`${session(actor, anon)} ${sql}`)
  const count = (target?: string, slug?: string, agent?: string) => service(`SELECT jsonb_array_length(${accounts(target, slug, agent)})`)
  let epoch: string
  const binding = (req = request, agent = id.agent) => `'${id.site}','${id.member}','${instance}','${agent}','${direct}','${req}',
    '${tool}','v1','${hash}','${epoch}',1,1,3,'${revision}'`
  const claim = (fingerprint = digest(), args = binding()) => `SELECT public.claim_connector_direct_dispatch(${args},'${fingerprint}')`
  const store = (reserved: string, args = binding()) => `SELECT public.store_connector_direct_result(${args},'${reserved}',${jsonSql(receiptDoc)})`
  const legacyArgs = `'${id.site}','${id.member}','${instance}','${id.agent}','${direct}','${tool}',true,1,1,'${revision}'`
  const legacyReady = `SELECT public.connector_private_result_ready(${legacyArgs})`
  const legacyStore = `SELECT public.store_connector_private_result(${legacyArgs},'v1','${hash}',${jsonSql(receiptDoc)})`

  beforeAll(() => { pg.start(); db(createGateway) }, 30000)
  afterAll(pg.stop)
  function install(mode: 'explicit' | 'workspace' = 'workspace', shortProof?: string) {
    installProviderDirect(db, undefined, mode)
    installDirectReceipts(db)
    db(sqlSource('20261123030000_connector_ask_on_connect.sql'))
    db(`UPDATE public.remote_instances SET user_id='${id.member}' WHERE id='${instance}'`)
    epoch = shortProof ? db(issueSql().replace('1 day', shortProof)) : issueDirect(db)
    enableDirect(db)
  }

  // Observe the real lock wait, not just a sleep of guessed duration. Named
  // backends are only these fixture sessions in this isolated cluster.
  async function waitUntilBlocked(name: string) {
    for (let i = 0; i < 100; i++) {
      if (db(`SELECT EXISTS (SELECT FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock')`) === 't') return
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error(`Expected a lock wait in ${name}`)
  }

  it('retires old direct receipts, replays, outstanding claims and unreserved calls on old turns without changing policy or legacy reports', () => {
    install(); service(turn()); db(agentGrant)
    const oldDigest = digest(), stored = service(claim(oldDigest)), receipt = service(store(stored)), pending = service(claim())
    const legacy = service(legacyStore)
    expect(new Set(user(list).split('\n'))).toEqual(new Set([legacy, receipt]))
    // A formerly valid agent override expires with no connector, policy or direct revision change.
    db(`UPDATE connector_agents SET expires_at=now() ${agentWhere}`)
    expect(user(list)).toBe(''); expect(user(read(receipt))).toBe(''); expect(count()).toBe('0')
    expect(() => service(store(pending))).toThrow(/42501/)
    const manager = `SELECT public.connector_ask_policy_status('${id.site}','${id.admin}','${direct}')`
    const metadata = service(manager), physical = `SELECT count(*) FROM ${claims}; SELECT count(*) FROM connector_result_private.reports;`
    const file = `SELECT pg_relation_filenode('${journal}')` // constant missing-column value, not a journal rewrite
    const before = db(file)
    db(ddl)
    expect(db(file)).toBe(before); expect(service(manager)).toBe(metadata); expect(db(physical)).toBe('2\n2')
    expect(db(`SELECT member_authority FROM ${journal} WHERE action_id='${request}'`)).toBe('f')
    expect(count()).toBe('1'); expect(user(list)).toBe(''); expect(user(read(receipt))).toBe('')
    for (const sql of [store(stored), store(pending), claim()]) expect(() => service(sql)).toThrow(/42501/)
    // Restore the legacy agent permission: only the non-direct receipt follows its old rules.
    db(`UPDATE connector_agents SET expires_at=NULL ${agentWhere}`)
    expect(user(list)).toBe(legacy); expect(JSON.parse(user(read(legacy)))).toEqual(receiptDoc)
    expect(user(read(receipt))).toBe(''); expect(() => service(store(pending))).toThrow(/42501/)
    expect(() => service(turn())).toThrow(/23505/)
    const next = randomUUID(); service(turn(next))
    expect(db(`SELECT member_authority FROM ${journal} WHERE action_id='${next}'`)).toBe('t')
    const args = binding(next), fresh = service(claim(oldDigest, args)), result = service(store(fresh, args))
    expect(user(read(receipt))).toBe(''); expect(JSON.parse(user(read(result)))).toEqual(receiptDoc)
    expect(service(store(fresh, args))).toBe(result); expect(() => service(claim(oldDigest, args))).toThrow(/P0D03/)
  })

  it.each(['workspace', 'explicit'] as const)('%s: member grant alone admits discovery, exact dispatch, store and open; agent overrides never authorize or veto', mode => {
    install(mode); db(ddl); service(turn())
    expect(count()).toBe(mode === 'workspace' ? '1' : '0')
    if (mode === 'explicit') {
      db(agentGrant); expect(count()).toBe('0'); expect(() => service(claim())).toThrow(/42501/)
      db(`DELETE FROM connector_agents ${agentWhere}; ${memberGrant}`)
    }
    // Even on an explicit account, a member grant needs no separate agent row.
    expect(count()).toBe('1'); expect(count('NULL', 'NULL')).toBe('1')
    const noAgentReceipt = service(store(service(claim())))
    expect(JSON.parse(user(read(noAgentReceipt)))).toEqual(receiptDoc)
    db(agentGrant); expect(service(legacyReady)).toBe('t')
    for (const change of ['enabled=false', 'enabled=true,revoked_at=now()', "revoked_at=NULL,expires_at=now()-interval '1s'"]) {
      db(`UPDATE public.connector_agents SET ${change} ${agentWhere}`)
      expect(count()).toBe('1'); expect(count('NULL', 'NULL')).toBe('1')
      const data = JSON.parse(service(`SELECT ${accounts()}`))
      expect(data[0].policy.require_approval).toBe(true) // still a saved policy field, not a replacement grant
      const receipt = service(store(service(claim())))
      expect(user(list).split('\n')).toContain(receipt); expect(JSON.parse(user(read(receipt)))).toEqual(receiptDoc)
      expect(service(legacyReady)).toBe('f'); expect(() => service(legacyStore)).toThrow(/42501/)
    }
    // A valid agent grant cannot stand in for a denied, view-only, revoked or expired member.
    db(`UPDATE connector_agents SET enabled=true,revoked_at=NULL,expires_at=NULL ${agentWhere}`)
    if (mode === 'workspace') db(memberGrant)
    const pending = service(claim())
    for (const state of ['can_use=false,can_view=false', 'can_view=true,can_use=false', 'can_use=true,revoked_at=now()', 'revoked_at=NULL,expires_at=now()']) {
      db(`UPDATE public.connector_members SET ${state} ${memberWhere}`)
      expect(count()).toBe('0'); expect(count('NULL', 'NULL')).toBe('0'); expect(user(list)).toBe('')
      expect(user(read(noAgentReceipt))).toBe(''); expect(() => service(claim())).toThrow(/42501/)
      expect(() => service(store(pending))).toThrow(/42501/)
    }
    expect(db(`SELECT consumed_at IS NULL FROM ${claims} WHERE id='${pending}'`)).toBe('t')
  })

  it('requires the active same-site host pinned on a trusted private turn and the actual requester-visible parent', () => {
    install(); db(ddl); service(turn())
    const pending = service(claim()), receipt = service(store(service(claim())))
    for (const who of [id.owner, id.admin, id.foreign]) {
      expect(user(list, who)).toBe(''); expect(user(read(receipt), who)).toBe('')
    }
    expect(user(list, id.member, true)).toBe(''); expect(user(read(receipt), id.member, true)).toBe('')
    for (const agent of [id.otherAgent, id.inactiveAgent]) expect(count(undefined, undefined, agent)).toBe('0')
    const unpinned = randomUUID(); db(`INSERT INTO public.agents VALUES ('${unpinned}','${id.site}','active')`)
    expect(() => service(claim(digest(), binding(request, unpinned)))).toThrow(/42501/)
    expect(() => service(store(pending, binding(request, unpinned)))).toThrow(/P0D04/)
    expect(() => service(`UPDATE instance_logs SET agent_id='${unpinned}' WHERE id='${request}'`)).toThrow(/42501/)
    for (const change of [`UPDATE agents SET status='inactive' WHERE id='${id.agent}'`,
      `UPDATE remote_instances SET visible=false`, `UPDATE remote_instances SET user_id='${id.owner}'`,
      `UPDATE remote_instances SET is_archived=true`]) {
      expect(db(`BEGIN; ${change}; ${session()} SELECT (${read(receipt)}) IS NULL AND NOT EXISTS (${list}); ROLLBACK`)).toBe('t')
      for (const sql of [claim(), store(pending)]) expect(() => db(`${verbose}BEGIN; ${change}; SET LOCAL ROLE service_role; ${sql}`)).toThrow(/42501/)
    }
    for (const change of ["'{assistant_recovery,execution,callerSource}','\"background\"'", "'{assistant_recovery,execution,catalogUserSession}','false'",
      "'{assistant_recovery,inFlightKind}','\"plan\"'", "'{status}','\"cancelled\"'"]) {
      for (const sql of [claim(), store(pending)]) expect(() => service(`BEGIN; UPDATE instance_logs SET details=jsonb_set(details,${change}); ${sql}`)).toThrow(/42501/)
    }
    service(turn(randomUUID(), { status: 'running' }))
    expect(() => service(store(pending))).toThrow(/42501/); expect(() => service(claim())).toThrow(/42501/)
    expect(JSON.parse(user(read(receipt)))).toEqual(receiptDoc) // reads are not dispatches; completion doesn't revoke a result
  })

  it('does not leak the private Ask exception into Customer Support publication', () => {
    install('explicit'); db(ddl); db(memberGrant)
    // A second synthetic Gmail account has a saved publication. The Support
    // RPC still requires *its agent's* permission, independent of member access.
    service(`SELECT public.connector_update_policy('${id.site}','${id.connector}','${id.owner}',1,
      '{}',ARRAY['assistant'],true,true,'all','{"audience":"verified","label_id":"Label_123"}')`)
    db(`UPDATE connectors SET granted_scopes=ARRAY['https://www.googleapis.com/auth/gmail.readonly'] WHERE id='${id.connector}';
      ${memberGrant.replace(direct, id.connector)}`)
    const support = `SELECT connector_id FROM public.connector_support_publication_page('${id.site}','${id.agent}','verified',NULL,'${id.connector}')`
    expect(count()).toBe('1'); expect(service(support)).toBe('')
    db(agentGrant.replace(direct, id.connector)); expect(service(support)).toBe(id.connector)
    db(`UPDATE connector_agents SET expires_at=now() WHERE connector_id='${id.connector}'`)
    expect(service(support)).toBe(''); expect(count()).toBe('1')
  })

  it('retains site, location, screen, saved host/tool, enrollment, credential and revision gates', () => {
    install(); db(ddl); service(turn()); const pending = service(claim()), receipt = service(store(service(claim())))
    for (const change of [
      `UPDATE site_members SET manually_disabled=true WHERE user_id='${id.member}'`,
      `UPDATE site_members SET license_suspended=true WHERE user_id='${id.member}'`,
      `UPDATE site_members SET restrict_to_assigned_only=true WHERE user_id='${id.member}'`,
      ...['people','aiWorkspace','connectors'].map(screen => `UPDATE site_members SET blocked_screens=ARRAY['${screen}'] WHERE user_id='${id.member}'`),
      `INSERT INTO site_member_location_restrictions VALUES ('${id.site}','${memberRow(id.member)}','${uuid(1088)}')`,
      `UPDATE sites SET archived_at=now() WHERE id='${id.site}'`,
      `UPDATE connector_policies SET tool_access_mode='selected', allowed_tools=ARRAY['CRM_OTHER'] WHERE connector_id='${direct}'`,
      `UPDATE connector_policies SET allowed_hosts='{direct}' WHERE connector_id='${direct}'`,
      `UPDATE site_secrets SET is_active=false`, `DELETE FROM connector_result_private.provider_attestations`,
      `UPDATE ${proofTable} SET revoked_at=now()`, `DELETE FROM connector_result_private.direct_enrollments`,
      `UPDATE connectors SET enabled=false WHERE id='${direct}'`,
    ]) {
      const begin = `BEGIN; ${change};`
      expect(db(`${begin} SET ROLE service_role; SELECT jsonb_array_length(${accounts()}); ROLLBACK`)).toBe('0')
      expect(db(`${begin} ${session()} SELECT (${read(receipt)}) IS NULL AND NOT EXISTS (${list}); ROLLBACK`)).toBe('t')
      expect(() => db(`${verbose}${begin} SET ROLE service_role; ${store(pending)}`)).toThrow(/42501/)
    }
    // Ordinary account edits still advance the existing security revision, including edits to agent shares.
    const edit = `SELECT public.connector_update_access('${id.site}','${direct}','${id.owner}',1,'[]',
      ${jsonSql([{ agent_id: id.agent, enabled: false }])})`
    service(edit); expect(count()).toBe('1'); expect(() => service(store(pending))).toThrow(/42501/)
    expect(user(read(receipt))).toBe(''); expect(user(list)).toBe('')
  })

  it.each(['agent','member','proof'] as const)('only member and proof expiry matter after a real reservation lock wait (%s expires)', async kind => {
    install('workspace', kind === 'proof' ? '2 seconds' : undefined); db(ddl); service(turn()); db(`${memberGrant}; ${agentGrant}`)
    // Use the actual post-start cutoff; the statement_timestamp() admission
    // would still pass on its own. Do not hold a lock across an external call.
    const target = kind === 'proof' ? proofTable : `public.connector_${kind}s`
    if (kind !== 'proof') db(`UPDATE ${target} SET expires_at=clock_timestamp()+interval '1.4 seconds' WHERE connector_id='${direct}'`)
    const expires = `SELECT expires_at FROM ${target} WHERE connector_id='${direct}'`
    const holder = pg.concurrent(`BEGIN; SELECT id FROM public.connectors WHERE id='${direct}' FOR UPDATE;
      SELECT pg_advisory_xact_lock(1033001); SELECT pg_sleep(greatest(0,extract(epoch FROM ((${expires})-clock_timestamp())))+0.12); COMMIT;`)
    try {
      for (let i = 0; i < 50 && db('SELECT pg_try_advisory_lock(1033001)') === 't'; i++) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      const result = Promise.allSettled([pg.concurrent(`${verbose}${gateway} SET application_name='member-expiry-claim'; ${claim()}`)])
      await waitUntilBlocked('member-expiry-claim')
      expect(db(`SELECT (${expires})>clock_timestamp()`)).toBe('t')
      const [outcome] = await result
      if (kind === 'agent') {
        expect(outcome.status).toBe('fulfilled')
        if (outcome.status === 'fulfilled') expect(JSON.parse(user(read(service(store(outcome.value)))))).toEqual(receiptDoc)
      } else {
        expect(outcome.status).toBe('rejected')
        if (outcome.status === 'rejected') expect(String(outcome.reason)).toContain('42501')
      }
    } finally { await holder }
    expect(db(`SELECT (${expires})<=clock_timestamp()`)).toBe('t')
    expect(db(`SELECT count(*) FROM ${claims}`)).toBe(kind === 'agent' ? '1' : '0')
  }, 15000)

  it('serializes cutover with the old submission writer without promoting its action or preventing fresh writes', async () => {
    install()
    const old = pg.concurrent(`${gateway} BEGIN; ${turn()}; SELECT pg_advisory_xact_lock(1033002); SELECT pg_sleep(1); COMMIT;`)
    try {
      for (let i = 0; i < 50 && db('SELECT pg_try_advisory_lock(1033002)') === 't'; i++) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      const cutover = pg.concurrent(`SET application_name='member-authority-cutover'; ${ddl}`)
      await waitUntilBlocked('member-authority-cutover'); await cutover
    } finally { await old }
    expect(db(`SELECT member_authority FROM ${journal} WHERE action_id='${request}'`)).toBe('f')
    expect(() => service(claim())).toThrow(/42501/)
    const next = randomUUID(); service(turn(next))
    expect(db(`SELECT member_authority FROM ${journal} WHERE action_id='${next}'`)).toBe('t')
    expect(service(claim(digest(), binding(next)))).toMatch(/^[0-9a-f-]{36}$/)
  }, 15000)

  it('keeps the new generation and all internal admission helpers inaccessible to application roles', () => {
    install(); db(ddl); service(turn())
    for (const role of ['authenticated','anon','service_role','connector_result_reader']) {
      for (const helper of ['direct_admissions(uuid,uuid,uuid,uuid,uuid,text)',
        'direct_claim_admitted(connector_result_private.direct_claims)', 'check_direct_authority(connector_result_private.direct_claims)']) {
        expect(db(`SELECT has_function_privilege('${role}','connector_result_private.${helper}','EXECUTE')`)).toBe('f')
      }
      expect(db(`SELECT has_table_privilege('${role}','${journal}','SELECT,UPDATE,INSERT,DELETE,TRUNCATE') OR
        has_column_privilege('${role}','${journal}','member_authority','SELECT,UPDATE,INSERT')`)).toBe('f')
      expect(() => db(`${verbose}SET ROLE ${role}; UPDATE ${journal} SET member_authority=true`)).toThrow(/42501/)
      if (role !== 'service_role') {
        expect(() => db(`${verbose}SET ROLE ${role}; SELECT ${accounts()}`)).toThrow(/42501/)
        expect(() => db(`${verbose}SET ROLE ${role}; ${claim()}`)).toThrow(/42501/)
      }
    }
  })
})