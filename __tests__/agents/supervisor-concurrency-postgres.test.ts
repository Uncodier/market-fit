/** @jest-environment node */
import { setTimeout as delay } from 'node:timers/promises'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { agent, assign, guardMigration, insert, installAgents, other, site, verbose } from './supervisor-postgres-fixture'

const pg = isolatedPostgres()
const parent = (id: number) => pg.db(`SELECT supervisor FROM public.agents WHERE id=${agent(id)}`)
const run = (sql: string, cluster = pg) => cluster.concurrent(verbose(sql)).then(
  () => '', (err: Error) => err.message,
)
const isolationCases = [['READ COMMITTED', 301], ['REPEATABLE READ', 401], ['SERIALIZABLE', 501]] as const

// A barrier rather than sleep-based scheduling: observe the parked backend,
// then open the gate in a DIFFERENT connection. All three connections belong
// to the existing test harness's socket-only cluster.
async function withGate(sql: string, whilePaused: () => Promise<void>, cluster = pg) {
  cluster.db('ALTER SEQUENCE public.supervisor_test_gate RESTART WITH 1')
  const transaction = run(`SET application_name='supervisor-test-writer'; SET statement_timeout='6s'; ${sql}`, cluster)
  try {
    const deadline = Date.now() + 4000
    while (cluster.db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='supervisor-test-writer'
      AND wait_event='PgSleep'`) !== '1') {
      if (Date.now() > deadline) throw new Error('The disposable writer did not reach its barrier')
      await delay(10)
    }
    await whilePaused()
  } finally {
    cluster.db("SELECT nextval('public.supervisor_test_gate')")
  }
  return transaction
}
const withPausedTransaction = (before: string, after: string, whilePaused: () => Promise<void>) =>
  withGate(`${before}; SELECT public.supervisor_test_pause(); ${after}; COMMIT`, whilePaused)

function installGate(cluster: typeof pg) {
  // PostgreSQL sequences are visible across MVCC snapshots (including RR).
  cluster.db(`CREATE SEQUENCE public.supervisor_test_gate;
    CREATE FUNCTION public.supervisor_test_pause() RETURNS void LANGUAGE plpgsql AS $$
    BEGIN WHILE NOT (SELECT is_called FROM public.supervisor_test_gate) LOOP PERFORM pg_sleep(0.01); END LOOP; END; $$;`)
}

;(postgresAvailable ? describe : describe.skip)('agent supervisor races in disposable PostgreSQL', () => {
  beforeAll(() => {
    pg.start()
    installAgents(pg.db)
    pg.db(`SET ROLE postgres; ${guardMigration}`)
    installGate(pg)
  }, 30000)
  afterAll(() => pg.stop())

  it('does not trust a fixed snapshot taken before the guard was installed', async () => {
    const fresh = isolatedPostgres()
    try {
      fresh.start(); installAgents(fresh.db); installGate(fresh)
      fresh.db(`${insert(901)}; ${insert(902)}`)
      const result = await withGate(`BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM public.agents;
        SELECT public.supervisor_test_pause(); ${assign(902, 901)}; COMMIT`, async () => {
        fresh.db(assign(901, 902)) // A legitimate pre-install write; there is no site witness yet.
        fresh.db(`SET ROLE postgres; ${guardMigration}`)
      }, fresh)
      expect(result).toMatch(/40001:/)
      expect(fresh.db(`SELECT supervisor FROM public.agents WHERE id=${agent(902)}`)).toBe('')
      expect(fresh.db(`SELECT supervisor FROM public.agents WHERE id=${agent(901)}`)).toBe(uuid(902))
    } finally { fresh.stop() }
  }, 30000)

  it('won\'t commit opposite assignments; retries see the winner, other sites and plain profiles do not contend', async () => {
    pg.db(`${insert(101)}; ${insert(102)}; ${insert(103)}; ${insert(104, null, other)}; ${insert(105, null, other)}`)
    const result = await withPausedTransaction(`BEGIN; ${assign(101, 102)}`, 'SELECT 1', async () => {
      expect(await run(assign(102, 101))).toMatch(/40001:/)
      expect(await run(assign(104, 105))).toBe('')
      expect(await run(`UPDATE public.agents SET name='ordinary update' WHERE id=${agent(103)}; ${insert(106)}`)).toBe('')
    })
    expect(result).toBe('')
    expect(parent(101)).toBe(uuid(102)); expect(parent(102)).toBe(''); expect(parent(104)).toBe(uuid(105))
    expect(await run(assign(102, 101))).toMatch(/23514:/)
  })

  it('fences both sites of a move vs a racing insert or same-tenant assignment', async () => {
    pg.db(`${insert(201)}; ${insert(202, null, other)}`)
    const delivered = await withPausedTransaction(`BEGIN; UPDATE public.agents SET site_id='${other}' WHERE id=${agent(201)}`,
      'SELECT 1', async () => {
        expect(await run(insert(203, 201, site))).toMatch(/40001:/)
        expect(await run(assign(202, 201))).toMatch(/40001:/)
      })
    expect(delivered).toBe('')
    expect(await run(insert(203, 201, site))).toMatch(/23514:/)
    expect(await run(assign(202, 201))).toBe('')
  })

  it.each(isolationCases)(
    '%s sees the committed opposite edge or refuses its stale snapshot, including first use of a site', async (isolation, id) => {
      // Distinct sites for each case. The winning transaction creates a fence
      // row that was not even present in the other transaction's initial view.
      const tenant = uuid(id + 50)
      pg.db(`INSERT INTO public.sites(id) VALUES ('${tenant}'); ${insert(id, null, tenant)}; ${insert(id + 1, null, tenant)}`)
      const result = await withPausedTransaction(`BEGIN ISOLATION LEVEL ${isolation}; SELECT count(*) FROM public.agents`,
        assign(id + 1, id), async () => {
          expect(await run(assign(id, id + 1))).toBe('')
        })
      expect(result).toMatch(isolation === 'READ COMMITTED' ? /23514:/ : /40001:/)
      expect(parent(id)).toBe(uuid(id + 1)); expect(parent(id + 1)).toBe('')
    },
  )

  it('detects a committed write to an existing witness, even after the advisory lock has been released', async () => {
    pg.db(`${insert(601)}; ${insert(602)}; ${assign(601, 602)}; ${assign(601, null)}`)
    const result = await withPausedTransaction('BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM public.agents',
      assign(602, 601), async () => { expect(await run(assign(601, 602))).toBe('') })
    expect(result).toMatch(/40001:/)
    expect(parent(602)).toBe('')
  })

  it('does not let a stale root replacement inherit a child committed in its former site', async () => {
    pg.db(insert(801))
    const result = await withPausedTransaction('BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM public.agents',
      `WITH removed AS (DELETE FROM public.agents WHERE id=${agent(801)} RETURNING id)
       INSERT INTO public.agents(id, site_id) SELECT id, '${other}' FROM removed`, async () => {
        expect(await run(insert(802, 801))).toBe('')
      })
    expect(pg.db(`SELECT site_id FROM public.agents WHERE id=${agent(801)}`)).toBe(site)
    expect(result).toMatch(/40001:/)
    expect(parent(802)).toBe(uuid(801))
  })

  it('validates a direct parent in the hierarchy snapshot, not just in the later FK check', async () => {
    // Pause after the guard has examined the child, before the NO ACTION FK reads
    // its parent. No triggers are disabled and the concurrent root is a normal insert.
    pg.db(`ALTER SEQUENCE public.supervisor_test_gate RESTART WITH 1;
      CREATE FUNCTION public.pause_before_agent_fk() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM public.supervisor_test_pause(); RETURN NULL; END; $$;
      CREATE TRIGGER "Pause_before_agent_fk" AFTER INSERT ON public.agents FOR EACH ROW
        WHEN (NEW.id=${agent(812)}) EXECUTE FUNCTION public.pause_before_agent_fk()`)
    try {
      // The child and its pending parent must not be accepted in different sites.
      const child = run(`SET application_name='supervisor-test-child'; SET statement_timeout='6s'; ${insert(812, 811)}`)
      const deadline = Date.now() + 4000
      while (pg.db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='supervisor-test-child'
        AND wait_event='PgSleep'`) === '0') {
        if (await Promise.race([child.then(() => true), delay(10, false)])) break
        if (Date.now() > deadline) throw new Error('The child did not reach the guard or the FK barrier')
      }
      pg.db(`${insert(811, null, other)}; SELECT nextval('public.supervisor_test_gate')`)
      expect(await child).toMatch(/23503:/)
      expect(pg.db(`SELECT count(*) FROM public.agents WHERE id=${agent(812)}`)).toBe('0')
    } finally {
      pg.db(`SELECT nextval('public.supervisor_test_gate')`)
      pg.db(`DROP TRIGGER "Pause_before_agent_fk" ON public.agents; DROP FUNCTION public.pause_before_agent_fk()`)
    }
  })

  it('rechecks against a fresh READ COMMITTED snapshot even when the original statement started before the winner', async () => {
    pg.db(`${insert(701)}; ${insert(702)};`)
    // The outer UPDATE already has its statement snapshot as it computes the
    // assignment. Only the VOLATILE trigger's query can see the later commit.
    const delayedAssignment = `UPDATE public.agents SET supervisor=(SELECT ${agent(701)} FROM public.supervisor_test_pause())
      WHERE id=${agent(702)}`
    const result = await withGate(delayedAssignment, async () => {
      expect(await run(assign(701, 702))).toBe('')
    })
    expect(result).toMatch(/23514:/)
    expect(parent(702)).toBe('')
  })
})