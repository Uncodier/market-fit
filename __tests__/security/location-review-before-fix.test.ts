/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, migration } from './isolated-postgres'
import { replaceLocations } from './location-access-fixture'
import { i, installReviewFixture, reviewMigrations } from './location-review-fixture'

const describePg = postgresAvailable ? describe : describe.skip
describePg('location review reproductions: uncorrected 30000-30009 state', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => installReviewFixture(pg,false))

  test('legacy FK contracts prove the ambiguous relation catalog before consolidation', () => {
    const count = (child: string, parent: string) => pg.db(`SELECT count(*) FROM pg_constraint WHERE contype='f'
      AND conrelid='${child}'::regclass AND confrelid='${parent}'::regclass`)
    expect(count('sales','locations')).toBe('2')
    expect(count('quotations','deals')).toBe('3')
    expect(count('purchase_items','purchases')).toBe('2')
    expect(count('pos_register_receipts','pos_register_sessions')).toBe('2')
    for (const file of reviewMigrations) pg.db(migration(file))
    expect(count('sales','locations')).toBe('1')
    expect(count('quotations','deals')).toBe('1')
    expect(count('purchase_items','purchases')).toBe('1')
    expect(count('pos_register_receipts','pos_register_sessions')).toBe('1')
  })

  test('unrestricted collaborator could directly assign and move root scope', () => {
    expect(pg.call(`UPDATE deals SET location_id='${i.location}' WHERE id='${i.unresolved}' RETURNING location_id`,i.member))
      .toBe(i.location)
    expect(pg.call(`UPDATE deals SET location_id='${i.secondLocation}' WHERE id='${i.allowed}' RETURNING location_id`,i.member))
      .toBe(i.secondLocation)
  })

  test('real records hardening omitted the subsequently added location INSERT column', () => {
    expect(() => pg.call(`INSERT INTO records(site_id,title,location_id)
      VALUES('${i.site}','Allowed branch','${i.location}')`,i.member)).toThrow(/permission denied/)
    expect(pg.call(`INSERT INTO records(site_id,title) VALUES('${i.site}','Old contract') RETURNING title`,i.member)).toBe('Old contract')
  })

  test('unchecked stale manager save could silently clear another manager restriction', () => {
    pg.call(replaceLocations([i.secondLocation]))
    pg.call(replaceLocations([]),i.admin)
    expect(pg.db('SELECT count(*) FROM site_member_location_restrictions')).toBe('0')
  })

  test('old per-site predicate returned unrestricted after membership revocation', () => {
    expect(pg.call(`SELECT current_user_site_role('${i.site}')`,i.member)).toBe('collaborator')
    pg.db(`DELETE FROM site_members WHERE id='${i.memberRow}'`)
    expect(pg.call(`SELECT current_user_has_site_location_restrictions('${i.site}')`,i.member)).toBe('f')
  })
})