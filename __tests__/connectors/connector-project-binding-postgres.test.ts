/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { finalizeSql, id, insertAttempt, installConnectorFixture, sqlSource } from './connector-postgres-fixture'

const migration = '20261120040000_connector_supabase_project_binding.sql'
const project = 'a'.repeat(20)
const suite = postgresAvailable ? describe : describe.skip
suite('Supabase account project binding', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installConnectorFixture(db))

  it('never derives a binding from a legacy account label or a repeated callback', () => {
    insertAttempt(db, 'completing', 'new-account', 'supabase')
    const finalize = finalizeSql({ toolkit: 'supabase' }).replace('Synthetic account', `Supabase · ${project}`)
    const old = JSON.parse(service(finalize))
    db(sqlSource(migration))
    expect(JSON.parse(service(finalize))).toMatchObject({ id: old.id, revision: old.revision, supabase_project_ref: null })
    expect(() => service(`UPDATE connectors SET supabase_project_ref='${project}' WHERE id='${old.id}'`)).toThrow(/immutable/)
    const bind = (actor: string, revision: number, credential = 'rev-1') => `SELECT public.connector_bind_supabase_project('${id.site}','${old.id}','${actor}',${revision},'${project}','${credential}')`
    expect(() => pg.call(bind(id.owner, old.revision), id.owner)).toThrow(/permission denied/)
    expect(() => service(bind(id.member, old.revision))).toThrow(/denied/)
    expect(() => service(bind(id.owner, old.revision, 'stale'))).toThrow(/cannot be bound/)
    expect(JSON.parse(service(bind(id.owner, old.revision)))).toEqual({ connector_id: old.id, revision: old.revision + 1 })
    expect(() => service(bind(id.owner, old.revision + 1))).toThrow(/cannot be bound/)
    expect(db(`SELECT supabase_project_ref FROM connectors WHERE id='${old.id}'`)).toBe(project)
  })

  it('copies only the immutable attempt binding into the new verified account', () => {
    db(sqlSource(migration))
    service(`INSERT INTO public.site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,auth_config_id,
      provider_account_id,nonce_hash,credential_revision,status,expires_at,supabase_project_ref) VALUES
      ('${id.attempt}','${id.site}','${id.provider}','${id.owner}','supabase','auth-config','new-account',
      '${'a'.repeat(64)}','rev-1','completing',now()+interval '5 minutes','${project}')`)
    expect(() => service(`UPDATE site_connector_auth_attempts SET supabase_project_ref=NULL WHERE id='${id.attempt}'`)).toThrow(/immutable/)
    const account = JSON.parse(service(finalizeSql({ toolkit: 'supabase' })))
    expect(account.supabase_project_ref).toBe(project)
    expect(() => service(`UPDATE connectors SET supabase_project_ref=NULL WHERE id='${account.id}'`)).toThrow(/immutable/)
    expect(db("SELECT has_column_privilege('authenticated', 'public.connectors','supabase_project_ref','SELECT')")).toBe('f')
  })
})

test('canonical, API and web migrations remain identical', () => {
  for (const repo of ['API', 'makinari-db-scheme']) expect(sqlSource(migration, repo)).toBe(sqlSource(migration))
})