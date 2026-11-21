import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const pgBin = process.env.MESSAGES_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
export const messagesPostgresAvailable = ['initdb', 'pg_ctl', 'psql'].every(bin => existsSync(path.join(pgBin, bin)))

export function messagesPostgres() {
  let directory = ''
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', LC_ALL: 'C', LANG: 'C', PGCONNECT_TIMEOUT: '3',
    PGOPTIONS: '-c client_min_messages=warning -c statement_timeout=8000 -c idle_in_transaction_session_timeout=12000' }
  const args = () => {
    if (!directory) throw new Error('Start a disposable PostgreSQL cluster first')
    return ['-X', '-qAtw', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
      '-h', directory, '-p', '55484', '-U', 'postgres', '-d', 'postgres']
  }
  const children = new Set<ReturnType<typeof client>>()
  function client() {
    const child = spawn(path.join(pgBin, 'psql'), args(), { env, stdio: 'pipe' })
    let stdout = '', stderr = '', sequence = 0, closed = false
    child.stdout.on('data', data => { stdout += data.toString() })
    child.stderr.on('data', data => { stderr += data.toString() })
    child.stdin.on('error', error => { stderr += error.message })
    const done = new Promise<void>(resolve => {
      child.on('error', error => { stderr += error.message })
      child.on('close', () => { closed = true; resolve() })
    })
    return {
      done,
      close: () => { if (!closed) child.kill() },
      async execute(sql: string) {
        const start = stdout.length
        const marker = `__messages_statement_${++sequence}__`
        child.stdin.write(`${sql.trim().replace(/;?$/, ';')}\n\\echo ${marker}\n`)
        await waitFor(() => closed || stdout.indexOf(marker, start) >= 0, marker)
        const end = stdout.indexOf(marker, start)
        if (end < 0) throw new Error(stderr || 'Disposable PostgreSQL client closed')
        return stdout.slice(start, end).trim()
      },
    }
  }

  async function waitFor(predicate: () => boolean, context: string) {
    const deadline = Date.now() + 9000
    do {
      if (predicate()) return
      await delay(15)
    } while (Date.now() < deadline)
    throw new Error(`Timed out waiting for ${context}`)
  }

  function run(bin: string, argv: string[], input?: string) {
    return execFileSync(path.join(pgBin, bin), argv, { env, input, encoding: 'utf8', timeout: 20000, stdio: 'pipe' }).trim()
  }
  const db = (sql: string) => run('psql', args(), sql)
  function stop() {
    if (!directory) return
    const data = path.join(directory, 'data')
    if (existsSync(path.join(data, 'postmaster.pid'))) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'])
    rmSync(directory, { recursive: true, force: true })
    directory = ''
  }

  return {
    db, stop,
    start() {
      // Socket-only cluster with synthetic roles; no DATABASE_URL/PG* setup inherited.
      directory = mkdtempSync('/tmp/messages-lock-pg-')
      const data = path.join(directory, 'data')
      try {
        run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale'])
        run('pg_ctl', ['-D', data, '-l', path.join(directory, 'server.log'), '-o',
          `-F -p 55484 -k ${directory} -c listen_addresses='' -c timezone=UTC -c deadlock_timeout=150ms`, '-w', 'start'])
      } catch (error) { stop(); throw error }
    },
    async open() {
      const connection = client()
      children.add(connection)
      const pid = Number(await connection.execute('SELECT pg_backend_pid()'))
      if (!Number.isInteger(pid) || pid <= 0) throw new Error('Missing PostgreSQL backend PID')
      return { ...connection, pid }
    },
    async waitOn(waiter: number, blocker: number, kind: 'advisory' | 'row') {
      await waitFor(() => db(`SELECT ${blocker} = ANY(pg_blocking_pids(${waiter})) AND EXISTS (
        SELECT FROM pg_locks WHERE pid=${waiter} AND NOT granted
        AND locktype IN (${kind === 'advisory' ? "'advisory'" : "'transactionid','tuple'"}))`) === 't',
      `backend ${waiter} to queue on ${blocker}'s ${kind} lock`)
    },
    async closeClients() {
      const connections = [...children]
      connections.forEach(connection => connection.close())
      await Promise.all(connections.map(connection => connection.done))
      children.clear()
    },
  }
}

export function captureSql(transaction: Promise<string>) {
  return transaction.then(output => ({ output, error: '' }), (error: Error) => ({ output: '', error: error.message }))
}