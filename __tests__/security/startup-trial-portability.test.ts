/** @jest-environment node */
import * as fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const sibling = path.resolve(root, '../API/supabase/migrations')

describe('Startup trial PostgreSQL test portability', () => {
  afterEach(() => { jest.dontMock('node:fs'); jest.restoreAllMocks() })

  it('keeps local migration contracts readable without the sibling API checkout', () => {
    const actualExists = fs.existsSync
    const exists = jest.fn((file: fs.PathLike) =>
      String(file).startsWith(sibling) ? false : actualExists(file))
    const reads = jest.fn(fs.readFileSync)
    jest.doMock('node:fs', () => ({ ...jest.requireActual('node:fs'), existsSync: exists, readFileSync: reads }))
    jest.isolateModules(() => {
      const helper = jest.requireActual<typeof import('./startup-trial-postgres')>('./startup-trial-postgres')
      expect(helper.startupTrialPrerequisitesAvailable).toBe(false)
      expect(helper.trialMigrationSql).toContain('primary_owner_id uuid PRIMARY KEY')
      expect(helper.trialMigrations).toHaveLength(7)
      expect(() => helper.startupTrialPostgres().install()).toThrow('requires the sibling API')
    })
    expect(exists.mock.calls.some(([file]) => String(file).startsWith(sibling))).toBe(true)
    expect(reads.mock.calls.some(([file]) => String(file).startsWith(sibling))).toBe(false)
  })

  it('uses only a new disposable socket cluster, never a remote database connection', () => {
    const runner = fs.readFileSync(path.join(__dirname, 'site-license-postgres.ts'), 'utf8')
    const helper = fs.readFileSync(path.join(__dirname, 'startup-trial-postgres.ts'), 'utf8')
    expect(runner).toContain("mkdtempSync('/tmp/site-license-pg-')")
    expect(runner).toContain("listen_addresses='' ")
    expect(runner).toContain("if (key.startsWith('PG')) delete env[key]")
    expect(helper).toContain('prerequisitePaths.every(file => existsSync(file))')
    expect(`${runner}\n${helper}`).not.toMatch(/process\.env\.(?:DATABASE_URL|SUPABASE_DB_URL|PGHOST|PGPASSWORD)/)
    expect(`${runner}\n${helper}`).not.toMatch(/postgres(?:ql)?:\/\//)
  })
})