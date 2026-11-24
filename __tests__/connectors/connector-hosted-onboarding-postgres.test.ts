/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { finalizeSql, id, insertAttempt, installConnectorFixture, sqlSource } from './connector-postgres-fixture'

const migration = '20261124000000_connector_hosted_onboarding.sql'
const setup = () => sqlSource(migration, 'makinari-db-scheme')

it('ships the same forward migration in both application repositories', () => {
  expect(sqlSource(migration, 'API')).toBe(setup())
  expect(sqlSource(migration)).toBe(setup())
})

;(postgresAvailable ? describe : describe.skip)('hosted connection policy on disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')

  beforeAll(pg.start, 30_000)
  afterAll(pg.stop)
  beforeEach(() => {
    db('DROP SCHEMA IF EXISTS connector_result_private CASCADE;')
    installConnectorFixture(db)
    db(sqlSource('20261120040000_connector_supabase_project_binding.sql'))
    db(sqlSource('20261120050000_connector_support_publication.sql'))
    db(`CREATE TABLE remote_instances(id uuid PRIMARY KEY, site_id uuid, user_id uuid, is_archived boolean DEFAULT false);
      ALTER TABLE site_members ADD COLUMN restrict_to_assigned_only boolean DEFAULT false`)
    db(sqlSource('20261120235000_connector_catalog_reads.sql'))
    db(sqlSource('20261121012000_connector_creation_catalog_reads.sql'))
    db('CREATE SCHEMA connector_result_private; ALTER TABLE public.site_connector_auth_attempts ADD COLUMN ask_on_connect boolean NOT NULL DEFAULT false;')
    db(setup())
  })

  function startHosted(toolkit = '_1password', mode = 'hosted', attempt = id.attempt, account = 'new-account') {
    service(`INSERT INTO public.site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,auth_config_id,
      nonce_hash,credential_revision,status,expires_at,setup_mode)
      VALUES ('${attempt}','${id.site}','${id.provider}','${id.owner}','${toolkit}','auth-config',
        repeat('a',64),'rev-1','pending',now()+interval '10 minutes','${mode}');
      UPDATE public.site_connector_auth_attempts SET provider_account_id='${account}' WHERE id='${attempt}';`)
  }

  it.each(['hosted', 'hosted_credentials'])('accepts native underscore slugs without enabling hosts or agent grants for %s', mode => {
    startHosted('_1password', mode)
    service(`UPDATE public.site_connector_auth_attempts SET status='completing' WHERE id='${id.attempt}'`)
    const sql = finalizeSql({ toolkit: '_1password' })
    const account = JSON.parse(service(sql))
    expect(account).toMatchObject({ toolkit_slug: '_1password', enabled: true, provider_status: 'ACTIVE', access_mode: 'workspace' })
    expect(db(`SELECT allowed_hosts FROM public.connector_policies WHERE connector_id='${account.id}'`)).toBe('{}')
    expect(db('SELECT count(*) FROM public.connector_agents')).toBe('0')
    expect(db(`SELECT ask_on_connect,status,setup_mode FROM public.site_connector_auth_attempts WHERE id='${id.attempt}'`)).toBe(`f|completed|${mode}`)
    expect(db('SELECT count(*) FROM public.connector_audit_events')).toBe('1')
    db(`UPDATE public.connector_policies SET allowed_hosts=ARRAY['assistant'] WHERE connector_id='${account.id}'`)
    expect(JSON.parse(service(sql)).id).toBe(account.id)
    expect(db(`SELECT allowed_hosts FROM public.connector_policies WHERE connector_id='${account.id}'`)).toBe('{assistant}')
  })

  it('cannot change the mode, opt in to Ask on the same attempt, or empty the policy of a different account', () => {
    startHosted('metaads')
    expect(() => service(`UPDATE public.site_connector_auth_attempts SET setup_mode='legacy' WHERE id='${id.attempt}'`)).toThrow(/immutable/)
    expect(() => service(`UPDATE public.site_connector_auth_attempts SET ask_on_connect=true WHERE id='${id.attempt}'`)).toThrow(/connector_auth_setup_mode_check/)
    service(`UPDATE public.site_connector_auth_attempts SET status='completing' WHERE id='${id.attempt}'`)
    expect(() => db(`UPDATE public.site_connector_auth_attempts SET status='completed',connector_id='${id.connector}' WHERE id='${id.attempt}'`)).toThrow(/could not be bound/)
    const legacy = uuid(150)
    db(`DELETE FROM public.site_connector_auth_attempts WHERE id='${id.attempt}'`)
    insertAttempt(db, 'completing', legacy)
    const account = JSON.parse(service(finalizeSql({ account: legacy })))
    expect(db(`SELECT allowed_hosts FROM public.connector_policies WHERE connector_id='${account.id}'`)).toBe('{assistant}')
  })
})