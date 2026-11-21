/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { finalizeSql, id, insertAttempt, installConnectorFixture, policySql, sqlSource } from './connector-postgres-fixture'

const migration = '20261121012000_connector_creation_catalog_reads.sql'
const project = 'a'.repeat(20)

;(postgresAvailable ? describe : describe.skip)('catalog reads at verified connector creation', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  const migrate = () => db(sqlSource(migration))
  const policy = (connector: string) => JSON.parse(db(`SELECT to_jsonb(p) FROM public.connector_policies p WHERE connector_id='${connector}'`))
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installConnectorFixture(db)
    db(sqlSource('20261120040000_connector_supabase_project_binding.sql'))
    db(sqlSource('20261120050000_connector_support_publication.sql'))
    db(`CREATE TABLE remote_instances(id uuid PRIMARY KEY, site_id uuid, user_id uuid, is_archived boolean DEFAULT false);
      ALTER TABLE site_members ADD COLUMN restrict_to_assigned_only boolean DEFAULT false`)
    db(sqlSource('20261120235000_connector_catalog_reads.sql'))
  })

  it.each(['gmail', 'supabase'])('enables compatible reads on first verified %s connection, not on replay after opt-out', toolkit => {
    migrate()
    if (toolkit === 'supabase') {
      service(`INSERT INTO public.site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,auth_config_id,
        provider_account_id,nonce_hash,credential_revision,status,expires_at,supabase_project_ref) VALUES
        ('${id.attempt}','${id.site}','${id.provider}','${id.owner}','supabase','auth-config','new-account',
        '${'a'.repeat(64)}','rev-1','completing',now()+interval '5 minutes','${project}')`)
    } else insertAttempt(db)
    const finalize = finalizeSql({ toolkit })
    const account = JSON.parse(service(finalize))
    expect(account).toMatchObject({ enabled: true, access_mode: 'workspace', supabase_project_ref: toolkit === 'supabase' ? project : null })
    expect(policy(account.id)).toMatchObject({ catalog_reads: true, tool_access_mode: 'all', allowed_hosts: ['assistant'],
      allowed_tools: toolkit === 'gmail' ? ['GMAIL_FETCH_EMAILS'] : [], require_approval: toolkit !== 'gmail', support_publication: null, revision: 1 })

    service(`SELECT public.connector_disable_catalog_reads('${id.site}','${account.id}','${id.owner}',1)`)
    const optedOut = policy(account.id)
    expect(optedOut.catalog_reads).toBe(false)
    expect(JSON.parse(service(finalize)).id).toBe(account.id)
    expect(policy(account.id)).toEqual(optedOut)
    expect(db(`SELECT count(*) FROM connector_audit_events WHERE event_type='auth_completed'`)).toBe('1')
  })

  it('leaves existing on, off and missing policies intact, including legacy policy creation and callback replay', () => {
    insertAttempt(db)
    const old = JSON.parse(service(finalizeSql()))
    expect(policy(old.id).catalog_reads).toBe(false)
    service(`SELECT public.connector_update_policy('${id.site}','${id.connector}','${id.owner}',1,
      ARRAY[]::text[],ARRAY['assistant'],true,true,'all',NULL,true)`)
    expect(policy(id.connector).catalog_reads).toBe(true)
    const policies = () => db('SELECT jsonb_agg(to_jsonb(p) ORDER BY connector_id) FROM connector_policies p')
    const before = policies()
    migrate()
    expect(JSON.parse(service(finalizeSql())).id).toBe(old.id)
    expect(policies()).toBe(before)
    expect(db(`SELECT count(*) FROM connector_policies WHERE connector_id='${id.hidden}'`)).toBe('0')
    service(policySql().replace(id.connector, id.hidden))
    expect(policy(id.hidden).catalog_reads).toBe(false)
  })

  it('still denies unclaimed attempts, non-managers and browser roles without inserting a policy', () => {
    migrate(); insertAttempt(db, 'pending')
    for (const role of ['anon', 'authenticated']) expect(() => pg.call(finalizeSql(), id.owner, role)).toThrow(/permission denied/)
    expect(() => service(finalizeSql({ actor: id.member }))).toThrow(/denied/)
    expect(() => service(finalizeSql())).toThrow(/not claimed/)
    expect(db('SELECT count(*) FROM connector_policies')).toBe('0')
    expect(db(`SELECT count(*) FROM connectors WHERE provider_account_id='new-account'`)).toBe('0')
  })
})

test('the creation default is identical across the canonical repo and mirrors', () => {
  for (const repo of ['market-fit', 'API']) expect(sqlSource(migration, repo)).toBe(sqlSource(migration, 'makinari-db-scheme'))
})