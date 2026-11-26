import { migration, uuid } from './isolated-postgres'
import { installLeadReadFixture, leadActors as a } from '../leads/read-rls-postgres-fixture'

export const screenTables = ['content', 'requirements', 'segments', 'deals', 'deal_owners'] as const
export const screenActors = [a.owner, a.coOwner, a.admin, a.collaborator, a.marketing, a.assigned,
  a.legacy, a.inactive, a.disabled, a.pending, a.unlicensed, a.foreign, a.locationRestricted,
  a.archivedOwner, a.lapsedOwner, a.lapsedMember]

export function installRemainingScreens(db: (sql: string) => string) {
  db('DROP SCHEMA IF EXISTS app_auth CASCADE')
  installLeadReadFixture(db)
  db(`CREATE SCHEMA app_auth;
    GRANT USAGE ON SCHEMA app_auth TO authenticated,anon,service_role;
    -- Exact catalog definition inspected read-only on 2026-11-26.
    CREATE FUNCTION app_auth.is_service_role_or_user_condition(user_condition boolean)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
      SELECT CASE
        WHEN (SELECT current_setting('role',true))='service_role' THEN true
        WHEN (SELECT (auth.jwt()->>'role'))='service_role' THEN true
        ELSE COALESCE(user_condition,false) END;
    $$;
    CREATE TABLE public.content(id uuid PRIMARY KEY,site_id uuid,user_id uuid,author_id uuid);
    CREATE TABLE public.requirements(id uuid PRIMARY KEY,site_id uuid,user_id uuid);
    CREATE TABLE public.segments(id uuid PRIMARY KEY,site_id uuid,user_id uuid);
    CREATE TABLE public.deals(id uuid PRIMARY KEY,site_id uuid,user_id uuid,location_id uuid);
    CREATE TABLE public.deal_owners(id uuid PRIMARY KEY,deal_id uuid,user_id uuid);
    CREATE INDEX ON public.deal_owners(deal_id,user_id);
    CREATE TABLE public.locations(id uuid PRIMARY KEY,site_id uuid);
    ALTER TABLE public.site_member_location_restrictions ADD COLUMN location_id uuid;
    INSERT INTO public.locations VALUES ('${uuid(900)}','${a.site}'),('${uuid(901)}','${a.site}');
    INSERT INTO public.site_member_location_restrictions(site_id,site_member_id,location_id)
      SELECT site_id,id,'${uuid(901)}' FROM public.site_members
      WHERE site_id='${a.site}' AND user_id='${a.locationRestricted}';`)
  const location = migration('20261020020000_location_access_foundation.sql')
  db(location.slice(location.indexOf('CREATE FUNCTION public.user_can_access_location('),
    location.indexOf('CREATE FUNCTION public.replace_site_member_location_restrictions(')))
  const helpers = migration('20261020030004_location_enforcement_writers.sql')
  db(helpers.slice(helpers.indexOf('CREATE OR REPLACE FUNCTION public.is_deal_owner('), helpers.lastIndexOf('COMMIT;')))
  const old = migration('20260820000000_team_member_restrict_assigned.sql')
  db(old.slice(old.indexOf('-- Content'), old.indexOf('-- Campaigns')))
  db(old.slice(old.indexOf('-- Segments'), old.indexOf('-- Audiences')))
  db(old.slice(old.indexOf('-- Requirements')))
  // Deployed Deals adds the direct creator branch to the historical definition.
  db(old.slice(old.indexOf('-- Deals'), old.indexOf('-- Sale Orders'))
    .replace('OR public.is_deal_owner', 'OR deals.user_id = auth.uid() OR public.is_deal_owner'))
  // Exact deployed predicate; deliberately not inferred from deals visibility.
  db(`CREATE POLICY deal_owners_unified ON public.deal_owners FOR ALL USING (
    EXISTS (SELECT 1 FROM deals d WHERE d.id=deal_owners.deal_id AND (
      current_setting('role',true)='service_role' OR auth.jwt()->>'role'='service_role'
      OR EXISTS (SELECT 1 FROM sites s WHERE s.id=d.site_id AND (
        s.user_id=auth.uid() OR EXISTS (SELECT 1 FROM site_members sm
          WHERE sm.site_id=s.id AND sm.user_id=auth.uid()))))));`)
  for (const table of screenTables) {
    db(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON public.${table} TO authenticated,anon,service_role;
      CREATE POLICY anonymous_guard ON public.${table} AS RESTRICTIVE TO anon USING(false);`)
    if (table !== 'deals' && table !== 'deal_owners') {
      db(`CREATE POLICY location_guard ON public.${table} AS RESTRICTIVE TO authenticated
        USING (NOT (SELECT public.current_user_has_location_restrictions()));`)
    }
  }
  db(`CREATE POLICY location_guard ON public.deals AS RESTRICTIVE TO authenticated USING (
      NOT (SELECT public.current_user_has_location_restrictions())
      OR public.user_can_access_location(site_id,location_id));
    CREATE POLICY location_guard ON public.deal_owners AS RESTRICTIVE TO authenticated USING (
      NOT (SELECT public.current_user_has_location_restrictions())
      OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id=deal_id));`)
  const rows = [
    [500, a.site, a.owner], [501, a.site, a.assigned], [502, a.site, a.legacy],
    [503, a.otherSite, a.assigned], [504, a.archivedSite, a.archivedOwner],
    [505, a.lapsedSite, a.lapsedMember], [506, null, a.assigned], [507, a.site, null],
    [508, a.site, a.owner], [509, a.site, a.owner], [510, null, null],
  ] as const
  for (const table of screenTables.filter(t => t !== 'deal_owners')) {
    db(`CREATE INDEX ON public.${table}(site_id);
      INSERT INTO public.${table}(id,site_id,user_id) VALUES ${rows.map(([id, site, user]) =>
        `('${uuid(id)}',${site ? `'${site}'` : 'NULL'},${user ? `'${user}'` : 'NULL'})`).join(',')};`)
  }
  db(`UPDATE public.content SET author_id='${a.assigned}' WHERE id IN ('${uuid(500)}','${uuid(503)}');
    UPDATE public.deals SET location_id='${uuid(900)}' WHERE id='${uuid(508)}';
    UPDATE public.deals SET location_id='${uuid(901)}' WHERE id='${uuid(509)}';
    INSERT INTO public.deal_owners SELECT id,id,'${a.assigned}' FROM public.deals;
    INSERT INTO public.deal_owners VALUES
      ('${uuid(800)}','${uuid(508)}','${a.locationRestricted}'),
      ('${uuid(801)}','${uuid(509)}','${a.locationRestricted}'),
      ('${uuid(802)}',NULL,'${a.assigned}'),
      ('${uuid(803)}','${uuid(999)}','${a.assigned}');`)
}