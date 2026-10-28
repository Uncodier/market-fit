import { installStorageFixture, sqlJson, ids } from './storage-fixture'
import { isolatedPostgres, migration, uuid } from '../security/isolated-postgres'
import { defaultPolicyDocument, approvalStageSchema, evaluateProcurementPolicy } from '@/app/purchases/procurement/domain'

export const itemId = uuid(300)
export const taxId = uuid(301)
export const requestDocument = { title: 'Equipment request', description: 'Net catalog estimate', currency: 'USD', lines: [{ catalog_item_id: itemId, description: '', quantity: 2 }] }
export function installRequestsFixture(pg: ReturnType<typeof isolatedPostgres>) {
  installStorageFixture(pg)
  pg.db(`CREATE FUNCTION public.user_can(p_site_id uuid,p_command text) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT public.current_user_site_role(p_site_id) IS NOT NULL $$;
    CREATE TABLE public.catalog_categories(id uuid PRIMARY KEY,site_id uuid,status text);
    CREATE TABLE public.catalog_items(id uuid PRIMARY KEY,site_id uuid,name text,cost numeric,currency text,category_id uuid,status text);
    CREATE TABLE public.taxes(id uuid PRIMARY KEY,site_id uuid,name text,rate numeric,is_active boolean);
    CREATE TABLE public.catalog_item_taxes(catalog_item_id uuid,site_id uuid,tax_id uuid);
    INSERT INTO public.catalog_items VALUES('${itemId}','${ids.site}','Equipment',12.34,'USD',NULL,'active');
    INSERT INTO public.taxes VALUES('${taxId}','${ids.site}','VAT',16,true);
    INSERT INTO public.catalog_item_taxes VALUES('${itemId}','${ids.site}','${taxId}');`)
  pg.db(migration('20261027171000_procurement_requests.sql'))
  // Execute the actual privileged bodies as a non-superuser owner, not auditor.
  pg.db(`GRANT SELECT ON public.catalog_items,public.catalog_categories,public.taxes,public.catalog_item_taxes,
      public.procurement_policy_versions TO postgres;
    ALTER TABLE public.procurement_requests OWNER TO postgres;
    ALTER TABLE public.procurement_request_items OWNER TO postgres;
    ALTER TABLE public.procurement_request_stages OWNER TO postgres;
    ALTER TABLE public.procurement_request_decisions OWNER TO postgres;
    ALTER TABLE public.procurement_request_audit OWNER TO postgres;
    ALTER FUNCTION public.procurement_request_access(uuid) OWNER TO postgres;
    ALTER FUNCTION public.procurement_request_visible(uuid,uuid) OWNER TO postgres;
    ALTER FUNCTION public.save_procurement_request(uuid,uuid,integer,jsonb) OWNER TO postgres;
    ALTER FUNCTION public.submit_procurement_request(uuid,uuid,integer,integer,uuid,jsonb) OWNER TO postgres;
    ALTER FUNCTION public.decide_procurement_request(uuid,uuid,integer,uuid,text,text) OWNER TO postgres;`)
}
export const saveRequest = (id: string | null = null, revision = 0, document: unknown = requestDocument) =>
  `SELECT public.save_procurement_request('${ids.site}',${id ? `'${id}'` : 'NULL'},${revision},${sqlJson(document)});`
export function policyWithStages(overrides: Record<string, unknown> = {}) {
  const document = defaultPolicyDocument()
  document.settings.fallback = { mode: 'approval', stages: [approvalStageSchema.parse({
    id: 'first', name: 'Manager review', decisionMode: 'human', approverIds: [ids.admin, ids.owner],
    mandatoryApproverIds: [], quorum: { mode: 'all' }, rejectionBehavior: 'veto', execution: 'parallel', allowSelfApproval: true, timeoutAction: 'block',
    ...overrides,
  })] }
  return document
}
export function planFor(document: unknown) {
  return evaluateProcurementPolicy(document, { event: 'requisition', currency: 'USD', netAmountMinor: 2468,
    requesterId: ids.owner, evaluatedAt: new Date().toISOString(), stageActivatedAt: new Date().toISOString(),
    lines: [{ id: 'line', productId: itemId, netAmountMinor: 2468 }] })
}
export const submitRequest = (id: string, plan: unknown, actor = ids.owner, revision = 1, policyRevision = 1) =>
  `SELECT public.submit_procurement_request('${ids.site}','${id}',${revision},${policyRevision},'${actor}',${sqlJson(plan)});`
export const decideRequest = (id: string, stage: string, decision = 'approve', revision = 1) =>
  `SELECT public.decide_procurement_request('${ids.site}','${id}',${revision},'${stage}','${decision}','Reviewed supporting details');`
