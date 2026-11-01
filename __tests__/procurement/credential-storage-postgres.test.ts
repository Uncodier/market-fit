/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { installEvidenceFixture, ids, metadata, reserve, sqlJson } from './evidence-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
const correction = '20261030230000_procurement_storage_admission.sql'

describePg('credential Storage admission lifecycle on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installEvidenceFixture(pg)
    // Match the platform object fields; keep the real baseline policies/RPCs.
    pg.db('ALTER TABLE storage.objects ADD owner uuid, ADD owner_id text, ADD version text;')
  })
  const pending = () => JSON.parse(pg.call(reserve(null, 0, metadata, 142), ids.foreign))
  const insert = (path: string, md: unknown) => `INSERT INTO storage.objects
    (bucket_id,name,owner,owner_id,metadata,version) VALUES
    ('procurement-credentials','${path}','${ids.foreign}','${ids.foreign}',${md === undefined ? 'NULL' : sqlJson(md)},'1');`
  const complete = (id: string) => `SELECT complete_procurement_credential('${id}');`

  test('reproduces baseline denial for empty and real v1.84.19 admission metadata', () => {
    const r = pending()
    for (const md of [{}, { mimetype: 'application/pdf', contentLength: 142 }]) {
      expect(() => pg.call(insert(r.object_path, md), ids.foreign)).toThrow(/row-level security/)
    }
  })

  test.each([undefined, {}, { mimetype: 'application/pdf', contentLength: 142 }])(
    'permits reserved probe %j, keeps it unreadable and requires backend metadata before ready', md => {
      pg.db(migration(correction))
      const r = pending()
      // Storage testPermission rolls back this caller-role admission INSERT.
      pg.call(`BEGIN; ${insert(r.object_path, md)} ROLLBACK;`, ids.foreign)
      expect(pg.db('SELECT count(*) FROM storage.objects;')).toBe('0')
      pg.call(insert(r.object_path, md), ids.foreign)
      expect(pg.call('SELECT count(*) FROM storage.objects;', ids.foreign)).toBe('0')
      expect(() => pg.call(complete(r.revision_id), ids.foreign)).toThrow(/missing or mismatched/)
      expect(pg.call(`UPDATE storage.objects SET metadata='{"size":142,"mimetype":"application/pdf"}'
        WHERE name='${r.object_path}' RETURNING id;`, ids.foreign)).toBe('')
      // Native Storage completeUpload uses its internal asSuperUser transaction.
      // This is not an application service-role fallback or relaxed caller RLS.
      pg.db(`SET ROLE postgres; UPDATE storage.objects SET metadata='{"size":142,"mimetype":"application/pdf"}'
        WHERE name='${r.object_path}';`)
      expect(pg.call(complete(r.revision_id), ids.foreign)).toBe(r.revision_id)
      expect(pg.call('SELECT count(*) FROM storage.objects;', ids.foreign)).toBe('1')
      expect(pg.call('SELECT count(*) FROM storage.objects;', ids.owner)).toBe('0')
      expect(pg.call(`DELETE FROM storage.objects RETURNING id;`, ids.foreign)).toBe('')
    }
  )

  test('denies foreign, forged, expired and ready paths despite a broad legacy policy', () => {
    pg.db(migration(correction))
    const r = pending()
    expect(() => pg.call(insert(r.object_path, {}), ids.owner)).toThrow(/row-level security/)
    expect(() => pg.call(insert(r.object_path, {}), ids.foreign, 'anon')).toThrow(/row-level security/)
    expect(() => pg.call(insert('forged', {}), ids.foreign)).toThrow(/row-level security/)
    pg.db(`ALTER TABLE procurement_credential_revisions DISABLE TRIGGER credential_revision_immutable;
      UPDATE procurement_credential_revisions SET created_at=now()-interval '2 hours';
      ALTER TABLE procurement_credential_revisions ENABLE TRIGGER credential_revision_immutable;`)
    expect(() => pg.call(insert(r.object_path, {}), ids.foreign)).toThrow(/row-level security/)
    pg.db(`ALTER TABLE procurement_credential_revisions DISABLE TRIGGER credential_revision_immutable;
      UPDATE procurement_credential_revisions SET created_at=now(),state='ready';
      ALTER TABLE procurement_credential_revisions ENABLE TRIGGER credential_revision_immutable;`)
    expect(() => pg.call(insert(r.object_path, {}), ids.foreign)).toThrow(/row-level security/)
  })

  test.each([{ size: 143 }, { size: null }, { mimetype: 'image/png' }, { mimetype: null }, []])(
    'rejects supplied mismatched/malformed admission metadata %j', md => {
      pg.db(migration(correction))
      expect(() => pg.call(insert(pending().object_path, md), ids.foreign)).toThrow(/row-level security/)
    }
  )

  test.each([{ size: 143, mimetype: 'application/pdf' }, { size: 142, mimetype: 'image/png' }])(
    'does not complete a backend metadata mismatch %j', md => {
      pg.db(migration(correction))
      const r = pending()
      pg.db(insert(r.object_path, md))
      expect(() => pg.call(complete(r.revision_id), ids.foreign)).toThrow(/missing or mismatched/)
      expect(pg.call('SELECT state FROM procurement_credential_revisions;', ids.foreign)).toBe('pending')
    }
  )
})