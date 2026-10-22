/** @jest-environment node */
import { randomUUID } from 'node:crypto'
import { isolatedPostgres, migration, postgresAvailable } from './isolated-postgres'

const source = migration('20261022011443_operational_read_indexes.sql')
const describePg = postgresAvailable ? describe : describe.skip
describePg('operational read indexes: isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => pg.db(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
    CREATE TABLE requirement_status(id uuid PRIMARY KEY,site_id uuid,requirement_id uuid,created_at timestamptz,message text);
    CREATE TABLE sale_orders(id uuid PRIMARY KEY,site_id uuid,created_at timestamptz,updated_at timestamptz);
    CREATE TABLE reservations(id uuid PRIMARY KEY,site_id uuid,start_time timestamptz,end_time timestamptz);
    CREATE TABLE tasks(id uuid PRIMARY KEY,site_id uuid,status text,priority text,scheduled_date timestamptz);`))

  test('creates exact ordered indexes and validates replay without changing data', () => {
    pg.db(source)
    const definitions = pg.db(`SELECT string_agg(indexdef,';' ORDER BY indexname) FROM pg_indexes
      WHERE schemaname='public' AND indexname NOT LIKE '%pkey'`)
    pg.db(source)
    expect(pg.db(`SELECT string_agg(indexdef,';' ORDER BY indexname) FROM pg_indexes
      WHERE schemaname='public' AND indexname NOT LIKE '%pkey'`)).toBe(definitions)
    expect(definitions).toContain('requirement_id, created_at DESC, id DESC')
    expect(definitions).toContain('INCLUDE (end_time)')
    expect(definitions).toContain('WHERE (scheduled_date IS NOT NULL)')
  })

  test('refuses a name collision and rolls back all newly created indexes', () => {
    pg.db(`CREATE INDEX requirement_status_site_requirement_recent_idx ON requirement_status(message)`)
    expect(() => pg.db(source)).toThrow(/Unexpected operational read index/)
    expect(pg.db(`SELECT count(*) FROM pg_indexes WHERE indexname='sale_orders_site_created_recent_idx'`)).toBe('0')
  })

  test('serves recent requirement history with a bounded ordered index scan', () => {
    const site = randomUUID(), requirement = randomUUID()
    pg.db(`INSERT INTO requirement_status SELECT gen_random_uuid(),'${site}','${requirement}',
      now()-(g||' seconds')::interval,'Synthetic status' FROM generate_series(1,25000) g;
      ANALYZE requirement_status;`)
    const query = `SELECT id,created_at,message FROM requirement_status
      WHERE site_id='${site}' AND requirement_id='${requirement}'
      ORDER BY created_at DESC,id DESC LIMIT 10`
    const rowsBefore = pg.db(query)
    const before = JSON.parse(pg.db(`EXPLAIN (FORMAT JSON) ${query}`))[0]
    pg.db(source)
    const after = JSON.parse(pg.db(`EXPLAIN (FORMAT JSON) ${query}`))[0]
    expect(pg.db(query)).toBe(rowsBefore)
    expect(JSON.stringify(before)).toContain('Sort')
    expect(JSON.stringify(after)).toContain('requirement_status_site_requirement_recent_idx')
    expect(JSON.stringify(after)).not.toContain('Sort')
    expect(after.Plan['Total Cost']).toBeLessThan(before.Plan['Total Cost'])
  })
})