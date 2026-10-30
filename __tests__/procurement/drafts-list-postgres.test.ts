/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { installBusinessQuotationFixture } from './business-quotation-fixture'
import { ids, sqlJson, supplierId } from './evidence-fixture'
import { publicationId, requirementId, tenderId } from './commerce-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
const draft = { reference: 'Quote', prices: {}, evidence: {}, key: 'receipt', attempted: false,
  registeredSupplier: null, proposalRevision: '', holderName: '' }
type Row = { publication_id: string; publication_version: number; applicant_key: string; draft_revision: number;
  reference: string; attempted: boolean; can_resume: boolean;
  opportunity: { title: string; supplier_id: string | null; supplier_name: string; acting_site_id: string | null;
    acting_as_self: boolean; directly_invited: boolean; requirements: { id: string; description: string }[] } | null }
describePg('private draft list on disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installBusinessQuotationFixture(pg)
    for (const file of ['20261030170000_procurement_submission_drafts.sql',
      '20261030180000_procurement_submission_draft_list.sql']) pg.db(migration(file))
    pg.db(`GRANT SELECT ON procurement_submission_drafts TO postgres;
      ALTER FUNCTION my_procurement_participation_details() OWNER TO postgres;
      ALTER FUNCTION procurement_draft_site(uuid,integer,text) OWNER TO postgres;
      ALTER FUNCTION procurement_saved_draft_opportunities() OWNER TO postgres;`)
  })
  const amend = (sql: string) => pg.db(`SET session_replication_role=replica; ${sql} SET session_replication_role=origin;`)
  const save = (applicant = 'personal', value = draft, actor = ids.foreign) => JSON.parse(pg.call(
    `SELECT procurement_submission_draft('put','${publicationId}',1,'${applicant}',NULL,${sqlJson(value)});`, actor))
  const list = (actor = ids.foreign): Row[] => JSON.parse(pg.call('SELECT procurement_submission_drafts_list();', actor))

  test('only saved owner rows are listed, with minimal metadata and immutable requirement DTO', () => {
    expect(list()).toEqual([])
    expect(JSON.parse(pg.call('SELECT procurement_saved_draft_opportunities();', ids.foreign))).toEqual([])
    const saved = save()
    save(`business:${ids.otherSite}`)
    expect(list(ids.admin)).toEqual([])
    const rows = list()
    expect(rows).toHaveLength(2)
    const personal = rows.find(row => row.applicant_key === 'personal')!
    expect(personal).toMatchObject({ publication_id: publicationId, publication_version: 1,
      draft_revision: saved.draft_revision, reference: 'Quote', attempted: false, can_resume: true })
    expect(Object.keys(personal).sort()).toEqual(['applicant_key', 'attempted', 'can_resume', 'draft_revision',
      'opportunity', 'publication_id', 'publication_version', 'reference', 'updated_at'].sort())
    expect(personal.opportunity!.requirements).toEqual([{ id: requirementId, description: 'Equipment', quantity: 2, unit: 'each' }])
    const business = rows.find(row => row.applicant_key.startsWith('business:'))!
    expect(business.opportunity).toMatchObject({ acting_site_id: ids.otherSite, acting_as_self: false,
      supplier_name: 'Owned business', supplier_id: null })
  })
  test('closed rows remain enriched from their publication, but only attempted receipts can resume', () => {
    save()
    save(`business:${ids.otherSite}`, { ...draft, attempted: true })
    amend(`UPDATE procurement_tenders SET status='closed',title='Working title changed',requirements='[]' WHERE id='${tenderId}';`)
    const rows = list()
    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.applicant_key === 'personal')!.can_resume).toBe(false)
    expect(rows.find(row => row.attempted)!.can_resume).toBe(true)
    for (const row of rows) {
      expect(row.opportunity!.title).toBe('Tender')
      expect(row.opportunity!.requirements[0].description).toBe('Equipment')
    }
    expect(JSON.parse(pg.call('SELECT procurement_saved_draft_opportunities();', ids.admin))).toEqual([])
  })
  test('resume matching includes version and exact applicant, never another available business', () => {
    save(`business:${ids.otherSite}`, draft, ids.admin)
    pg.db(`DELETE FROM site_members WHERE site_id='${ids.otherSite}' AND user_id='${ids.admin}';`)
    expect(list(ids.admin)[0]).toMatchObject({ can_resume: false, opportunity: { acting_site_id: ids.otherSite } })
    save()
    amend(`UPDATE procurement_tenders SET version=2 WHERE id='${tenderId}';`)
    expect(list()[0].can_resume).toBe(false)
  })
  test('direct invitation classification excludes approved general suppliers and self/business choices', () => {
    pg.db(`INSERT INTO supplier_representatives(site_id,supplier_id,user_id,granted_by)
      VALUES('${ids.site}','${supplierId}','${ids.foreign}','${ids.owner}');`)
    const opportunities = () => JSON.parse(pg.call('SELECT my_procurement_participation_details();', ids.foreign)) as
      { supplier_id: string | null; acting_site_id: string | null; directly_invited: boolean }[]
    expect(opportunities().find(row => row.supplier_id === supplierId)!.directly_invited).toBe(true)
    expect(opportunities().filter(row => row.supplier_id !== supplierId).every(row => !row.directly_invited)).toBe(true)
    save(`supplier:${supplierId}`)
    pg.db(`UPDATE procurement_tender_participants SET status='withdrawn' WHERE tender_id='${tenderId}';`)
    expect(opportunities().find(row => row.supplier_id === supplierId)!.directly_invited).toBe(false)
    expect(list()[0]).toMatchObject({ can_resume: true, opportunity: { directly_invited: false, supplier_name: 'Supplier' } })
    amend(`UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{participation}','"approved_suppliers"');`)
    expect(opportunities().find(row => row.supplier_id === supplierId)!.directly_invited).toBe(false)
  })
  test('revoked representation retains the correct supplier identity without discovery privileges', () => {
    pg.db(`INSERT INTO supplier_representatives(site_id,supplier_id,user_id,granted_by)
      VALUES('${ids.site}','${supplierId}','${ids.foreign}','${ids.owner}');`)
    save(`supplier:${supplierId}`)
    pg.db(`UPDATE supplier_representatives SET revoked_at=now();`)
    amend(`UPDATE suppliers SET name='Renamed supplier';`)
    expect(list()[0]).toMatchObject({ can_resume: false, opportunity: { supplier_id: supplierId,
      acting_as_self: false, acting_site_id: null, supplier_name: 'Renamed supplier' } })
  })
  test('anonymous, service role and missing identity cannot execute the list or enrichment', () => {
    for (const fn of ['procurement_submission_drafts_list', 'procurement_saved_draft_opportunities']) {
      for (const role of ['anon', 'service_role']) {
        expect(() => pg.call(`SELECT ${fn}();`, ids.foreign, role)).toThrow(/permission denied/)
      }
    }
    expect(() => pg.db(`SET ROLE authenticated; SET request.jwt.claims='{}'; SELECT procurement_submission_drafts_list();`))
      .toThrow(/Authentication required/)
  })
  test('unavailable exact publication enrichment never drops the retained owner row', () => {
    save()
    amend('UPDATE procurement_submission_drafts SET publication_version=99;')
    expect(list()).toHaveLength(1)
    expect(list()[0]).toMatchObject({ publication_version: 99, opportunity: null, can_resume: false })
  })
})