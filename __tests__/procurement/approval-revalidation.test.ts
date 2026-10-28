/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, migration, uuid } from '../security/isolated-postgres'
import { installCommerceFixture, ids, supplierId, tenderId, recordQuote, quoteDocument, openAward } from './commerce-fixture'
import { saveTender } from './tenders-fixture'
import { sqlJson, actors } from './storage-fixture'
import { saveRequest, submitRequest, planFor, policyWithStages } from './requests-fixture'
import { defaultPolicyDocument, approvalStageSchema, evaluateProcurementPolicy } from '@/app/purchases/procurement/domain'

jest.setTimeout(180000)
;(postgresAvailable ? describe : describe.skip)('approval revalidation forward migration', () => {
  const pg = isolatedPostgres()
  const correction = () => pg.db(migration('20261028001000_procurement_approval_revalidation.sql'))
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())

  test('a policy change rolls back final publication vote until a new plan is requested', () => {
    installCommerceFixture(pg)
    pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',true)`)
    correction()
    const target = pg.call(saveTender())
    const document = defaultPolicyDocument()
    document.settings.allowGlobalListing = true
    document.settings.fallback = { mode: 'approval', stages: [approvalStageSchema.parse({
      id: 'release', name: 'Release', decisionMode: 'human', approverIds: [ids.admin], quorum: { mode: 'first_response' },
      rejectionBehavior: 'veto', execution: 'parallel', allowSelfApproval: false, timeoutAction: 'block',
    })] }
    pg.call(`SELECT save_procurement_policy('${ids.site}',1,${sqlJson(document)})`)
    const plan = evaluateProcurementPolicy(document, { event: 'publication', currency: 'USD', netAmountMinor: 125000,
      requesterId: ids.owner, evaluatedAt: new Date().toISOString() })
    const create = (revision: number) => `SELECT create_procurement_event_approval('${ids.site}','${target}',1,'publication','${ids.owner}',${revision},${sqlJson(plan)})`
    const pending = pg.call(create(2), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM procurement_event_stages WHERE approval_id='${pending}'`)
    pg.call(`SELECT save_procurement_policy('${ids.site}',2,${sqlJson(document)})`)
    expect(() => pg.call(`SELECT decide_procurement_event('${ids.site}','${pending}','${stage}','approve','Reviewed')`, ids.admin)).toThrow(/Policy changed/)
    expect(pg.db('SELECT count(*) FROM procurement_event_decisions')).toBe('0')
    expect(pg.db(`SELECT count(*) FROM procurement_tender_publications WHERE tender_id='${target}'`)).toBe('0')
    const replacement = pg.call(create(3), ids.owner, 'service_role')
    const newStage = pg.db(`SELECT id FROM procurement_event_stages WHERE approval_id='${replacement}'`)
    pg.call(`SELECT decide_procurement_event('${ids.site}','${replacement}','${newStage}','approve','Reviewed current policy')`, ids.admin)
    expect(pg.db(`SELECT policy_revision FROM procurement_tender_publications WHERE tender_id='${target}'`)).toBe('3')
  })

  test('withdrawn invitations stop counting and cannot satisfy award minimums', () => {
    installCommerceFixture(pg)
    correction()
    const otherSupplier = uuid(965)
    pg.db(`INSERT INTO suppliers VALUES('${otherSupplier}','${ids.site}','Second supplier','approved');
      INSERT INTO procurement_tender_participants(site_id,tender_id,supplier_id,invited_by)
      VALUES('${ids.site}','${tenderId}','${otherSupplier}','${ids.owner}');`)
    const quote = pg.call(recordQuote())
    pg.call(recordQuote({ ...quoteDocument, supplier_id: otherSupplier, idempotency_key: uuid(966) }))
    openAward(pg)
    const count = () => JSON.parse(pg.call(`SELECT procurement_commerce_event_context('${ids.site}','${quote}',1,'award')`)).supplier_proposals
    expect(count()).toBe(2)
    pg.db(`UPDATE procurement_tender_participants SET status='withdrawn' WHERE supplier_id='${otherSupplier}'`)
    expect(count()).toBe(1)
    expect(() => pg.call(`SELECT create_procurement_commerce_approval('${ids.site}','${quote}',1,'award','${ids.owner}',1,
      '{"status":"ready","stages":[],"requirements":[],"minimumSupplierProposals":2}')`, ids.owner, 'service_role')).toThrow(/Minimum supplier/)
    expect(pg.db('SELECT count(*) FROM procurement_awards')).toBe('0')
    expect(pg.db(`SELECT status FROM suppliers WHERE id='${supplierId}'`)).toBe('approved')
  })

  test('historical request approvers cannot read a new unassigned revision', () => {
    installCommerceFixture(pg)
    correction()
    const document = policyWithStages({ approverIds: [actors.member], quorum: { mode: 'first_response' }, rejectionBehavior: 'return_for_correction' })
    pg.call(`SELECT save_procurement_policy('${ids.site}',1,${sqlJson(document)})`)
    const request = pg.call(saveRequest())
    pg.call(submitRequest(request, planFor(document), ids.owner, 1, 2), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM procurement_request_stages WHERE request_id='${request}'`)
    expect(pg.call(`SELECT count(*) FROM procurement_requests WHERE id='${request}'`, actors.member)).toBe('1')
    pg.call(`SELECT decide_procurement_request('${ids.site}','${request}',1,'${stage}','reject','Return for correction')`, actors.member)
    pg.call(saveRequest(request, 1))
    expect(pg.call(`SELECT count(*) FROM procurement_requests WHERE id='${request}'`, actors.member)).toBe('0')
    expect(pg.call(`SELECT count(*) FROM procurement_request_items WHERE request_id='${request}'`, actors.member)).toBe('0')
    expect(pg.call(`SELECT count(*) FROM procurement_requests WHERE id='${request}'`)).toBe('1')
  })
})