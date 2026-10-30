/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { get } from 'node:http'
import { once } from 'node:events'
import { isolatedPostgres, migration, postgresAvailable, ids, uuid } from '../security/isolated-postgres'
import { installEvidenceFixture } from './evidence-fixture'
import { recordQuote } from './commerce-fixture'

const sourceFiles = ['app/quotations/actions.ts', 'app/quotations/public-actions.ts', 'app/buyer/quote-actions.ts']
const projections = sourceFiles.flatMap(file => [...readFileSync(path.join(process.cwd(), file), 'utf8')
  .matchAll(/site:sites[^()]*\([^()]+\)/g)].map(match => ({ file, projection: match[0] })))

test('all four legacy quotation site projections explicitly choose the seller relationship', () => {
  expect(projections).toHaveLength(4)
  for (const { projection } of projections) expect(projection).toMatch(/^site:sites!site_id\(/)
})

const binary = process.env.POSTGREST_TEST_BIN ?? '/opt/homebrew/bin/postgrest'
const describePostgrest = postgresAvailable && existsSync(binary) ? describe : describe.skip

describePostgrest('legacy quotation projections after procurement migrations in real PostgREST', () => {
  const pg = isolatedPostgres()
  let child: ChildProcess | undefined
  let port = 0
  const legacy = uuid(8800)
  let procurement = ''
  const request = (select: string, id?: string): Promise<{ status: number; body: unknown }> => new Promise((resolve, reject) => {
    const params = new URLSearchParams({ select })
    if (id) params.set('id', `eq.${id}`)
    const connection = get(`http://127.0.0.1:${port}/quotations?${params}`, response => {
      let body = ''
      response.on('data', chunk => { body += chunk })
      response.on('end', () => {
        try { resolve({ status: response.statusCode ?? 0, body: JSON.parse(body) }) } catch (error) { reject(error) }
      })
    })
    connection.setTimeout(2000, () => connection.destroy(new Error('Local PostgREST timed out')))
    connection.on('error', reject)
  })
  beforeAll(async () => {
    pg.start()
    installEvidenceFixture(pg, true)
    pg.db(migration('20261027175000_catalog_procurement.sql'))
    pg.db(migration('20261028001000_procurement_approval_revalidation.sql'))
    pg.db(`ALTER TABLE public.sites ADD COLUMN name text, ADD COLUMN logo_url text, ADD COLUMN url text;
      GRANT SELECT ON public.sites TO authenticated;
      UPDATE public.sites SET name='Original seller' WHERE id='${ids.site}';`)
    pg.call(`INSERT INTO public.quotations(id,site_id,lead_id) VALUES('${legacy}','${ids.site}','${uuid(8801)}');`)
    procurement = pg.call(recordQuote())
    const server = createServer()
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Local port unavailable')
    port = address.port
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    const socket = pg.db('SHOW unix_socket_directories')
    const process = spawn(binary, [], { env: {
      NODE_ENV: 'test',
      PATH: '/usr/bin:/bin', DYLD_LIBRARY_PATH: '/opt/homebrew/opt/postgresql@17/lib/postgresql',
      PGRST_DB_URI: `postgresql://auditor@/postgres?host=${socket}&port=55469`,
      PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'authenticated',
      PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(port),
    }, stdio: 'ignore' })
    child = process
    let spawnError: Error | undefined
    process.on('error', error => { spawnError = error })
    for (let attempt = 0; attempt < 50; attempt++) {
      if (spawnError) throw spawnError
      if (process.exitCode !== null) throw new Error('Local PostgREST exited during startup')
      try { if ((await request('id')).status === 200) return } catch { /* Wait only for local startup. */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Local PostgREST did not start')
  }, 30000)
  afterAll(async () => {
    if (child?.pid && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited }
    pg.stop()
  })
  test('detects the original ambiguity instead of hiding it behind a Supabase mock', async () => {
    expect(await request('id,site:sites(id)')).toMatchObject({ status: 300, body: { code: 'PGRST201' } })
  })
  test.each(projections)('$file resolves the original seller and does not expose procurement documents', async ({ projection }) => {
    expect(await request(`id,${projection}`, legacy)).toMatchObject({ status: 200,
      body: [{ id: legacy, site: { id: ids.site, name: 'Original seller' } }] })
    expect(await request(`id,${projection}`, procurement)).toEqual({ status: 200, body: [] })
  })
})