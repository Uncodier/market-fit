/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { connector, installAnalytics, project, tool } from './connector-analytics-fixture'

const migration = '20261121024000_connector_external_analytics_registry.sql'
const table = 'connector_result_private.external_analytics_datasets'
const rpc = 'public.connector_external_analytics_dataset'
const otherProject = 'b'.repeat(20)
const source = (name: string) => ({ name, schema: 'makinari_facts_test', table: name,
  siteColumn: 'workspace', columns: [{ name: 'units', column: 'units', type: 'integer' }] })
const insert = (site: string, ref: string, sources: unknown) =>
  `INSERT INTO ${table}(site_id,project_ref,sources) VALUES ('${site}','${ref}',${jsonSql(sources)})`
const lookup = (site = id.site, account = connector, ref = project, revision = 1) =>
  `SELECT ${rpc}('${site}','${account}','${ref}',${revision})`

test('both application migration mirrors are byte-identical to the canonical registry migration', () => {
  for (const repo of ['API', 'market-fit']) expect(sqlSource(migration, repo)).toBe(sqlSource(migration, 'makinari-db-scheme'))
})

;(postgresAvailable ? describe : describe.skip)('external analytics registry in disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (q: string) => pg.call(q, id.owner, 'service_role')
  beforeAll(() => { pg.start(); db('CREATE ROLE supabase_read_only_user BYPASSRLS; GRANT pg_read_all_data TO supabase_read_only_user;') }, 30000)
  afterAll(pg.stop)
  beforeEach(() => {
    installAnalytics(db)
    // Simulate broad Supabase default grants; the migration must revoke them atomically.
    db(`ALTER DEFAULT PRIVILEGES IN SCHEMA connector_result_private GRANT ALL ON TABLES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`)
    db(sqlSource(migration, 'makinari-db-scheme'))
  }, 30000)

  it('finds only the exact site/project pair for each current account; deleting or replacing the row takes effect on the next read', () => {
    const addAccount = (account: string, site: string, owner: string, provider: string, ref: string) => db(`
      INSERT INTO public.connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,display_name,
        provider_status,created_by,verified_at,enabled,supabase_project_ref) VALUES
        ('${account}','${site}','${provider}','supabase','${account}','test-config','Test account','ACTIVE','${owner}',now(),true,'${ref}');
      INSERT INTO public.connector_policies(site_id,connector_id,allowed_tools,allowed_hosts,catalog_reads)
        VALUES ('${site}','${account}',ARRAY['${tool}'],ARRAY['assistant'],true)`)
    const foreignAccount = uuid(850), otherAccount = uuid(851), secondAccount = uuid(852)
    addAccount(foreignAccount, id.otherSite, id.foreign, id.otherProvider, project)
    addAccount(otherAccount, id.site, id.owner, id.provider, otherProject)
    addAccount(secondAccount, id.site, id.owner, id.provider, project)

    const missing = { siteId: id.site, projectRef: project, missing: true }
    expect(JSON.parse(service(lookup()))).toEqual(missing)
    db(insert(id.otherSite, project, [source('other_workspace')]))
    db(insert(id.site, otherProject, [source('other_project')]))
    expect(JSON.parse(service(lookup()))).toEqual(missing)
    expect(JSON.parse(service(lookup(id.otherSite, foreignAccount)))).toEqual({
      siteId: id.otherSite, projectRef: project, sources: [source('other_workspace')],
    })
    expect(JSON.parse(service(lookup(id.site, otherAccount, otherProject)))).toEqual({
      siteId: id.site, projectRef: otherProject, sources: [source('other_project')],
    })
    db(insert(id.site, project, [source('bookings')]))
    const mapped = { siteId: id.site, projectRef: project, sources: [source('bookings')] }
    expect(JSON.parse(service(lookup()))).toEqual(mapped)
    expect(JSON.parse(service(lookup(id.site, secondAccount)))).toEqual(mapped)
    for (const bad of [lookup(id.otherSite), lookup(id.site, foreignAccount), lookup(id.site, connector, otherProject),
      lookup(id.site, connector, project, 2), lookup(id.site, id.connector)]) {
      expect(() => service(bad)).toThrow(/no longer authorized/)
    }
    const key = `WHERE site_id='${id.site}' AND project_ref='${project}'`
    db(`UPDATE ${table} SET sources=${jsonSql([source('revised')])} ${key}`)
    expect(JSON.parse(service(lookup()))).toEqual({ ...mapped, sources: [source('revised')] })
    db(`DELETE FROM ${table} ${key}`)
    expect(JSON.parse(service(lookup()))).toEqual(missing)
  })

  it('refuses stale or disabled connector, provider and catalog policy snapshots rather than reporting an absent mapping', () => {
    db(insert(id.site, project, [source('bookings')]))
    const change = (set: string) => `UPDATE public.connectors SET ${set} WHERE id='${connector}'`
    const policy = (set: string) => `UPDATE public.connector_policies SET ${set} WHERE connector_id='${connector}'`
    for (const update of [change('enabled=false'), change('enabled=false,verified_at=NULL'), change("enabled=false,provider_status='REVOKED'"),
      change('enabled=false,revocation_pending=true'), change('revocation_dispatched=true'), change('revision=2'),
      `UPDATE public.site_connector_providers SET status='disabled' WHERE id='${id.provider}'`, policy('catalog_reads=false'),
      policy("allowed_hosts=ARRAY['direct']"), policy("allowed_tools='{}',tool_access_mode='selected'")]) {
      expect(() => db(`BEGIN; ${update}; SET ROLE service_role; ${lookup()}; ROLLBACK;`)).toThrow(/no longer authorized/)
    }
  })

  it('requires a real site, canonical project ref, bounded sources and one row per pair', () => {
    for (const invalid of [insert(uuid(899), project, [{}]), insert(id.site, '*', [{}]), insert(id.site, project+'\n', [{}]),
      insert(id.site, project, []), insert(id.site, project, {}), insert(id.site, project, Array(9).fill({})),
      insert(id.site, project, ['a'.repeat(65536)])]) expect(() => db(invalid)).toThrow()
    const valid = insert(id.site, project, [source('bookings')]); db(valid)
    expect(() => db(valid)).toThrow(/duplicate key/)
    expect(db(`SELECT relrowsecurity FROM pg_class WHERE oid='${table}'::regclass`)).toBe('t')
    expect(db(`SELECT count(*) FROM pg_policy WHERE polrelid='${table}'::regclass`)).toBe('0')
  })

  it('adds no direct table privileges for clients/service and no lookup or mutation ability to the provider read role', () => {
    db(insert(id.site, project, [source('bookings')]))
    for (const role of ['anon', 'authenticated', 'connector_result_reader', 'service_role', 'supabase_read_only_user']) {
      const run = (q: string) => db(`SET ROLE ${role}; ${q}`)
      if (role !== 'service_role') expect(() => run(lookup())).toThrow(/permission denied/)
      if (role !== 'supabase_read_only_user') {
        expect(() => run(`SELECT sources FROM ${table}`)).toThrow(/permission denied/)
        expect(db(`SELECT has_table_privilege('${role}','${table}','SELECT')`)).toBe('f')
      }
      for (const q of [insert(id.otherSite, project, [source('foreign')]), `UPDATE ${table} SET sources='[]'`, `DELETE FROM ${table}`]) {
        expect(() => run(q)).toThrow(/permission denied/)
      }
    }
    // The hosted management role may ALREADY have pg_read_all_data + BYPASSRLS out of band.
    // This feature neither changes that global role nor exposes arbitrary SQL to the application connector.
    expect(db(`SET ROLE supabase_read_only_user; SELECT count(*) FROM ${table}`)).toBe('1')
  })
})