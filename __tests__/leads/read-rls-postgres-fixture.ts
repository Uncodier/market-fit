import { ids, installSiteFixture, migration, uuid } from '../security/isolated-postgres'

export const leadActors = { ...ids, assigned: uuid(17), legacy: uuid(18), locationRestricted: uuid(19),
  disabled: uuid(22), pending: uuid(23), unlicensed: uuid(24), archivedSite: uuid(3),
  archivedOwner: uuid(25), lapsedSite: uuid(4), lapsedOwner: uuid(26), lapsedMember: uuid(27) }

function installFunction(db: (sql: string) => string, file: string, name: string) {
  const source = migration(file).match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]+?\\$\\$;`))?.[0]
  if (!source) throw new Error(`Missing fixture function: ${name}`)
  db(source)
}

export function installLeadReadFixture(db: (sql: string) => string) {
  const a = leadActors
  installSiteFixture(db)
  db(`
    ALTER TABLE public.site_ownership ADD PRIMARY KEY (site_id);
    ALTER TABLE public.site_members ADD COLUMN id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      ADD COLUMN manually_disabled boolean NOT NULL DEFAULT false,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT '2026-10-01',
      ADD UNIQUE (site_id, user_id);
    CREATE TABLE public.billing (site_id uuid PRIMARY KEY, status text, plan text,
      stripe_subscription_id text, paid_subscription_invoice_id text, paid_subscription_period_start timestamptz,
      paid_subscription_period_end timestamptz, subscription_status text, trial_started_at timestamptz,
      trial_ends_at timestamptz);
    CREATE TABLE public.site_startup_trials (site_id uuid PRIMARY KEY, started_at timestamptz,
      ends_at timestamptz, converted_at timestamptz);
    CREATE TABLE public.site_member_location_restrictions (site_id uuid, site_member_id uuid);
    CREATE TABLE public.companies (id uuid PRIMARY KEY, name text);
    CREATE TABLE public.leads (id uuid PRIMARY KEY, site_id uuid REFERENCES public.sites,
      user_id uuid, assignee_id uuid, company_id uuid REFERENCES public.companies, segment_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL DEFAULT 'Synthetic lead');
    CREATE INDEX idx_leads_site_id ON public.leads(site_id);
    CREATE INDEX idx_leads_site_created_at ON public.leads(site_id, created_at DESC);
    CREATE INDEX idx_leads_site_segment ON public.leads(site_id, segment_id) WHERE segment_id IS NOT NULL;
    INSERT INTO public.sites VALUES ('${a.archivedSite}', '${a.archivedOwner}', now()),
      ('${a.lapsedSite}', '${a.lapsedOwner}', NULL);
    INSERT INTO public.billing(site_id,status,plan) VALUES ('${a.site}','active','enterprise'),
      ('${a.lapsedSite}','active','engine');
    UPDATE public.billing SET stripe_subscription_id='fixture-subscription',
      paid_subscription_invoice_id='fixture-invoice', paid_subscription_period_start=now()-interval '1 hour',
      paid_subscription_period_end=now()-interval '1 minute' WHERE site_id='${a.lapsedSite}';
    INSERT INTO public.site_members(site_id,user_id,role,status,manually_disabled,created_at) VALUES
      ('${a.site}','${a.coOwner}','collaborator','active',false,'2026-10-02'),
      ('${a.site}','${a.assigned}','collaborator','active',false,'2026-10-03'),
      ('${a.site}','${a.legacy}','marketing','active',false,'2026-10-04'),
      ('${a.site}','${a.locationRestricted}','collaborator','active',false,'2026-10-05'),
      ('${a.otherSite}','${a.locationRestricted}','collaborator','active',false,'2026-10-05'),
      ('${a.site}','${a.disabled}','admin','active',true,'2026-10-06'),
      ('${a.site}','${a.pending}','collaborator','pending',false,'2026-10-07'),
      ('${a.otherSite}','${a.unlicensed}','collaborator','active',false,'2026-10-08'),
      ('${a.lapsedSite}','${a.lapsedMember}','collaborator','active',false,'2026-10-09');
    INSERT INTO public.site_member_location_restrictions
      SELECT site_id,id FROM public.site_members WHERE site_id='${a.otherSite}' AND user_id='${a.locationRestricted}';
    INSERT INTO public.companies VALUES ('${uuid(300)}','Synthetic company');
    INSERT INTO public.leads(id,site_id,user_id,assignee_id,company_id,segment_id) VALUES
      ('${uuid(100)}','${a.site}','${a.owner}','${a.assigned}','${uuid(300)}','${uuid(400)}'),
      ('${uuid(101)}','${a.site}','${a.assigned}',NULL,NULL,'${uuid(401)}'),
      ('${uuid(102)}','${a.site}','${a.legacy}',NULL,NULL,'${uuid(400)}'),
      ('${uuid(103)}','${a.site}','${a.owner}',NULL,NULL,NULL),
      ('${uuid(104)}','${a.otherSite}','${a.assigned}','${a.assigned}',NULL,NULL),
      ('${uuid(105)}','${a.archivedSite}','${a.archivedOwner}',NULL,NULL,NULL),
      ('${uuid(106)}',NULL,'${a.assigned}','${a.assigned}',NULL,NULL),
      ('${uuid(107)}','${a.lapsedSite}','${a.lapsedOwner}','${a.lapsedMember}',NULL,NULL);
  `)
  installFunction(db, '20261019220000_startup_trial_schema.sql', 'effective_site_plan')
  for (const name of ['site_member_has_effective_license', 'current_user_site_role']) {
    installFunction(db, '20261019220003_startup_trial_licensing.sql', name)
  }
  installFunction(db, '20261020030000_location_enforcement_scope.sql', 'current_user_has_location_restrictions')
  const historical = migration('20260820000000_team_member_restrict_assigned.sql')
  db(historical.slice(0, historical.indexOf('-- Create helper function for deals')))
  // The parent SELECT policies below mirror the deployed policy chain. In particular,
  // a co-owner still needs a visible (active, licensed) sites row.
  db(`
    UPDATE public.site_members SET restrict_to_assigned_only=true WHERE user_id IN ('${a.assigned}','${a.coOwner}');
    UPDATE public.site_members SET restrict_to_assigned_only=NULL WHERE user_id='${a.legacy}';
    GRANT SELECT ON public.companies TO anon, authenticated, service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.leads TO anon, authenticated, service_role;
    ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.site_ownership ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
    CREATE POLICY sites_active_only ON public.sites AS RESTRICTIVE TO anon, authenticated
      USING (archived_at IS NULL) WITH CHECK (archived_at IS NULL);
    CREATE POLICY license_sites_access ON public.sites AS RESTRICTIVE TO authenticated
      USING (user_id=(SELECT auth.uid()) OR public.current_user_site_role(id) IS NOT NULL);
    CREATE POLICY sites_select_policy ON public.sites FOR SELECT TO authenticated USING (
      user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id=sites.id AND sm.user_id=(SELECT auth.uid()) AND sm.status='active'));
    CREATE POLICY site_members_final_policy ON public.site_members TO authenticated USING (
      user_id=(SELECT auth.uid()) OR site_id IN (SELECT so.site_id FROM public.site_ownership so
        WHERE so.user_id=(SELECT auth.uid())));
    CREATE POLICY license_members_access ON public.site_members AS RESTRICTIVE TO authenticated
      USING (public.current_user_site_role(site_id) IS NOT NULL);
    CREATE POLICY ownership_select ON public.site_ownership FOR SELECT TO authenticated USING (true);
    CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
    ${['leads', 'companies'].map(table => `CREATE POLICY location_acl_enforcement ON public.${table}
      AS RESTRICTIVE TO authenticated USING (NOT (SELECT public.current_user_has_location_restrictions()))
      WITH CHECK (NOT (SELECT public.current_user_has_location_restrictions()));`).join('\n')}
    ${['leads', 'companies', 'site_members', 'site_ownership'].map(table => `CREATE POLICY location_acl_private_anon
      ON public.${table} AS RESTRICTIVE TO anon USING (false) WITH CHECK (false);`).join('\n')}
  `)
}

export function seedLeadReadScale(db: (sql: string) => string) {
  db(`INSERT INTO public.sites (id,user_id) SELECT md5('site-'||i)::uuid, '${ids.foreign}' FROM generate_series(1,56) g(i);
    INSERT INTO public.leads (id,site_id,user_id,company_id,created_at)
    SELECT md5('lead-'||i)::uuid,
      CASE WHEN i<=6092 THEN '${ids.site}'::uuid ELSE md5('site-'||(1+i%56))::uuid END,
      '${ids.owner}', '${uuid(300)}', now()-i*interval '1 second' FROM generate_series(1,29817) g(i);
    ANALYZE public.leads; ANALYZE public.sites; ANALYZE public.site_members; ANALYZE public.site_ownership;`)
}