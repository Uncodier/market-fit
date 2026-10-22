/** @jest-environment node */
import { actorSql, isolatedPostgres, postgresAvailable } from './isolated-postgres'
import { installCommerceFixture, outcome, planningMigration } from './commerce-planning-fixture'

jest.setTimeout(60000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('bounded commerce ACL write and session regression', () => {
  const pg = isolatedPostgres()
  let fixture: ReturnType<typeof installCommerceFixture>
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => { fixture = installCommerceFixture(pg) })

  test('ON CONFLICT UPDATE RETURNING preserves both permitted and excluded row outcomes', () => {
    const { ids } = fixture
    const capture = () => [ids.member, ids.owner].flatMap(user => [ids.allowed, ids.denied].map(id => {
      const location = id === ids.allowed ? ids.location : ids.secondLocation
      return outcome(pg, `INSERT INTO public.deals(id,site_id,location_id,payload)
        VALUES('${id}','${ids.site}','${location}','upsert probe')
        ON CONFLICT(id) DO UPDATE SET payload=excluded.payload RETURNING id`, user)
    }))
    const before = capture()
    expect(before[0]).toEqual({ rows: ids.allowed, state: 'ok' })
    expect(before[1].state).toMatch(/row-level security/)
    expect(before[2]).toEqual({ rows: ids.allowed, state: 'ok' })
    expect(before[3]).toEqual({ rows: ids.denied, state: 'ok' })
    pg.db(planningMigration())
    expect(capture()).toEqual(before)
    expect(pg.db(`SELECT count(*) FROM deals WHERE payload='upsert probe'`)).toBe('0')
  })

  test('one prepared statement sees restriction removal and restoration in the same session', () => {
    const { ids } = fixture
    const capture = () => pg.db(`BEGIN;
      ${actorSql('', ids.member)}
      PREPARE restricted_rows AS SELECT count(*) FROM public.deals;
      EXECUTE restricted_rows;
      RESET ROLE;
      DELETE FROM public.site_member_location_restrictions WHERE site_member_id='${ids.memberRow}';
      SET ROLE authenticated; EXECUTE restricted_rows;
      RESET ROLE;
      INSERT INTO public.site_member_location_restrictions(site_id,site_member_id,location_id)
        VALUES('${ids.site}','${ids.memberRow}','${ids.secondLocation}');
      SET ROLE authenticated; EXECUTE restricted_rows;
      ROLLBACK;`)
    const before = capture()
    expect(before).toBe('1\n3\n1')
    pg.db(planningMigration())
    expect(capture()).toBe(before)
  })
})