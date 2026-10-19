import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const pgBin = process.env.CATALOG_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
export const postgresAvailable = ['initdb', 'pg_ctl', 'psql'].every(file => existsSync(path.join(pgBin, file)))
// Allowlist the environment: Next/Jest loads real .env files. Never inherit any
// database URL, PGSERVICE, PGHOST, credentials, or remote connection configuration.
const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', PATH: process.env.PATH, HOME: process.env.HOME, LC_ALL: 'C', LANG: 'C' }
export const migration = (file: string) => readFileSync(path.resolve(__dirname, '../../supabase/migrations', file), 'utf8')
export const archiveMigration = () => migration('20261012190000_catalog_category_archival.sql')
export const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`
export const ids = {
  site: uuid(1), otherSite: uuid(2), owner: uuid(10), admin: uuid(11), member: uuid(12), marketing: uuid(13),
  inactive: uuid(14), suspended: uuid(15), foreign: uuid(16), coOwner: uuid(17),
  category: uuid(20), otherCategory: uuid(21), emptyCategory: uuid(22), foreignCategory: uuid(23),
  root: uuid(30), child: uuid(31), grandchild: uuid(32), archived: uuid(33), nullStatus: uuid(34),
  unrelated: uuid(35), foreignItem: uuid(36), pass: uuid(37), legacyChild: uuid(38),
}
export const actorSql = (sql: string, user: string | null = ids.owner, role = 'authenticated') =>
  `SET ROLE ${role}; SET request.jwt.claims = '${JSON.stringify({ sub: user, role })}'; ${sql}`
export const archiveSql = (category = ids.category, site = ids.site) =>
  `SELECT public.archive_catalog_category('${site}', '${category}');`

export class CategoryArchivePostgres {
  private directory = ''
  private args() {
    if (!this.directory) throw new Error('Disposable PostgreSQL cluster is not running')
    return ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
      '-h', this.directory, '-p', '55473', '-U', 'auditor', '-d', 'postgres']
  }

  db(sql: string, timeout = 20000) {
    return execFileSync(path.join(pgBin, 'psql'), this.args(), {
      input: sql, encoding: 'utf8', stdio: 'pipe', timeout, env,
    }).trim()
  }

  call(sql: string, user: string | null = ids.owner, role = 'authenticated') {
    return this.db(actorSql(sql, user, role))
  }

  start(sql: string, name: string, hold = false) {
    const child = spawn(path.join(pgBin, 'psql'), this.args(), { stdio: 'pipe', env, timeout: 20000 })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    const result = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', code => resolve({ code, stdout: stdout.trim(), stderr }))
    })
    child.stdin.write(`SET application_name = '${name}'; SET statement_timeout = '10s'; ${sql}\n`)
    if (!hold) child.stdin.end()
    return { result, finish: (sql = 'COMMIT;') => child.stdin.end(`${sql}\n`), kill: () => child.kill() }
  }

  async waitForIdle(name: string) {
    const deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      if (this.db(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
        WHERE application_name = '${name}' AND state = 'idle in transaction');`) === 't') return
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    throw new Error(`PostgreSQL transaction did not reach barrier: ${name}`)
  }

  startCluster() {
    this.directory = mkdtempSync('/tmp/category-pg-')
    try {
      execFileSync(path.join(pgBin, 'initdb'), ['-D', path.join(this.directory, 'data'), '-U', 'auditor',
        '-A', 'trust', '--no-locale'], { stdio: 'pipe', timeout: 20000, env })
      execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(this.directory, 'data'),
        '-l', path.join(this.directory, 'server.log'), '-o',
        `-F -p 55473 -k ${this.directory} -c listen_addresses='' -c lc_messages=C`, '-w', 'start'],
      { stdio: 'pipe', timeout: 20000, env })
      this.db('CREATE ROLE postgres NOSUPERUSER BYPASSRLS; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
    } catch (error) { this.stop(); throw error }
  }

  stop() {
    if (!this.directory) return
    if (existsSync(path.join(this.directory, 'data/postmaster.pid'))) {
      execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', path.join(this.directory, 'data'), '-m', 'fast', '-w', 'stop'],
        { stdio: 'pipe', timeout: 20000, env })
    }
    rmSync(this.directory, { recursive: true, force: true })
    this.directory = ''
  }
}