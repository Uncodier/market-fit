/** @jest-environment node */
import { randomBytes } from 'node:crypto'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, sqlSource } from './connector-postgres-fixture'
import { binding, installAnalytics } from './connector-analytics-fixture'

const migration = '20261121031200_connector_provider_attestations.sql'
const table = 'connector_result_private.provider_attestations', rpc = 'public.connector_attested_provider_project'
const revision = randomBytes(32).toString('hex'), rotated = randomBytes(32).toString('hex')
const callback = 'https://app.example.test/connectors/callback'
const add = (site = id.site, rev = revision, project = 'project-a', url = callback) =>
  `INSERT INTO ${table}(site_id,credential_revision,project_id,oauth_verifier_url) VALUES ('${site}','${rev}','${project}','${url}')`
const lookup = (site = id.site, rev = revision, url = callback) => `SELECT ${rpc}('${site}','${rev}','${url}')`

it('keeps both migration mirrors byte-identical to the canonical migration', () => {
  for (const repo of ['market-fit','API']) expect(sqlSource(migration,repo)).toBe(sqlSource(migration,'makinari-db-scheme'))
})

;(postgresAvailable ? describe : describe.skip)('operator provider registry in socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.owner, 'service_role')
  const actor = (sql: string, sub = id.admin) => db(`SET ROLE authenticated;
    SET request.jwt.claims = '${JSON.stringify({sub, is_anonymous:false})}'; ${sql}`)
  beforeAll(() => { pg.start() }, 30000)
  afterAll(pg.stop)
  beforeEach(() => {
    installAnalytics(db)
    db(`ALTER DEFAULT PRIVILEGES IN SCHEMA connector_result_private GRANT ALL ON TABLES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`)
    db(sqlSource(migration,'makinari-db-scheme'))
  }, 30000)

  it('finds only the exact site, ciphertext revision and callback, never another site or project default', () => {
    expect(service(lookup())).toBe('')
    db(add(id.otherSite, revision, 'other-project')); db(add(id.site, rotated, 'rotated-project'))
    expect(service(lookup())).toBe('')
    db(add()); expect(service(lookup())).toBe('project-a')
    expect(service(lookup(id.otherSite))).toBe('other-project')
    expect(service(lookup(id.site,rotated))).toBe('rotated-project')
    expect(service(lookup(id.site,revision,callback+'/'))).toBe('')
    expect(service(lookup(id.site,revision,callback.toUpperCase()))).toBe('')
    db(`DELETE FROM ${table} WHERE site_id='${id.site}' AND credential_revision='${revision}'`)
    expect(service(lookup())).toBe('')
  })

  it('rejects duplicate identity, malformed values and nonexistent tenants', () => {
    for (const sql of [add(uuid(999)),add(id.site,'*'),add(id.site,'platform:'+revision),add(id.site,revision,'bad/project'),
      add(id.site,revision,'project-a',callback+'?sensitive'),add(id.site,revision,'project-a','https://u@app.example.test/connectors/callback'),
      add(id.site,revision,'project-a','http://app.example.test/connectors/callback')]) expect(() => db(sql)).toThrow()
    db(add()); expect(() => db(add(id.site,revision,'another'))).toThrow(/duplicate key/)
  })

  it('offers no table access or writes for app roles, and no browser or reader lookup', () => {
    db(add())
    expect(db(`SELECT relrowsecurity FROM pg_class WHERE oid='${table}'::regclass`)).toBe('t')
    expect(db(`SELECT count(*) FROM pg_policy WHERE polrelid='${table}'::regclass`)).toBe('0')
    for (const role of ['anon','authenticated','connector_result_reader','service_role']) {
      const as = (sql: string) => db(`SET ROLE ${role}; ${sql}`)
      if (role !== 'service_role') expect(() => as(lookup())).toThrow(/permission denied/)
      for (const q of [`SELECT * FROM ${table}`,add(id.otherSite),`UPDATE ${table} SET project_id='bad'`,`DELETE FROM ${table}`]) {
        expect(() => as(q)).toThrow(/permission denied/)
      }
    }
  })

  it('withholds a stored BYOK receipt after withdrawal; platform receipts do not require registry rows', () => {
    const updateRevision = (rev: string) => db(`UPDATE public.site_connector_providers SET credential_revision='${rev}' WHERE id='${id.provider}'`)
    const ready = (rev: string) => `SELECT public.connector_private_result_ready(${binding.replace('rev-1',rev)})`
    const store = `SELECT public.store_connector_private_result(${binding.replace('rev-1',revision)},'v1','${'a'.repeat(64)}','{}')`
    updateRevision(revision); expect(service(ready(revision))).toBe('f')
    db(add()); expect(service(ready(revision))).toBe('t')
    const receipt = service(store), read = `SELECT public.read_connector_private_result('${receipt}')`
    expect(actor(read)).toBe('{}'); expect(actor(read,id.foreign)).toBe('')
    db(`UPDATE ${table} SET project_id='another'`)
    expect(actor(read)).toBe(''); expect(service(ready(revision))).toBe('f')
    db(`DELETE FROM ${table}`); db(add(id.otherSite)); db(add(id.site,rotated))
    expect(actor(read)).toBe(''); expect(() => service(store)).toThrow(/unavailable/)
    db(`DELETE FROM ${table}`); updateRevision(`platform:${revision}`)
    expect(service(ready(`platform:${revision}`))).toBe('t'); expect(actor(read)).toBe('')
  })
})