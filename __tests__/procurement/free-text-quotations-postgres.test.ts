/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { installEvidenceFixture, ids, uuid, supplierId, quoteDocument, sqlJson, upload } from './evidence-fixture'
import { itemId, openAward, publicationId, tenderId, requirementId, approve } from './commerce-fixture'

jest.setTimeout(180000)
const forward = '20261030190000_procurement_free_text_quotations.sql'
const describePg = postgresAvailable ? describe : describe.skip

describePg('free-text quotations on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installEvidenceFixture(pg, true)
    for (const file of ['20261028001000_procurement_approval_revalidation.sql',
      '20261028020000_procurement_lifecycle_repair.sql', '20261028020001_procurement_commerce_lifecycle_repair.sql',
      '20261030120000_procurement_open_self_participation.sql', '20261030130000_procurement_proposal_attachments.sql', forward]) pg.db(migration(file))
    pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
      DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false);`)
  })
  function lines(mapping: string | null, mixed = false) {
    const requirements = [{ id: requirementId, description: 'Free service', quantity: 2, unit: 'hours', unit_net_minor: 1234, catalog_item_id: mapping },
      ...(mixed ? [{ id: uuid(899), description: 'Equipment', quantity: 1, unit: 'each', unit_net_minor: 100, catalog_item_id: itemId }] : [])]
    pg.db(`SET session_replication_role=replica;
      UPDATE procurement_tenders SET requirements=${sqlJson(requirements)} WHERE id='${tenderId}';
      UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{requirements}',${sqlJson(requirements)}) WHERE id='${publicationId}';
      UPDATE procurement_tender_policy_bindings SET working_snapshot=(SELECT to_jsonb(t)-ARRAY['status','updated_at','version'] FROM procurement_tenders t WHERE id='${tenderId}');
      SET session_replication_role=origin;`)
    return { ...quoteDocument, lines: requirements.map(line => ({ requirement_id: line.id, unit_net_minor: line.unit_net_minor })) }
  }
  const submit = (document: unknown, actor = ids.foreign) => pg.call(
    `SELECT submit_procurement_quotation('${ids.site}',${sqlJson(document)});`, actor)

  test.each([false, true])('accepts free-text and mixed=%s offers with unknown rather than zero tax', mixed => {
    const document = lines(null, mixed)
    const before = pg.db('SELECT count(*) FROM catalog_items;')
    const quote = submit(document)
    expect(submit(document)).toBe(quote)
    expect(pg.db('SELECT count(*) FROM catalog_items;')).toBe(before)
    expect(pg.db(`SELECT procurement_tax_minor IS NULL AND tax_total IS NULL AND total IS NULL FROM quotations WHERE id='${quote}';`)).toBe('t')
    expect(pg.db(`SELECT procurement_net_minor FROM quotations WHERE id='${quote}';`)).toBe(mixed ? '2568' : '2468')
    expect(pg.db(`SELECT catalog_item_id IS NULL AND procurement_tax_minor IS NULL AND procurement_tax_snapshot IS NULL FROM quotation_items WHERE quotation_id='${quote}' AND procurement_requirement_id='${requirementId}';`)).toBe('t')
    expect(pg.call('SELECT count(*) FROM quotations;', ids.foreign)).toBe('0')
    const own = JSON.parse(pg.call('SELECT my_procurement_submissions();', ids.foreign))
    expect(own[0].tax_amount_minor).toBeNull()
    expect(JSON.parse(pg.call(`SELECT list_procurement_quotations('${ids.site}');`))).toEqual([])
    openAward(pg)
    const buyer = JSON.parse(pg.call(`SELECT list_procurement_quotations('${ids.site}');`))[0]
    expect(buyer.tax_amount_minor).toBeNull()
    expect(buyer.lines).toHaveLength(mixed ? 2 : 1)
    const context = JSON.parse(pg.call(`SELECT procurement_commerce_event_context('${ids.site}','${quote}',1,'award');`))
    expect(context.lines).toHaveLength(mixed ? 2 : 1)
    expect(context.lines.find((line: { productId: string | null }) => line.productId === null)).toMatchObject({ categoryIds: [], netAmountMinor: 2468 })
  })

  test('mapped offers retain calculated taxes and may progress to orders', () => {
    const quote = submit(lines(itemId))
    expect(pg.db(`SELECT procurement_tax_minor IS NOT NULL AND total=subtotal+tax_total FROM quotations WHERE id='${quote}';`)).toBe('t')
    openAward(pg)
    pg.call(approve(quote, 'award'), ids.owner, 'service_role')
    const award = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${quote}';`)
    pg.call(approve(award, 'order'), ids.owner, 'service_role')
    expect(pg.db('SELECT count(*) FROM purchase_orders;')).toBe('1')
  })

  test('open personal participation accepts the existing publication without creating catalog products', () => {
    const document = lines(null)
    pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',true);`)
    pg.db(`SET session_replication_role=replica;
      UPDATE procurement_tenders SET visibility='public',participation='open' WHERE id='${tenderId}';
      UPDATE procurement_tender_publications SET visibility='public',snapshot=jsonb_set(snapshot,'{participation}','"open"') WHERE id='${publicationId}';
      SET session_replication_role=origin;`)
    const self = pg.call(`SELECT register_open_tender_participant('${publicationId}');`, ids.admin)
    const quote = submit({ ...document, supplier_id: self }, ids.admin)
    expect(submit({ ...document, supplier_id: self }, ids.admin)).toBe(quote)
    expect(pg.db(`SELECT procurement_publication_id FROM quotations WHERE id='${quote}';`)).toBe(publicationId)
    expect(pg.db(`SELECT status FROM suppliers WHERE id='${self}';`)).toBe('prospect')
  })

  test('a failed pre-migration attempt can retry with the original immutable key', () => {
    const document = lines(null)
    // Reinstall only the preceding capture function to reproduce the live rejection.
    const old = migration('20261030130000_procurement_proposal_attachments.sql')
    const start = old.indexOf('CREATE OR REPLACE FUNCTION public.capture_procurement_quotation')
    pg.db(old.slice(start, old.indexOf('END $$;', start) + 'END $$;'.length))
    expect(() => submit(document)).toThrow(/Active same-currency catalog mapping required/)
    expect(pg.db('SELECT count(*) FROM quotations;')).toBe('0')
    const next = migration(forward)
    const nextStart = next.indexOf('CREATE OR REPLACE FUNCTION public.capture_procurement_quotation')
    pg.db(next.slice(nextStart, next.indexOf('END $$;', nextStart) + 'END $$;'.length))
    const quote = submit(document)
    expect(submit(document)).toBe(quote)
    expect(pg.db(`SELECT procurement_idempotency_key FROM quotations WHERE id='${quote}';`)).toBe(document.idempotency_key)
  })

  test('net-only offers can be awarded but cannot materialize an order with unknown taxes', () => {
    const quote = submit(lines(null))
    openAward(pg)
    pg.call(approve(quote, 'award'), ids.owner, 'service_role')
    const award = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${quote}';`)
    expect(() => pg.call(approve(award, 'order'), ids.owner, 'service_role')).toThrow(/mapping and taxes must be resolved/)
    expect(pg.db('SELECT count(*) FROM purchase_orders;')).toBe('0')
  })

  test('evidence remains scoped and invalid evidence rolls back net-only offers', () => {
    const document = lines(null)
    const foreign = upload(pg, ids.admin)
    expect(() => submit({ ...document, evidence: [{ requirement_id: requirementId, revision_id: foreign.revision_id }] })).toThrow(/Private evidence unavailable/)
    expect(pg.db('SELECT count(*) FROM quotations;')).toBe('0')
    const own = upload(pg)
    expect(submit({ ...document, evidence: [{ requirement_id: requirementId, revision_id: own.revision_id }] })).toBeTruthy()
  })

  test('no mapping does not relax actor authorization, idempotency or immutable storage', () => {
    const document = lines(null)
    expect(() => submit(document, ids.admin)).toThrow(/representation required/)
    expect(() => pg.call(`SELECT submit_procurement_quotation('${ids.site}',${sqlJson(document)});`, ids.foreign, 'anon')).toThrow(/permission denied/)
    const quote = submit(document)
    expect(() => submit({ ...document, reference: 'Changed' })).toThrow(/Idempotency conflict/)
    expect(() => pg.db(`UPDATE quotation_items SET name='Changed' WHERE quotation_id='${quote}';`)).toThrow(/immutable/)
    expect(() => pg.db(`DELETE FROM quotations WHERE id='${quote}';`)).toThrow(/immutable/)
  })

  test.each(['missing', 'inactive', 'currency', 'foreign'])('explicit %s mappings still fail closed', kind => {
    let mapping = itemId
    if (kind === 'missing') mapping = uuid(999)
    if (kind === 'inactive') pg.db(`UPDATE catalog_items SET status='inactive' WHERE id='${itemId}';`)
    if (kind === 'currency') pg.db(`UPDATE catalog_items SET currency='EUR' WHERE id='${itemId}';`)
    if (kind === 'foreign') pg.db(`UPDATE catalog_items SET site_id='${ids.otherSite}' WHERE id='${itemId}';`)
    expect(() => submit(lines(mapping))).toThrow(/Active same-currency catalog mapping required/)
    expect(pg.db('SELECT count(*) FROM quotations;')).toBe('0')
  })

  test('sales still require catalog items and non-null tax totals', () => {
    expect(() => pg.db(`INSERT INTO quotations(id,site_id,lead_id,tax_total,total) VALUES('${uuid(901)}','${ids.site}','${uuid(902)}',NULL,NULL);`)).toThrow(/quotation_purpose_boundary/)
    pg.db(`INSERT INTO quotations(id,site_id,lead_id) VALUES('${uuid(901)}','${ids.site}','${uuid(902)}');`)
    expect(() => pg.db(`INSERT INTO quotation_items(quotation_id,name,catalog_item_id) VALUES('${uuid(901)}','No product',NULL);`)).toThrow(/Sales item cannot contain procurement state|quotation_item_catalog_scope/)
  })
})