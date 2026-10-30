/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { installEvidenceFixture, ids, uuid, supplierId, quoteDocument, sqlJson, metadata, reserve, upload } from './evidence-fixture'
import { openAward, publicationId, tenderId, requirementId } from './commerce-fixture'

jest.setTimeout(180000)
const forward = '20261030130000_procurement_proposal_attachments.sql'
const describePg = postgresAvailable ? describe : describe.skip

test('proposal migration preserves receipt idempotency and private execution', () => {
  const sql = migration(forward)
  expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
  expect(sql).toContain('q.procurement_input IS DISTINCT FROM p_document')
  expect(sql).toContain("revision.metadata->>'type'='tender_proposal'")
  expect(sql).toContain('public.attach_procurement_quotation_proposal(result,')
  expect(sql.trim().endsWith('COMMIT;')).toBe(true)
})

describePg('immutable quotation proposals on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installEvidenceFixture(pg, true)
    for (const file of ['20261028001000_procurement_approval_revalidation.sql',
      '20261028020000_procurement_lifecycle_repair.sql', '20261028020001_procurement_commerce_lifecycle_repair.sql',
      '20261030120000_procurement_open_self_participation.sql', forward]) pg.db(migration(file))
    pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
      DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false);`)
  })
  const document = (revision?: string, extra = {}) => ({ ...quoteDocument,
    ...(revision ? { proposal_revision_id: revision } : {}), ...extra })
  const submit = (revision?: string, extra = {}) => pg.call(
    `SELECT submit_procurement_quotation('${ids.site}',${sqlJson(document(revision, extra))});`, ids.foreign)
  function proposal(actor = ids.foreign, changes = {}, mime = 'application/pdf', ready = true) {
    const r = JSON.parse(pg.call(`SELECT reserve_procurement_credential(NULL,0,${sqlJson({ ...metadata, type: 'tender_proposal', ...changes })},'proposal.pdf','${mime}',10);`, actor))
    if (ready) {
      pg.call(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('procurement-credentials','${r.object_path}',${sqlJson({ size: 10, mimetype: mime })});`, actor)
      pg.call(`SELECT complete_procurement_credential('${r.revision_id}');`, actor)
    }
    return r as { credential_id: string; revision_id: string; object_path: string }
  }
  test('optional PDF stays sealed, survives renewal/archive and opens only to scoped buyer', () => {
    const r = proposal(); const q = submit(r.revision_id)
    expect(submit(r.revision_id)).toBe(q)
    expect(pg.call('SELECT count(*) FROM procurement_quotation_attachments;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM storage.objects;')).toBe('0')
    expect(pg.call('SELECT revision_id FROM procurement_quotation_attachments;', ids.foreign)).toBe(r.revision_id)
    expect(pg.db('SELECT count(*) FROM procurement_submission_evidence;')).toBe('0')
    const renewal = JSON.parse(pg.call(reserve(r.credential_id, 1, { ...metadata, type: 'tender_proposal' }), ids.foreign))
    pg.call(`SELECT archive_procurement_credential('${r.credential_id}',2);`, ids.foreign)
    expect(submit(r.revision_id)).toBe(q)
    openAward(pg)
    expect(pg.call('SELECT revision_id FROM procurement_quotation_attachments;')).toBe(r.revision_id)
    expect(pg.call('SELECT name FROM storage.objects;')).toBe(r.object_path)
    expect(pg.call(`SELECT count(*) FROM procurement_credential_revisions WHERE id='${renewal.revision_id}';`)).toBe('0')
    for (const actor of [ids.inactive, ids.collaborator]) expect(pg.call('SELECT count(*) FROM procurement_quotation_attachments;', actor)).toBe('0')
    expect(() => pg.call('SELECT count(*) FROM procurement_quotation_attachments;', ids.admin, 'anon')).toThrow(/permission denied/)
  })
  test('foreign, pending, archived, wrong type and image selections roll back quote/items', () => {
    const archived = proposal()
    pg.call(`SELECT archive_procurement_credential('${archived.credential_id}',1);`, ids.foreign)
    const invalid = [proposal(ids.owner), proposal(ids.foreign, {}, 'application/pdf', false), archived,
      proposal(ids.foreign, { type: 'professional_license' }), proposal(ids.foreign, {}, 'image/png')]
    for (const r of invalid) expect(() => submit(r.revision_id)).toThrow(/Private proposal unavailable/)
    expect(pg.db("SELECT count(*) FROM quotations WHERE purpose='procurement';")).toBe('0')
    expect(pg.db('SELECT count(*) FROM quotation_items;')).toBe('0')
  })
  test('omitting a proposal creates no fabricated attachment', () => {
    expect(submit()).toBeTruthy()
    expect(pg.db('SELECT count(*) FROM procurement_quotation_attachments;')).toBe('0')
  })
  test('changed attachment conflicts; helper, writes and privileged mutation are denied', () => {
    const r = proposal(); const q = submit(r.revision_id); const next = proposal()
    expect(() => submit(next.revision_id)).toThrow(/Idempotency conflict/)
    expect(() => submit()).toThrow(/Idempotency conflict/)
    expect(() => pg.call(`SELECT attach_procurement_quotation_proposal('${q}','${next.revision_id}');`, ids.foreign)).toThrow(/permission denied/)
    expect(() => pg.call('DELETE FROM procurement_quotation_attachments;', ids.foreign)).toThrow(/permission denied/)
    expect(() => pg.db('DELETE FROM procurement_quotation_attachments;')).toThrow(/immutable/)
    expect(() => pg.db('TRUNCATE procurement_quotation_attachments;')).toThrow(/immutable/)
    expect(() => submit(undefined, { proposal_revision_id: null, idempotency_key: uuid(981) })).toThrow(/Invalid proposal/)
    expect(() => pg.call(`SELECT record_procurement_quotation('${ids.site}',${sqlJson(document(r.revision_id, { idempotency_key: uuid(982) }))});`)).toThrow(/Invalid proposal/)
  })
  test('separate evidence mapping and concurrent retries attach once', async () => {
    const r = proposal(); const evidence = upload(pg)
    const doc = document(r.revision_id, { evidence: [{ requirement_id: requirementId, revision_id: evidence.revision_id }] })
    const sql = actorSql(`SELECT submit_procurement_quotation('${ids.site}',${sqlJson(doc)});`, ids.foreign)
    const results = await Promise.all([pg.concurrent(sql), pg.concurrent(sql)])
    expect(results[0]).toBe(results[1])
    expect(pg.db('SELECT count(*) FROM procurement_quotation_attachments;')).toBe('1')
    expect(pg.db('SELECT count(*) FROM procurement_submission_evidence;')).toBe('1')
  })
  test('open self participant attaches without organizational representation', () => {
    pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',true);`)
    pg.db(`SET session_replication_role=replica;
      UPDATE procurement_tenders SET visibility='public',participation='open' WHERE id='${tenderId}';
      UPDATE procurement_tender_publications SET visibility='public',snapshot=jsonb_set(snapshot,'{participation}','"open"') WHERE id='${publicationId}';
      SET session_replication_role=origin;`)
    const self = pg.call(`SELECT register_open_tender_participant('${publicationId}');`, ids.admin)
    const r = proposal(ids.admin)
    const q = pg.call(`SELECT submit_procurement_quotation('${ids.site}',${sqlJson(document(r.revision_id, { supplier_id: self }))});`, ids.admin)
    expect(pg.call(`SELECT revision_id FROM procurement_quotation_attachments WHERE quotation_id='${q}';`, ids.admin)).toBe(r.revision_id)
  })
})
