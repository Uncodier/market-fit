/** @jest-environment node */
import { actorSql, isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { installEvidenceFixture, ids, uuid, supplierId, quoteDocument, sqlJson, metadata, reserve, upload } from './evidence-fixture'
import { openAward, requirementId } from './commerce-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('personal evidence, representation and scoped sharing on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => installEvidenceFixture(pg))
  const grant = () => pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false);`)
  const submit = (revision: string, idempotency = uuid(940)) => pg.call(`SELECT submit_procurement_quotation('${ids.site}',${sqlJson({
    ...quoteDocument, idempotency_key: idempotency, evidence: [{ requirement_id: requirementId, revision_id: revision }],
  })});`, ids.foreign)

  test('external accounts upload without workspace membership; other users and anon cannot read even with legacy storage policies', () => {
    const first = upload(pg)
    expect(pg.call('SELECT count(*) FROM procurement_credentials;', ids.foreign)).toBe('1')
    expect(pg.call('SELECT count(*) FROM procurement_credential_revisions;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM storage.objects;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM storage.objects;', ids.foreign, 'anon')).toBe('0')
    expect(pg.call('SELECT count(*) FROM storage.objects;', ids.foreign)).toBe('1')
    expect(() => pg.call(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('procurement-credentials','forged','{}');`, ids.foreign)).toThrow(/row-level security/)
    expect(pg.call(`DELETE FROM storage.objects WHERE name='${first.object_path}' RETURNING id;`, ids.foreign)).toBe('')
    expect(() => pg.call(reserve(first.credential_id, 1))).toThrow(/access denied/)
    expect(() => pg.call(reserve(null, 0, { ...metadata, holder_kind: 'organization' }), ids.foreign)).toThrow(/Invalid/)
  })
  test('immutable revisions, checked storage completion and stale version rejection', () => {
    const first = upload(pg)
    expect(() => pg.call(`UPDATE procurement_credential_revisions SET metadata='{}' WHERE id='${first.revision_id}';`, ids.foreign)).toThrow(/permission denied/)
    expect(() => pg.call(reserve(first.credential_id, 0), ids.foreign)).toThrow(/version conflict/)
    const pending = JSON.parse(pg.call(reserve(first.credential_id, 1), ids.foreign))
    expect(() => pg.call(`SELECT complete_procurement_credential('${pending.revision_id}');`, ids.foreign)).toThrow(/missing or mismatched/)
    expect(pg.call(`SELECT complete_procurement_credential('${first.revision_id}');`, ids.foreign)).toBe(first.revision_id)
  })
  test('explicit verified-account grants only; revoked or unknown representation fails closed', () => {
    expect(pg.call(`SELECT procurement_can_represent('${ids.site}','${supplierId}');`, ids.foreign)).toBe('f')
    expect(() => pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false);`, ids.foreign)).toThrow(/denied/)
    grant()
    expect(pg.call(`SELECT procurement_can_represent('${ids.site}','${supplierId}');`, ids.foreign)).toBe('t')
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',true);`)
    expect(pg.call(`SELECT procurement_can_represent('${ids.site}','${supplierId}');`, ids.foreign)).toBe('f')
    expect(pg.call('SELECT count(*) FROM supplier_representation_events;')).toBe('2')
  })
  test('atomic exact revision sharing stays sealed, opens only to buyer and survives archive/renewal', () => {
    const first = upload(pg); grant()
    const quote = submit(first.revision_id)
    expect(submit(first.revision_id)).toBe(quote)
    expect(pg.call('SELECT count(*) FROM procurement_submission_evidence;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM storage.objects;')).toBe('0')
    const second = upload(pg, ids.foreign, first.credential_id, 1)
    pg.call(`SELECT archive_procurement_credential('${first.credential_id}',2);`, ids.foreign)
    openAward(pg)
    expect(pg.call('SELECT count(*) FROM procurement_submission_evidence;')).toBe('1')
    expect(pg.call('SELECT id FROM procurement_credential_revisions;')).toBe(first.revision_id)
    expect(pg.call('SELECT name FROM storage.objects;')).toBe(first.object_path)
    expect(pg.call(`SELECT count(*) FROM storage.objects WHERE name='${second.object_path}';`)).toBe('0')
    expect(pg.call('SELECT count(*) FROM storage.objects;', ids.inactive)).toBe('0')
  })
  test('foreign revision selection rolls back quotation; private attach cannot be called standalone', () => {
    const first = upload(pg, ids.owner); grant()
    expect(() => submit(first.revision_id)).toThrow(/Private evidence unavailable/)
    expect(pg.db("SELECT count(*) FROM quotations WHERE purpose='procurement';")).toBe('0')
    expect(() => pg.call(`SELECT attach_procurement_quotation_evidence('${uuid(941)}','[]');`, ids.foreign)).toThrow(/permission denied/)
  })
  test('account byte quota includes pending revisions and rejects oversized storage reservations', () => {
    for (let i = 0; i < 16; i++) pg.call(reserve(null, 0, metadata, 8388608), ids.foreign)
    expect(() => pg.call(reserve(), ids.foreign)).toThrow(/storage limit/)
  })
  test('direct storage insert cannot exceed its reservation to bypass cumulative byte quota', () => {
    const pending = JSON.parse(pg.call(reserve(), ids.foreign))
    expect(() => pg.call(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('procurement-credentials','${pending.object_path}','{"size":8388608,"mimetype":"application/pdf"}');`, ids.foreign)).toThrow(/row-level security/)
    expect(() => pg.call(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('procurement-credentials','${pending.object_path}','{"size":10,"mimetype":"image/png"}');`, ids.foreign)).toThrow(/row-level security/)
  })
  test('concurrent revisions serialize on account and credential locks rather than overwrite', async () => {
    const first = upload(pg)
    const calls = await Promise.allSettled([
      pg.concurrent(actorSql(reserve(first.credential_id, 1), ids.foreign)),
      pg.concurrent(actorSql(reserve(first.credential_id, 1), ids.foreign)),
    ])
    expect(calls.filter(call => call.status === 'fulfilled')).toHaveLength(1)
    expect(calls.filter(call => call.status === 'rejected')).toHaveLength(1)
    expect(pg.call('SELECT count(*) FROM procurement_credential_revisions;', ids.foreign)).toBe('2')
  })
  test('safe external participation context omits private pricing and revoked grants disappear', () => {
    grant()
    const opportunities = JSON.parse(pg.call('SELECT my_procurement_participation();', ids.foreign))
    expect(opportunities).toHaveLength(1)
    expect(opportunities[0].requirements[0]).toEqual({ id: requirementId, description: 'Equipment', quantity: 2, unit: 'each' })
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',true);`)
    expect(pg.call('SELECT my_procurement_participation();', ids.foreign)).toBe('[]')
  })
})