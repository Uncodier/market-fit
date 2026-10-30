import { isolatedPostgres, migration, ids, uuid } from '../security/isolated-postgres'
import { installCommerceFixture, supplierId, itemId, openAward } from './commerce-fixture'
import { saveRequest, submitRequest, planFor } from './requests-fixture'
import { saveTender, tenderDocument } from './tenders-fixture'
import { sqlJson, saveSql } from './storage-fixture'
import { defaultPolicyDocument, evaluateProcurementPolicy, procurementRuleSchema, type PolicyDocument } from '@/app/purchases/procurement/domain'

export { ids, uuid, sqlJson, saveSql, saveRequest, submitRequest, planFor, saveTender, supplierId, itemId, openAward }
export type Pg = ReturnType<typeof isolatedPostgres>
export const plainPolicy = () => { const doc = defaultPolicyDocument(); doc.settings.fallback = { mode: 'none' }; return doc }
export function installLifecycleFixture(pg: Pg) {
  installCommerceFixture(pg, true)
  for (const file of ['20261028001000_procurement_approval_revalidation.sql',
    '20261028020000_procurement_lifecycle_repair.sql', '20261028020001_procurement_commerce_lifecycle_repair.sql']) pg.db(migration(file))
  pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
    DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
}
export function requestPolicy(milestone: 'participation' | 'award' | 'order' | null, minimum = 0) {
  const doc = plainPolicy()
  doc.rules = [procurementRuleSchema.parse({ id: 'request-rule', name: 'Saved request requirements',
    type: milestone ? 'requirements' : 'supplier_participation', status: 'active', event: 'requisition',
    minimumSupplierProposals: minimum || null, requirements: milestone ? [{ id: 'certificate', name: 'Mandatory certificate',
      kind: 'certification', classification: 'mandatory', milestone, overridable: false,
      credential: { holder: 'organization', validity: 'award', acceptedEquivalentIds: [], evidenceRequired: true, review: 'human' } }] : [],
  })]
  return doc
}
export function eventPlan(document: PolicyDocument, event: 'publication' | 'award' | 'order') {
  return evaluateProcurementPolicy(document, { event, currency: 'USD', netAmountMinor: 2468,
    requesterId: ids.owner, evaluatedAt: new Date().toISOString(), stageActivatedAt: new Date().toISOString(),
    lines: [{ id: uuid(970), productId: itemId, categoryIds: [], netAmountMinor: 2468 }] })
}
export function linkedDraft(pg: Pg, document = plainPolicy()) {
  pg.call(saveSql(1, document))
  const request = pg.call(saveRequest())
  pg.call(submitRequest(request, planFor(document), ids.owner, 1, 2), ids.owner, 'service_role')
  const tenderDoc = { ...tenderDocument, request_id: request, visibility: 'private', global_visible: false,
    requirements: [{ id: uuid(970), description: 'Equipment', quantity: 2, unit: 'each', unit_net_minor: 1234, catalog_item_id: itemId }] }
  const tender = pg.call(saveTender(null, 0, tenderDoc))
  return { request, tender, tenderDoc, document }
}
export function publish(pg: Pg, tender: string, document = plainPolicy(), version = 1, revision = 2) {
  pg.call(`SELECT create_procurement_event_approval('${ids.site}','${tender}',${version},'publication','${ids.owner}',${revision},${sqlJson(eventPlan(document, 'publication'))})`, ids.owner, 'service_role')
  return pg.db(`SELECT id FROM procurement_tender_publications WHERE tender_id='${tender}' ORDER BY version DESC LIMIT 1`)
}
export function quote(pg: Pg, tender: string, publication: string, supplier = supplierId, key = uuid(980), version = 1) {
  pg.call(`SELECT set_procurement_tender_participant('${ids.site}','${tender}',${version},'${supplier}','invited')`)
  return pg.call(`SELECT record_procurement_quotation('${ids.site}',${sqlJson({ supplier_id: supplier, tender_id: tender, publication_id: publication,
    reference: 'Supplier quotation', idempotency_key: key, lines: [{ requirement_id: uuid(970), unit_net_minor: 1234 }] })})`)
}
export const approvalSql = (target: string, event: 'award' | 'order', document = plainPolicy(), revision = 2) =>
  `SELECT create_procurement_commerce_approval('${ids.site}','${target}',1,'${event}','${ids.owner}',${revision},${sqlJson(eventPlan(document, event))})`
export const revalidateSql = (request: string, revision = 1, site = ids.site) =>
  `SELECT revalidate_procurement_request('${site}','${request}',${revision})`