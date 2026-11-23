import { randomBytes, randomUUID } from 'node:crypto'
import { id, sqlSource } from './connector-postgres-fixture'
import { installProviderDirect, revision } from './provider-direct-fixture'
import { installDirectReceipts } from './provider-direct-receipt-fixture'

export const ordinaryFile = '20261123150000_connector_ordinary_oauth.sql'
type Db = (sql:string)=>string
export function installOrdinaryOauth(db:Db) {
  installProviderDirect(db); installDirectReceipts(db)
  for (const file of ['20261121012000_connector_creation_catalog_reads.sql','20261123030000_connector_ask_on_connect.sql',
    '20261123040000_connector_instance_member_authority.sql','20261123041000_connector_instance_scoped_reads.sql',
    '20261123080000_connector_instance_report_sources.sql','20261123090000_retire_instance_scoped_report.sql',
    '20261123100000_connector_policy_save_with_ask.sql','20261123110000_connector_instance_member_policy.sql']) db(sqlSource(file))
  db(`ALTER TABLE agents ADD COLUMN role text; UPDATE agents SET role='Customer Support';
    CREATE TABLE conversations(id uuid PRIMARY KEY,site_id uuid,agent_id uuid,user_id uuid);`)
  for (const file of ['20261123130000_connector_support_direct_accounts.sql','20261123140000_connector_explicit_agent_grants.sql',ordinaryFile]) db(sqlSource(file))
}

export function completeOrdinaryOauth(db:Db, options:{toolkit?:string;scopes?:string[];notice?:boolean;legacy?:boolean}={}) {
  const {toolkit='gmail',scopes=['https://www.googleapis.com/auth/gmail.readonly'],notice=true,legacy=false}=options
  const authorizationId=randomUUID(), nonce=randomBytes(32).toString('hex'), account=randomUUID()
  db(`SET ROLE service_role; INSERT INTO public.site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,
    auth_config_id,nonce_hash,credential_revision,status,expires_at,ask_on_connect)
    VALUES ('${authorizationId}','${id.site}','${id.provider}','${id.owner}','${toolkit}',
      'auth-config','${nonce}','${revision}','pending',now()+interval '10 minutes',${notice});
    UPDATE public.site_connector_auth_attempts SET provider_account_id='${account}' WHERE id='${authorizationId}';
    UPDATE public.site_connector_auth_attempts SET status='completing' WHERE id='${authorizationId}';`)
  const args=`('${authorizationId}','${id.owner}','${nonce}','${account}','${toolkit}','auth-config','Synthetic OAuth',
    ARRAY[${scopes.map(s=>`'${s}'`).join(',')}]::text[])`
  const connectorId=db(`SET ROLE service_role; SELECT public.${legacy?'connector_finalize_auth':'connector_finalize_private_oauth'}${args}->>'id'`)
  return {connectorId,authorizationId,args}
}
