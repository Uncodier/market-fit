import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"

const pgBin = process.env.RECORD_TRASH_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"

// Reuse the existing fixture's private Unix socket, but create controllable
// clients. Never accept a connection string or inherit libpq credentials.
export function recordsSessions(socket: string) {
  if (!/^\/tmp\/records-trash-pg-[\w]+$/.test(socket) || !existsSync(path.join(socket, ".s.PGSQL.55448"))) {
    throw new Error("Expected disposable Records PostgreSQL socket")
  }
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", LC_ALL: "C", LANG: "C", PGCONNECT_TIMEOUT: "5", PGPASSFILE: path.join(socket, "no-passfile"),
    PGOPTIONS: "-c client_min_messages=warning -c statement_timeout=8000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=12000" }
  const bin = path.join(pgBin, "psql")
  const args = ["-X", "-qAt", "-w", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
    "-h", socket, "-p", "55448", "-U", "postgres", "-d", "postgres"]
  const children = new Set<ChildProcessWithoutNullStreams>()
  const query = (sql: string) => execFileSync(bin, args, { input: sql, env, encoding: "utf8",
    timeout: 10000, stdio: "pipe" }).trim()

  async function waitFor(test: () => boolean, description: string) {
    const deadline = Date.now() + 4000
    do {
      if (test()) return
      await delay(20)
    } while (Date.now() < deadline)
    throw new Error(`Timed out waiting for ${description}`)
  }

  async function connect() {
    const child = spawn(bin, args, { env, stdio: "pipe" })
    children.add(child)
    let stdout = "", stderr = "", sequence = 0
    let closed = false
    child.stdout.on("data", data => { stdout += data.toString() })
    child.stderr.on("data", data => { stderr += data.toString() })
    child.stdin.on("error", error => { stderr += error.message })
    const done = new Promise<{ code: number | null; stderr: string }>(resolve => {
      child.on("error", error => { stderr += error.message })
      child.on("close", code => {
        children.delete(child)
        closed = true
        resolve({ code, stderr })
      })
    })

    async function execute(sql: string) {
      const start = stdout.length
      const marker = `__records_statement_${++sequence}__`
      child.stdin.write(`${sql.trim().replace(/;?$/, ";")}\n\\echo ${marker}\n`)
      await waitFor(() => closed || stdout.indexOf(marker, start) >= 0, marker)
      const end = stdout.indexOf(marker, start)
      if (end < 0) throw new Error(stderr || "Disposable PostgreSQL client closed")
      return stdout.slice(start, end).trim()
    }

    const pid = Number(await execute("SELECT pg_backend_pid()"))
    if (!Number.isInteger(pid) || pid <= 0) throw new Error("Missing disposable PostgreSQL backend PID")
    // The client remains attached until test cleanup so BEGIN/COMMIT order is
    // controlled by the caller; psql exits and rolls back on the first error.
    return { pid, execute, done }
  }

  return {
    connect,
    query,
    async waitingOnAdvisory(waiter: number, blocker: number) {
      await waitFor(() => query(`SELECT ${blocker} = ANY(pg_blocking_pids(${waiter}))
        AND EXISTS (SELECT 1 FROM pg_locks WHERE pid=${waiter} AND locktype='advisory' AND NOT granted)`) === "t",
      `backend ${waiter} queued on ${blocker}'s advisory fence`)
    },
    async waitingOnTuple(waiter: number, blocker: number) {
      await waitFor(() => query(`SELECT ${blocker} = ANY(pg_blocking_pids(${waiter}))
        AND EXISTS (SELECT 1 FROM pg_locks WHERE pid=${waiter} AND locktype='transactionid' AND NOT granted)`) === "t",
      `backend ${waiter} queued on ${blocker}'s row transaction`)
    },
    async cleanUp() {
      await Promise.all([...children].map(child => new Promise<void>(resolve => {
        child.once("close", () => resolve())
        child.kill()
      })))
    },
  }
}