import { readFileSync } from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { ids, uuid } from "./movements-postgres"
import { receivers, receivingBootstrap } from "./receiving-responsibility-postgres"

export const transferSql = (name: string) => readFileSync(path.join(process.cwd(), "supabase/migrations", name), "utf8")
export const ordersMigration = transferSql("20261113210000_inventory_transfer_orders.sql")
export const projectionMigration = transferSql("20261113210100_inventory_transfer_legacy_projection.sql")
export const partialMigration = transferSql("20261113210150_inventory_transfer_partial_dispatch.sql")
export const stockMigration = transferSql("20261113210300_inventory_transfer_stock_events.sql")
export const admin = uuid(220)
export const transferBootstrap = `${receivingBootstrap}
  INSERT INTO public.site_members(id,site_id,user_id,role,status,name) VALUES
    ('${uuid(221)}','${ids.site}','${admin}','admin','active','Administrator');
  CREATE OR REPLACE FUNCTION public.user_can(site uuid, command text) RETURNS boolean
    LANGUAGE sql STABLE AS $$ SELECT
      (site='${ids.site}' AND (auth.uid() IN ('${ids.owner}','${ids.restricted}','${receivers.member}','${admin}')
        OR (auth.uid()='${ids.viewer}' AND command='select')))
      OR (site='${ids.otherSite}' AND auth.uid()='${ids.foreign}'); $$;
`
export const transferInput = (overrides = {}) => ({
  items: [{ catalogItemId: ids.product, quantity: 6 }], fromLocationId: ids.source,
  toLocationId: ids.target, receivingUserId: receivers.member, status: "requested", ...overrides,
})
export const jsonSql = (input: unknown) => `'${JSON.stringify(input).replace(/'/g, "''")}'::jsonb`
export const createSql = (input: unknown, request = uuid(300), site = ids.site) =>
  `SELECT public.create_inventory_transfer_order('${site}','${request}',${jsonSql(input)});`
export const transitionSql = (order: string, input: unknown, request = uuid(301), site = ids.site) =>
  `SELECT public.transition_inventory_transfer_order('${site}','${order}','${request}',${jsonSql(input)});`

// Only connect to the freshly created socket path obtained from this suite's cluster.
export const concurrentSql = async (socket: string, sql: string) => {
  if (!socket.startsWith("/tmp/requirement-pg-")) throw new Error("Disposable socket required")
  const binary = path.join(process.env.REQUIREMENT_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin", "psql")
  const { stdout } = await promisify(execFile)(binary, [
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", socket,
    "-p", "55443", "-U", "postgres", "-d", "postgres", "-c", sql,
  ], { timeout: 20000, env: { ...process.env, LC_ALL: "C", LANG: "C" } })
  return stdout.trim()
}