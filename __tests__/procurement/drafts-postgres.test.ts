/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { installBusinessQuotationFixture } from './business-quotation-fixture'
import { ids, sqlJson } from './evidence-fixture'
import { publicationId, tenderId } from './commerce-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
const draft = { reference: 'Quote', prices: {}, evidence: {}, key: 'immutable-receipt', attempted: false,
  registeredSupplier: null, proposalRevision: '', holderName: '' }
describePg('submission draft persistence on socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installBusinessQuotationFixture(pg)
    pg.db(migration('20261030170000_procurement_submission_drafts.sql'))
    pg.db(`ALTER FUNCTION my_procurement_participation_details() OWNER TO postgres;
      ALTER FUNCTION procurement_draft_site(uuid,integer,text) OWNER TO postgres;`)
  })
  const statement = (action: string, revision: number | null = null, value: unknown = draft, applicant = 'personal', version = 1) =>
    `SELECT procurement_submission_draft('${action}','${publicationId}',${version},'${applicant}',${revision ?? 'NULL'},${sqlJson(value)});`
  const call = (action: string, revision: number | null = null, value: unknown = draft, actor = ids.foreign, applicant = 'personal') =>
    JSON.parse(pg.call(statement(action, revision, value, applicant), actor))

  test('roundtrip is owner-scoped, server derives tenant, and applicant drafts are isolated', () => {
    expect(call('get')).toEqual({ draft: null, draft_revision: null })
    const saved = call('put')
    expect(saved.draft).toEqual(draft)
    expect(call('get')).toEqual(saved)
    expect(call('get', null, draft, ids.admin).draft).toBeNull()
    expect(pg.call('SELECT count(*) FROM procurement_submission_drafts;', ids.admin)).toBe('0')
    const business = call('put', null, { ...draft, key: 'business-receipt' }, ids.foreign, `business:${ids.otherSite}`)
    expect(business.draft_revision).not.toBe(saved.draft_revision)
    expect(pg.db(`SELECT site_id FROM procurement_submission_drafts WHERE applicant_key='personal';`)).toBe(ids.site)
    expect(() => call('put', null, draft, ids.owner, `business:${ids.otherSite}`)).toThrow(/access denied/)
    expect(() => pg.call(statement('put', null, draft, 'personal', 999), ids.foreign)).toThrow(/access denied/)
    expect(() => pg.call(statement('get'), ids.foreign, 'anon')).toThrow(/permission denied/)
    expect(() => pg.call(statement('get'), ids.foreign, 'service_role')).toThrow(/permission denied/)
  })
  test('CAS prevents stale saves and deletion/recreation ABA; attempted payload and key are immutable', () => {
    const first = call('put')
    expect(() => call('put')).toThrow(/Stale draft revision/)
    expect(() => call('put', first.draft_revision, { ...draft, key: 'replacement' })).toThrow(/immutable/)
    const attempt = call('put', first.draft_revision, { ...draft, attempted: true, registeredSupplier: ids.foreign })
    expect(() => call('put', first.draft_revision)).toThrow(/Stale draft revision/)
    expect(() => call('put', attempt.draft_revision, { ...attempt.draft, attempted: false })).toThrow(/immutable/)
    expect(() => call('put', attempt.draft_revision, { ...attempt.draft, prices: { changed: '99' } })).toThrow(/immutable/)
    expect(() => call('delete', first.draft_revision)).toThrow(/Stale draft revision/)
    expect(call('delete', attempt.draft_revision)).toEqual({ draft: null, draft_revision: null })
    const replacement = call('put')
    expect(replacement.draft_revision).toBeGreaterThan(attempt.draft_revision)
    expect(() => call('delete', attempt.draft_revision)).toThrow(/Stale draft revision/)
  })
  test('retained receipt reads/deletes survive closure while new writes fail closed', () => {
    const saved = call('put', null, { ...draft, attempted: true })
    pg.db(`SET session_replication_role=replica; UPDATE procurement_tenders SET status='closed' WHERE id='${tenderId}'; SET session_replication_role=origin;`)
    expect(call('get')).toEqual(saved)
    expect(call('put', saved.draft_revision, saved.draft)).toEqual(saved)
    expect(() => call('put', saved.draft_revision, { ...saved.draft, reference: 'Changed' })).toThrow(/access denied/)
    expect(call('delete', saved.draft_revision).draft).toBeNull()
    expect(() => call('put')).toThrow(/access denied/)
  })
  test.each(['deadline', 'portal', 'unconfirmed', 'archived', 'private', 'invitation', 'stale'])(
    'new draft denied when participation becomes %s', mode => {
      const amendments: Record<string, string> = {
        deadline: `UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{participation_deadline}',to_jsonb((now()-interval '1 day')::text));`,
        portal: 'UPDATE procurement_tender_portals SET enabled=false;',
        unconfirmed: `UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${ids.foreign}';`,
        archived: `UPDATE sites SET archived_at=now() WHERE id='${ids.site}';`,
        private: "UPDATE procurement_tender_publications SET visibility='private';",
        invitation: `UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{participation}','"invitation_only"');`,
        stale: 'UPDATE procurement_tenders SET version=version+1;',
      }
      pg.db(`SET session_replication_role=replica; ${amendments[mode]} SET session_replication_role=origin;`)
      expect(() => call('put')).toThrow(/access denied/)
    })
  test('business revocation retains owner receipt but prevents another write', () => {
    const applicant = `business:${ids.otherSite}`
    const saved = call('put', null, draft, ids.admin, applicant)
    pg.db(`DELETE FROM site_members WHERE site_id='${ids.otherSite}' AND user_id='${ids.admin}';`)
    expect(call('get', null, draft, ids.admin, applicant)).toEqual(saved)
    expect(() => call('put', saved.draft_revision, draft, ids.admin, applicant)).toThrow(/access denied/)
    expect(call('delete', saved.draft_revision, draft, ids.admin, applicant).draft).toBeNull()
  })
  test('RLS rejects forged owner and tenant, trigger rejects extra authority and direct attempted mutation', () => {
    const saved = call('put', null, { ...draft, attempted: true })
    expect(() => pg.call(`UPDATE procurement_submission_drafts SET draft=jsonb_set(draft,'{key}','"other"');`, ids.foreign)).toThrow(/immutable/)
    expect(() => pg.call(`INSERT INTO procurement_submission_drafts(owner_id,publication_id,publication_version,applicant_key,site_id,draft)
      VALUES('${ids.owner}','${publicationId}',1,'personal','${ids.otherSite}',${sqlJson(draft)});`, ids.foreign)).toThrow(/row-level security/)
    call('delete', saved.draft_revision)
    expect(() => call('put', null, { ...draft, site_id: ids.site })).toThrow(/Invalid draft fields/)
    expect(() => call('put', null, { ...draft, prices: { line: 42 } })).toThrow(/Invalid draft entry/)
    expect(() => call('put', null, { ...draft, attempted: null })).toThrow(/Invalid attempted state/)
    expect(() => call('put', null, { ...draft, holderName: null })).toThrow(/Invalid draft string/)
    expect(() => call('put', null, { ...draft, evidence: null })).toThrow(/Invalid draft entries/)
    expect(() => call('put', null, null)).toThrow(/Invalid draft/)
  })
  test('parallel creates cannot overwrite each other and classification only enriches authorized publications', async () => {
    const results = await Promise.allSettled([1, 2].map(() => pg.concurrent(actorSql(statement('put'), ids.foreign))))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    const choices = JSON.parse(pg.call('SELECT my_procurement_participation_details();', ids.foreign))
    expect(choices.length).toBeGreaterThan(0)
    expect(choices.every((row: { publication_id: string; visibility: string; participation: string }) =>
      row.publication_id === publicationId && row.visibility === 'public' && row.participation === 'open')).toBe(true)
  })
})