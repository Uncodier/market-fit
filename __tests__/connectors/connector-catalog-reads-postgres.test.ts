/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { finalizeSql, id, insertAttempt, installConnectorFixture, policySql, sqlSource } from './connector-postgres-fixture'

const migration = '20261120235000_connector_catalog_reads.sql'
const actorRpc = (user: string, instance: string, agent = id.agent, site = id.site) =>
  `SELECT public.connector_catalog_read_actor('${site}','${user}','${instance}','${agent}')`
const optOut = (rev: number, actor = id.admin, connector = id.connector) =>
  `SELECT public.connector_disable_catalog_reads('${id.site}','${connector}','${actor}',${rev})`
const save = (rev: number, flag: string, actor = id.admin, connector = id.connector,
  enabled = 'true', mode = 'all', hosts = "ARRAY['assistant']") =>
  `SELECT public.connector_update_policy('${id.site}','${connector}','${actor}',${rev},
    ARRAY['GMAIL_GET_LABEL'],${hosts},true,${enabled},'${mode}',NULL${flag ? `,${flag}` : ''})`

;(postgresAvailable ? describe : describe.skip)('instance catalogue opt-in on socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db, service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  const value = (connector = id.connector) => db(`SELECT catalog_reads FROM connector_policies WHERE connector_id='${connector}'`)
  const migrate = () => db(sqlSource(migration))
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installConnectorFixture(db); db(sqlSource('20261120050000_connector_support_publication.sql'))
    db(`CREATE TABLE remote_instances(id uuid PRIMARY KEY, site_id uuid, user_id uuid, is_archived boolean NOT NULL DEFAULT false);
      GRANT SELECT ON remote_instances TO service_role;
      ALTER TABLE site_members ADD COLUMN restrict_to_assigned_only boolean DEFAULT false`)
  })

  it('does not expand prior all/selected policies, revisits or new OAuth accounts', () => {
    service(save(1, '', id.owner, id.connector, 'true', 'selected')); service(save(1, '', id.admin, id.hidden))
    const before = db(`SELECT jsonb_agg(to_jsonb(p) ORDER BY connector_id) FROM connector_policies p`)
    migrate()
    expect(db(`SELECT jsonb_agg(to_jsonb(p)-'catalog_reads' ORDER BY connector_id) FROM connector_policies p`)).toBe(before)
    expect([value(), value(id.hidden)]).toEqual(['f', 'f'])
    insertAttempt(db); const account = JSON.parse(service(finalizeSql())).id
    expect(value(account)).toBe('f')
    service(save(1, 'true', id.admin, account)); expect(JSON.parse(service(finalizeSql())).id).toBe(account)
    expect(value(account)).toBe('t'); expect(value()).toBe('f')
  })

  it('writes once at the expected revision, keeps legacy calls unambiguous, and preserves opt-in on unrelated saves', () => {
    migrate(); service(policySql()); expect(value()).toBe('f')
    expect(JSON.parse(service(save(2, 'true')))).toMatchObject({ revision: 3, policy_revision: 2 })
    expect(value()).toBe('t'); expect(() => service(save(2, 'false'))).toThrow(/revision conflict/)
    service(save(3, '')); service(policySql(4)); expect(value()).toBe('t') // 10- and 8-argument legacy clients
    service(optOut(5)); expect(value()).toBe('f'); expect(() => service(save(5, 'true'))).toThrow(/revision conflict/)
    expect(db(`SELECT count(*) FROM connector_audit_events WHERE event_type='policy_updated'`)).toBe('5')
    expect(db('SELECT revision FROM connector_policies')).toBe('5')
  })

  it('rolls back the entire save when the new permission is invalid; can always narrow disabled accounts', () => {
    migrate()
    for (const sql of [save(1, 'NULL'), save(1, 'true', id.owner, id.connector, 'false'),
      save(1, 'true', id.owner, id.connector, 'true', 'all', "ARRAY['direct']")]) expect(() => service(sql)).toThrow()
    db(`UPDATE connectors SET revocation_pending=true WHERE id='${id.connector}'`)
    expect(() => service(save(1, 'true'))).toThrow(/not ready/)
    db(`UPDATE connectors SET revocation_pending=false,revocation_dispatched=true WHERE id='${id.connector}'`)
    expect(() => service(save(1, 'true'))).toThrow(/not ready/)
    expect(db('SELECT count(*) FROM connector_policies')).toBe('0')
    expect(db('SELECT count(*) FROM connector_audit_events')).toBe('0')
    db(`INSERT INTO connector_policies(site_id,connector_id,catalog_reads) VALUES ('${id.site}','${id.connector}',true)`)
    expect(JSON.parse(service(optOut(1)))).toMatchObject({ revision: 2 }); expect(value()).toBe('f')
  })

  it('rejects every other policy change in a full opt-out; delisted IDs and an inactive provider do not block local revocation', () => {
    migrate()
    const publication = `'{"audience":"verified","label_id":"Label_12"}'::jsonb`
    const full = (rev: number, flag: string) => save(rev, flag, id.admin, id.connector, 'true', 'selected').replace('NULL,', `${publication},`)
    service(full(1, 'true'))
    const snapshot = () => db(`SELECT to_jsonb(p)-ARRAY['catalog_reads','revision','updated_at'] FROM connector_policies p`)
    const original = snapshot(), sql = full(2, 'false')
    db(`UPDATE site_connector_providers SET status='disabled' WHERE id='${id.provider}'`)
    for (const edited of [sql.replace('GMAIL_GET_LABEL', 'UNVALIDATED_ID'), sql.replace("'selected'", "'all'"),
      sql.replace("ARRAY['assistant']", "ARRAY['assistant','direct']"), sql.replace('true,true,', 'false,true,'),
      sql.replace('true,true,', 'true,false,'), sql.replace('verified', 'anonymous'), sql.replace(publication, 'NULL')]) {
      expect(() => service(edited)).toThrow(/Save catalog opt-out separately/)
    }
    expect(value()).toBe('t'); expect(db('SELECT count(*) FROM connector_audit_events')).toBe('1')
    expect(JSON.parse(service(sql))).toMatchObject({ revision: 3, policy_revision: 2 }); expect(value()).toBe('f')
    expect(snapshot()).toBe(original); expect(() => service(optOut(2))).toThrow(/revision conflict/)
    expect(db(`SELECT enabled FROM connectors WHERE id='${id.connector}'`)).toBe('t')
  })

  it('requires same-site manager and service role; read policy and no direct writes remain intact', () => {
    migrate(); const sql = save(1, 'true')
    for (const role of ['anon', 'authenticated']) for (const operation of [sql, optOut(1)]) expect(() => pg.call(operation, id.owner, role)).toThrow(/permission denied/)
    for (const role of ['authenticated', 'service_role']) expect(() => pg.call('UPDATE connector_policies SET catalog_reads=true', id.owner, role)).toThrow(/permission denied/)
    expect(() => service(save(1, 'true', id.member))).toThrow(/management denied/)
    expect(() => service(save(1, 'true', id.admin, id.foreignConnector))).toThrow(/management denied/)
    expect(() => service(optOut(1, id.member))).toThrow(/management denied/)
    expect(() => service(optOut(1, id.owner, id.foreignConnector))).toThrow(/management denied/)
    service(sql); const read = 'SELECT catalog_reads FROM connector_policies'
    expect(pg.call(read, id.admin)).toBe('t'); expect(pg.call(read, id.member)).toBe(''); expect(pg.call(read, id.foreign)).toBe('')
  })

  it('requires an owned instance, live prompt agent, active site and unscoped actor; the predicate is not browser-callable', () => {
    migrate(); const instance = uuid(301), owned = actorRpc(id.member, instance)
    db(`INSERT INTO remote_instances VALUES ('${instance}','${id.site}','${id.member}')`)
    expect(service(owned)).toBe('t')
    db(`UPDATE remote_instances SET is_archived=true WHERE id='${instance}'`); expect(service(owned)).toBe('f')
    db(`UPDATE remote_instances SET is_archived=false WHERE id='${instance}'`); expect(service(owned)).toBe('t')
    for (const role of ['anon', 'authenticated']) expect(() => pg.call(owned, id.member, role)).toThrow(/permission denied/)
    for (const wrong of [actorRpc(id.owner, instance), actorRpc(id.member, uuid(302)), actorRpc(id.member, instance, id.otherAgent),
      actorRpc(id.member, instance, id.inactiveAgent), actorRpc(id.member, instance, id.agent, id.otherSite)]) expect(service(wrong)).toBe('f')
    for (const restriction of ['true', 'NULL']) {
      db(`UPDATE site_members SET restrict_to_assigned_only=${restriction} WHERE user_id='${id.member}'`); expect(service(owned)).toBe('f')
    }
    db(`UPDATE site_members SET restrict_to_assigned_only=false, blocked_screens=ARRAY['leads'] WHERE user_id='${id.member}'`); expect(service(owned)).toBe('f')
    db(`UPDATE remote_instances SET user_id='${id.restricted}'`); expect(service(actorRpc(id.restricted, instance))).toBe('f')
    for (const owner of [id.owner, id.coowner]) {
      db(`UPDATE remote_instances SET user_id='${owner}'`); expect(service(actorRpc(owner, instance))).toBe('t')
    }
    db(`UPDATE sites SET archived_at=now() WHERE id='${id.site}'`); expect(service(actorRpc(id.coowner, instance))).toBe('f')
  })
})

test('catalogue permission migration matches the canonical schema and both mirrors', () => {
  for (const repo of ['market-fit', 'API']) expect(sqlSource(migration, repo)).toBe(sqlSource(migration, 'makinari-db-scheme'))
})