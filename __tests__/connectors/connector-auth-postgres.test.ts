/** @jest-environment node */
import { actorSql, isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { accessSql, finalizeSql, id, insertAttempt, installConnectorFixture, sqlSource,
  workspaceAccessMigration } from './connector-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
suite('connector OAuth binding in disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installConnectorFixture(db))

  it.each([
    ['gmail', '{GMAIL_FETCH_EMAILS}|{assistant}|f'],
    ['hubspot', '{HUBSPOT_LIST_CONTACTS}|{assistant}|f'],
    ['slack', '{}|{assistant}|t'],
    ['supabase', '{}|{assistant}|t'],
  ])('finalizes %s with all compatible tools, assistant host and unchanged approval default', (toolkit, policy) => {
    insertAttempt(db, 'completing', 'new-account', toolkit)
    const connector = JSON.parse(service(finalizeSql({ toolkit })))
    expect(connector.enabled).toBe(true)
    expect(connector.access_mode).toBe('workspace')
    expect(connector.verified_at).toBeTruthy()
    expect(connector.provider_project_id).toBe('project-a')
    expect(connector.provider_account_id).toBe('new-account')
    expect(connector.provider_status).toBe('ACTIVE')
    expect(connector.revision).toBe(1)
    expect(db('SELECT count(*) FROM connector_members')).toBe('0')
    expect(db('SELECT count(*) FROM connector_agents')).toBe('0')
    expect(db('SELECT tool_access_mode FROM connector_policies')).toBe('all')
    expect(db('SELECT allowed_tools,allowed_hosts,require_approval FROM connector_policies')).toBe(policy)
    expect(db('SELECT status FROM site_connector_auth_attempts')).toBe('completed')
    service(`UPDATE connectors SET revocation_pending=true WHERE id='${connector.id}'`)
    const replay = JSON.parse(service(finalizeSql({ toolkit })))
    expect(replay.id).toBe(connector.id)
    expect(replay.revocation_pending).toBe(true)
    expect(replay.enabled).toBe(false)
    expect(db('SELECT allowed_tools,allowed_hosts,require_approval FROM connector_policies')).toBe(policy)
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('1')
  })

  it('keeps existing state, grants and policy intact across migration and completed-attempt replay', () => {
    installConnectorFixture(db, workspaceAccessMigration)
    insertAttempt(db)
    const old = JSON.parse(service(finalizeSql()))
    service(accessSql([{ user_id: id.member, can_view: true, can_use: false }],
      [{ agent_id: id.agent, enabled: false }], 1, id.owner, old.id))
    service(`SELECT public.connector_update_policy('${id.site}','${old.id}','${id.owner}',2,
      ARRAY['GMAIL_FETCH_EMAILS'],ARRAY['assistant'],true,true)`)
    const snapshot = () => db(`SELECT jsonb_build_array(
      (SELECT jsonb_agg(to_jsonb(c) - 'access_mode' ORDER BY c.id) FROM connectors c),
      (SELECT jsonb_agg(to_jsonb(m)) FROM connector_members m),
      (SELECT jsonb_agg(to_jsonb(a)) FROM connector_agents a),
      (SELECT jsonb_agg(to_jsonb(p)) FROM connector_policies p),
      (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.revision) FROM connector_audit_events e))`)
    const prior = snapshot()

    db(sqlSource(workspaceAccessMigration))
    expect(db("SELECT DISTINCT access_mode FROM connectors")).toBe('explicit')
    const replay = JSON.parse(service(finalizeSql()))
    expect(replay).toMatchObject({ id: old.id, enabled: true, access_mode: 'explicit', revision: 3 })
    expect(db(`SELECT enabled FROM connectors WHERE id='${id.connector}'`)).toBe('f')
    expect(snapshot()).toBe(prior)
    expect(() => service(`UPDATE connectors SET access_mode='workspace' WHERE id='${old.id}'`))
      .toThrow('access mode is immutable')
  })

  it('serializes duplicate callbacks without creating duplicate accounts or audit events', async () => {
    insertAttempt(db)
    const responses = await Promise.all([
      pg.concurrent(actorSql(finalizeSql(), id.owner, 'service_role')),
      pg.concurrent(actorSql(finalizeSql(), id.owner, 'service_role')),
    ])
    expect(JSON.parse(responses[0]).id).toBe(JSON.parse(responses[1]).id)
    expect(db("SELECT count(*) FROM connectors WHERE provider_account_id='new-account'")).toBe('1')
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('1')
  })

  it.each([
    { actor: id.member }, { actor: id.foreign }, { nonce: 'b'.repeat(64) },
    { account: 'wrong-account' }, { toolkit: 'slack' }, { config: 'wrong-config' },
  ])('rejects mismatched completion binding %#', override => {
    insertAttempt(db)
    expect(() => service(finalizeSql(override))).toThrow('auth attempt denied')
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('0')
  })

  it.each(['pending', 'failed', 'expired', 'outcome_unknown'])('rejects unclaimed/terminal attempt %s', status => {
    insertAttempt(db, status)
    expect(() => service(finalizeSql())).toThrow('not claimed')
  })

  it('refuses completion after credential rotation and leaves the attempt uncompleted', () => {
    insertAttempt(db)
    service(`UPDATE site_connector_providers SET credential_revision='rev-2' WHERE id='${id.provider}'`)
    expect(() => service(finalizeSql())).toThrow('credentials changed')
    expect(db('SELECT status FROM site_connector_auth_attempts')).toBe('completing')
  })

  it('rejects elapsed attempts and browser invocation', () => {
    db(`INSERT INTO site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,auth_config_id,
      provider_account_id,nonce_hash,credential_revision,status,expires_at) VALUES
      ('${id.attempt}','${id.site}','${id.provider}','${id.owner}','gmail','auth-config','new-account',
      '${'a'.repeat(64)}','rev-1','completing',now()-interval '1 second')`)
    expect(() => service(finalizeSql())).toThrow('auth attempt denied')
    expect(() => pg.call(finalizeSql(), id.owner)).toThrow('permission denied')
  })

  it('prevents duplicate project/account adoption across different sites and provider rows', () => {
    insertAttempt(db, 'completing', 'account-b')
    expect(() => service(finalizeSql({ account: 'account-b' }))).toThrow('unique constraint')
    expect(db('SELECT count(*) FROM connectors')).toBe('3')
    expect(db('SELECT status FROM site_connector_auth_attempts')).toBe('completing')
    expect(db('SELECT count(*) FROM connector_policies')).toBe('0')
  })

  it('requires same-site attempt provider and linked connector with exact toolkit/config/account', () => {
    insertAttempt(db)
    expect(() => service(`UPDATE site_connector_auth_attempts SET provider_id='${id.otherProvider}'`)).toThrow('immutable')
    expect(() => service(`UPDATE site_connector_auth_attempts SET status='completed',connector_id='${id.foreignConnector}'`))
      .toThrow('foreign key constraint')
    expect(() => service(`UPDATE site_connector_auth_attempts SET status='completed',connector_id='${id.connector}'`))
      .toThrow('foreign key constraint')
    expect(() => service(`UPDATE site_connector_auth_attempts SET expires_at=now()+interval '1 hour'`)).toThrow('immutable')
  })

  it('never permits terminal attempts to be revived for another provider request', () => {
    insertAttempt(db, 'pending')
    service("UPDATE site_connector_auth_attempts SET status='outcome_unknown'")
    expect(() => service("UPDATE site_connector_auth_attempts SET status='pending'")).toThrow('auth transition')
  })

  it('permits only expiry shortening when the initial provider account is attached', () => {
    db(`INSERT INTO site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,auth_config_id,
      nonce_hash,credential_revision,status,expires_at) VALUES
      ('${id.attempt}','${id.site}','${id.provider}','${id.owner}','gmail','auth-config',
      '${'a'.repeat(64)}','rev-1','pending',now()+interval '10 minutes')`)
    service(`UPDATE site_connector_auth_attempts SET provider_account_id='new-account',expires_at=now()+interval '5 minutes' WHERE id='${id.attempt}'`)
    expect(db(`SELECT provider_account_id FROM site_connector_auth_attempts WHERE id='${id.attempt}'`)).toBe('new-account')
    expect(() => service(`UPDATE site_connector_auth_attempts SET expires_at=now()+interval '9 minutes'`)).toThrow('immutable')
  })
})