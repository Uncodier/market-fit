/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, migration } from '../security/isolated-postgres'
import { installEvidenceFixture, ids, supplierId, quoteDocument, upload, sqlJson } from './evidence-fixture'
import { openAward, approve, itemId } from './commerce-fixture'

jest.setTimeout(180000)
;(postgresAvailable ? describe : describe.skip)('combined procurement migrations and external participant',()=>{
  const pg=isolatedPostgres()
  beforeAll(()=>{
    pg.start(); installEvidenceFixture(pg,true)
    pg.db(migration('20261027175000_catalog_procurement.sql'))
    pg.db(migration('20261028001000_procurement_approval_revalidation.sql'))
  })
  afterAll(()=>pg.stop())
  test('uses real supplier grants, evidence, quotations, award and order without sales effects',()=>{
    pg.call(`SELECT public.set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false)`)
    const evidence=upload(pg)
    const quote=pg.call(`SELECT public.submit_procurement_quotation('${ids.site}',${sqlJson({...quoteDocument,
      evidence:[{requirement_id:quoteDocument.lines[0].requirement_id,revision_id:evidence.revision_id}]})})`,ids.foreign)
    expect(pg.call('SELECT jsonb_array_length(public.my_procurement_submissions())',ids.foreign)).toBe('1')
    expect(pg.db(`SELECT site_id IS NULL AND lead_id IS NULL FROM quotations WHERE id='${quote}'`)).toBe('t')
    openAward(pg)
    pg.call(approve(quote,'award'),ids.owner,'service_role')
    const award=pg.db('SELECT id FROM public.procurement_awards LIMIT 1')
    pg.call(approve(award,'order'),ids.owner,'service_role')
    expect(pg.db('SELECT count(*) FROM public.purchase_orders')).toBe('1')
    pg.call(`UPDATE public.catalog_items SET procurement_enabled=true WHERE id='${itemId}'`)
    expect(pg.db(`SELECT procurement_enabled FROM public.catalog_items WHERE id='${itemId}'`)).toBe('t')
    expect(pg.db('SELECT count(*) FROM public.webhook_calls')).toBe('0')
  })
})