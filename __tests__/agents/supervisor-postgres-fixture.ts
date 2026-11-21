import { ids, installSiteFixture, migration, uuid } from '../security/isolated-postgres'

export const guardMigration = migration('20261120233000_agent_supervisor_integrity.sql')
export const site = ids.site, other = ids.otherSite
export const agent = (n: number) => `'${uuid(n)}'::uuid`
export const assign = (child: number, parent: number | null) =>
  `UPDATE public.agents SET supervisor=${parent === null ? 'NULL' : agent(parent)} WHERE id=${agent(child)}`
export const insert = (id: number, parent: number | null = null, tenant = site) =>
  `INSERT INTO public.agents(id, site_id, supervisor) VALUES (${agent(id)}, '${tenant}', ${parent === null ? 'NULL' : agent(parent)})`
export const verbose = (sql: string) => `\\set VERBOSITY verbose\n${sql}`

export function installAgents(db: (sql: string) => string) {
  installSiteFixture(db)
  // Canonical 070/088/101 bootstrap columns, FK actions and index. Exercise
  // actual PostgreSQL RLS with a deliberately *narrower* same-site reader.
  db(`CREATE TABLE public.agents(
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, site_id uuid NOT NULL REFERENCES public.sites ON DELETE CASCADE,
      supervisor uuid CONSTRAINT agents_supervisor_fkey REFERENCES public.agents(id),
      user_id uuid NOT NULL DEFAULT '${ids.owner}', name text NOT NULL DEFAULT 'Fixture',
      role text, configuration jsonb NOT NULL DEFAULT '{}');
    CREATE INDEX idx_agents_supervisor ON public.agents(supervisor);
    ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY local_agent ON public.agents TO authenticated
      USING (site_id='${site}' AND user_id=auth.uid()) WITH CHECK (site_id='${site}' AND user_id=auth.uid());
    ALTER SCHEMA public OWNER TO postgres;
    ALTER TABLE public.sites OWNER TO postgres;
    ALTER TABLE public.agents OWNER TO postgres;
    GRANT CREATE ON DATABASE postgres TO postgres;
    GRANT SELECT, INSERT, UPDATE ON public.agents TO authenticated;
    -- Supabase can have explicit defaults in addition to PostgreSQL's PUBLIC EXECUTE.
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
}