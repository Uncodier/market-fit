import { id, installConnectorFixture, sqlSource } from './connector-postgres-fixture'
import { uuid } from '../security/isolated-postgres'

export const analyticsMigrations = ['20261121020000_connector_analytics_authority.sql']
export const instance = uuid(801), connector = uuid(802), project = 'a'.repeat(20), tool = 'SUPABASE_RUN_READ_ONLY_QUERY'
export const binding = `'${id.site}','${id.admin}','${instance}','${id.agent}','${connector}','${tool}',true,1,1,'rev-1'`
export function installAnalytics(db: (sql: string) => string) {
  db('DROP SCHEMA IF EXISTS connector_result_private CASCADE;')
  installConnectorFixture(db)
  db('DROP ROLE IF EXISTS connector_result_reader;')
  db(sqlSource('20261120040000_connector_supabase_project_binding.sql'))
  db(sqlSource('20261120050000_connector_support_publication.sql'))
  const deployed = sqlSource('20261019220003_startup_trial_licensing.sql')
  db(deployed.slice(deployed.indexOf('CREATE FUNCTION public.site_user_has_effective_access(')).split('$$;')[0] + '$$;')
  db(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claims',true)::jsonb$$;
    CREATE TABLE remote_instances(id uuid PRIMARY KEY,site_id uuid,user_id uuid,is_archived boolean DEFAULT false,visible boolean DEFAULT true);
    INSERT INTO remote_instances VALUES ('${instance}','${id.site}','${id.admin}');
    GRANT SELECT (id,site_id,user_id) ON remote_instances TO authenticated;
    ALTER TABLE remote_instances ENABLE ROW LEVEL SECURITY;
    CREATE POLICY user_instance ON remote_instances FOR SELECT TO authenticated USING (visible AND user_id=auth.uid());
    ALTER TABLE site_members ADD COLUMN restrict_to_assigned_only boolean DEFAULT false;
    INSERT INTO connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,display_name,provider_status,
      created_by,verified_at,access_mode,enabled,supabase_project_ref) VALUES ('${connector}','${id.site}','${id.provider}',
      'supabase','test-account','test-config','test','ACTIVE','${id.owner}',now(),'workspace',true,'${project}');`)
  db(sqlSource('20261120235000_connector_catalog_reads.sql')); db(sqlSource('20261121002000_connector_private_results.sql'))
  db('REVOKE ALL ON public.site_member_location_restrictions FROM service_role'); db(sqlSource('20261121013000_connector_catalog_actor_location_acl.sql'))
  db(`INSERT INTO connector_policies(site_id,connector_id,allowed_tools,allowed_hosts,catalog_reads)
    VALUES ('${id.site}','${connector}',ARRAY['${tool}'],ARRAY['assistant'],true);`)
  for (const m of analyticsMigrations) db(sqlSource(m))
}
