/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { completeOrdinaryOauth, installOrdinaryOauth } from './ordinary-oauth-fixture'
import { id, sqlSource } from './connector-postgres-fixture'

const file = '20261125223000_connector_creation_direct_host.sql'
test('canonical migration and its mirrors are identical', () => {
  for (const repo of ['market-fit', 'API']) expect(sqlSource(file, repo)).toBe(sqlSource(file, 'makinari-db-scheme'))
})

;(postgresAvailable ? describe : describe.skip)('prospective direct host default', () => {
  const pg = isolatedPostgres(), db = pg.db
  beforeAll(() => { pg.start(); installOrdinaryOauth(db) }, 30000)
  afterAll(() => pg.stop())
  const hosts = (account: string) => db(`SELECT allowed_hosts FROM connector_policies WHERE connector_id='${account}'`)

  it('preserves existing accounts, seeds any new toolkit, and never restores an opt-out on replay', () => {
    const old = completeOrdinaryOauth(db, { legacy: true })
    expect(hosts(old.connectorId)).toBe('{assistant}')
    db(sqlSource(file))
    db(`SET ROLE service_role; SELECT connector_finalize_auth${old.args}`)
    expect(hosts(old.connectorId)).toBe('{assistant}')
    for (const toolkit of ['gmail', 'unlisted_toolkit']) {
      const fresh = completeOrdinaryOauth(db, { toolkit, legacy: true })
      expect(hosts(fresh.connectorId)).toBe('{assistant,direct}')
      for (const table of ['connector_members', 'connector_agents']) {
        expect(db(`SELECT count(*) FROM ${table} WHERE connector_id='${fresh.connectorId}'`)).toBe('0')
      }
      db(`SET ROLE service_role; SELECT connector_update_policy('${id.site}','${fresh.connectorId}','${id.owner}',1,
        ARRAY[]::text[],ARRAY['assistant'],true,true,'all',NULL); SELECT connector_finalize_auth${fresh.args}`)
      expect(hosts(fresh.connectorId)).toBe('{assistant}')
    }
  })
})