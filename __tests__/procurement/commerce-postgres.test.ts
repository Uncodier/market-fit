/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, actorSql } from '../security/isolated-postgres'
import { installCommerceFixture, ids, uuid, recordQuote, quoteDocument, openAward, approve, supplierId, tenderId } from './commerce-fixture'
import { sqlJson } from './storage-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('procurement commerce on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => installCommerceFixture(pg))

  test('reuses quotations without a seller tenant or fake lead, recomputes totals and suppresses seller webhooks', () => {
    const id = pg.call(recordQuote())
    const quote = JSON.parse(pg.db(`SELECT row_to_json(q) FROM quotations q WHERE id='${id}';`))
    expect(quote).toMatchObject({ purpose: 'procurement', site_id: null, lead_id: null, buyer_site_id: ids.site,
      procurement_net_minor: 2468, procurement_tax_minor: 395, subtotal: 24.68, total: 28.63 })
    expect(pg.db('SELECT count(*) FROM webhook_calls;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM quotations;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM quotation_items;')).toBe('0')
    expect(JSON.parse(pg.call(`SELECT list_procurement_quotations('${ids.site}');`))).toHaveLength(1)
    expect(pg.call(recordQuote())).toBe(id)
    expect(() => pg.call(recordQuote({ ...quoteDocument, reference: 'Different' }))).toThrow(/Idempotency/)
  })
  test.each([ids.foreign, ids.inactive, ids.collaborator])('denies foreign/inactive/non-manager %s', actor => {
    expect(() => pg.call(recordQuote(), actor)).toThrow(/access denied/)
    expect(() => pg.call(`SELECT list_procurement_quotations('${ids.site}');`, actor)).toThrow(/access denied/)
    expect(() => pg.call(`SELECT list_procurement_orders('${ids.site}');`, actor)).toThrow(/access denied/)
  })
  test('blocks service DML mutation, public tokens, buyer identity, checkout, deletion and item replacement', () => {
    const id = pg.call(recordQuote())
    for (const update of ["public_access_token='leak'", "status='accepted'", `buyer_user_id='${ids.owner}'`, "procurement_net_minor=1"]) {
      expect(() => pg.call(`UPDATE quotations SET ${update} WHERE id='${id}';`, ids.owner, 'service_role')).toThrow(/immutable/)
    }
    expect(() => pg.call(`DELETE FROM quotations WHERE id='${id}';`, ids.owner, 'service_role')).toThrow(/immutable/)
    expect(() => pg.call(`UPDATE quotation_items SET quantity=1 WHERE quotation_id='${id}';`, ids.owner, 'service_role')).toThrow(/immutable/)
    expect(() => pg.call(`SELECT create_procurement_commerce_approval('${ids.site}','${id}',1,'award','${ids.owner}',1,'{}');`)).toThrow(/permission denied/)
  })
  test('rejects client total/tax fields, missing lines, duplicate lines, expired terms and blocked suppliers', () => {
    expect(() => pg.call(recordQuote({ ...quoteDocument, total: 1 }))).toThrow(/Invalid quotation/)
    expect(() => pg.call(recordQuote({ ...quoteDocument, lines: [] }))).toThrow(/Invalid quotation/)
    expect(() => pg.call(recordQuote({ ...quoteDocument, lines: [quoteDocument.lines[0], quoteDocument.lines[0]] }))).toThrow(/exactly once/)
    pg.db(`UPDATE suppliers SET status='blocked' WHERE id='${supplierId}';`)
    expect(() => pg.call(recordQuote())).toThrow(/not approved/)
    pg.db(`UPDATE suppliers SET status='approved'; UPDATE procurement_tenders SET version=2 WHERE id='${tenderId}';`)
    expect(() => pg.call(recordQuote())).toThrow(/Publication changed/)
  })
  test('separate event approvals create one whole award and one immutable order, never payments', () => {
    const id = pg.call(recordQuote())
    expect(() => pg.call(approve(id, 'award'), ids.owner, 'service_role')).toThrow(/not open/)
    openAward(pg)
    const approvalId = pg.call(approve(id, 'award'), ids.owner, 'service_role')
    expect(pg.call(approve(id, 'award'), ids.owner, 'service_role')).toBe(approvalId)
    const award = pg.db('SELECT id FROM procurement_awards;')
    expect(pg.db('SELECT count(*) FROM purchase_orders;')).toBe('0')
    pg.call(approve(award, 'order'), ids.owner, 'service_role')
    pg.call(approve(award, 'order'), ids.owner, 'service_role')
    expect(pg.db('SELECT count(*) FROM purchase_orders;')).toBe('1')
    expect(pg.db('SELECT count(*) FROM purchase_order_items;')).toBe('1')
    expect(() => pg.call('INSERT INTO purchase_orders DEFAULT VALUES;')).toThrow(/permission denied/)
  })
  test('concurrent receipt retries are exactly once and overreceipts are rejected without partial writes', async () => {
    const id = pg.call(recordQuote()); openAward(pg)
    pg.call(approve(id, 'award'), ids.owner, 'service_role')
    pg.call(approve(pg.db('SELECT id FROM procurement_awards;'), 'order'), ids.owner, 'service_role')
    const order = pg.db('SELECT id FROM purchase_orders;'); const item = pg.db('SELECT id FROM purchase_order_items;')
    const input = { order_id: order, note: 'Service accepted', idempotency_key: uuid(880), lines: [{ item_id: item, quantity: 1 }] }
    const sql = `SELECT record_procurement_receipt('${ids.site}',${sqlJson(input)});`
    const results = await Promise.all([pg.concurrent(actorSql(sql)), pg.concurrent(actorSql(sql))])
    expect(results[0]).toBe(results[1])
    expect(pg.db('SELECT count(*) FROM procurement_receipts;')).toBe('1')
    const over = { ...input, idempotency_key: uuid(881), lines: [{ item_id: item, quantity: 2 }] }
    expect(() => pg.call(`SELECT record_procurement_receipt('${ids.site}',${sqlJson(over)});`)).toThrow(/exceeds/)
    expect(pg.db('SELECT count(*) FROM procurement_receipts;')).toBe('1')
  })

  test('supplier submission fails closed without a grant, returns own receipt and stays sealed to buyer until opening', () => {
    const submit = `SELECT submit_procurement_quotation('${ids.site}',${sqlJson(quoteDocument)});`
    expect(() => pg.call(submit, ids.foreign)).toThrow(/Verified representation/)
    pg.db(`CREATE FUNCTION public.procurement_can_represent(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$
      SELECT auth.uid()='${ids.foreign}'::uuid AND $1='${ids.site}'::uuid AND $2='${supplierId}'::uuid $$;
      CREATE TABLE public.supplier_representatives(site_id uuid,supplier_id uuid,user_id uuid,revoked_at timestamptz);
      INSERT INTO public.supplier_representatives VALUES('${ids.site}','${supplierId}','${ids.foreign}',NULL);
      GRANT SELECT,UPDATE ON public.supplier_representatives TO postgres;`)
    const id = pg.call(submit, ids.foreign)
    expect(pg.call(submit, ids.foreign)).toBe(id)
    expect(JSON.parse(pg.call('SELECT my_procurement_submissions();', ids.foreign))).toHaveLength(1)
    expect(JSON.parse(pg.call('SELECT my_procurement_submissions();', ids.admin))).toHaveLength(0)
    expect(JSON.parse(pg.call(`SELECT list_procurement_quotations('${ids.site}');`))).toHaveLength(0)
    openAward(pg)
    expect(JSON.parse(pg.call(`SELECT list_procurement_quotations('${ids.site}');`))).toHaveLength(1)
  })
})