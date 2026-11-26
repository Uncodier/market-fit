import { migration, uuid } from './isolated-postgres'
import { installLeadReadFixture, leadActors as a } from '../leads/read-rls-postgres-fixture'

export function installMessageParentFixture(db: (sql: string) => string) {
  installLeadReadFixture(db)
  db(migration('20261123183000_bound_leads_rls_membership.sql'))
  db(`CREATE TABLE public.tasks(id uuid PRIMARY KEY, site_id uuid, user_id uuid, assignee uuid);
    CREATE TABLE public.conversations(id uuid PRIMARY KEY, site_id uuid, user_id uuid,
      agent_id uuid, delegate_id uuid, visitor_id uuid, lead_id uuid, channel text DEFAULT 'web',
      created_at timestamptz DEFAULT now(), last_message_at timestamptz DEFAULT now(),
      is_archived boolean DEFAULT false, status text DEFAULT 'active');
    CREATE TABLE public.messages(id uuid PRIMARY KEY, conversation_id uuid, user_id uuid,
      agent_id uuid, visitor_id uuid, content text DEFAULT 'Synthetic message', created_at timestamptz DEFAULT now());
    CREATE INDEX ON public.conversations(site_id,last_message_at DESC,created_at DESC,id DESC);
    CREATE INDEX ON public.messages(conversation_id,created_at DESC,id DESC);`)
  const old = migration('20260820000000_team_member_restrict_assigned.sql')
  db(old.slice(old.indexOf('-- Tasks'), old.indexOf('-- Reservations')))
  db(old.slice(old.indexOf('-- Conversations'), old.indexOf('-- Records')))
  for (const table of ['tasks', 'conversations', 'messages']) {
    db(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON public.${table} TO authenticated,anon,service_role;
      CREATE POLICY location_guard ON public.${table} AS RESTRICTIVE TO authenticated
        USING (NOT (SELECT public.current_user_has_location_restrictions()));
      CREATE POLICY anonymous_guard ON public.${table} AS RESTRICTIVE TO anon USING(false);`)
  }
  db(`CREATE POLICY review_guard ON public.conversations AS RESTRICTIVE TO authenticated
      USING (channel IS DISTINCT FROM 'internal_review');
    INSERT INTO public.conversations(id,site_id,user_id,agent_id,delegate_id,visitor_id,lead_id,channel) VALUES
      ('${uuid(600)}','${a.site}','${a.owner}',NULL,NULL,NULL,'${uuid(100)}','web'),
      ('${uuid(601)}','${a.site}','${a.assigned}',NULL,NULL,NULL,NULL,'web'),
      ('${uuid(602)}','${a.site}','${a.owner}',NULL,NULL,NULL,NULL,'web'),
      ('${uuid(603)}','${a.site}','${a.owner}','${a.assigned}',NULL,NULL,NULL,'web'),
      ('${uuid(604)}','${a.site}','${a.owner}',NULL,'${a.assigned}',NULL,NULL,'web'),
      ('${uuid(605)}','${a.otherSite}','${a.assigned}',NULL,NULL,NULL,NULL,'web'),
      ('${uuid(606)}','${a.site}','${a.owner}',NULL,NULL,'${a.assigned}',NULL,'web'),
      ('${uuid(607)}','${a.site}','${a.owner}',NULL,NULL,NULL,'${uuid(104)}','web'),
      ('${uuid(608)}','${a.site}','${a.assigned}',NULL,NULL,NULL,NULL,'internal_review'),
      ('${uuid(609)}',NULL,NULL,NULL,NULL,NULL,NULL,'web'),
      ('${uuid(610)}','${a.archivedSite}','${a.archivedOwner}',NULL,NULL,NULL,NULL,'web'),
      ('${uuid(611)}','${a.lapsedSite}','${a.lapsedOwner}',NULL,NULL,NULL,'${uuid(107)}','web');
    INSERT INTO public.messages(id,conversation_id)
      SELECT md5('message-'||id)::uuid,id FROM public.conversations;
    INSERT INTO public.messages(id,conversation_id,user_id,agent_id,visitor_id) VALUES
      ('${uuid(700)}','${uuid(608)}','${a.assigned}',NULL,NULL),
      ('${uuid(701)}',NULL,NULL,'${a.assigned}',NULL),
      ('${uuid(702)}',NULL,NULL,NULL,'${a.assigned}'),
      ('${uuid(703)}','${uuid(999)}',NULL,NULL,NULL);`)
  db(migration('20261126195000_bound_chat_task_membership.sql'))
}

export function seedMessageParentScale(db: (sql: string) => string) {
  db(`INSERT INTO public.sites(id,user_id)
      SELECT md5('scale-site-'||i)::uuid,'${a.owner}' FROM generate_series(1,24) g(i);
    INSERT INTO public.billing(site_id,status,plan)
      SELECT md5('scale-site-'||i)::uuid,'active','enterprise' FROM generate_series(1,24) g(i);
    INSERT INTO public.site_members(site_id,user_id,role,status,restrict_to_assigned_only)
      SELECT md5('scale-site-'||i)::uuid,'${a.assigned}','collaborator','active',true
      FROM generate_series(1,24) g(i);
    INSERT INTO public.conversations(id,site_id,user_id,agent_id,last_message_at)
      SELECT md5('scale-conversation-'||i)::uuid,md5('scale-site-'||(1+i%24))::uuid,
        '${a.owner}','${a.assigned}',now()-interval '1 day' FROM generate_series(1,12000) g(i);
    INSERT INTO public.conversations(id,site_id,user_id,agent_id,last_message_at)
      SELECT md5('inbox-'||i)::uuid,'${a.site}','${a.owner}','${a.assigned}',now()+interval '1 day'
      FROM generate_series(1,21) g(i);
    INSERT INTO public.leads(id,site_id,user_id,assignee_id)
      SELECT md5('scale-lead-'||i)::uuid,md5('scale-site-'||(1+i%24))::uuid,'${a.owner}','${a.assigned}'
      FROM generate_series(1,12000) g(i);
    INSERT INTO public.messages(id,conversation_id,content,created_at)
      SELECT md5('scale-message-'||c.id||'-'||i)::uuid,c.id,'Synthetic '||i,now()+i*interval '1 second'
      FROM public.conversations c CROSS JOIN generate_series(1,3) g(i);
    ANALYZE public.sites; ANALYZE public.site_members; ANALYZE public.site_ownership;
    ANALYZE public.conversations; ANALYZE public.messages; ANALYZE public.leads;`)
}