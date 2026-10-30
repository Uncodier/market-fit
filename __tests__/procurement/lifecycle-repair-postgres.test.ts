/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, actorSql } from '../security/isolated-postgres'
import { installLifecycleFixture, linkedDraft, publish, quote, openAward, approvalSql, requestPolicy,
  revalidateSql, plainPolicy, ids, uuid, saveSql, saveTender, submitRequest, planFor, saveRequest, sqlJson, supplierId } from './lifecycle-repair-fixture'
import { policyWithStages, decideRequest } from './requests-fixture'
import { actors } from './storage-fixture'
import { approvalStageSchema, procurementRuleSchema } from '@/app/purchases/procurement/domain'

;(postgresAvailable ? describe : describe.skip)('procurement lifecycle repair on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => installLifecycleFixture(pg))

  test.each(['participation', 'award', 'order'] as const)('inherits saved %s requirements at the required milestone', milestone => {
    const fixture = linkedDraft(pg, requestPolicy(milestone))
    if (milestone === 'participation') {
      expect(() => publish(pg, fixture.tender, fixture.document)).toThrow(/requirements unresolved/)
      expect(pg.db(`SELECT count(*) FROM procurement_tender_publications WHERE tender_id='${fixture.tender}'`)).toBe('0')
      return
    }
    const publication = publish(pg, fixture.tender, fixture.document)
    const quotation = quote(pg, fixture.tender, publication)
    openAward(pg)
    if (milestone === 'award') expect(() => pg.call(approvalSql(quotation, 'award'), ids.owner, 'service_role')).toThrow(/Inherited request requirements/)
    else {
      pg.call(approvalSql(quotation, 'award'), ids.owner, 'service_role')
      const award = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${quotation}'`)
      expect(() => pg.call(approvalSql(award, 'order'), ids.owner, 'service_role')).toThrow(/Inherited request requirements/)
    }
    expect(pg.db('SELECT count(*) FROM purchase_orders')).toBe('0')
  })

  test('rejects the original min3/one-proposal bypass even with an empty service-supplied event plan', () => {
    const f = linkedDraft(pg, requestPolicy(null, 3))
    const pub = publish(pg, f.tender, f.document)
    const q = quote(pg, f.tender, pub)
    openAward(pg)
    expect(() => pg.call(approvalSql(q, 'award'), ids.owner, 'service_role')).toThrow(/Inherited minimum supplier proposals/)
    expect(pg.db('SELECT count(*) FROM procurement_awards')).toBe('0')
  })

  test('pins original request plan through revalidation and amended publication', () => {
    const f = linkedDraft(pg, requestPolicy('award', 3))
    publish(pg, f.tender, f.document)
    pg.call(saveSql(2, plainPolicy()))
    pg.call(revalidateSql(f.request))
    pg.call(submitRequest(f.request, planFor(plainPolicy()), ids.owner, 2, 3), ids.owner, 'service_role')
    pg.call(saveTender(f.tender, 1, { ...f.tenderDoc, title: 'Amended title' }))
    const pub = publish(pg, f.tender, plainPolicy(), 2, 3)
    const q = quote(pg, f.tender, pub, undefined, undefined, 2)
    openAward(pg)
    expect(() => pg.call(approvalSql(q, 'award', plainPolicy(), 3), ids.owner, 'service_role')).toThrow(/Inherited request requirements/)
    expect(pg.db(`SELECT COALESCE(request_plan->>'minimumSupplierProposals','null') FROM procurement_tender_policy_bindings WHERE tender_id='${f.tender}' ORDER BY request_revision`)).toBe('3\nnull')
    expect(pg.call(`SELECT snapshot ? 'request_id' OR snapshot ? 'request_plan' FROM public_procurement_tenders(NULL,NULL,0,'')`, ids.owner, 'anon')).toBe('')
    expect(() => pg.call('SELECT * FROM procurement_tender_policy_bindings')).toThrow(/permission denied/)
  })

  test('prevents linkage edits and cannot launder unpublished amendments through close', () => {
    const f = linkedDraft(pg)
    const pub = publish(pg, f.tender)
    const q = quote(pg, f.tender, pub)
    expect(() => pg.call(saveTender(f.tender, 1, { ...f.tenderDoc, request_id: null }))).toThrow(/binding is immutable/)
    pg.call(saveTender(f.tender, 1, { ...f.tenderDoc, description: 'Unpublished change' }))
    openAward(pg)
    expect(() => pg.call(`SELECT transition_procurement_tender('${ids.site}','${f.tender}',2,'close')`)).toThrow(/Publish all amendments/)
    expect(() => pg.call(approvalSql(q, 'award'), ids.owner, 'service_role')).toThrow(/unpublished amendments/)
    expect(pg.db('SELECT count(*) FROM purchase_orders')).toBe('0')
  })

  test('unchanged published tender can close, award and order; committed request cannot be reset', () => {
    const f = linkedDraft(pg)
    const q = quote(pg, f.tender, publish(pg, f.tender))
    openAward(pg)
    pg.call(`SELECT transition_procurement_tender('${ids.site}','${f.tender}',1,'close')`)
    pg.call(approvalSql(q, 'award'), ids.owner, 'service_role')
    const award = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${q}'`)
    pg.call(approvalSql(award, 'order'), ids.owner, 'service_role')
    expect(pg.db('SELECT count(*) FROM purchase_orders')).toBe('1')
    expect(() => pg.call(revalidateSql(f.request))).toThrow(/Committed orders/)
    expect(pg.db(`SELECT status||':'||revision FROM procurement_requests WHERE id='${f.request}'`)).toBe('approved:1')
  })

  test('explicit revalidation preserves history and immutable lines, requires fresh normal approvals', () => {
    const doc = policyWithStages({ approverIds: [ids.owner], quorum: { mode: 'all' } })
    pg.call(saveSql(1, doc))
    const request = pg.call(saveRequest())
    pg.call(submitRequest(request, planFor(doc), ids.owner, 1, 2), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM procurement_request_stages WHERE request_id='${request}'`)
    pg.call(decideRequest(request, stage))
    pg.call(saveSql(2, doc))
    pg.call(revalidateSql(request))
    expect(pg.db(`SELECT status||':'||revision FROM procurement_requests WHERE id='${request}'`)).toBe('draft:2')
    expect(pg.db(`SELECT count(*) FROM procurement_request_stages WHERE request_id='${request}' AND revision=2`)).toBe('0')
    expect(pg.db(`SELECT (SELECT jsonb_agg(to_jsonb(i)-ARRAY['id','revision']) FROM procurement_request_items i WHERE request_id='${request}' AND revision=1) =
      (SELECT jsonb_agg(to_jsonb(i)-ARRAY['id','revision']) FROM procurement_request_items i WHERE request_id='${request}' AND revision=2)`)).toBe('t')
    expect(() => pg.call(saveRequest(request, 2))).toThrow(/preserves approved content/)
    pg.call(submitRequest(request, planFor(doc), ids.owner, 2, 3), ids.owner, 'service_role')
    expect(pg.db(`SELECT status FROM procurement_requests WHERE id='${request}'`)).toBe('submitted')
    expect(pg.db(`SELECT status FROM procurement_request_stages WHERE id='${stage}'`)).toBe('approved')
    expect(pg.db(`SELECT count(*) FROM procurement_request_decisions WHERE stage_id='${stage}'`)).toBe('1')
    expect(pg.db(`SELECT count(*) FROM procurement_request_audit WHERE request_id='${request}' AND event='approval_revalidation_started'`)).toBe('1')
    const next = pg.db(`SELECT id FROM procurement_request_stages WHERE request_id='${request}' AND revision=2`)
    pg.call(decideRequest(request, next, 'approve', 2))
    expect(pg.db(`SELECT status||':'||policy_revision FROM procurement_requests WHERE id='${request}'`)).toBe('approved:3')
  })

  test('revalidation rejects anonymous, ordinary, foreign, restricted and stale callers', () => {
    const f = linkedDraft(pg)
    for (const [user, role] of [[ids.owner, 'anon'], [ids.collaborator, 'authenticated'], [ids.foreign, 'authenticated']]) {
      expect(() => pg.call(revalidateSql(f.request), user, role)).toThrow()
    }
    expect(() => pg.call(revalidateSql(f.request, 2))).toThrow(/revision or state/)
    expect(() => pg.call(revalidateSql(f.request, 1, ids.otherSite))).toThrow(/access denied/)
    expect(() => pg.call(revalidateSql(f.request), actors.restricted)).toThrow(/access denied/)
  })

  test('a returned revalidation can explicitly restart unchanged without reusing rejected votes', () => {
    const f = linkedDraft(pg)
    const doc = policyWithStages({ approverIds: [ids.owner], rejectionBehavior: 'return_for_correction' })
    pg.call(saveSql(2, doc))
    pg.call(revalidateSql(f.request))
    pg.call(submitRequest(f.request, planFor(doc), ids.owner, 2, 3), ids.owner, 'service_role')
    const stage = pg.db(`SELECT id FROM procurement_request_stages WHERE request_id='${f.request}' AND revision=2`)
    pg.call(decideRequest(f.request, stage, 'reject', 2))
    expect(() => pg.call(saveRequest(f.request, 2))).toThrow(/preserves approved content/)
    pg.call(revalidateSql(f.request, 2))
    expect(pg.db(`SELECT status||':'||revision FROM procurement_requests WHERE id='${f.request}'`)).toBe('draft:3')
    pg.call(submitRequest(f.request, planFor(doc), ids.owner, 3, 3), ids.owner, 'service_role')
    expect(pg.db(`SELECT status FROM procurement_request_stages WHERE id='${stage}'`)).toBe('rejected')
    expect(pg.db(`SELECT status FROM procurement_request_stages WHERE request_id='${f.request}' AND revision=3`)).toBe('pending')
  })

  test('uses max proposal requirement and rechecks inherited minimum at the final human vote', () => {
    const f = linkedDraft(pg, requestPolicy(null, 3))
    const pub = publish(pg, f.tender, f.document)
    const q = quote(pg, f.tender, pub)
    const suppliers: string[] = []
    for (const n of [991, 992]) {
      const supplier = { name: `Supplier ${n}`, status: 'prospect', company_id: null, commercial_terms: '', private_notes: '', contacts: [], category_ids: [] }
      const created = JSON.parse(pg.call(`SELECT save_procurement_supplier('${ids.site}',NULL,0,${sqlJson(supplier)})`))
      for (const [index, status] of ['under_review', 'approved'].entries()) {
        pg.call(`SELECT save_procurement_supplier('${ids.site}','${created.id}',${index + 1},${sqlJson({ ...supplier, status })})`)
      }
      suppliers.push(created.id)
      quote(pg, f.tender, pub, created.id, uuid(n + 10))
    }
    openAward(pg)
    const context = JSON.parse(pg.call(`SELECT procurement_commerce_event_context('${ids.site}','${q}',1,'award')`))
    expect(context).toMatchObject({ minimum_supplier_proposals: 3, supplier_proposals: 3 })
    const doc = policyWithStages({ approverIds: [ids.admin], quorum: { mode: 'all' } })
    const plan = { ...planFor(doc), minimumSupplierProposals: 4 }
    const approval = (value: unknown) => `SELECT create_procurement_commerce_approval('${ids.site}','${q}',1,'award','${ids.owner}',2,${sqlJson(value)})`
    expect(() => pg.call(approval(plan), ids.owner, 'service_role')).toThrow(/Minimum supplier proposals/)
    plan.minimumSupplierProposals = 1
    const pending = pg.call(approval(plan), ids.owner, 'service_role')
    pg.call(`SELECT set_procurement_tender_participant('${ids.site}','${f.tender}',1,'${suppliers[0]}','withdrawn')`)
    const stage = pg.db(`SELECT id FROM procurement_event_stages WHERE approval_id='${pending}'`)
    expect(() => pg.call(`SELECT decide_procurement_event('${ids.site}','${pending}','${stage}','approve','Reviewed')`, ids.admin)).toThrow(/Inherited minimum supplier proposals/)
    expect(pg.db('SELECT count(*) FROM procurement_event_decisions')).toBe('0')
    expect(pg.db('SELECT count(*) FROM procurement_awards')).toBe('0')
    expect(pg.db(`SELECT status FROM suppliers WHERE id='${supplierId}'`)).toBe('approved')
  })

  test('concurrent revalidation has one winner without duplicate snapshots', async () => {
    const f = linkedDraft(pg)
    const results = await Promise.allSettled([pg.concurrent(actorSql(revalidateSql(f.request))), pg.concurrent(actorSql(revalidateSql(f.request)))])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(pg.db(`SELECT count(*) FROM procurement_request_items WHERE request_id='${f.request}' AND revision=2`)).toBe('1')
  })

  test('an order commit serializes ahead of revalidation and prevents silent invalidation', async () => {
    const f = linkedDraft(pg)
    const q = quote(pg, f.tender, publish(pg, f.tender))
    openAward(pg)
    pg.call(approvalSql(q, 'award'), ids.owner, 'service_role')
    const award = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${q}'`)
    const order = pg.concurrent(actorSql(`BEGIN; SET application_name='lifecycle_order_race';
      SELECT pg_advisory_xact_lock(hashtextextended('procurement_policy:${ids.site}',0));
      SELECT pg_sleep(1); ${approvalSql(award, 'order')}; COMMIT;`, ids.owner, 'service_role'))
    for (let attempt = 0; attempt < 50; attempt++) {
      if (pg.db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='lifecycle_order_race' AND wait_event='PgSleep'`) === '1') break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    const reset = pg.concurrent(actorSql(revalidateSql(f.request)))
    const results = await Promise.allSettled([order, reset])
    expect(results[0].status).toBe('fulfilled')
    expect(results[1]).toMatchObject({ status: 'rejected', reason: expect.objectContaining({ message: expect.stringContaining('Committed orders') }) })
    expect(pg.db('SELECT count(*) FROM purchase_orders')).toBe('1')
    expect(pg.db(`SELECT status||':'||revision FROM procurement_requests WHERE id='${f.request}'`)).toBe('approved:1')
  })

  test.each([false, true])('ordinary assigned publication approver finalizes under the initiating manager, revoked=%s', revoked => {
    const doc = plainPolicy()
    doc.rules = [procurementRuleSchema.parse({ id: 'release', name: 'Release approval', status: 'active', type: 'approval', event: 'publication',
      stages: [approvalStageSchema.parse({ id: 'release-vote', name: 'Independent approval', decisionMode: 'human',
        approverIds: [actors.member], quorum: { mode: 'all' }, allowSelfApproval: false, execution: 'parallel',
        rejectionBehavior: 'veto', timeoutAction: 'block' })] })]
    const f = linkedDraft(pg, doc)
    publish(pg, f.tender, doc)
    const approval = pg.db(`SELECT id FROM procurement_event_approvals WHERE target_id='${f.tender}'`)
    const stage = pg.db(`SELECT id FROM procurement_event_stages WHERE approval_id='${approval}'`)
    if (revoked) pg.db(`UPDATE sites SET user_id='${ids.foreign}' WHERE id='${ids.site}'`)
    const decision = () => pg.call(`SELECT decide_procurement_event('${ids.site}','${approval}','${stage}','approve','Independent review')`, actors.member)
    if (revoked) {
      expect(decision).toThrow(/Publisher access revoked/)
      expect(pg.db(`SELECT count(*) FROM procurement_event_decisions WHERE stage_id='${stage}'`)).toBe('0')
    } else {
      decision()
      expect(pg.db(`SELECT count(*) FROM procurement_tender_policy_bindings WHERE tender_id='${f.tender}'`)).toBe('1')
    }
  })
})