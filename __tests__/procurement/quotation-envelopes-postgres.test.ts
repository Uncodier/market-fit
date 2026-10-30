/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, migration } from '../security/isolated-postgres'
import { installCommerceFixture, ids, supplierId, publicationId, tenderId, quoteDocument, recordQuote, openAward } from './commerce-fixture'
import { sqlJson } from './storage-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('sealed quotation envelopes on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  const envelopes = (site = ids.site, actor = ids.owner) => JSON.parse(pg.call(`SELECT list_procurement_quotation_envelopes('${site}');`, actor))
  const quotes = () => JSON.parse(pg.call(`SELECT list_procurement_quotations('${ids.site}');`))
  const submit = () => pg.call(`SELECT submit_procurement_quotation('${ids.site}',${sqlJson(quoteDocument)});`, ids.foreign)
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installCommerceFixture(pg)
    pg.db(migration('20261030200000_procurement_quotation_envelopes.sql'))
    pg.db(migration('20261030210000_procurement_receipt_activity.sql'))
    pg.db('ALTER FUNCTION public.list_procurement_receipt_activity(uuid,uuid) OWNER TO postgres;')
    pg.db(`ALTER FUNCTION public.list_procurement_quotation_envelopes(uuid) OWNER TO postgres;
      CREATE FUNCTION public.procurement_can_represent(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$
        SELECT auth.uid()='${ids.foreign}'::uuid AND $1='${ids.site}'::uuid AND $2='${supplierId}'::uuid $$;
      CREATE TABLE public.supplier_representatives(site_id uuid,supplier_id uuid,user_id uuid,revoked_at timestamptz);
      INSERT INTO public.supplier_representatives VALUES('${ids.site}','${supplierId}','${ids.foreign}',NULL);
      GRANT SELECT,UPDATE ON public.supplier_representatives TO postgres;`)
  })

  test('returns only receipt metadata while contents remain sealed, and retries do not inflate counts', () => {
    expect(envelopes()).toEqual([])
    const id = submit()
    expect(submit()).toBe(id)
    expect(quotes()).toEqual([])
    const result = envelopes()
    expect(result).toEqual([{ tender_id: tenderId, publication_id: publicationId, tender_title: 'Tender',
      opening_at: expect.any(String), received_count: 1 }])
    expect(JSON.stringify(result)).not.toContain(id)
    expect(pg.call('SELECT count(*) FROM quotations;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM quotation_items;')).toBe('0')
    openAward(pg)
    expect(envelopes()).toEqual([])
    expect(quotes()).toEqual([expect.objectContaining({ id, reference: quoteDocument.reference, net_amount_minor: 2468 })])
  })

  test('counts every received envelope, not the 100-row opened quotation page', () => {
    const id = submit()
    // Synthetic receipts exercise aggregation beyond the legacy detail-page limit.
    pg.db(`SET session_replication_role=replica;
      INSERT INTO quotations SELECT (jsonb_populate_record(NULL::quotations,
        to_jsonb(q)||jsonb_build_object('id',gen_random_uuid(),
          'procurement_idempotency_key',gen_random_uuid(),'procurement_supplier_id',gen_random_uuid()))).*
      FROM quotations q CROSS JOIN generate_series(1,104) WHERE q.id='${id}';
      SET session_replication_role=origin;`)
    expect(envelopes()[0].received_count).toBe(105)
  })

  test('uses immutable publication terms, not the edited working version', () => {
    submit()
    pg.db(`UPDATE procurement_tenders SET version=2,opening_policy='on_receipt' WHERE id='${tenderId}';`)
    expect(envelopes()[0].received_count).toBe(1)
    expect(quotes()).toEqual([])
  })

  test('does not label buyer-recorded quotations as sealed', () => {
    pg.call(recordQuote())
    expect(envelopes()).toEqual([])
    expect(quotes()).toHaveLength(1)
  })
  test('does not label on-receipt quotations as sealed', () => {
    submit()
    pg.db(`SET session_replication_role=replica;
      UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{opening_policy}','"on_receipt"');
      SET session_replication_role=origin;`)
    expect(envelopes()).toEqual([])
    expect(quotes()).toHaveLength(1)
  })

  test.each([ids.foreign, ids.inactive, ids.collaborator])('denies unauthorized actor %s', actor => {
    submit()
    expect(() => envelopes(ids.site, actor)).toThrow(/access denied/)
  })
  test('denies foreign sites and anonymous/service-role calls', () => {
    submit()
    expect(envelopes(ids.otherSite, ids.foreign)).toEqual([])
    expect(() => envelopes(ids.otherSite)).toThrow(/access denied/)
    for (const role of ['anon', 'service_role']) {
      expect(() => pg.call(`SELECT list_procurement_quotation_envelopes('${ids.site}');`, ids.owner, role)).toThrow(/permission denied/)
    }
  })
  test('denies location-restricted managers', () => {
    pg.db(`UPDATE fixture_members SET restricted=true WHERE user_id='${ids.admin}';`)
    expect(() => envelopes(ids.site, ids.admin)).toThrow(/access denied/)
  })
  test('receipt activity includes historical submissions once and persists after opening', () => {
    const activity = () => JSON.parse(pg.call(`SELECT list_procurement_receipt_activity('${ids.site}','${tenderId}');`))
    expect(activity()).toEqual([])
    const id = submit()
    submit()
    const result = activity()
    expect(result).toEqual([{ receipt_number: 1, received_at: expect.any(String), publication_id: publicationId, publication_version: 1 }])
    expect(JSON.stringify(result)).not.toContain(id)
    openAward(pg)
    expect(activity()).toEqual(result)
  })
  test('receipt activity excludes buyer-recorded quotations and rejects unauthorized scopes', () => {
    pg.call(recordQuote())
    const sql = `SELECT list_procurement_receipt_activity('${ids.site}','${tenderId}');`
    expect(JSON.parse(pg.call(sql))).toEqual([])
    for (const actor of [ids.foreign, ids.inactive, ids.collaborator]) expect(() => pg.call(sql, actor)).toThrow(/access denied/)
    expect(() => pg.call(`SELECT list_procurement_receipt_activity('${ids.otherSite}','${tenderId}');`, ids.foreign)).toThrow(/access denied/)
    for (const role of ['anon', 'service_role']) expect(() => pg.call(sql, ids.owner, role)).toThrow(/permission denied/)
    pg.db(`UPDATE fixture_members SET restricted=true WHERE user_id='${ids.admin}';`)
    expect(() => pg.call(sql, ids.admin)).toThrow(/access denied/)
  })
})