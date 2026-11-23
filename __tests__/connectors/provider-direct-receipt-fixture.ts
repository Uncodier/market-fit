import { id, sqlSource } from './connector-postgres-fixture'

export const receiptMigration = '20261123020000_connector_direct_receipts.sql'

// A NOINHERIT gateway can SET ROLE to either service_role or authenticated. Its
// outer context deliberately differs from the real requester tested by parent RLS.
export const createGateway = `CREATE ROLE direct_fixture_gateway NOINHERIT;
  GRANT authenticated,service_role TO direct_fixture_gateway;`
export const gateway = `SET SESSION AUTHORIZATION direct_fixture_gateway; SET ROLE service_role;
  SET request.jwt.claims='{"role":"service_role"}'; SET request.jwt.claim='{"role":"service_role"}';
  SET request.jwt.claim.sub='${id.owner}'; SET request.jwt.claim.role='service_role';
  SET request.headers='{"x-test":"outer"}'; SET request.cookies='{"test":"outer"}'; SET connector_direct.result_id='prior-ack';`

export function installDirectReceipts(db: (sql: string) => string) {
  db(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(
      nullif(current_setting('request.jwt.claim.sub',true),''),auth.jwt()->>'sub')::uuid $$;
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(
      nullif(current_setting('request.jwt.claim',true),''),nullif(current_setting('request.jwt.claims',true),''))::jsonb $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(
      nullif(current_setting('request.jwt.claim.role',true),''), auth.jwt()->>'role') $$;
    ALTER TABLE remote_instances ADD COLUMN agent_id uuid;
    CREATE TABLE instance_pending_work(id uuid PRIMARY KEY, instance_id uuid,site_id uuid,user_id uuid);
    CREATE TABLE instance_logs(id uuid PRIMARY KEY,instance_id uuid REFERENCES remote_instances(id) ON DELETE CASCADE,
      site_id uuid,user_id uuid,agent_id uuid,log_type text,trusted_user_action boolean NOT NULL DEFAULT false,details jsonb,
      message text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT clock_timestamp());
    GRANT ALL ON instance_logs TO anon, authenticated, service_role;
    ALTER TABLE instance_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY instance_log_fixture ON instance_logs TO authenticated USING (site_id='${id.site}') WITH CHECK (site_id='${id.site}');`)
  db(sqlSource('20261119223000_connector_identity_guards.sql'))
  db(sqlSource(receiptMigration, 'makinari-db-scheme'))
}