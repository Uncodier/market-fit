import { readFileSync } from 'node:fs'
import path from 'node:path'

/** Install the actual location predicate alongside the minimal billing fixture. */
export function installBillingLocationPredicate(pg: { db: (sql: string) => string }) {
  const source = readFileSync(path.resolve(__dirname,
    '../../supabase/migrations/20261021010004_location_records_insert_and_readiness.sql'), 'utf8')
  const start = source.indexOf('CREATE OR REPLACE FUNCTION public.current_user_has_site_location_restrictions(')
  const end = source.indexOf('$$;', start)
  if (start === -1 || end === -1) throw new Error('Missing location predicate prerequisite')
  pg.db(`CREATE TABLE public.site_member_location_restrictions(site_id uuid NOT NULL,site_member_id uuid NOT NULL);
    ${source.slice(start, end + 3)}`)
}