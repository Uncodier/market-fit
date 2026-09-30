/** @jest-environment node */
import { actor, assigned, coOwner, collaborator, foreign, inactive, marketing, migration,
  otherSite, owner, postgresAvailable, reorder, ReorderPostgres, site, uuid } from './reorder-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip

suite('task reordering in isolated socket-only PostgreSQL', () => {
  const pg = new ReorderPostgres()
  let originalGuards = ''
  const guards = () => pg.db(`SELECT json_build_object(
    'rls', (SELECT relrowsecurity FROM pg_class WHERE oid='public.tasks'::regclass),
    'policies', (SELECT json_agg(p) FROM pg_policies p WHERE tablename='tasks'),
    'triggers', (SELECT json_agg(pg_get_triggerdef(oid) ORDER BY tgname) FROM pg_trigger
      WHERE tgrelid='public.tasks'::regclass AND NOT tgisinternal));`)
  const deny = (sql: string, error: string, user: string | null = owner, role = 'authenticated') => {
    const before = pg.snapshot()
    expect(() => pg.call(sql, user, role)).toThrow(error)
    expect(pg.snapshot()).toBe(before)
    expect(pg.writes()).toBe('0')
    expect(pg.db('SELECT count(*) FROM public.task_update_audit;')).toBe('0')
  }
  const expectOrder = (ids: number[], status = 'pending', siteId = site) => {
    expect(pg.ordering(status, siteId)).toEqual(ids.map((id, index) => ({ id: uuid(id), priority: 990 - index * 10 })))
  }

  beforeAll(() => {
    pg.start()
    originalGuards = guards()
    pg.db(migration)
    pg.db(migration) // Forward correction must safely replace the existing signature on replay.
  }, 30000)
  afterAll(() => pg.stop())
  beforeEach(() => pg.seed())

  it('retains invoker/void signature, RLS, policies, and triggers with only authenticated execution', () => {
    expect(guards()).toBe(originalGuards)
    expect(pg.db(`SELECT prosecdef, pg_get_function_result(oid), pg_get_function_arguments(oid)
      FROM pg_proc WHERE oid='public.reorder_task_priorities(uuid,integer,text,uuid)'::regprocedure;`))
      .toBe('f|void|p_task_id uuid, p_new_position integer, p_status text, p_site_id uuid')
    expect(pg.db(`SELECT r, has_function_privilege(r,
      'public.reorder_task_priorities(uuid,integer,text,uuid)', 'EXECUTE')
      FROM unnest(ARRAY['anon','authenticated','service_role']) r ORDER BY r;`))
      .toBe('anon|f\nauthenticated|t\nservice_role|f')
  })

  it('accepts the browser named arguments and rejects the nonexistent legacy name', () => {
    deny(`SELECT public.reorder_task_priorities(p_task_id => '${uuid(103)}'::uuid,
      p_new_priority => 1, p_status => 'pending', p_site_id => '${site}'::uuid);`, 'does not exist')
    expect(pg.call(`SELECT public.reorder_task_priorities(p_task_id => '${uuid(103)}'::uuid,
      p_new_position => 1, p_status => 'pending', p_site_id => '${site}'::uuid);`)).toBe('')
    expectOrder([103, 101, 102])
  })

  it.each([['owner', owner], ['site co-owner', coOwner], ['collaborator', collaborator]])(
    'allows %s and resolves equal priorities by task ID', (_label, user) => {
      pg.call(reorder(), user)
      expectOrder([103, 101, 102])
      expect(pg.db(`SELECT count(*) FROM public.task_update_audit WHERE actor_id='${user}';`)).toBe('3')
      expect(pg.db(`SELECT count(*) FROM public.tasks WHERE site_id='${site}' AND status='pending'
        AND updated_at > '2026-01-01T00:00:00Z';`)).toBe('3')
    })

  it('supports the last position within a column and avoids no-op update side effects', () => {
    pg.call(reorder(uuid(101), 3))
    expectOrder([102, 103, 101])
    const before = pg.snapshot()
    const writes = pg.writes()
    pg.call(reorder(uuid(101), 3))
    expect(pg.snapshot()).toBe(before)
    expect(pg.writes()).toBe(writes)
  })

  it('renumbers both columns atomically, excluding the moving task from destination counts', () => {
    pg.call(reorder(uuid(103), 2, 'completed'))
    expectOrder([101, 102])
    expectOrder([104, 103, 105], 'completed')
    expect(pg.ordering('pending', otherSite)).toEqual([{ id: uuid(201), priority: 100 }])
  })

  it.each(['pending', 'in_progress', 'completed', 'failed', 'canceled'])(
    'accepts the deployed database status %s', status => {
      pg.call(reorder(uuid(103), 1, status))
      expect(pg.db(`SELECT status FROM public.tasks WHERE id='${uuid(103)}';`)).toBe(status)
    })

  it('allows appending to a destination and inserting into an empty destination', () => {
    pg.call(reorder(uuid(103), 3, 'completed'))
    expectOrder([104, 105, 103], 'completed')
    pg.call(reorder(uuid(103), 1, 'in_progress'))
    expectOrder([103], 'in_progress')
  })

  it.each([
    ['null task', reorder(null), 'IDs are required'],
    ['null site', reorder(uuid(103), 1, 'pending', null), 'IDs are required'],
    ['missing task', reorder(uuid(999)), 'Task not found'],
    ['foreign task', reorder(uuid(201)), 'Task not found'],
    ['missing site', reorder(uuid(103), 1, 'pending', uuid(999)), 'not authorized'],
    ['null position', reorder(uuid(103), null), 'at least 1'],
    ['zero position', reorder(uuid(103), 0), 'at least 1'],
    ['negative position', reorder(uuid(103), -1), 'at least 1'],
    ['same-column overflow', reorder(uuid(103), 4), 'exceeds destination size'],
    ['cross-column overflow', reorder(uuid(103), 4, 'completed'), 'exceeds destination size'],
    ['empty-column overflow', reorder(uuid(103), 2, 'in_progress'), 'exceeds destination size'],
    ['maximum integer position', reorder(uuid(103), 2147483647), 'exceeds destination size'],
    ['null status', reorder(uuid(103), 1, null), 'Invalid task status'],
    ['unknown status', reorder(uuid(103), 1, 'done'), 'Invalid task status'],
    ['alternate spelling', reorder(uuid(103), 1, 'cancelled'), 'Invalid task status'],
    ['uppercase status', reorder(uuid(103), 1, 'PENDING'), 'Invalid task status'],
    ['empty status', reorder(uuid(103), 1, ''), 'Invalid task status'],
  ])('rejects %s before any write attempt', (_label, sql, error) => deny(sql, error))

  it('rejects a visible task paired with a different authorized site', () => {
    pg.db(`INSERT INTO public.site_ownership VALUES ('${otherSite}', '${coOwner}');`)
    try {
      deny(reorder(uuid(103), 1, 'pending', otherSite), 'Task not found', coOwner)
    } finally {
      pg.db(`DELETE FROM public.site_ownership WHERE site_id='${otherSite}' AND user_id='${coOwner}';`)
    }
  })

  it.each([['marketing', marketing], ['foreign member', foreign], ['inactive member', inactive]])(
    'denies %s before any writes', (_label, user) => deny(reorder(), 'not authorized', user))

  it('requires an actor even for an authenticated database role', () => {
    deny(reorder(), 'Authentication required', null)
  })

  it('preserves the newer archived-site denial even for an owner', () => {
    pg.db(`UPDATE public.sites SET archived_at=now() WHERE id='${site}';`)
    deny(reorder(), 'Task update not authorized')
  })

  it.each([['anon', null], ['service_role', null], ['service_role', owner]])(
    'does not expose the RPC to %s with actor %s', (role, user) => {
      deny(reorder(), 'permission denied for function reorder_task_priorities', user, role)
    })

  it('keeps marketing read access but preserves the update permission trigger', () => {
    expect(pg.call('SELECT count(*) FROM public.tasks;', marketing)).toBe('5')
    deny(`UPDATE public.tasks SET priority=1 WHERE id='${uuid(103)}';`, 'CREATE_UPDATE_PERMISSION_DENIED', marketing)
    expect(pg.call('SELECT count(*) FROM public.tasks;', inactive)).toBe('0')
    expect(pg.call('SELECT count(*) FROM public.tasks;', foreign)).toBe('1')
  })

  it('limits assigned-only reorders to created/assigned tasks without touching hidden rows', () => {
    expect(pg.call('SELECT count(*) FROM public.tasks;', assigned)).toBe('3')
    const hidden = () => pg.db(`SELECT json_agg(t ORDER BY id) FROM public.tasks t WHERE id IN ('${uuid(101)}','${uuid(104)}');`)
    const before = hidden()
    pg.call(reorder(uuid(103), 1, 'completed'), assigned)
    expect(hidden()).toBe(before)
    expect(pg.call(`SELECT string_agg(id::text, ',' ORDER BY priority DESC, id)
      FROM public.tasks WHERE status='completed';`, assigned)).toBe(`${uuid(103)},${uuid(105)}`)
    expect(pg.db(`SELECT count(*) FROM public.task_update_audit WHERE task_id IN ('${uuid(101)}','${uuid(104)}');`)).toBe('0')
  })

  it('rejects hidden tasks and positions outside the assigned-only visible destination', () => {
    deny(reorder(uuid(101)), 'Task not found', assigned)
    deny(reorder(uuid(103), 3), 'exceeds destination size', assigned)
    deny(reorder(uuid(103), 3, 'completed'), 'exceeds destination size', assigned)
  })

  it('rolls back all earlier updates and transactional trigger effects if a later trigger fails', () => {
    const before = pg.snapshot()
    expect(() => pg.call(`SET reorder.fail_task='${uuid(103)}'; ${reorder(uuid(103), 2, 'completed')}`))
      .toThrow('Injected task trigger failure')
    expect(Number(pg.writes())).toBeGreaterThan(1)
    expect(pg.snapshot()).toBe(before)
    expect(pg.db('SELECT count(*) FROM public.task_update_audit;')).toBe('0')
  })

  it('honors caller transaction rollback', () => {
    const before = pg.snapshot()
    pg.call(`BEGIN; ${reorder()} ROLLBACK;`)
    expect(pg.snapshot()).toBe(before)
    expect(pg.db('SELECT count(*) FROM public.task_update_audit;')).toBe('0')
    expect(Number(pg.writes())).toBeGreaterThan(0)
  })

  const waitFor = async (query: string) => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (pg.db(query) === 't') return
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    throw new Error('Timed out waiting for PostgreSQL concurrency barrier')
  }

  it('takes the site advisory lock before row locks and releases it on rollback', async () => {
    const first = pg.concurrent(actor(`SET application_name='reorder-holder'; BEGIN;
      SELECT pg_advisory_xact_lock(hashtextextended('public.reorder_task_priorities:${site}',0));
      SELECT pg_sleep(1); ROLLBACK;`))
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='reorder-holder' AND wait_event='PgSleep');")
    const second = pg.concurrent(actor(`SET application_name='reorder-waiter'; ${reorder()}`))
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='reorder-waiter' AND wait_event='advisory');")
    expect(pg.writes()).toBe('0')
    // A separate writer can still lock the moving row: the waiting RPC did not lock it first.
    pg.call(`BEGIN; SELECT id FROM public.tasks WHERE id='${uuid(103)}' FOR UPDATE NOWAIT; ROLLBACK;`)
    // Different sites do not share the lock.
    pg.call(`SET lock_timeout='200ms'; ${reorder(uuid(201), 1, 'pending', otherSite)}`, foreign)
    await Promise.all([first, second])
    expectOrder([103, 101, 102])
  }, 15000)

  it.each([
    ['same-column', reorder(uuid(103), 1), reorder(uuid(101), 1), [101, 103, 102], [104, 105]],
    ['opposing cross-column', reorder(uuid(103), 1, 'completed'), reorder(uuid(104), 1), [104, 101, 102], [103, 105]],
  ])('serializes concurrent %s moves with fresh ordering after the lock', async (_label, firstSql, secondSql, pending, completed) => {
    const first = pg.concurrent(actor(`SET application_name='reorder-first'; BEGIN; ${firstSql} SELECT pg_sleep(1); COMMIT;`))
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='reorder-first' AND wait_event='PgSleep');")
    const second = pg.concurrent(actor(`SET application_name='reorder-second'; ${secondSql}`))
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='reorder-second' AND wait_event='advisory');")
    await Promise.all([first, second])
    expectOrder(pending)
    if (_label === 'opposing cross-column') expectOrder(completed, 'completed')
  }, 15000)

  it('serializes two concurrent moves into an initially empty column', async () => {
    await Promise.all([
      pg.concurrent(actor(reorder(uuid(101), 1, 'in_progress'))),
      pg.concurrent(actor(reorder(uuid(103), 1, 'in_progress'), collaborator)),
    ])
    expectOrder([102])
    const destination: { id: string; priority: number }[] = pg.ordering('in_progress')
    expect(destination.map(task => task.id).sort()).toEqual([uuid(101), uuid(103)])
    expect(destination.map(task => task.priority)).toEqual([990, 980])
  })
})