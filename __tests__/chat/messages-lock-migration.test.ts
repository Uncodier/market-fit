/** @jest-environment node */

import { messagesLockMigration as sql } from './messages-lock-postgres-fixture'

const compact = sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim()

describe('message lock order migration contract', () => {
  it('installs the trigger chain atomically and checks the known baseline', () => {
    expect(compact).toMatch(/^BEGIN; SET LOCAL lock_timeout = '5s'; LOCK TABLE public\.messages IN SHARE ROW EXCLUSIVE MODE;/)
    expect(compact).toMatch(/COMMIT;$/)
    expect(compact).toContain("md5(prosrc) = '2ff5403d198166130e61fae59c4d9fc3'")
    expect(compact).toContain("md5(prosrc) = '1751f5e4c71f33ca2943c2ce7e24fec7'")
    expect(compact).toContain("t.tgenabled = 'O'")
  })

  it('takes parent FOR UPDATE between visibility and inheritance and covers the same summary events', () => {
    const lockTrigger = 'location_acl_15_lock_message_conversations'
    expect('location_acl_10_visible' < lockTrigger && lockTrigger < 'location_acl_inherit').toBe(true)
    expect(compact).toContain(`CREATE TRIGGER ${lockTrigger} BEFORE INSERT OR UPDATE OF content, role, created_at, conversation_id, id ON public.messages`)
    expect(compact).toContain('AFTER INSERT OR DELETE OR UPDATE OF content, role, created_at, conversation_id, id ON public.messages')
    expect(compact).toContain('WHERE c.id = NEW.conversation_id FOR UPDATE;')
    expect(compact).toContain('ARRAY[OLD.conversation_id, NEW.conversation_id]')
    expect(compact).toContain('ORDER BY c.id FOR UPDATE NOWAIT')
    expect(compact).toContain('BEFORE DELETE ON public.messages')
    expect(compact).not.toMatch(/pg_advisory|SKIP LOCKED/)
  })

  it('preserves exact summaries, legacy updated_at and authorization boundaries', () => {
    expect(compact).toContain('COUNT(*)::bigint')
    expect(compact).toContain('ORDER BY latest.created_at DESC, latest.id DESC')
    expect(compact).toContain('SET updated_at = NEW.created_at WHERE id = NEW.conversation_id')
    expect(compact).not.toContain('last_message_at = NEW.created_at')
    expect(compact).toContain('ALTER FUNCTION public.lock_message_conversations() OWNER TO postgres;')
    expect(compact).toContain('REVOKE ALL ON FUNCTION public.lock_message_conversations() FROM PUBLIC, anon, authenticated, service_role;')
    expect(compact).not.toMatch(/\b(?:GRANT|DISABLE TRIGGER|ALTER POLICY|DROP POLICY)\b/)
    expect(compact).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION public\.(location_acl|snooze_conversation)/)
  })
})