/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, migration } from '../security/isolated-postgres'
import { installEvidenceFixture, upload } from './evidence-fixture'
import { linkedDraft, publish, approvalSql, ids, uuid, itemId, sqlJson, supplierId, openAward, revalidateSql } from './lifecycle-repair-fixture'

;(postgresAvailable ? describe : describe.skip)('lifecycle repairs with the complete procurement migration chain', () => {
  const pg = isolatedPostgres()
  beforeAll(() => {
    pg.start(); installEvidenceFixture(pg, true)
    // Legacy inventory dependencies only; procurement behavior is real migration SQL.
    pg.db(`CREATE TABLE public.locations(id uuid PRIMARY KEY,site_id uuid,name text,is_active boolean);
      CREATE TABLE public.inventory_levels(id uuid PRIMARY KEY,site_id uuid,catalog_item_id uuid,location_id uuid,quantity numeric,updated_at timestamptz);
      ALTER TABLE public.catalog_items ADD COLUMN track_inventory boolean DEFAULT true;`)
    for (const file of ['20261027175000_catalog_procurement.sql', '20261028001000_procurement_approval_revalidation.sql',
      '20261028010000_procurement_replenishment.sql', '20261028010001_procurement_replenishment_queue.sql',
      '20261028020000_procurement_lifecycle_repair.sql', '20261028020001_procurement_commerce_lifecycle_repair.sql',
      '20261028021000_procurement_replenishment_repair.sql']) pg.db(migration(file))
    pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
      DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
  })
  afterAll(() => pg.stop())
  test('real represented supplier evidence -> closed tender -> award -> PO, with no sales side effects or public request leak', () => {
    const f = linkedDraft(pg)
    pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',true)`)
    pg.call(`SELECT save_procurement_tender('${ids.site}','${f.tender}',1,${sqlJson({ ...f.tenderDoc, visibility: 'public' })})`)
    const publication = publish(pg, f.tender, f.document, 2)
    pg.call(`SELECT set_procurement_tender_participant('${ids.site}','${f.tender}',2,'${supplierId}','invited')`)
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false)`)
    const evidence = upload(pg)
    const q = pg.call(`SELECT submit_procurement_quotation('${ids.site}',${sqlJson({ supplier_id: supplierId,
      tender_id: f.tender, publication_id: publication, reference: 'External supplier', idempotency_key: uuid(950),
      lines: [{ requirement_id: uuid(970), unit_net_minor: 1234 }],
      evidence: [{ requirement_id: uuid(970), revision_id: evidence.revision_id }] })})`, ids.foreign)
    const slug = pg.db(`SELECT portal_slug FROM procurement_tenders WHERE id='${f.tender}'`)
    const siteSlug = pg.db(`SELECT slug FROM procurement_tender_portals WHERE site_id='${ids.site}'`)
    const publicJson = pg.call(`SELECT row_to_json(p) FROM public_procurement_tenders('${siteSlug}','${slug}',0,'') p`, ids.foreign, 'anon')
    expect(publicJson).not.toContain(f.request)
    expect(publicJson).not.toContain('request_plan')
    expect(publicJson).toContain('Office equipment')
    openAward(pg)
    pg.call(`SELECT transition_procurement_tender('${ids.site}','${f.tender}',2,'close')`)
    pg.call(approvalSql(q, 'award'), ids.owner, 'service_role')
    const award = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${q}'`)
    pg.call(approvalSql(award, 'order'), ids.owner, 'service_role')
    expect(pg.db('SELECT count(*) FROM purchase_orders')).toBe('1')
    expect(() => pg.call(revalidateSql(f.request))).toThrow(/Committed orders/)
    expect(pg.db(`SELECT site_id IS NULL AND lead_id IS NULL FROM quotations WHERE id='${q}'`)).toBe('t')
    expect(pg.db('SELECT count(*) FROM webhook_calls')).toBe('0')
    pg.call(`UPDATE catalog_items SET procurement_enabled=true WHERE id='${itemId}'`)
    expect(pg.db(`SELECT procurement_enabled FROM catalog_items WHERE id='${itemId}'`)).toBe('t')
  })
})