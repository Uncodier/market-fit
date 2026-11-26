import { installLeadReadFixture, leadActors } from '../leads/read-rls-postgres-fixture'
import { migration, uuid } from '../security/isolated-postgres'

export const robotActors = leadActors
export const robotRows = {
  own: uuid(500), created: uuid(501), hidden: uuid(502), unknown: uuid(503),
  crossSite: uuid(504), blocked: uuid(505), archived: uuid(506), lapsed: uuid(507),
}

// Reuse the existing real licensing/capability chain without changing its fixture.
// Only the Robots tables below are new; deliberately permissive legacy policies
// make each ownership guard observable independently of unrelated parent guards.
export function installRobotReadFixture(db: (sql: string) => string) {
  installLeadReadFixture(db)
  const a = robotActors
  const r = robotRows
  db(`
    CREATE TABLE public.remote_instances (
      id uuid PRIMARY KEY, site_id uuid, user_id uuid, created_by uuid,
      payload text DEFAULT 'original', blocked boolean NOT NULL DEFAULT false
    );
    CREATE TABLE public.instance_logs (
      id uuid PRIMARY KEY, site_id uuid, instance_id uuid,
      payload text DEFAULT 'original', blocked boolean NOT NULL DEFAULT false
    );
    ${['remote_instances', 'instance_logs'].map(table => `
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, anon, service_role;
      CREATE POLICY legacy_allow ON public.${table} USING (true) WITH CHECK (true);
      CREATE POLICY legacy_guard ON public.${table} AS RESTRICTIVE
        USING (NOT blocked) WITH CHECK (NOT blocked);
      CREATE POLICY location_acl_enforcement ON public.${table} AS RESTRICTIVE TO authenticated
        USING (NOT (SELECT public.current_user_has_location_restrictions()))
        WITH CHECK (NOT (SELECT public.current_user_has_location_restrictions()));
    `).join('\n')}
    INSERT INTO public.remote_instances(id,site_id,user_id,created_by,blocked) VALUES
      ('${r.own}','${a.site}','${a.assigned}','${a.owner}',false),
      ('${r.created}','${a.site}','${a.owner}','${a.assigned}',false),
      ('${r.hidden}','${a.site}','${a.owner}','${a.owner}',false),
      ('${r.unknown}','${a.site}',NULL,NULL,false),
      ('${r.crossSite}','${a.otherSite}','${a.assigned}','${a.assigned}',false),
      ('${r.blocked}','${a.site}','${a.assigned}','${a.assigned}',true),
      ('${r.archived}','${a.archivedSite}','${a.archivedOwner}','${a.archivedOwner}',false),
      ('${r.lapsed}','${a.lapsedSite}','${a.lapsedMember}','${a.lapsedMember}',false);
    INSERT INTO public.instance_logs(id,site_id,instance_id,blocked) VALUES
      ('${uuid(600)}','${a.site}','${r.own}',false),
      ('${uuid(601)}','${a.site}','${r.created}',false),
      ('${uuid(602)}','${a.site}','${r.hidden}',false),
      ('${uuid(603)}','${a.site}','${r.unknown}',false),
      ('${uuid(604)}','${a.site}','${r.crossSite}',false),
      ('${uuid(605)}','${a.otherSite}','${r.own}',false),
      ('${uuid(606)}','${a.site}','${r.blocked}',false),
      ('${uuid(607)}','${a.site}',NULL,false),
      ('${uuid(608)}',NULL,'${r.own}',false),
      ('${uuid(609)}','${a.site}','${uuid(999)}',false),
      ('${uuid(610)}','${a.site}','${r.own}',true),
      ('${uuid(611)}','${a.otherSite}','${r.crossSite}',false),
      ('${uuid(612)}','${a.archivedSite}','${r.archived}',false),
      ('${uuid(613)}','${a.lapsedSite}','${r.lapsed}',false);
  `)
  db(migration('20261113160000_instance_ownership_rls.sql'))
  // The deployed helper additionally grants service_role execution. Match that
  // catalog ACL without changing the applied historical migration.
  db(`ALTER FUNCTION public.instance_row_access(uuid,uuid,uuid) OWNER TO postgres;
    SET ROLE postgres;
    GRANT EXECUTE ON FUNCTION public.instance_row_access(uuid,uuid,uuid) TO service_role;
    RESET ROLE;`)
}