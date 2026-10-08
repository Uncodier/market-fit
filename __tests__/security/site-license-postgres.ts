import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const bin = process.env.LICENSE_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
export const licensePostgresAvailable = ['initdb', 'pg_ctl', 'psql'].every(file => existsSync(path.join(bin, file)))
const env: NodeJS.ProcessEnv = { ...process.env, LC_ALL: 'C', LANG: 'C' }
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key]
export const licenseMigration = readFileSync(path.join(root, 'supabase/migrations/20261007220000_site_license_enforcement.sql'), 'utf8')
export const licenseFixture = readFileSync(path.join(root, '__tests__/fixtures/site-license-bootstrap.sql'), 'utf8')
export const partnerLicenseMigration = readFileSync(path.join(root, 'supabase/migrations/20261007220001_atomic_partner_license.sql'), 'utf8')
export const licenseUuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`
export const licenseIds = { site: licenseUuid(1), other: licenseUuid(2), owner: licenseUuid(10), member: licenseUuid(11), foreign: licenseUuid(12) }
export const licenseActor = (sql: string, user = licenseIds.owner, role = 'authenticated') =>
  `SET ROLE ${role}; SET request.jwt.claims = '${JSON.stringify({ sub: user, role })}'; ${sql}`

export function licensePostgres() {
  let directory = ''
  const args = () => ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55481', '-U', 'postgres', '-d', 'postgres']
  const db = (sql: string) => execFileSync(path.join(bin, 'psql'), args(), { input: sql, encoding: 'utf8', stdio: 'pipe', timeout: 20000, env }).trim()
  const stop = () => {
    if (!directory) return
    if (existsSync(path.join(directory, 'data/postmaster.pid'))) execFileSync(path.join(bin, 'pg_ctl'),
      ['-D', path.join(directory, 'data'), '-m', 'fast', '-w', 'stop'], { stdio: 'pipe', timeout: 20000, env })
    rmSync(directory, { recursive: true, force: true }); directory = ''
  }
  const start = () => {
    // Never use a database URL: a new socket-only cluster with no network listener.
    directory = mkdtempSync('/tmp/site-license-pg-')
    try {
      execFileSync(path.join(bin, 'initdb'), ['-D', path.join(directory, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale'], { stdio: 'pipe', timeout: 20000, env })
      execFileSync(path.join(bin, 'pg_ctl'), ['-D', path.join(directory, 'data'), '-l', path.join(directory, 'server.log'),
        '-o', `-F -p 55481 -k ${directory} -c listen_addresses='' -c lc_messages=C`, '-w', 'start'], { stdio: 'pipe', timeout: 20000, env })
      db('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
    } catch (error) { stop(); throw error }
  }
  const install = (legacy = '') => {
    db(licenseFixture)
    db(`INSERT INTO sites(id,user_id) VALUES ('${licenseIds.site}','${licenseIds.owner}'),('${licenseIds.other}','${licenseIds.foreign}');
      INSERT INTO billing(site_id,plan) VALUES ('${licenseIds.site}','enterprise'),('${licenseIds.other}','commission');
      INSERT INTO settings(site_id) SELECT id FROM sites; ${legacy}`)
    db(licenseMigration)
  }
  const concurrent = (sql: string) => new Promise<string>((resolve, reject) => {
    const child = spawn(path.join(bin, 'psql'), args(), { stdio: ['pipe', 'pipe', 'pipe'], env })
    let output = ''; let error = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), 20000)
    child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { error += data })
    child.on('error', reason => { clearTimeout(timer); reject(reason) })
    child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(output.trim()); else reject(new Error(error)) })
    child.stdin.end(sql)
  })
  return { db, start, stop, install, concurrent, call: (sql: string, user = licenseIds.owner, role = 'authenticated') => db(licenseActor(sql, user, role)) }
}