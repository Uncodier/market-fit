import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const pgBin = process.env.RECORD_TRASH_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
export const available = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const env = { ...process.env, LC_ALL: "C", LANG: "C" }
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
export const migrations = ["20261111032100_records_trash_storage.sql", "20261111032200_records_trash_rpc.sql",
  "20261111032300_records_trash_embeddings.sql"].map(file => readFileSync(path.join(process.cwd(), "supabase/migrations", file), "utf8"))

export function localDatabase() {
  let directory = ""
  const args = () => ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory,
    "-p", "55448", "-U", "postgres", "-d", "postgres"]
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), args(), {
    input: sql, encoding: "utf8", stdio: "pipe", timeout: 20000, env,
  }).trim()
  const actorSql = (sql: string, who = 1, role = "authenticated") =>
    `SET ROLE ${role}; SET request.jwt.claim.sub = '${id(who)}'; ${sql}`
  return {
    db,
    actor: (sql: string, who = 1, role = "authenticated") => db(actorSql(sql, who, role)),
    concurrent(sql: string, who = 1) {
      const child = spawn(path.join(pgBin, "psql"), args(), { env, stdio: "pipe" })
      let output = ""
      child.stdout.on("data", chunk => { output += chunk.toString() })
      child.stderr.on("data", chunk => { output += chunk.toString() })
      child.stdin.end(actorSql(sql, who))
      return new Promise<{ code: number | null; output: string }>(resolve => {
        child.on("exit", code => resolve({ code, output }))
      })
    },
    start() {
      // No configured URLs; this disposable cluster listens ONLY on its private Unix socket.
      directory = mkdtempSync("/tmp/records-trash-pg-")
      execFileSync(path.join(pgBin, "initdb"), ["-D", `${directory}/data`, "-U", "postgres",
        "-A", "trust", "--no-locale"], { env, stdio: "pipe", timeout: 20000 })
      execFileSync(path.join(pgBin, "pg_ctl"), ["-D", `${directory}/data`, "-l", `${directory}/server.log`,
        "-o", `-F -p 55448 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start"],
      { env, stdio: "pipe", timeout: 20000 })
      db("CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;")
    },
    stop() {
      if (!directory) return
      if (existsSync(`${directory}/data/postmaster.pid`)) execFileSync(path.join(pgBin, "pg_ctl"),
        ["-D", `${directory}/data`, "-m", "fast", "-w", "stop"], { env, stdio: "pipe", timeout: 20000 })
      rmSync(directory, { recursive: true, force: true })
    },
    reset() {
      db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
        CREATE SCHEMA public; CREATE SCHEMA auth;
        GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        CREATE TABLE actors (user_id uuid, site_id uuid, role text, active boolean DEFAULT true,
          restricted boolean DEFAULT false, can_delete boolean DEFAULT true, can_update boolean DEFAULT true);
        INSERT INTO actors VALUES
          ('${id(1)}','${id(10)}','owner',true,false,true,true),
          ('${id(2)}','${id(10)}','admin',true,false,true,true),
          ('${id(3)}','${id(10)}','collaborator',true,false,true,true),
          ('${id(4)}','${id(10)}','admin',false,false,true,true),
          ('${id(5)}','${id(11)}','owner',true,false,true,true),
          ('${id(6)}','${id(10)}','admin',true,true,true,true),
          ('${id(7)}','${id(10)}','admin',true,false,false,false);
        CREATE FUNCTION current_user_site_role(s uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
          SELECT role FROM actors WHERE site_id=s AND user_id=auth.uid() AND active $$;
        CREATE FUNCTION current_user_has_site_location_restrictions(s uuid) RETURNS boolean
          LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT COALESCE((SELECT restricted FROM actors
            WHERE site_id=s AND user_id=auth.uid() AND active),true) $$;
        CREATE FUNCTION user_can(s uuid, action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
          SELECT COALESCE((SELECT CASE action WHEN 'delete' THEN can_delete WHEN 'update' THEN can_update ELSE true END
            FROM actors WHERE site_id=s AND user_id=auth.uid() AND active), false) $$;
        CREATE TABLE record_categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL,
          name text, description text, icon text, parent_category_id uuid REFERENCES record_categories,
          template_fields jsonb DEFAULT '[]');
        CREATE TABLE records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL,
          category_id uuid REFERENCES record_categories ON DELETE CASCADE, title text, description text,
          data jsonb DEFAULT '{}', relations jsonb DEFAULT '{}', status text, location_id uuid,
          assigned_to uuid, record_embedding_revision bigint DEFAULT 0);
        CREATE TABLE record_diagrams (record_id uuid REFERENCES records ON DELETE CASCADE, content jsonb);
        CREATE TABLE record_diagram_nodes (record_id uuid REFERENCES records ON DELETE CASCADE, content jsonb);
        CREATE TABLE record_diagram_edges (record_id uuid REFERENCES records ON DELETE CASCADE, content jsonb);
        CREATE TABLE record_embedding_jobs (id uuid DEFAULT gen_random_uuid(), record_id uuid REFERENCES records,
          site_id uuid, status text, completed_at timestamptz, updated_at timestamptz, last_error text);
        CREATE FUNCTION match_records_vector(uuid,double precision,integer) RETURNS SETOF uuid
          LANGUAGE sql SECURITY INVOKER AS $$ SELECT id FROM records $$;
        CREATE FUNCTION get_records_similarity_edges(uuid,double precision,integer) RETURNS SETOF uuid
          LANGUAGE sql SECURITY INVOKER AS $$ SELECT id FROM records $$;
        ALTER TABLE records ENABLE ROW LEVEL SECURITY;
        ALTER TABLE record_categories ENABLE ROW LEVEL SECURITY;
        ALTER TABLE record_diagrams ENABLE ROW LEVEL SECURITY;
        CREATE FUNCTION can_access_record_diagram(r uuid, s uuid, action text) RETURNS boolean
          LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT user_can(s,action)
            AND EXISTS (SELECT 1 FROM records WHERE id=r AND site_id=s) $$;
        CREATE POLICY diagram_select ON record_diagrams FOR SELECT TO authenticated USING
          (EXISTS (SELECT 1 FROM records r WHERE r.id=record_id
            AND can_access_record_diagram(r.id,r.site_id,'select')));
        GRANT SELECT ON record_diagrams TO authenticated;
        CREATE POLICY records_select ON records FOR SELECT TO authenticated USING (user_can(site_id,'select')
          AND (current_user_site_role(site_id) IN ('owner','admin') OR assigned_to=auth.uid()));
        CREATE POLICY records_delete ON records FOR DELETE TO authenticated USING (user_can(site_id,'delete')
          AND (current_user_site_role(site_id) IN ('owner','admin') OR assigned_to=auth.uid()));
        CREATE POLICY records_update ON records FOR UPDATE TO authenticated USING (user_can(site_id,'update'));
        CREATE POLICY records_insert ON records FOR INSERT TO authenticated WITH CHECK (user_can(site_id,'insert'));
        CREATE POLICY categories_all ON record_categories TO authenticated USING (user_can(site_id,'select'));
        CREATE POLICY location_guard ON records AS RESTRICTIVE TO authenticated
          USING (NOT current_user_has_site_location_restrictions(site_id));
        GRANT ALL ON records,record_categories TO authenticated;
        INSERT INTO record_categories (id,site_id,name,parent_category_id) VALUES
          ('${id(20)}','${id(10)}','Root',NULL), ('${id(21)}','${id(10)}','Child','${id(20)}'),
          ('${id(22)}','${id(10)}','Grandchild','${id(21)}'), ('${id(23)}','${id(11)}','Other',NULL);
        INSERT INTO records(id,site_id,category_id,title,assigned_to) VALUES
          ('${id(30)}','${id(10)}','${id(20)}','Assigned','${id(3)}'),
          ('${id(31)}','${id(10)}','${id(21)}','Hidden','${id(1)}'),
          ('${id(32)}','${id(10)}','${id(22)}','Deep','${id(1)}');
        INSERT INTO record_diagrams VALUES ('${id(30)}','{"nodes":["retained"]}');
        INSERT INTO record_embedding_jobs(record_id,site_id,status) VALUES ('${id(30)}','${id(10)}','pending');`)
      migrations.forEach(db)
    },
  }
}