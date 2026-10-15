import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const pgBin = process.env.MARKETPLACE_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin';
export const postgresAvailable = ['initdb', 'pg_ctl', 'psql'].every(file => existsSync(path.join(pgBin, file)));
const pgEnv = { ...process.env, LC_ALL: 'C', LANG: 'C' };
export const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export const site = id(10), owner = id(1), operator = id(2), integration = id(30), location = id(20), secret = id(40);
export const migrationNames = ['20261014230000_marketplace_schema.sql', '20261014230100_marketplace_config.sql',
  '20261014230200_marketplace_ingestion.sql', '20261014230300_marketplace_actions.sql', '20261014230400_marketplace_poll.sql',
  '20261014230500_marketplace_ingestion_review.sql', '20261014230600_marketplace_action_review.sql',
  '20261014230700_marketplace_recovery_review.sql', '20261014230800_marketplace_print_review.sql',
  '20261014230900_marketplace_merchant_consent.sql', '20261014231000_marketplace_merchant_configuration.sql',
  '20261014231100_marketplace_merchant_provisioning.sql', '20261014231200_marketplace_webhook_registration.sql',
  '20261014231300_marketplace_webhook_app_lease.sql', '20261014231400_marketplace_merchant_reconnection.sql',
  '20261014231500_marketplace_verified_provisioning_status.sql', '20261014231600_marketplace_external_provider_status.sql'];
const sqlFile = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

export class MarketplaceDatabase {
  private directory = '';
  private readonly port = '55447';
  start() {
    // An explicitly socket-only fresh cluster. Never consume DATABASE_URL,
    // PGHOST, application env credentials or any pre-existing PostgreSQL server.
    this.directory = mkdtempSync('/tmp/marketplace-pg-');
    execFileSync(path.join(pgBin, 'initdb'), ['-D', `${this.directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale'],
      { env: pgEnv, stdio: 'pipe', timeout: 20000 });
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', `${this.directory}/data`, '-l', `${this.directory}/postgres.log`,
      '-o', `-F -k ${this.directory} -p ${this.port} -c listen_addresses=''`, '-w', 'start'],
    { env: pgEnv, stdio: 'pipe', timeout: 20000 });
  }
  stop() {
    if (!this.directory) return;
    try { execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', `${this.directory}/data`, '-m', 'immediate', '-w', 'stop'],
      { env: pgEnv, stdio: 'pipe', timeout: 20000 }); }
    finally { rmSync(this.directory, { recursive: true, force: true }); this.directory = ''; }
  }
  private args() { return ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', this.directory,
    '-p', this.port, '-U', 'postgres', '-d', 'postgres']; }
  sql(sql: string) {
    return execFileSync(path.join(pgBin, 'psql'), this.args(), {
      input: sql, encoding: 'utf8', stdio: 'pipe', timeout: 20000, env: pgEnv,
    }).trim();
  }
  async concurrent(sql: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(path.join(pgBin, 'psql'), this.args(), { env: pgEnv });
      let output = '', error = '';
      child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { error += data; });
      child.on('error', reject); child.on('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
      child.stdin.end(sql);
    });
  }
  actor(sql: string, actor = owner, role = 'service_role') {
    return this.sql(`SET ROLE ${role}; SET request.jwt.claims = '{"sub":"${actor}","role":"${role}"}';
      SET request.jwt.claim.sub = '${actor}'; ${sql}`);
  }
  reset() {
    this.sql('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
    // Roles persist between tests, but no fixture data or objects do.
    this.sql(sqlFile('__tests__/marketplace/database-fixture.sql').replace(/CREATE ROLE [^;]+;/g, ''));
    this.sql(sqlFile('supabase/migrations/20260825160000_fix_site_role_and_delete_caps.sql')
      .split('CREATE OR REPLACE FUNCTION public.get_my_site_capabilities')[0]);
    this.sql(sqlFile('supabase/migrations/20261007220000_site_license_enforcement.sql')
      .split('CREATE OR REPLACE FUNCTION public.current_user_site_role')[1]
      .split('-- user_can')[0].replace(/^/, 'CREATE OR REPLACE FUNCTION public.current_user_site_role'));
    this.sql(sqlFile('supabase/migrations/20260929224000_repair_sale_order_attribution.sql'));
    this.sql(sqlFile('supabase/migrations/20260921143000_create_sale_order_item_units.sql'));
    this.sql(sqlFile('supabase/migrations/20260921151500_secure_order_line_unit_mutations.sql'));
    this.sql(sqlFile('supabase/migrations/20260921153000_harden_order_line_workflow.sql'));
    this.sql('DROP PUBLICATION IF EXISTS supabase_realtime; CREATE PUBLICATION supabase_realtime;');
    for (const name of migrationNames) this.sql(sqlFile(`supabase/migrations/${name}`));
    this.sql(`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
      REVOKE ALL ON marketplace_integrations,marketplace_events,marketplace_actions,marketplace_platform_apps,
        marketplace_oauth_sessions,marketplace_merchant_connections,marketplace_provider_webhook_keys,
        marketplace_webhook_registrations,marketplace_webhook_registration_apps FROM authenticated;
      REVOKE ALL ON marketplace_rebind_permits FROM authenticated,service_role;
      GRANT SELECT ON marketplace_integrations TO authenticated;
      INSERT INTO auth.users VALUES('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'),('${id(5)}');
      INSERT INTO profiles SELECT id FROM auth.users;
      INSERT INTO sites VALUES('${site}','${owner}',NULL),('${id(11)}','${id(3)}',NULL);
      INSERT INTO site_members(site_id,user_id,role,status) VALUES('${site}','${operator}','collaborator','active'),
        ('${site}','${id(4)}','marketing','active'),('${site}','${id(5)}','admin','inactive');
      INSERT INTO locations VALUES('${location}','${site}',true),('${id(21)}','${id(11)}',true);`);
  }
  createRoles() { this.sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;'); }
  configure(provider = 'uber_eats') {
    const config = { id: integration, site_id: site, provider, environment: 'sandbox', country: provider === 'rappi' ? 'MX' : 'US',
      external_store_id: 'store-test', origin_location_id: location, enabled: true, manual_ready: true };
    // Synthetic encrypted opaque values generated by caller; no live key material.
    return this.actor(`SELECT save_marketplace_integration('${JSON.stringify(config)}','${secret}',
      repeat('synthetic-ciphertext-',3),'${owner}');`);
  }
  ingest(order: object, event = 'event-test', eventAt = '2026-10-14T12:00:00Z') {
    return JSON.parse(this.actor(`SELECT ingest_marketplace_event('${integration}','${event}',
      '${JSON.stringify(order)}','${eventAt}');`));
  }
}

export function normalizedOrder(status = 'pending') {
  return { external_order_id: 'order-test', external_store_id: 'store-test', display_id: '100', status,
    currency: 'MXN', total: 105, subtotal: 100, discount_total: 0, totals_provisional: false,
    marketplace_totals: { tax: 5 }, customer: { name: 'Synthetic customer' }, fulfillment_method: 'delivery',
    items: [{ external_id: 'line-1', name: 'Test meal', quantity: 2, unit_price: 50, total: 100,
      modifiers_included_in_price: true, modifiers: [{ external_id: 'choice-1', name: 'Test topping',
        quantity: 1, unit_price: 5, total: 5, modifiers: [] }] }],
    delivery: { status: 'courier_assigned', courier: { name: 'Test courier', latitude: 20, longitude: -100 }, eta_minutes: 10 } };
}