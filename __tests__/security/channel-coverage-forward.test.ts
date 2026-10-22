/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { licensePostgresAvailable } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'

const source = readFileSync(path.resolve(__dirname,
  '../../supabase/migrations/20261022032027_complete_channel_activation_and_paid_coverage.sql'), 'utf8')
const hashes = [
  ['enforce_settings_license()', '092236c56cac29a104553a5dff3f90c8'],
  ['get_site_licensed_resources(uuid)', 'deca30b77cdaf40095b9217c4a776be1'],
  ['billing_license_changed()', 'f4a566dc8c65edbbe847aad7b43ace54'],
] as const

describe('channel and coverage forward migration contract', () => {
  test('requires exact audited bodies and rejects partial installation rather than replaying', () => {
    for (const [signature, hash] of hashes) {
      expect(source).toContain(`('public.${signature}', '${hash}')`)
    }
    expect(source).toContain("md5(observed.prosrc) <> expected_function.body_md5")
    expect(source).toContain('SHARE ROW EXCLUSIVE MODE')
    expect(source).not.toContain('CREATE TABLE IF NOT EXISTS public.agent_channel_activation_context')
    expect(source).toContain('NEW.paid_subscription_period_end')
  })
})

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
live('guarded forward correction: isolated PostgreSQL', () => {
  const pg = startupTrialPostgres()
  let fixtureSource: string
  afterEach(() => pg.stop())
  beforeEach(() => {
    pg.start()
    pg.install()
    // The synthetic installer is semantically identical but formats patched
    // bodies differently. Bind the unchanged preflight to this fixture's exact
    // baseline hashes; production retains the checked-in audited hashes above.
    fixtureSource = source
    for (const [signature, hash] of hashes) {
      const fixtureHash = pg.db(`SELECT md5(prosrc) FROM pg_proc WHERE oid='public.${signature}'::regprocedure`)
      fixtureSource = fixtureSource.replace(hash, fixtureHash)
    }
    const dependencies = [...source.matchAll(/\('public\.([^']+)','([a-f0-9]{32})','postgres',/g)]
    for (const [, signature, hash] of dependencies) {
      const fixtureHash = pg.db(`SELECT md5(prosrc) FROM pg_proc WHERE oid='public.${signature}'::regprocedure`)
      fixtureSource = fixtureSource.replace(hash, fixtureHash)
    }
    const inner = (name: string) => readFileSync(path.resolve(__dirname, '../../supabase/migrations', name), 'utf8')
      .replace(/^BEGIN;/, '').replace(/COMMIT;\s*$/, '')
    const finalHashes = JSON.parse(pg.db(`BEGIN;
      ${inner('20261020002000_manual_agent_channel_activation.sql')}
      ${inner('20261021001000_reconcile_paid_coverage_licenses.sql')}
      SELECT jsonb_object_agg(oid::regprocedure::text,md5(prosrc)) FROM pg_proc
        WHERE oid IN ('public.enforce_settings_license()'::regprocedure,
          'public.get_site_licensed_resources(uuid)'::regprocedure,'public.billing_license_changed()'::regprocedure);
      ROLLBACK;`)) as Record<string, string>
    for (const [, signature, hash] of source.matchAll(/\('public\.([^']+)','([a-f0-9]{32})'\)/g)) {
      fixtureSource = fixtureSource.replace(hash, finalHashes[signature])
    }
  })

  test('installs missing capability and coverage correction without a data backfill', () => {
    const before = pg.db('SELECT md5(coalesce(jsonb_agg(to_jsonb(b))::text,\'[]\')) FROM billing b')
    pg.db(fixtureSource)
    expect(pg.db('SELECT md5(coalesce(jsonb_agg(to_jsonb(b))::text,\'[]\')) FROM billing b')).toBe(before)
    expect(pg.db(`SELECT count(*) FROM agent_channel_activation_context`)).toBe('0')
    expect(pg.db(`SELECT has_function_privilege('service_role',
      'public.set_site_agent_channel_enabled(uuid,text,boolean,uuid)','EXECUTE')`)).toBe('t')
    for (const actor of ['anon', 'authenticated']) {
      expect(pg.db(`SELECT has_function_privilege('${actor}',
        'public.set_site_agent_channel_enabled(uuid,text,boolean,uuid)','EXECUTE')`)).toBe('f')
    }
    expect(pg.db(`SELECT strpos(prosrc,'NEW.paid_subscription_invoice_id')>0 FROM pg_proc
      WHERE oid='public.billing_license_changed()'::regprocedure`)).toBe('t')
  })

  test('refuses newer function drift atomically before creating the capability table', () => {
    pg.db(`CREATE OR REPLACE FUNCTION public.billing_license_changed() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN RETURN NEW; END $$`)
    expect(() => pg.db(fixtureSource)).toThrow(/changed since audit/)
    expect(pg.db(`SELECT to_regclass('public.agent_channel_activation_context') IS NULL`)).toBe('t')
  })

  test('refuses replay after installation without changing the corrected function', () => {
    pg.db(fixtureSource)
    const before = pg.db(`SELECT md5(prosrc) FROM pg_proc WHERE oid='public.billing_license_changed()'::regprocedure`)
    expect(() => pg.db(fixtureSource)).toThrow(/verified initial state/)
    expect(pg.db(`SELECT md5(prosrc) FROM pg_proc WHERE oid='public.billing_license_changed()'::regprocedure`)).toBe(before)
  })
})