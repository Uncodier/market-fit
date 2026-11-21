import { readFileSync } from 'node:fs'
import path from 'node:path'

const migrations = path.join(process.cwd(), 'supabase/migrations')
export const messagesLockMigration = readFileSync(path.join(migrations, '20261120232100_messages_lock_order.sql'), 'utf8')
const locationGuards = readFileSync(path.join(migrations, '20261021010001_location_scope_write_guards.sql'), 'utf8')
const inheritScope = locationGuards.slice(locationGuards.indexOf('CREATE OR REPLACE FUNCTION public.location_acl_inherit_scope()')).split('\nDO $$')[0]

export const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`
export const site = uuid(1), foreignSite = uuid(2)
export const inbox = uuid(10), overflow = uuid(20), hidden = uuid(30)
export const at = (hour: number) => `2026-01-01 ${String(hour).padStart(2, '0')}:00:00+00`
export const sqlInsert = (id: number, parent = inbox, role = 'assistant', hour = 12, custom = '{}') =>
  `INSERT INTO public.messages (id,conversation_id,role,content,created_at,custom_data)
   VALUES ('${uuid(id)}','${parent}','${role}','message-${id}','${at(hour)}','${custom}');`
export const writer = (sql: string) => `SET ROLE authenticated; SET messages_test.site_id = '${site}'; ${sql}`

export const installMessagesFixture = (db: (sql: string) => string) => {
  db(`CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE ROLE test_reader;
    CREATE SCHEMA location_acl_private;
    CREATE TABLE location_acl_private.links (child_table text, child_column text, parent_table text, required boolean, same_location boolean);
    CREATE TABLE location_acl_private.roots (table_name text, location_column text);
    INSERT INTO location_acl_private.links VALUES ('messages','conversation_id','conversations',true,false);
    INSERT INTO location_acl_private.roots VALUES ('conversations','location_id');

    CREATE TABLE public.conversations (
      id uuid PRIMARY KEY, site_id uuid NOT NULL, location_id uuid, title text,
      message_count bigint NOT NULL DEFAULT 0, last_message_preview jsonb, last_message_at timestamptz,
      updated_at timestamptz, last_human_reply_at timestamptz, automation_paused_until timestamptz
    );
    CREATE TABLE public.messages (
      id uuid PRIMARY KEY, conversation_id uuid NOT NULL, content text NOT NULL, role text NOT NULL,
      created_at timestamptz, read_at timestamptz, custom_data jsonb DEFAULT '{}'::jsonb,
      CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE
    );
    CREATE TABLE public.snooze_test_settings (site_id uuid PRIMARY KEY, hours numeric NOT NULL);
    INSERT INTO public.snooze_test_settings VALUES ('${site}', 4), ('${foreignSite}', 0);
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon, authenticated, service_role, test_reader;
    GRANT SELECT ON public.conversations, public.snooze_test_settings TO authenticated, service_role, test_reader;
    GRANT UPDATE ON public.conversations TO authenticated, service_role;
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY conversation_site ON public.conversations TO authenticated, test_reader
      USING (site_id = NULLIF(current_setting('messages_test.site_id',true),'')::uuid);
    CREATE POLICY message_site ON public.messages TO authenticated, test_reader
      USING (EXISTS (SELECT 1 FROM public.conversations AS c WHERE c.id = conversation_id));
    ${inheritScope}
    REVOKE ALL ON FUNCTION public.location_acl_inherit_scope() FROM PUBLIC, anon, authenticated, service_role;
    CREATE TRIGGER location_acl_inherit BEFORE INSERT OR UPDATE ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.location_acl_inherit_scope();
  `)
  db(readFileSync(path.join(__dirname, 'messages-lock-audited-functions.sql'), 'utf8').replace(/@space@/g, ' '))
}

export function resetMessagesFixture(db: (sql: string) => string) {
  db(`TRUNCATE public.conversations, public.messages;
    INSERT INTO public.conversations(id,site_id) VALUES
    ('${inbox}','${site}'),('${overflow}','${site}'),('${hidden}','${foreignSite}');`)
}

export function exactSummary(db: (sql: string) => string) {
  return db(`SELECT bool_and(c.message_count = (SELECT count(*) FROM public.messages m WHERE m.conversation_id=c.id)
    AND c.last_message_preview IS NOT DISTINCT FROM latest.preview
    AND c.last_message_at IS NOT DISTINCT FROM latest.created_at)
    FROM public.conversations c LEFT JOIN LATERAL (
      SELECT jsonb_build_object('id',m.id,'content',m.content,'role',m.role,'created_at',m.created_at) AS preview, m.created_at
      FROM public.messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    ) latest ON true;`)
}