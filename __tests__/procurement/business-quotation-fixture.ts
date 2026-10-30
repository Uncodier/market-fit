import { isolatedPostgres, migration } from '../security/isolated-postgres'
import { installEvidenceFixture, ids } from './evidence-fixture'
import { publicationId, tenderId } from './commerce-fixture'

// Mirrors the business participation regression setup, including real licensing.
export function installBusinessQuotationFixture(pg: ReturnType<typeof isolatedPostgres>) {
  const amend = (sql: string) => pg.db(`SET session_replication_role=replica; ${sql} SET session_replication_role=origin;`)
  installEvidenceFixture(pg, true)
  // Use the actual canonical license/role functions, with synthetic plan data.
  pg.db(`CREATE TABLE site_members(id uuid DEFAULT gen_random_uuid(), site_id uuid REFERENCES sites,
    user_id uuid,role text,status text,manually_disabled boolean NOT NULL DEFAULT false,created_at timestamptz DEFAULT now());
    CREATE TABLE site_ownership(site_id uuid,user_id uuid);
    INSERT INTO site_members(site_id,user_id,role,status)
     SELECT site_id,user_id,role,CASE WHEN active THEN 'active' ELSE 'inactive' END FROM fixture_members;
    ALTER TABLE sites ADD COLUMN test_plan text DEFAULT 'engine', ADD COLUMN name text DEFAULT 'Buyer business';
    CREATE FUNCTION effective_site_plan(p_site uuid) RETURNS text LANGUAGE sql STABLE AS
     $$ SELECT test_plan FROM sites WHERE id=p_site $$;
    UPDATE sites SET name='Owned business' WHERE id='${ids.otherSite}';
    INSERT INTO site_members(site_id,user_id,role,status) VALUES
     ('${ids.otherSite}','${ids.admin}','marketing','active'),
     ('${ids.otherSite}','${ids.inactive}','admin','pending');`)
  const canonical = migration('20261019220003_startup_trial_licensing.sql')
  for (const signature of ['site_member_has_effective_license(p_member_id uuid)', 'current_user_site_role(p_site_id uuid)']) {
    const start = canonical.indexOf(`FUNCTION public.${signature}`)
    pg.db('CREATE OR REPLACE ' + canonical.slice(start).split('$$;')[0] + '$$;')
  }
  for (const file of ['20261028001000_procurement_approval_revalidation.sql',
    '20261028020000_procurement_lifecycle_repair.sql', '20261028020001_procurement_commerce_lifecycle_repair.sql',
    '20261030120000_procurement_open_self_participation.sql', '20261030130000_procurement_proposal_attachments.sql', '20261030140000_procurement_open_business_participation.sql']) pg.db(migration(file))
  pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
    DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
  pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',true);`)
  amend(`UPDATE procurement_tenders SET visibility='public',participation='open' WHERE id='${tenderId}';
    UPDATE procurement_tender_publications SET visibility='public',snapshot=jsonb_set(snapshot,'{participation}','"open"') WHERE id='${publicationId}';
    UPDATE procurement_tender_policy_bindings SET working_snapshot=(SELECT to_jsonb(t)-ARRAY['status','updated_at','version'] FROM procurement_tenders t WHERE id='${tenderId}');`)
}
