import { createHash, randomBytes } from 'node:crypto'
import { id, sqlSource } from './connector-postgres-fixture'
import { installAnalytics, instance } from './connector-analytics-fixture'
import { uuid } from '../security/isolated-postgres'

export { instance }
export const directMigration = '20261123010000_connector_provider_direct.sql'
export const direct = uuid(811), ciphertext = randomBytes(32).toString('hex')
export const revision = createHash('sha256').update(ciphertext).digest('hex')
type Db = (sql: string) => string
export const proofTable = 'connector_result_private.direct_attestations'

// Test DDL and identities only. This fixture is not a production enrollment script.
export function installProviderDirect(db: Db, beforePolicyMigration?: () => void) {
  db('DROP SCHEMA IF EXISTS connector_direct_rpc CASCADE;') // Reset the receipt gate between isolated cases.
  installAnalytics(db)
  db(sqlSource('20261121031200_connector_provider_attestations.sql'))
  db(`CREATE TABLE public.site_secrets(site_id uuid, instance_id uuid, provider text, use_case text, is_active boolean, encrypted_value text);
    INSERT INTO public.site_secrets VALUES ('${id.site}',null,'composio','integrations',true,'${ciphertext}');
    ALTER TABLE public.site_connector_providers DISABLE TRIGGER connector_provider_identity_guard;
    UPDATE public.site_connector_providers SET credential_revision='${revision}',provider_user_id=site_id::text WHERE id='${id.provider}';
    ALTER TABLE public.site_connector_providers ENABLE TRIGGER connector_provider_identity_guard;
    INSERT INTO connector_result_private.provider_attestations VALUES ('${id.site}','${revision}','project-a','https://app.example.test/connectors/callback');
    INSERT INTO public.connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,display_name,provider_status,
      created_by,verified_at,access_mode,enabled) VALUES ('${direct}','${id.site}','${id.provider}','crm','direct-a','auth-config','CRM','ACTIVE','${id.owner}',now(),'workspace',true);
    INSERT INTO public.connector_policies(site_id,connector_id,allowed_hosts,tool_access_mode,catalog_reads)
      VALUES ('${id.site}','${direct}',ARRAY['assistant'],'all',true);
    ALTER DEFAULT PRIVILEGES IN SCHEMA connector_result_private GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public,connector_result_private GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`)
  beforePolicyMigration?.()
  db(sqlSource(directMigration,'makinari-db-scheme'))
  db(`INSERT INTO connector_result_private.direct_resources VALUES ('crm-issuer','customer-tenant-17','${id.site}',ARRAY['people','leads'])`)
}

export const issueSql = () => `INSERT INTO ${proofTable}(site_id,connector_id,provider_id,project_id,account_id,auth_config_id,toolkit_slug,credential_revision,
  resource_namespace,resource_kind,resource_boundary,evidence_ref,credential_custody,resource_scope,operation_scope,rotation_scope,expires_at) VALUES
  ('${id.site}','${direct}','${id.provider}','project-a','direct-a','auth-config','crm','${revision}',
   'crm-issuer','external_business_resource','customer-tenant-17','review-17','customer_owned_dedicated','provider_enforced_single_site','business_data_only_no_control_plane','reauth_cannot_expand_boundary',now()+interval '1 day') RETURNING id;`
export const issueDirect = (db: Db) => db(issueSql())
export const setSql = (enabled: boolean, directRev: number, actor=id.admin, rev=1) =>
  `SELECT public.connector_set_direct_policy('${id.site}','${actor}','${direct}',${rev},${directRev},${enabled});`
export const enableDirect = (db: Db) => {
  const current = JSON.parse(db(`SET ROLE service_role; SELECT public.connector_direct_policy('${id.site}','${id.admin}','${direct}')`))
  return db(`SET ROLE service_role; ${setSql(true,current.direct_revision,id.admin,current.revision)}`)
}
