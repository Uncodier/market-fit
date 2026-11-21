/** @jest-environment node */

import { at, exactSummary, hidden, inbox, installMessagesFixture, messagesLockMigration, overflow,
  resetMessagesFixture, site, sqlInsert, uuid, writer } from './messages-lock-postgres-fixture'
import { captureSql, messagesPostgres, messagesPostgresAvailable } from './messages-lock-postgres-sessions'

const suite = messagesPostgresAvailable ? describe : describe.skip
const gate = 9817112
const securityMetadata = `SELECT jsonb_agg(jsonb_build_object('name',proname,'owner',proowner,'acl',proacl,
  'definer',prosecdef,'config',proconfig) ORDER BY proname) FROM pg_proc WHERE oid IN
  ('public.refresh_conversation_message_summary()'::regprocedure,'public.update_conversation_last_message_time()'::regprocedure);`

suite('message lock order in disposable PostgreSQL', () => {
  const pg = messagesPostgres()
  const { db } = pg
  let oldPrivileges: string

  beforeAll(() => {
    pg.start()
    installMessagesFixture(db)
    oldPrivileges = db(securityMetadata)
    // Pause one real INSERT after the location SHARE lock and before any AFTER
    // trigger. The independent gate cannot satisfy the production lock waits.
    db(`CREATE FUNCTION public.messages_test_insert_gate() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF current_setting('messages_test.gate',true) = 'hold' THEN PERFORM pg_advisory_xact_lock(${gate}); END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER zz_messages_test_insert_gate BEFORE INSERT ON public.messages FOR EACH ROW
        EXECUTE FUNCTION public.messages_test_insert_gate();`)
  }, 30000)
  beforeEach(() => resetMessagesFixture(db))
  afterEach(async () => pg.closeClients())
  afterAll(() => pg.stop(), 30000)

  async function overlappingInserts(role: string, fixed: boolean) {
    const [controller, first, second] = await Promise.all([pg.open(), pg.open(), pg.open()])
    await controller.execute(`BEGIN; SELECT pg_advisory_xact_lock(${gate});`)
    const a = captureSql(first.execute(writer(`SET messages_test.gate='hold'; ${sqlInsert(101, inbox, role, 13)}`)))
    await pg.waitOn(first.pid, controller.pid, 'advisory')
    const b = captureSql(second.execute(writer(sqlInsert(102, inbox, role, 11))))
    await pg.waitOn(second.pid, first.pid, 'row')
    if (!fixed) {
      // Before correction, assistant is blocked upgrading the row in summary
      // while owning the summary advisory lock. Human reply blocks earlier, in
      // its FOR UPDATE, without yet owning the summary advisory lock.
      expect(db(`SELECT EXISTS(SELECT FROM pg_locks WHERE pid=${second.pid} AND locktype='advisory' AND granted)`))
        .toBe(role === 'assistant' ? 't' : 'f')
    }
    await controller.execute('COMMIT')
    return Promise.all([a, b])
  }

  describe('audited before state', () => {
    test.each(['assistant', 'team_member'])('%s INSERT reproduces SQLSTATE 40P01', async role => {
      const outcomes = await overlappingInserts(role, false)
      expect(outcomes.filter(outcome => outcome.error.includes('40P01')).length).toBe(1)
      expect(outcomes.filter(outcome => !outcome.error).length).toBe(1)
      expect(db('SELECT count(*) FROM public.messages;')).toBe('1')
    }, 20000)
  })

  describe('forward correction', () => {
    beforeAll(() => db(messagesLockMigration))

    test.each(['assistant', 'team_member'])('both %s INSERTs commit with fresh exact summaries', async role => {
      expect((await overlappingInserts(role, true)).map(outcome => outcome.error)).toEqual(['', ''])
      expect(db('SELECT count(*) FROM public.messages;')).toBe('2')
      expect(exactSummary(db)).toBe('t')
      const pause = role === 'team_member' ? `${at(13)}|${at(17)}` : '|'
      expect(db(`SELECT last_human_reply_at, automation_paused_until FROM public.conversations WHERE id='${inbox}';`)).toBe(pause)
    }, 20000)

    it('lets a direct parent update finish first and does not serialize another conversation', async () => {
      const [parent, first, unrelated] = await Promise.all([pg.open(), pg.open(), pg.open()])
      await parent.execute(`BEGIN; UPDATE public.conversations SET title='kept' WHERE id='${inbox}';`)
      const pending = captureSql(first.execute(writer(sqlInsert(103))))
      await pg.waitOn(first.pid, parent.pid, 'row')
      await unrelated.execute(writer(sqlInsert(104, overflow)))
      await parent.execute('COMMIT')
      expect((await pending).error).toBe('')
      expect(db(`SELECT title FROM public.conversations WHERE id='${inbox}';`)).toBe('kept')
      expect(exactSummary(db)).toBe('t')
    }, 20000)

    it('exposes retryable child conflicts without blocking metadata or breaking cascade', async () => {
      db(writer(sqlInsert(105) + sqlInsert(106)))
      const parent = await pg.open()
      await parent.execute(`BEGIN; SELECT id FROM public.conversations WHERE id='${inbox}' FOR UPDATE;`)
      // No summary changes; metadata updates need not wait for the parent row.
      db(writer(`UPDATE public.messages SET read_at=now(),custom_data='{"status":"read"}' WHERE id='${uuid(105)}';`))
      for (const mutation of [
        `UPDATE public.messages SET content=content WHERE id='${uuid(105)}';`,
        `UPDATE public.messages SET conversation_id='${overflow}' WHERE id='${uuid(105)}';`,
        `DELETE FROM public.messages WHERE id='${uuid(105)}';`,
      ]) {
        expect(() => db(writer(mutation))).toThrow(/55P03/)
      }
      await parent.execute('COMMIT')
      expect(exactSummary(db)).toBe('t')
      db(writer(`UPDATE public.messages SET conversation_id='${overflow}' WHERE id='${uuid(105)}';`))
      db(`DELETE FROM public.conversations WHERE id='${inbox}';`)
      expect(db('SELECT id FROM public.messages;')).toBe(uuid(105))
      expect(exactSummary(db)).toBe('t')
    }, 20000)

    it('breaks the child-first versus parent-first FK cascade wait cycle', async () => {
      db(writer(sqlInsert(120)))
      const [child, parent] = await Promise.all([pg.open(), pg.open()])
      await child.execute(writer(`BEGIN; UPDATE public.messages SET read_at=now() WHERE id='${uuid(120)}';`))
      const cascade = captureSql(parent.execute(`DELETE FROM public.conversations WHERE id='${inbox}';`))
      await pg.waitOn(parent.pid, child.pid, 'row')
      expect((await captureSql(child.execute(`DELETE FROM public.messages WHERE id='${uuid(120)}';`))).error).toContain('55P03')
      expect((await cascade).error).toBe('')
      expect(db('SELECT count(*) FROM public.messages;')).toBe('0')
      expect(db(`SELECT count(*) FROM public.conversations WHERE id='${inbox}';`)).toBe('0')
    }, 20000)

    it('requires transaction retry on a stale REPEATABLE READ parent snapshot', async () => {
      const stale = await pg.open()
      expect(await stale.execute(writer(`BEGIN ISOLATION LEVEL REPEATABLE READ;
        SELECT message_count FROM public.conversations WHERE id='${inbox}';`))).toBe('0')
      db(writer(sqlInsert(107)))
      expect((await captureSql(stale.execute(sqlInsert(108)))).error).toContain('40001')
      db(writer(sqlInsert(108)))
      expect(exactSummary(db)).toBe('t')
    }, 20000)

    it('preserves grants, parent visibility, snooze invoker checks, and anonymous denial', () => {
      expect(db(securityMetadata)).toBe(oldPrivileges)
      expect(db(`SELECT bool_or(has_function_privilege(role,'public.lock_message_conversations()','EXECUTE'))
        FROM unnest(ARRAY['anon','authenticated','service_role']) AS roles(role);`)).toBe('f')
      for (const hiddenOrMissing of [hidden, uuid(31)]) {
        expect(() => db(writer(sqlInsert(109, hiddenOrMissing)))).toThrow(/42501: Operational parent unavailable/)
      }
      expect(() => db(`SET ROLE anon; ${sqlInsert(109)}`)).toThrow(/42501/)
      // A role with message write permission but no conversation UPDATE grant
      // cannot use the definer lock to bypass human-reply write authorization.
      expect(() => db(`SET ROLE test_reader; SET messages_test.site_id='${site}';
        ${sqlInsert(109, inbox, 'team_member')}`)).toThrow(/42501/)
      expect(db('SELECT count(*) FROM public.messages;')).toBe('0')
      db(writer(sqlInsert(109, inbox, 'team_member', 12, '{"internal":true}')))
      expect(db(`SELECT last_human_reply_at IS NULL FROM public.conversations WHERE id='${inbox}';`)).toBe('t')
    })

    it('keeps exact summaries for ordered batches, tie-break edits, moves, deletes and rollback', async () => {
      const [holder, waiter] = await Promise.all([pg.open(), pg.open()])
      const insertBatch = (start: number, hour: number) => `INSERT INTO public.messages(id,conversation_id,content,role,created_at)
        SELECT v.id,v.parent,'batch','user', '${at(hour)}'::timestamptz FROM (VALUES
          ('${uuid(start)}'::uuid,'${inbox}'::uuid),('${uuid(start + 1)}'::uuid,'${inbox}'::uuid),
          ('${uuid(start + 2)}'::uuid,'${overflow}'::uuid)) AS v(id,parent) ORDER BY v.parent,v.id;`
      await holder.execute(writer(`BEGIN; ${insertBatch(110, 13)}`))
      const pending = captureSql(waiter.execute(writer(insertBatch(115, 10))))
      await pg.waitOn(waiter.pid, holder.pid, 'row')
      await holder.execute('COMMIT')
      expect((await pending).error).toBe('')
      expect(exactSummary(db)).toBe('t')
      expect(db(`SELECT message_count,last_message_at,updated_at,last_message_preview->>'id'
        FROM public.conversations WHERE id='${inbox}';`)).toBe(`4|${at(13)}|${at(10)}|${uuid(111)}`)

      db(writer(`UPDATE public.messages SET id='${uuid(119)}', content='edited', role='assistant' WHERE id='${uuid(110)}';`))
      expect(db(`SELECT last_message_preview->>'id' FROM public.conversations WHERE id='${inbox}';`)).toBe(uuid(119))
      db(writer(`UPDATE public.messages SET conversation_id='${overflow}',created_at='${at(16)}' WHERE id='${uuid(119)}';`))
      expect(exactSummary(db)).toBe('t')
      db(writer(`BEGIN; DELETE FROM public.messages; ROLLBACK;`))
      expect(exactSummary(db)).toBe('t')
      expect(db('SELECT count(*) FROM public.messages;')).toBe('6')
      db(writer('DELETE FROM public.messages;'))
      expect(exactSummary(db)).toBe('t')
      expect(db('SELECT count(*) FROM public.messages;')).toBe('0')
    }, 20000)
  })
})